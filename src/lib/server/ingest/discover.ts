import { parse } from 'node-html-parser';
import { FED_ORIGIN, INDEX_URL, fetchPage, type FetchOptions } from './fetchPage';

/**
 * How a release's text is laid out. The Fed has reorganised the report three times:
 *
 *  - `legacy`       2003-2016: one page, sections marked by <strong>/<b> runs and
 *                   districts opened by "First District--Boston" (an <h2> from 2011,
 *                   a bold run before that). No "Highlights by District" section.
 *  - `full-report`  2017-2023: one page, sections still marked by <strong> runs but
 *                   districts opened by <h4>Federal Reserve Bank of X</h4>, and the
 *                   national summary standardised into three parts plus highlights.
 *  - `multi-page`   2024 onwards: a National Summary page plus twelve district
 *                   pages, with sections marked by real <h4>/<h5> headings.
 *
 * EARLIEST_YEAR is 2003 because that is where section headings begin. From 2002 back
 * to 1996 the reports bold the *first sentence* of each paragraph instead of using
 * headings, so there are no topics to extract — the heading-and-topic model this app
 * is built on simply doesn't exist in those editions.
 */
export type ReleaseFormat = 'legacy' | 'full-report' | 'multi-page';

export const EARLIEST_YEAR = 2003;
/** Last year of the pre-2017 layout. */
const LAST_LEGACY_YEAR = 2016;
/** The last year published as a single Full Report page in the modern layout. */
const LAST_FULL_REPORT_YEAR = 2023;

export interface DiscoveredRelease {
	year: number;
	/** The digits after the year in the slug. An ordinal, not a month. */
	seq: number;
	/** e.g. "beigebook202601" — globally unique, and the upsert key. */
	slug: string;
	releaseDate: Date;
	/** e.g. "January 2026" */
	label: string;
	format: ReleaseFormat;
	/** The page to parse: the Full Report, or the National Summary. */
	summaryUrl: string;
	pdfUrl: string;
}

const MONTHS = [
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december'
];

function absolute(href: string): string {
	return href.startsWith('http') ? href : `${FED_ORIGIN}${href}`;
}

export function formatForYear(year: number): ReleaseFormat {
	if (year <= LAST_LEGACY_YEAR) return 'legacy';
	if (year <= LAST_FULL_REPORT_YEAR) return 'full-report';
	return 'multi-page';
}

/**
 * The page that actually holds the text, given the index's HTML link.
 *
 * Each era points somewhere slightly different: 2003-2010 link to a `default.htm`
 * that is only a table of contents, with the prose behind `FullReport.htm`; 2011-2016
 * link straight at the full text; 2017-2023 link to a landing page whose sibling
 * `-summary.htm` we want; 2024+ link at the summary already.
 */
function contentUrl(href: string, slug: string, format: ReleaseFormat): string {
	if (format === 'legacy') {
		return href.replace(/default\.htm$/i, 'FullReport.htm');
	}
	if (format === 'full-report') return `/monetarypolicy/${slug}.htm`;
	return `/monetarypolicy/${slug}-summary.htm`;
}

/**
 * Discover a year's releases from the Fed's own index table.
 *
 * This must never be replaced by building URLs from dates. The slug's suffix looks
 * like a month but is an ordinal over the eight yearly releases: in 2026 March is
 * `02` and June is `05`, and `beigebook202603` is a 404. One release even breaks the
 * pattern entirely — May 2023 is `beigebook20230531`. The index table is the only
 * authoritative mapping.
 */
export async function discoverReleases(
	year: number,
	options: FetchOptions = {}
): Promise<DiscoveredRelease[]> {
	// The default page carries the current year; older years live on archive pages.
	const currentYear = new Date().getFullYear();
	const url = year === currentYear ? INDEX_URL : `${FED_ORIGIN}/monetarypolicy/beigebook${year}.htm`;
	const key = year === currentYear ? 'index-default' : `index-${year}`;

	const html = await fetchPage(url, key, options);
	const root = parse(html);

	// Find the table whose header is the year we want — archive pages list several.
	const tables = root.querySelectorAll('table.table-layout');
	const table = tables.find((t) => {
		const header = t.querySelector('thead th');
		return header?.text.trim() === String(year);
	});

	if (!table) {
		throw new Error(`No release table for ${year} at ${url}`);
	}

	const format = formatForYear(year);
	const releases: DiscoveredRelease[] = [];

	for (const row of table.querySelectorAll('tbody tr')) {
		// Layouts differ by era: 2024+ puts the date and both links in a single cell
		// ("January 14: HTML | PDF"), while the archive pages use one cell for the
		// date and the next for the links. Reading the whole row covers both.
		const links = row.querySelectorAll('a');
		const htmlLink = links.find((a) => a.text.trim().toUpperCase() === 'HTML');
		if (!htmlLink) continue; // scheduled but not yet published

		const href = htmlLink.getAttribute('href');
		if (!href) continue;

		const dateText = row.text.replace(/\s+/g, ' ').trim();
		const dateMatch = dateText.match(/([A-Za-z]+)\s+(\d{1,2})/);
		if (!dateMatch) continue;

		const monthIndex = MONTHS.indexOf(dateMatch[1].toLowerCase());
		if (monthIndex === -1) continue;

		const day = Number(dateMatch[2]);

		// Matches beigebook202601-summary.htm, beigebook202301.htm and the one-off
		// beigebook20230531.htm. The /fomc/ era has no such slug in its URL at all
		// (it is /fomc/beigebook/2005/20050119/), so one is synthesised from the date
		// — every release still needs a stable unique key.
		const slugMatch = href.match(/(beigebook(\d{4})(\d{2,4}))(?:-summary)?\.htm/);
		const stamp = `${year}${String(monthIndex + 1).padStart(2, '0')}${String(day).padStart(2, '0')}`;
		const slug = slugMatch ? slugMatch[1] : `beigebook${stamp}`;
		const suffix = slugMatch ? slugMatch[3] : '';

		const pdfLink = links.find((a) => a.text.trim().toUpperCase() === 'PDF');
		const target = contentUrl(href, slug, format);

		releases.push({
			year: slugMatch ? Number(slugMatch[2]) : year,
			// Four-digit suffixes are a date (0531), not an ordinal; they have no seq.
			seq: suffix.length === 2 ? Number(suffix) : 0,
			slug,
			// Noon UTC keeps the calendar date stable regardless of local timezone.
			releaseDate: new Date(Date.UTC(year, monthIndex, day, 12)),
			label: `${dateMatch[1]} ${year}`,
			format,
			summaryUrl: absolute(target),
			pdfUrl: pdfLink ? absolute(pdfLink.getAttribute('href') ?? '') : ''
		});
	}

	return releases.sort((a, b) => a.releaseDate.getTime() - b.releaseDate.getTime());
}
