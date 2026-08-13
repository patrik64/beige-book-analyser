import { repo } from 'remult';
import { Release, Section } from '$lib/shared/entities';
import { DISTRICT_NAMES, districtOrder } from '$lib/shared/districts';
import { topicOrder } from '$lib/shared/topics';
import { PACE_BUCKETS } from '$lib/shared/paceWords';
import { sentimentLabel, type TermHit } from '$lib/shared/sentiment-types';
import { db } from './db';

/**
 * Plain objects for the client, and SQL for the aggregates.
 *
 * Load functions deliberately return DTOs rather than Remult entity instances:
 * SvelteKit can't serialize non-POJOs out of a server `load`, and the pages want
 * aggregates anyway.
 *
 * Aggregates run as SQL GROUP BY rather than in JavaScript. With ten years ingested
 * there are ~10,000 sections carrying ~1.5M words of body text between them, so
 * pulling them all into memory to compute an average — which is what this module used
 * to do when it only held 2026 — costs far more than the answer is worth.
 */

export interface ReleaseDTO {
	id: number;
	slug: string;
	label: string;
	shortLabel: string;
	releaseDate: string;
	year: number;
	seq: number;
	format: string;
	preparedBy: string;
	dataCutoff: string;
	pdfUrl: string;
	summaryUrl: string;
	sectionCount: number;
	fetchedAt: string;
}

export interface SectionDTO {
	id: number;
	releaseId: number;
	scope: string;
	district: string;
	heading: string;
	topic: string;
	body: string;
	wordCount: number;
	sentimentScore: number;
	sentimentLabel: string;
	termHits: TermHit[];
	paceWords: Record<string, number>;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toReleaseDTO(r: Release): ReleaseDTO {
	const month = r.releaseDate.getUTCMonth();
	return {
		id: r.id,
		slug: r.slug,
		label: r.label,
		// Axis labels have to stay short once eighty releases share one chart.
		shortLabel: `${MONTH_ABBR[month]} ${String(r.year).slice(2)}`,
		releaseDate: r.releaseDate.toISOString().slice(0, 10),
		year: r.year,
		seq: r.seq,
		format: r.format,
		preparedBy: r.preparedBy,
		dataCutoff: r.dataCutoff,
		pdfUrl: r.pdfUrl,
		summaryUrl: r.summaryUrl,
		sectionCount: r.sectionCount,
		fetchedAt: r.fetchedAt.toISOString()
	};
}

function toSectionDTO(s: Section): SectionDTO {
	return {
		id: s.id,
		releaseId: s.releaseId,
		scope: s.scope,
		district: s.district,
		heading: s.heading,
		topic: s.topic,
		body: s.body,
		wordCount: s.wordCount,
		sentimentScore: s.sentimentScore,
		sentimentLabel: s.sentimentLabel,
		termHits: s.termHits ?? [],
		paceWords: s.paceWords ?? {}
	};
}

/** Run a read-only aggregate. Values are inlined via the driver's own parameters. */
async function sql<T = Record<string, unknown>>(
	build: (param: (v: unknown) => string) => string
): Promise<T[]> {
	const command = db().createCommand();
	const text = build((v) => command.param(v));
	const result = await command.execute(text);
	return result.rows as T[];
}

export async function listReleases(year?: number): Promise<ReleaseDTO[]> {
	const rows = await repo(Release).find({
		where: year ? { year } : {},
		orderBy: { releaseDate: 'asc' },
		limit: 500
	});
	return rows.map(toReleaseDTO);
}

export async function listYears(): Promise<number[]> {
	const rows = await sql<{ year: number }>(() => `select distinct year from releases order by year`);
	return rows.map((r) => Number(r.year));
}

export async function findRelease(slug: string): Promise<ReleaseDTO | undefined> {
	const row = await repo(Release).findFirst({ slug });
	return row ? toReleaseDTO(row) : undefined;
}

/** Index of each release id, so aggregate rows can be slotted into a dense series. */
function indexById(releases: ReleaseDTO[]): Map<number, number> {
	return new Map(releases.map((r, i) => [r.id, i]));
}

/**
 * A district's reading for a release.
 *
 * From 2017 the Fed writes a one-paragraph highlight per district, which is the best
 * single summary available and what the heatmap was built on. Earlier editions have
 * no such section, so the district's own report is averaged instead — otherwise
 * everything before 2017 would render as an empty grid. `avg` skips NULLs, so the
 * COALESCE picks the highlight whenever one exists and falls back silently when it
 * doesn't.
 */
const DISTRICT_TONE = `
	coalesce(
		avg(case when scope = 'highlight' then sentimentScore end),
		avg(case when scope = 'district'  then sentimentScore end)
	)`;

/** The three National Summary parts, per release — the headline trend. */
export interface NationalTrend {
	releases: ReleaseDTO[];
	topics: string[];
	/** series[topicIndex][releaseIndex] */
	series: (number | null)[][];
}

export async function nationalTrend(year?: number): Promise<NationalTrend> {
	const releases = await listReleases(year);
	const slot = indexById(releases);
	const topics = ['Overall Economic Activity', 'Labor Markets', 'Prices'];

	const rows = await sql<{ releaseId: number; topic: string; score: number }>(
		(p) => `
			select releaseId, topic, avg(sentimentScore) as score
			from sections
			where scope = ${p('national')}
			group by releaseId, topic`
	);

	const series = topics.map(() => releases.map(() => null as number | null));
	for (const row of rows) {
		const t = topics.indexOf(row.topic);
		const i = slot.get(Number(row.releaseId));
		if (t !== -1 && i !== undefined) series[t][i] = Number(row.score);
	}

	return { releases, topics, series };
}

/** District x release grid, built from the twelve highlight blurbs on each summary. */
export interface DistrictMatrix {
	releases: ReleaseDTO[];
	districts: string[];
	/** cells[districtIndex][releaseIndex] */
	cells: (number | null)[][];
}

export async function districtMatrix(year?: number): Promise<DistrictMatrix> {
	const releases = await listReleases(year);
	const slot = indexById(releases);

	const rows = await sql<{ releaseId: number; district: string; score: number | null }>(
		() => `
			select releaseId, district, ${DISTRICT_TONE} as score
			from sections
			where scope in ('highlight', 'district') and district <> ''
			group by releaseId, district`
	);

	const cells = DISTRICT_NAMES.map(() => releases.map(() => null as number | null));
	for (const row of rows) {
		const d = DISTRICT_NAMES.indexOf(row.district);
		const i = slot.get(Number(row.releaseId));
		if (d !== -1 && i !== undefined && row.score !== null) cells[d][i] = Number(row.score);
	}

	return { releases, districts: [...DISTRICT_NAMES], cells };
}

/**
 * Pace-word usage per release, folded into five ordered intensity buckets.
 *
 * "declined" is excluded on purpose: it encodes direction, not pace, so mixing it in
 * would break the ordering the colour ramp depends on. The counts live in a JSON
 * column, so this one aggregate is still assembled in JS — but it reads only that
 * column, never the body text.
 */
const BUCKET_OF: Record<string, (typeof PACE_BUCKETS)[number]> = {
	flat: 'flat',
	slight: 'slight',
	modest: 'modest',
	moderate: 'moderate',
	solid: 'strong',
	strong: 'strong',
	significant: 'strong',
	sharp: 'strong',
	robust: 'strong'
};

export interface PaceTrend {
	releases: ReleaseDTO[];
	buckets: string[];
	/** counts[bucketIndex][releaseIndex] */
	counts: number[][];
	/** The same data as a share of that release's total, for the 100% stacked view. */
	shares: number[][];
}

export async function paceTrend(year?: number): Promise<PaceTrend> {
	const releases = await listReleases(year);
	const slot = indexById(releases);

	const rows = await sql<{ releaseId: number; paceWords: string }>(
		(p) => `select releaseId, paceWords from sections where scope = ${p('district')}`
	);

	const counts = PACE_BUCKETS.map(() => releases.map(() => 0));

	for (const row of rows) {
		const i = slot.get(Number(row.releaseId));
		if (i === undefined || !row.paceWords) continue;

		let parsed: Record<string, number>;
		try {
			parsed = typeof row.paceWords === 'string' ? JSON.parse(row.paceWords) : row.paceWords;
		} catch {
			continue;
		}

		for (const [stem, n] of Object.entries(parsed)) {
			const bucket = BUCKET_OF[stem];
			if (bucket) counts[PACE_BUCKETS.indexOf(bucket)][i] += n;
		}
	}

	const totals = releases.map((_, i) => counts.reduce((sum, row) => sum + row[i], 0));
	const shares = counts.map((row) => row.map((n, i) => (totals[i] ? (n / totals[i]) * 100 : 0)));

	return { releases, buckets: [...PACE_BUCKETS], counts, shares };
}

/** Topic x district matrix plus per-topic trend. */
export interface TopicBreakdown {
	releases: ReleaseDTO[];
	topics: string[];
	districts: string[];
	/** cells[topicIndex][districtIndex] — averaged across the selected releases. */
	cells: (number | null)[][];
	/** trend[topicIndex][releaseIndex] — averaged across districts. */
	trend: (number | null)[][];
}

export async function topicBreakdown(year?: number): Promise<TopicBreakdown> {
	const releases = await listReleases(year);
	const slot = indexById(releases);
	const ids = releases.map((r) => r.id);
	if (ids.length === 0) {
		return { releases, topics: [], districts: [...DISTRICT_NAMES], cells: [], trend: [] };
	}
	const idList = ids.join(',');

	const byDistrict = await sql<{ topic: string; district: string; score: number }>(
		(p) => `
			select topic, district, avg(sentimentScore) as score
			from sections
			where scope = ${p('district')} and releaseId in (${idList})
			group by topic, district`
	);

	const byRelease = await sql<{ topic: string; releaseId: number; score: number }>(
		(p) => `
			select topic, releaseId, avg(sentimentScore) as score
			from sections
			where scope = ${p('district')} and releaseId in (${idList})
			group by topic, releaseId`
	);

	const topics = [...new Set(byDistrict.map((r) => r.topic))].sort(
		(a, b) => topicOrder(a) - topicOrder(b)
	);

	const cells = topics.map(() => DISTRICT_NAMES.map(() => null as number | null));
	for (const row of byDistrict) {
		const t = topics.indexOf(row.topic);
		const d = DISTRICT_NAMES.indexOf(row.district);
		if (t !== -1 && d !== -1) cells[t][d] = Number(Number(row.score).toFixed(4));
	}

	const trend = topics.map(() => releases.map(() => null as number | null));
	for (const row of byRelease) {
		const t = topics.indexOf(row.topic);
		const i = slot.get(Number(row.releaseId));
		if (t !== -1 && i !== undefined) trend[t][i] = Number(Number(row.score).toFixed(4));
	}

	return { releases, topics, districts: [...DISTRICT_NAMES], cells, trend };
}

/** Everything needed to render one release page. */
export async function releaseDetail(slug: string) {
	const release = await findRelease(slug);
	if (!release) return undefined;

	const sections = await repo(Section).find({
		where: { releaseId: release.id },
		orderBy: { ordinal: 'asc' },
		limit: 500
	});

	const dtos = sections.map(toSectionDTO);
	return {
		release,
		national: dtos.filter((s) => s.scope === 'national'),
		highlights: dtos
			.filter((s) => s.scope === 'highlight')
			.sort((a, b) => districtOrder(a.district) - districtOrder(b.district)),
		districts: dtos.filter((s) => s.scope === 'district')
	};
}

/**
 * One district's record. The trend covers every year; the prose is fetched for one
 * release at a time, since ten years of a district's text is far more than a page
 * needs.
 */
export async function districtDetail(district: string, releaseSlug?: string) {
	const releases = await listReleases();
	const slot = indexById(releases);

	const overallRows = await sql<{ releaseId: number; score: number }>(
		(p) => `
			select releaseId, avg(sentimentScore) as score
			from sections
			where scope = ${p('district')} and district = ${p(district)}
			  and topic = ${p('Overall Economic Activity')}
			group by releaseId`
	);

	const overall = releases.map(() => null as number | null);
	for (const row of overallRows) {
		const i = slot.get(Number(row.releaseId));
		if (i !== undefined) overall[i] = Number(row.score);
	}

	const topicRows = await sql<{ topic: string; releaseId: number; score: number }>(
		(p) => `
			select topic, releaseId, avg(sentimentScore) as score
			from sections
			where scope = ${p('district')} and district = ${p(district)}
			group by topic, releaseId`
	);

	const topics = [...new Set(topicRows.map((r) => r.topic))].sort(
		(a, b) => topicOrder(a) - topicOrder(b)
	);

	const byTopic = topics.map(() => releases.map(() => null as number | null));
	for (const row of topicRows) {
		const t = topics.indexOf(row.topic);
		const i = slot.get(Number(row.releaseId));
		if (t !== -1 && i !== undefined) byTopic[t][i] = Number(Number(row.score).toFixed(4));
	}

	const selected = releaseSlug
		? releases.find((r) => r.slug === releaseSlug)
		: releases.at(-1);

	const sections = selected
		? (
				await repo(Section).find({
					where: { district, scope: 'district', releaseId: selected.id },
					orderBy: { ordinal: 'asc' },
					limit: 100
				})
			).map(toSectionDTO)
		: [];

	return { district, releases, selected, sections, topics, overall, byTopic };
}

/** Headline numbers for the dashboard. */
export async function dashboardStats(year?: number) {
	const releases = await listReleases(year);
	const latest = releases.at(-1);
	const previous = releases.at(-2);

	const [totals] = await sql<{ sections: number; words: number }>(
		() => `select count(*) as sections, coalesce(sum(wordCount), 0) as words from sections`
	);

	const [releaseCount] = await sql<{ n: number }>(() => `select count(*) as n from releases`);

	const ranked = latest
		? (
				await sql<{ district: string; score: number | null }>(
					(p) => `
						select district, ${DISTRICT_TONE} as score
						from sections
						where scope in ('highlight', 'district')
						  and district <> '' and releaseId = ${p(latest.id)}
						group by district
						order by score desc`
				)
			)
				.filter((r) => r.score !== null)
				.map((r) => ({
					district: r.district,
					score: Number(r.score),
					label: sentimentLabel(Number(r.score))
				}))
		: [];

	const toneOf = async (releaseId: number) => {
		const [row] = await sql<{ score: number | null }>(
			(p) => `
				select avg(score) as score from (
					select ${DISTRICT_TONE} as score from sections
					where scope in ('highlight', 'district')
					  and district <> '' and releaseId = ${p(releaseId)}
					group by district
				)`
		);
		return row?.score == null ? 0 : Number(row.score);
	};

	const latestTone = latest ? await toneOf(latest.id) : 0;
	const previousTone = previous ? await toneOf(previous.id) : 0;

	return {
		releaseCount: Number(releaseCount?.n ?? 0),
		yearReleaseCount: releases.length,
		sectionCount: Number(totals?.sections ?? 0),
		wordCount: Number(totals?.words ?? 0),
		latest,
		latestTone: Number(latestTone.toFixed(4)),
		toneChange: previous ? Number((latestTone - previousTone).toFixed(4)) : null,
		ranked,
		positiveDistricts: ranked.filter((r) => r.score > 0.05).length,
		negativeDistricts: ranked.filter((r) => r.score < -0.05).length
	};
}

/** Two releases side by side, matched on scope+district+topic. */
export async function compareReleases(slugA: string, slugB: string) {
	const [a, b] = await Promise.all([findRelease(slugA), findRelease(slugB)]);
	if (!a || !b) return undefined;

	const rows = await repo(Section).find({
		where: { releaseId: [a.id, b.id] },
		orderBy: { ordinal: 'asc' },
		limit: 1000
	});
	const dtos = rows.map(toSectionDTO);

	const key = (s: SectionDTO) => `${s.scope}|${s.district}|${s.topic}`;
	const left = new Map(dtos.filter((s) => s.releaseId === a.id).map((s) => [key(s), s]));
	const right = new Map(dtos.filter((s) => s.releaseId === b.id).map((s) => [key(s), s]));

	const pairs = [...left.keys()]
		.filter((k) => right.has(k))
		.map((k) => {
			const from = left.get(k)!;
			const to = right.get(k)!;
			return {
				key: k,
				scope: from.scope,
				district: from.district,
				topic: from.topic,
				heading: from.heading,
				from,
				to,
				delta: Number((to.sentimentScore - from.sentimentScore).toFixed(4))
			};
		})
		.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

	return { a, b, pairs };
}
