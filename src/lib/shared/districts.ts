/**
 * The twelve Federal Reserve districts, in the Fed's own ordering (by district
 * number, which is the order they appear in "Highlights by Federal Reserve District").
 *
 * `slug` matches the Fed's URL segment, e.g. beigebook202601-san-francisco.htm
 */
export const DISTRICTS = [
	{ number: 1, name: 'Boston', slug: 'boston' },
	{ number: 2, name: 'New York', slug: 'new-york' },
	{ number: 3, name: 'Philadelphia', slug: 'philadelphia' },
	{ number: 4, name: 'Cleveland', slug: 'cleveland' },
	{ number: 5, name: 'Richmond', slug: 'richmond' },
	{ number: 6, name: 'Atlanta', slug: 'atlanta' },
	{ number: 7, name: 'Chicago', slug: 'chicago' },
	{ number: 8, name: 'St. Louis', slug: 'st-louis' },
	{ number: 9, name: 'Minneapolis', slug: 'minneapolis' },
	{ number: 10, name: 'Kansas City', slug: 'kansas-city' },
	{ number: 11, name: 'Dallas', slug: 'dallas' },
	{ number: 12, name: 'San Francisco', slug: 'san-francisco' }
] as const;

export type DistrictName = (typeof DISTRICTS)[number]['name'];

export const DISTRICT_NAMES: string[] = DISTRICTS.map((d) => d.name);

type District = (typeof DISTRICTS)[number];

// Keyed by plain string: lookups come from URL params and scraped headings, which
// aren't narrowed to the literal union.
const BY_SLUG = new Map<string, District>(DISTRICTS.map((d) => [d.slug, d]));
const BY_NAME = new Map<string, District>(DISTRICTS.map((d) => [d.name.toLowerCase(), d]));

export function districtBySlug(slug: string) {
	return BY_SLUG.get(slug);
}

export function districtByName(name: string) {
	return BY_NAME.get(name.trim().toLowerCase());
}

/** Sort key so districts always render in Fed order rather than alphabetically. */
export function districtOrder(name: string): number {
	return districtByName(name)?.number ?? 99;
}

/**
 * District pages are titled "Federal Reserve Bank of Boston" — pull the district
 * name back out of that heading.
 */
export function districtFromHeading(heading: string): string | undefined {
	const m = heading.match(/Federal Reserve Bank of\s+(.+)$/i);
	if (!m) return undefined;
	return districtByName(m[1])?.name;
}

const ORDINALS = [
	'first',
	'second',
	'third',
	'fourth',
	'fifth',
	'sixth',
	'seventh',
	'eighth',
	'ninth',
	'tenth',
	'eleventh',
	'twelfth'
];

/**
 * Editions before 2017 open each district with "First District--Boston" rather than
 * "Federal Reserve Bank of Boston". The separator drifts between `--`, an en dash and
 * a spaced hyphen across years, and the trailing name is occasionally absent
 * ("First District"), so the ordinal is what actually identifies the district.
 */
export function districtFromLegacyHeading(heading: string): string | undefined {
	const m = heading.match(/^\s*(\w+)\s+District\b\s*(?:[-–—]+\s*(.+))?$/i);
	if (!m) return undefined;

	const byName = m[2] ? districtByName(m[2].trim()) : undefined;
	if (byName) return byName.name;

	const number = ORDINALS.indexOf(m[1].toLowerCase()) + 1;
	return number > 0 ? DISTRICTS[number - 1].name : undefined;
}

/** Either heading convention. */
export function districtFromAnyHeading(heading: string): string | undefined {
	return districtFromHeading(heading) ?? districtFromLegacyHeading(heading);
}
