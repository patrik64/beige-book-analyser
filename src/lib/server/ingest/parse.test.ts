import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISTRICT_NAMES } from '$lib/shared/districts';
import { canonicalTopic } from '$lib/shared/topics';
import { pageTitle, parseDistrictPage, parseFullReport, parseSummaryPage } from './parse';

const fixture = (name: string) =>
	readFileSync(join(import.meta.dirname, '__fixtures__', name), 'utf8');

const summaryHtml = fixture('beigebook202601-summary.html');
const bostonHtml = fixture('beigebook202601-boston.html');
const fullReportHtml = fixture('beigebook202301-fullreport.html');
// Two markup variants the Fed used for the same section over the years.
const h4MarkerHtml = fixture('beigebook201701-fullreport.html');
const sharedStrongHtml = fixture('beigebook202309-fullreport.html');

describe('parseSummaryPage', () => {
	const parsed = parseSummaryPage(summaryHtml);

	it('finds exactly the three national parts', () => {
		const national = parsed.sections.filter((s) => s.scope === 'national');
		expect(national.map((s) => s.heading)).toEqual([
			'Overall Economic Activity',
			'Labor Markets',
			'Prices'
		]);
	});

	it('finds all twelve district highlights, in Fed order', () => {
		const highlights = parsed.sections.filter((s) => s.scope === 'highlight');
		expect(highlights).toHaveLength(12);
		expect(highlights.map((s) => s.district)).toEqual(DISTRICT_NAMES);
	});

	it('excludes the container heading from the sections', () => {
		expect(parsed.sections.some((s) => /^Highlights by/i.test(s.heading))).toBe(false);
	});

	it('captures the body text of the opening section', () => {
		const overall = parsed.sections.find((s) => s.heading === 'Overall Economic Activity');
		expect(overall?.body).toMatch(
			/^Overall economic activity increased at a slight to modest pace in eight of the twelve/
		);
	});

	it('reads the preparing bank and data cutoff from the footnote', () => {
		expect(parsed.preparedBy).toBe('Federal Reserve Bank of Richmond');
		expect(parsed.dataCutoff).toBe('January 5, 2026');
	});

	it('discovers all twelve district page URLs from the sidebar', () => {
		expect(parsed.districtUrls.size).toBe(12);
		expect(parsed.districtUrls.get('San Francisco')).toBe(
			'/monetarypolicy/beigebook202601-san-francisco.htm'
		);
	});

	it('keeps the preparation note out of the section bodies', () => {
		expect(parsed.sections.some((s) => s.body.includes('This report was prepared'))).toBe(false);
	});

	it('strips non-breaking spaces from headings', () => {
		for (const s of parsed.sections) {
			expect(s.heading).not.toMatch(/ /);
			expect(s.heading).toBe(s.heading.trim());
		}
	});
});

describe('parseDistrictPage', () => {
	const sections = parseDistrictPage(bostonHtml, 'Boston');

	it('opens with the three standardized headings in order', () => {
		expect(sections.slice(0, 3).map((s) => s.heading)).toEqual([
			'Summary of Economic Activity',
			'Labor Markets',
			'Prices'
		]);
	});

	it('captures district-specific sections beyond the standard three', () => {
		const headings = sections.map((s) => s.heading);
		expect(headings).toContain('Retail and Tourism');
		expect(headings).toContain('Commercial Real Estate');
	});

	it('tags every section with the district and district scope', () => {
		for (const s of sections) {
			expect(s.district).toBe('Boston');
			expect(s.scope).toBe('district');
		}
	});

	it('drops the trailing regional-site link paragraph', () => {
		for (const s of sections) {
			expect(s.body).not.toMatch(/For more information about District economic conditions/);
		}
	});

	it('gives every section a non-empty body', () => {
		expect(sections.length).toBeGreaterThan(3);
		for (const s of sections) expect(s.body.length).toBeGreaterThan(50);
	});
});

/**
 * The 2017-2023 editions ship as one page and mark sections with inline <strong>
 * runs rather than headings, so they get their own parser.
 */
describe('parseFullReport (2017-2023 layout)', () => {
	const parsed = parseFullReport(fullReportHtml);

	it('finds the three national parts', () => {
		const national = parsed.sections.filter((s) => s.scope === 'national');
		expect(national.map((s) => s.heading)).toEqual([
			'Overall Economic Activity',
			'Labor Markets',
			'Prices'
		]);
	});

	it('finds all twelve district highlights in Fed order', () => {
		const highlights = parsed.sections.filter((s) => s.scope === 'highlight');
		expect(highlights).toHaveLength(12);
		expect(highlights.map((s) => s.district)).toEqual(DISTRICT_NAMES);
	});

	it('recovers Boston, whose blurb shares a paragraph with the container heading', () => {
		// <p><strong>Highlights by …</strong><br /><strong>Boston</strong><br />text</p>
		const boston = parsed.sections.find((s) => s.scope === 'highlight' && s.district === 'Boston');
		expect(boston?.body).toMatch(/^Business activity was roughly flat/);
	});

	it('drops the container heading itself', () => {
		expect(parsed.sections.some((s) => /^Highlights by/i.test(s.heading))).toBe(false);
	});

	it('attributes district sections to all twelve districts', () => {
		const districts = parsed.sections.filter((s) => s.scope === 'district');
		expect(new Set(districts.map((s) => s.district)).size).toBe(12);
		expect(districts.length).toBeGreaterThan(80);
	});

	it('opens each district with the standardized three headings', () => {
		const boston = parsed.sections.filter((s) => s.scope === 'district' && s.district === 'Boston');
		expect(boston.slice(0, 3).map((s) => s.heading)).toEqual([
			'Summary of Economic Activity',
			'Labor Markets',
			'Prices'
		]);
	});

	it('reads the preparing bank and cutoff from the note, which has no id in this era', () => {
		expect(parsed.preparedBy).toBe('Federal Reserve Bank of Cleveland');
		expect(parsed.dataCutoff).toBe('January 9, 2023');
	});

	it('reports no district URLs, since everything is on one page', () => {
		expect(parsed.districtUrls.size).toBe(0);
	});

	it('leaves no markup or entities in the extracted text', () => {
		for (const s of parsed.sections) {
			expect(s.body).not.toMatch(/<[a-z/]/i);
			expect(s.body).not.toMatch(/&(amp|nbsp|quot|#39|rsquo|mdash);/);
			expect(s.heading).not.toMatch(/<|&[a-z]+;/i);
		}
	});

	it('yields a section count in the same range as the modern layout', () => {
		expect(parsed.sections.length).toBeGreaterThan(100);
		expect(parsed.sections.length).toBeLessThan(160);
	});
});

/**
 * The Fed marked "Highlights by Federal Reserve District" three different ways over
 * these years. Each variant silently cost us a district's blurb until it was handled,
 * so each gets a fixture.
 */
describe('parseFullReport — highlights markup variants', () => {
	it('handles the 2017 layout, where the marker is a real <h4>', () => {
		const parsed = parseFullReport(h4MarkerHtml);
		const highlights = parsed.sections.filter((s) => s.scope === 'highlight');
		expect(highlights.map((s) => s.district)).toEqual(DISTRICT_NAMES);
		// Without this the twelve blurbs were scored as national sections instead.
		expect(parsed.sections.filter((s) => s.scope === 'national')).toHaveLength(3);
	});

	it('handles a marker sharing one <strong> with the first district', () => {
		// <strong>Highlights by Federal Reserve District<br />Boston</strong>
		const parsed = parseFullReport(sharedStrongHtml);
		const highlights = parsed.sections.filter((s) => s.scope === 'highlight');
		expect(highlights).toHaveLength(12);
		expect(highlights[0].district).toBe('Boston');
		expect(highlights[0].body).toMatch(/^Business activity expanded modestly/);
	});

	it('maps the older "Employment and Wages" heading onto Labor Markets', () => {
		// 2017 had not yet renamed the section, and the trend chart keys off the
		// canonical topic rather than the Fed's wording.
		const parsed = parseFullReport(h4MarkerHtml);
		const national = parsed.sections.filter((s) => s.scope === 'national');
		expect(national.map((s) => s.heading)).toContain('Employment and Wages');
		expect(canonicalTopic('Employment and Wages')).toBe('Labor Markets');
	});
});

describe('entity decoding', () => {
	// The older reports write "&frac12; percent" and "home d&eacute;cor"; leaving those
	// raw would put literal entity text in front of the reader and the scorer.
	it('decodes the Latin-1 block, numeric forms and typography', () => {
		const parsed = parseFullReport(fullReportHtml);
		for (const section of parsed.sections) {
			expect(section.body).not.toMatch(/&[a-zA-Z]+;/);
			expect(section.body).not.toMatch(/&#\d+;/);
		}
	});
});

describe('pageTitle', () => {
	it('reads the h3 of each page type', () => {
		expect(pageTitle(summaryHtml)).toBe('National Summary');
		expect(pageTitle(bostonHtml)).toBe('Federal Reserve Bank of Boston');
	});
});
