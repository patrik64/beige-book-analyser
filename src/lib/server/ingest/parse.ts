import { parse as parseHtml, type HTMLElement } from 'node-html-parser';
import { districtByName, districtFromAnyHeading } from '$lib/shared/districts';
import type { SectionScope } from '$lib/shared/entities';

export interface ParsedSection {
	scope: SectionScope;
	district: string;
	heading: string;
	body: string;
}

export interface ParsedSummary {
	sections: ParsedSection[];
	/** Reserve Bank that compiled this edition. */
	preparedBy: string;
	/** "information collected on or before <date>". */
	dataCutoff: string;
	/** District page URLs discovered from the sidebar, keyed by district name. */
	districtUrls: Map<string, string>;
}

/** The Fed emits non-breaking spaces into headings — June 2026 has "Overall Economic Activity ". */
function clean(text: string): string {
	return text
		.replace(/ /g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function article(html: string): HTMLElement {
	const root = parseHtml(html);
	const el = root.querySelector('#article');
	if (!el) throw new Error('No #article element — page layout changed');
	return el;
}

/**
 * Paragraphs that are navigation rather than content. Each district page closes with
 * a link to that Reserve Bank's regional site, which would otherwise be scored as
 * part of the final section.
 */
function isBoilerplate(text: string): boolean {
	return (
		/^For more information about District economic conditions/i.test(text) ||
		/^Note: This report was prepared/i.test(text) ||
		text.length === 0
	);
}

/**
 * Walk `#article`, which is a flat run of h3/h4/h5/p siblings with no per-section
 * wrappers: open a new section at each heading and absorb the paragraphs that follow.
 *
 * `headingTags` selects which levels start a section — the summary page needs h4 and
 * h5 handled differently, so callers pass what they want.
 */
function walkSections(
	el: HTMLElement,
	headingTags: string[]
): { heading: string; level: string; body: string }[] {
	const out: { heading: string; level: string; body: string }[] = [];
	let current: { heading: string; level: string; paragraphs: string[] } | null = null;

	const flush = () => {
		if (current) out.push({ heading: current.heading, level: current.level, body: current.paragraphs.join('\n\n') });
		current = null;
	};

	for (const node of el.childNodes) {
		const child = node as HTMLElement;
		const tag = child.tagName?.toLowerCase?.();
		if (!tag) continue;

		if (headingTags.includes(tag)) {
			flush();
			current = { heading: clean(child.text), level: tag, paragraphs: [] };
		} else if (tag === 'p' && current) {
			const text = clean(child.text);
			if (!isBoilerplate(text)) current.paragraphs.push(text);
		}
	}
	flush();

	return out.filter((s) => s.body.length > 0);
}

/**
 * Parse the National Summary page. It yields two different kinds of section:
 * the three `h4` national parts, and the twelve `h5` district highlight blurbs that
 * sit under the "Highlights by Federal Reserve District" heading.
 */
export function parseSummaryPage(html: string): ParsedSummary {
	const el = article(html);
	const walked = walkSections(el, ['h4', 'h5']);

	const sections: ParsedSection[] = [];
	for (const s of walked) {
		if (s.level === 'h4') {
			// "Highlights by Federal Reserve District" is a container heading; its own
			// h5 children carry the content, so it contributes nothing itself.
			if (/^Highlights by/i.test(s.heading)) continue;
			sections.push({ scope: 'national', district: '', heading: s.heading, body: s.body });
		} else {
			sections.push({ scope: 'highlight', district: s.heading, heading: s.heading, body: s.body });
		}
	}

	// The preparation note lives in p#f2 from 2024 on; fall back to the article text.
	const note = clean(el.querySelector('p#f2')?.text ?? '') || clean(el.text);
	const { preparedBy, dataCutoff } = preparationNote(note);

	// The sidebar lists all thirteen sibling pages; take the twelve district ones so
	// the slugs never have to be hardcoded.
	const districtUrls = new Map<string, string>();
	const root = parseHtml(html);
	for (const link of root.querySelectorAll('#t4_nav a.list-group-item')) {
		const district = districtFromAnyHeading(clean(link.text));
		const href = link.getAttribute('href');
		if (district && href) districtUrls.set(district, href);
	}

	return { sections, preparedBy, dataCutoff, districtUrls };
}

/** Parse one district page. Every section here is scope `district`. */
export function parseDistrictPage(html: string, district: string): ParsedSection[] {
	const el = article(html);
	return walkSections(el, ['h4']).map((s) => ({
		scope: 'district' as const,
		district,
		heading: s.heading,
		body: s.body
	}));
}

/** The `h3` title of a page, e.g. "National Summary" or "Federal Reserve Bank of Boston". */
export function pageTitle(html: string): string {
	return clean(article(html).querySelector('h3')?.text ?? '');
}

/** Pull the compiling bank and cutoff date out of the preparation note. */
function preparationNote(text: string) {
	return {
		preparedBy:
			text.match(/prepared at the (Federal Reserve Bank of [A-Za-z .]+?) based on/i)?.[1] ?? '',
		dataCutoff: text.match(/collected on or before ([A-Za-z]+ \d{1,2},? \d{4})/i)?.[1] ?? ''
	};
}

/**
 * Parse a 2017-2023 Full Report: one page carrying the national summary, the twelve
 * district highlights and all twelve district reports.
 *
 * This era marks sections with inline `<strong>` runs rather than real headings:
 *
 *   <p><strong>Overall Economic Activity</strong><br /> Overall economic activity …</p>
 *
 * and a single paragraph can hold several of them — the "Highlights by Federal
 * Reserve District" heading and Boston's blurb share one `<p>`. So sections are cut
 * at every `<strong>`, not at paragraph boundaries. District reports are delimited by
 * real `<h4>Federal Reserve Bank of X</h4>` headings, which is what tells us we have
 * left the national summary.
 */
export function parseFullReport(html: string, options: { legacy?: boolean } = {}): ParsedSummary {
	const legacy = options.legacy ?? false;
	const el = legacy ? legacyRoot(html) : article(html);

	const sections: ParsedSection[] = [];
	let district = '';
	let inHighlights = false;
	/**
	 * Legacy editions open with an unheaded paragraph that is the overall read on the
	 * economy — the role "Overall Economic Activity" plays from 2017 on. Capturing it
	 * under that name is what keeps the long-run trend chart continuous.
	 */
	const intro: string[] = [];

	// Legacy pages nest the prose a level or two deeper than #article does.
	const nodes = legacy ? flatten(el) : [...el.childNodes];

	for (const node of nodes) {
		const child = node as HTMLElement;
		const tag = child.tagName?.toLowerCase?.();
		if (!tag) continue;

		if (/^h[1-6]$/.test(tag)) {
			const heading = clean(child.text);
			const bank = districtFromAnyHeading(heading);
			if (bank) {
				district = bank;
				inHighlights = false;
			} else if (/^Highlights by/i.test(heading)) {
				// 2017-2018 mark the highlights with a real heading; later years fold it
				// into a <strong> run instead.
				inHighlights = true;
			}
			continue;
		}

		if (tag !== 'p') continue;

		// Split the paragraph at each bold run: everything after one, up to the next,
		// is that section's body. Pre-2011 editions use <b> rather than <strong>.
		const parts = child.innerHTML.split(/<(?:strong|b)>/i);

		if (parts.length < 2) {
			// An unheaded paragraph. Before the first district it is part of the opening
			// overview; inside a district it continues the section already open.
			const text = clean(stripTags(child.innerHTML));
			if (!text || isBoilerplate(text)) continue;
			const previous = sections.at(-1);
			if (legacy && !district && !previous) intro.push(text);
			else if (previous) previous.body = clean(`${previous.body} ${text}`);
			continue;
		}

		for (const [offset, part] of parts.slice(1).entries()) {
			const [rawHeading, ...rest] = part.split(/<\/(?:strong|b)>/i);
			const body = clean(stripTags(rest.join('')));

			// March 2013 contains `S<strong>ervices…</strong>` — the first letter left
			// outside the bold tag. If the text right before the tag ends mid-word,
			// those characters belong to the heading, not to the previous paragraph.
			const preceding = stripTags(parts[offset]);
			const orphan = legacy ? (preceding.match(/(?:^|\s)([A-Za-z]{1,3})$/)?.[1] ?? '') : '';

			// One <strong> can carry two stacked headings — some editions write
			// <strong>Highlights by Federal Reserve District<br />Boston</strong>, so
			// splitting on the line break is what keeps Boston's blurb from being
			// swallowed by the container heading.
			const lines = rawHeading
				.split(/<br\s*\/?>/i)
				.map((line) => clean(stripTags(line)))
				.filter(Boolean);

			let heading = '';
			for (const line of lines) {
				// A container heading with no prose of its own; whatever follows it,
				// here or in a later paragraph, is a district highlight.
				if (/^Highlights by/i.test(line)) inHighlights = true;
				else heading = line;
			}

			if (orphan && heading) heading = `${orphan}${heading}`;

			if (legacy) {
				// Before 2011 the district marker is itself a bold run inside a
				// paragraph rather than a heading element.
				const bank = districtFromAnyHeading(heading);
				if (bank) {
					district = bank;
					// The marker sometimes shares its paragraph with the district's first
					// section, so anything after it is that district's opening prose.
					if (body) sections.push({ scope: 'district', district, heading: 'Summary of Economic Activity', body });
					continue;
				}
				// The masthead, the "Summary" label and the preparation note are chrome —
				// but the opening overview is often the *body* of the preparation note's
				// paragraph, so the text is kept even though the heading is dropped.
				if (isLegacyChrome(heading)) {
					if (body && !district) intro.push(body);
					continue;
				}
			}

			// Not every <strong> is a heading. The January 2018 report contains
			// "…were positive<strong>.</strong> Low crop prices…" — a bolded full stop
			// mid-sentence. Treating that as a section boundary would both invent a
			// section called "." and truncate the real one, so runs that don't look
			// like a heading are folded back into the text they interrupted.
			// Legacy pages also bold words for emphasis mid-sentence — April 2015 has
			// "<strong>across</strong> most of the District". Headings in this report are
			// always Title Case, so a lowercase opening marks emphasis, not a section.
			const looksLikeHeading =
				/[a-z]/i.test(heading) && heading.length <= 80 && (!legacy || /^[A-Z0-9]/.test(heading));
			if (!looksLikeHeading) {
				const previous = sections.at(-1);
				if (previous) previous.body = clean(`${previous.body} ${heading} ${body}`);
				continue;
			}

			if (!body || isBoilerplate(body)) continue;

			if (district) {
				sections.push({ scope: 'district', district, heading, body });
			} else if (inHighlights) {
				// Highlight headings are the bare district name ("Boston"), not the
				// "Federal Reserve Bank of …" form the district reports use.
				const name = districtByName(heading)?.name ?? heading;
				sections.push({ scope: 'highlight', district: name, heading: name, body });
			} else {
				sections.push({ scope: 'national', district: '', heading, body });
			}
		}
	}

	// The opening overview has no heading of its own; file it under the name the
	// modern editions give the same content so the two eras line up.
	if (intro.length) {
		sections.unshift({
			scope: 'national',
			district: '',
			heading: 'Overall Economic Activity',
			body: clean(intro.join(' '))
		});
	}

	// The note has no stable id in this era, so match it in the article text.
	const { preparedBy, dataCutoff } = preparationNote(clean(el.text));

	// Everything is on one page, so there are no district URLs to follow.
	return { sections, preparedBy, dataCutoff, districtUrls: new Map() };
}

/** Masthead, section label and preparation note — present as bold runs, not content. */
function isLegacyChrome(heading: string): boolean {
	return (
		/Summary of Commentary/i.test(heading) ||
		/^Summary$/i.test(heading) ||
		/^Prepared at the/i.test(heading) ||
		/^Full Report$/i.test(heading) ||
		/^Report$/i.test(heading) ||
		// Page furniture that sits in the same bold runs as the content.
		/^Last update/i.test(heading) ||
		/^Skip to/i.test(heading) ||
		/^Return to/i.test(heading)
	);
}

/**
 * Legacy pages have no #article. The prose sits in #leftText from 2011 on, and in
 * plain body markup before that.
 */
function legacyRoot(html: string): HTMLElement {
	const root = parseHtml(html);
	return (
		root.querySelector('#leftText') ??
		root.querySelector('#content') ??
		root.querySelector('body') ??
		root
	);
}

/**
 * Depth-first list of an element's descendants, stopping at each paragraph or
 * heading. The modern layout keeps its sections as direct children of #article, but
 * legacy pages wrap them in tables and divs, so the walk has to descend.
 */
function flatten(el: HTMLElement): HTMLElement[] {
	const out: HTMLElement[] = [];
	const visit = (node: HTMLElement) => {
		for (const child of node.childNodes as unknown as HTMLElement[]) {
			const tag = child.tagName?.toLowerCase?.();
			if (!tag) continue;
			if (tag === 'p' || /^h[1-6]$/.test(tag)) out.push(child);
			else visit(child);
		}
	};
	visit(el);
	return out;
}

/**
 * The HTML4 Latin-1 entity names, in code-point order from U+00A0 to U+00FF. The
 * older reports lean on these heavily — "&frac12; percent", "home d&eacute;cor" — so
 * a handful of hand-picked names isn't enough; the whole block is generated instead.
 */
const LATIN1_ENTITY_NAMES =
	'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr ' +
	'deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest ' +
	'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml ' +
	'Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times ' +
	'Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring ' +
	'aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ' +
	'ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml';

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	rsquo: '’',
	lsquo: '‘',
	ldquo: '“',
	rdquo: '”',
	sbquo: '‚',
	bdquo: '„',
	mdash: '—',
	ndash: '–',
	hellip: '…',
	bull: '•',
	dagger: '†',
	permil: '‰',
	prime: '′',
	Prime: '″',
	euro: '€',
	trade: '™',
	percnt: '%',
	...Object.fromEntries(
		LATIN1_ENTITY_NAMES.split(' ').map((name, i) => [name, String.fromCodePoint(0xa0 + i)])
	)
};

function stripTags(html: string): string {
	return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''));
}

/**
 * Legacy pages lean on numeric entities — `&#160;` rather than `&nbsp;` — so decoding
 * has to be general rather than a list of the few forms the modern pages happen to use.
 */
function decodeEntities(text: string): string {
	return text
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
		// Case matters for the Latin-1 block — &Eacute; and &eacute; are different
		// letters — so an exact match is tried before falling back to lowercase.
		// Entity names can contain digits — &frac12; is the common one in these
		// reports — so the character class has to allow them.
		.replace(
			/&([a-z][a-z0-9]*);/gi,
			(whole, name) => NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? whole
		);
}
