import { repo } from 'remult';
import { Release, Section } from '$lib/shared/entities';
import type { IngestReport } from '$lib/shared/ingest-types';
import { FED_ORIGIN } from './fetchPage';
import { canonicalTopic, unmappedHeadings } from '$lib/shared/topics';
import { discoverReleases, type DiscoveredRelease } from './discover';
import { fetchPage, type FetchOptions } from './fetchPage';
import { parseDistrictPage, parseFullReport, parseSummaryPage, type ParsedSection } from './parse';
import { countWords, score } from '../sentiment/score';

export type { IngestReport } from '$lib/shared/ingest-types';

export interface IngestOptions extends FetchOptions {
	/** Limit to a single release slug — useful when checking a parser change. */
	onlySlug?: string;
}

/**
 * Score one parsed section.
 *
 * Price sections are inverted so that rising prices read as bad news: the whole app
 * is colour-coded green = good, and "prices rose robustly" is not good. District
 * highlight blurbs cover every topic at once, so they are never inverted.
 */
function scoreSection(parsed: ParsedSection, topic: string) {
	const invert = topic === 'Prices' && parsed.scope !== 'highlight';
	return score(parsed.body, { invert });
}

async function ingestRelease(discovered: DiscoveredRelease, options: IngestOptions) {
	// Everything before 2024 is a single page; 2024 onwards splits the edition across
	// a National Summary plus twelve district pages.
	const singlePage = discovered.format !== 'multi-page';
	const cacheKey = singlePage ? `${discovered.slug}-full` : `${discovered.slug}-summary`;

	const summaryHtml = await fetchPage(discovered.summaryUrl, cacheKey, options);
	const summary = singlePage
		? parseFullReport(summaryHtml, { legacy: discovered.format === 'legacy' })
		: parseSummaryPage(summaryHtml);

	const parsed: ParsedSection[] = [...summary.sections];

	// Empty for the full-report era, so this loop simply doesn't run there.
	for (const [district, href] of summary.districtUrls) {
		const url = href.startsWith('http') ? href : `${FED_ORIGIN}${href}`;
		const key = href.split('/').pop()?.replace(/\.htm$/, '') ?? `${discovered.slug}-${district}`;
		const html = await fetchPage(url, key, options);
		parsed.push(...parseDistrictPage(html, district));
	}

	// Upsert on the slug: it is unique across every year, whereas `seq` is 0 for the
	// one release whose slug encodes a date instead of an ordinal.
	const releaseRepo = repo(Release);
	const existing = await releaseRepo.findFirst({ slug: discovered.slug });

	const values = {
		year: discovered.year,
		seq: discovered.seq,
		slug: discovered.slug,
		format: discovered.format,
		releaseDate: discovered.releaseDate,
		label: discovered.label,
		summaryUrl: discovered.summaryUrl,
		pdfUrl: discovered.pdfUrl,
		preparedBy: summary.preparedBy,
		dataCutoff: summary.dataCutoff,
		sectionCount: parsed.length,
		fetchedAt: new Date()
	};

	const release = existing
		? await releaseRepo.update(existing.id, values)
		: await releaseRepo.insert(values);

	// Replace this release's sections wholesale. Scoring is cheap and deterministic,
	// so re-deriving everything keeps a lexicon change from leaving stale rows behind.
	const sectionRepo = repo(Section);
	const stale = await sectionRepo.find({ where: { releaseId: release.id } });
	if (stale.length) await sectionRepo.deleteMany({ where: { releaseId: release.id } });

	const rows = parsed.map((p, ordinal) => {
		// A highlight blurb is headed by the district name rather than a subject, and
		// covers the district's conditions as a whole — so it is an overall-activity
		// section by definition, not something to look up in the topic map.
		const topic = p.scope === 'highlight' ? 'Overall Economic Activity' : canonicalTopic(p.heading);
		const scored = scoreSection(p, topic);
		return {
			releaseId: release.id,
			scope: p.scope,
			district: p.district,
			heading: p.heading,
			topic,
			body: p.body,
			wordCount: countWords(p.body),
			sentimentScore: scored.score,
			sentimentLabel: scored.label,
			termHits: scored.termHits,
			paceWords: scored.paceWords,
			ordinal
		};
	});

	await sectionRepo.insert(rows);
	return { label: release.label, slug: release.slug, sections: rows.length };
}

/**
 * Fetch, parse, score and store every published release for a year.
 * Idempotent: running it again refreshes scores in place rather than duplicating rows.
 */
export async function ingestYear(year: number, options: IngestOptions = {}): Promise<IngestReport> {
	let discovered = await discoverReleases(year, options);
	if (options.onlySlug) discovered = discovered.filter((d) => d.slug === options.onlySlug);

	const releases: IngestReport['releases'] = [];

	for (const d of discovered) {
		try {
			releases.push(await ingestRelease(d, options));
		} catch (error) {
			releases.push({
				label: d.label,
				slug: d.slug,
				sections: 0,
				skipped: error instanceof Error ? error.message : String(error)
			});
		}
	}

	return { year, releases, unmappedHeadings: unmappedHeadings() };
}
