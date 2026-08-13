/**
 * Canonical topic mapping.
 *
 * Only the first three headings on a district page are standardized ("Summary of
 * Economic Activity", "Labor Markets", "Prices"). Everything after that is written
 * in each Reserve Bank's own taxonomy — Boston files retail under "Retail and
 * Tourism", Dallas under "Retail Sales", San Francisco under "Retail Trade and
 * Services". To compare districts at all we have to fold those into canonical topics.
 */

export const TOPICS = [
	'Overall Economic Activity',
	'Labor Markets',
	'Prices',
	'Consumer Spending',
	'Manufacturing',
	'Real Estate and Construction',
	'Banking and Finance',
	'Nonfinancial Services',
	'Agriculture and Resources',
	'Community Conditions',
	'Other'
] as const;

export type Topic = (typeof TOPICS)[number];

/** Topics that appear in every district, so charts can rely on them being present. */
export const CORE_TOPICS: Topic[] = ['Overall Economic Activity', 'Labor Markets', 'Prices'];

function normalize(heading: string): string {
	return heading
		.replace(/ /g, ' ')
		.toLowerCase()
		.replace(/[^a-z0-9 ]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Exact matches for every heading observed across the twelve districts in 2026.
 * Keys are normalized (lowercase, punctuation stripped).
 */
const EXACT: Record<string, Topic> = {
	// Overall
	'summary of economic activity': 'Overall Economic Activity',
	'overall economic activity': 'Overall Economic Activity',
	// Pre-2017 wording for the same opening section.
	overview: 'Overall Economic Activity',
	summary: 'Overall Economic Activity',
	'general business conditions': 'Overall Economic Activity',

	// Labor
	'labor markets': 'Labor Markets',
	'worker experience': 'Labor Markets',
	// Wording used before the section was renamed to "Labor Markets" in 2018.
	'employment and wages': 'Labor Markets',
	'labor markets and wages': 'Labor Markets',
	// Boston's staffing-firm reports are a labour-market read.
	staffing: 'Labor Markets',
	'temporary employment': 'Labor Markets',
	// 2011-2016 combined the two into one section; it is filed under Labor Markets,
	// which is why the separate Prices series has a gap over those years.
	'employment wages and prices': 'Labor Markets',
	'labor markets wages and prices': 'Labor Markets',

	// Prices
	prices: 'Prices',

	// Consumer spending / retail / tourism
	'consumer spending': 'Consumer Spending',
	'retail and tourism': 'Consumer Spending',
	'retail sales': 'Consumer Spending',
	'retail trade and services': 'Consumer Spending',
	'retail travel and tourism': 'Consumer Spending',

	// Manufacturing
	manufacturing: 'Manufacturing',
	'manufacturing and distribution': 'Manufacturing',
	'manufacturing and related services': 'Manufacturing',
	'manufacturing and other business activity': 'Manufacturing',

	// Real estate and construction
	'real estate and construction': 'Real Estate and Construction',
	'construction and real estate': 'Real Estate and Construction',
	'commercial real estate': 'Real Estate and Construction',
	'residential real estate': 'Real Estate and Construction',

	// Banking and finance
	'banking and finance': 'Banking and Finance',
	'financial services': 'Banking and Finance',
	'financial institutions': 'Banking and Finance',
	// San Francisco shortened its heading to the bare word in some 2023 editions.
	institutions: 'Banking and Finance',
	'credit conditions': 'Banking and Finance',
	'banking and financial services': 'Banking and Finance',
	'community and regional banking': 'Banking and Finance',
	// Pre-2017 wording.
	'financial developments': 'Banking and Finance',
	'banking and credit': 'Banking and Finance',
	finance: 'Banking and Finance',
	banking: 'Banking and Finance',

	// Services, transport, business spending
	'nonfinancial services': 'Nonfinancial Services',
	services: 'Nonfinancial Services',
	'trade and services': 'Nonfinancial Services',
	transportation: 'Nonfinancial Services',
	'ports and transportation': 'Nonfinancial Services',
	'business spending': 'Nonfinancial Services',
	// Cleveland reported on freight separately for much of 2019-2020.
	freight: 'Nonfinancial Services',
	'transportation and logistics': 'Nonfinancial Services',
	// Wording common in the pre-2017 editions.
	'other business activity': 'Nonfinancial Services',
	'selected business services': 'Nonfinancial Services',
	'trucking and shipping': 'Nonfinancial Services',
	'services and tourism': 'Nonfinancial Services',

	// Agriculture, energy, natural resources
	agriculture: 'Agriculture and Resources',
	energy: 'Agriculture and Resources',
	'agriculture and natural resources': 'Agriculture and Resources',
	'agriculture energy and natural resources': 'Agriculture and Resources',
	'agriculture and resource related industries': 'Agriculture and Resources',

	// Community
	'community conditions': 'Community Conditions',
	'community perspectives': 'Community Conditions',
	'minority and women owned business enterprises': 'Community Conditions'
};

/**
 * Keyword fallback, tried in order, for headings the Fed introduces later that
 * aren't in the exact map. Ordered most- to least-specific: "real estate" must be
 * checked before "estate", and "financial services" before the bare "services".
 */
const KEYWORDS: [RegExp, Topic][] = [
	[/\bprice|inflation|cost pressure/, 'Prices'],
	[/\blabor|employment|wage|hiring|worker/, 'Labor Markets'],
	[/\breal estate|construction|housing|residential|commercial property/, 'Real Estate and Construction'],
	[/\bbank|financ|credit|lending|loan|institution|insurance/, 'Banking and Finance'],
	[/\bagricultur|energy|natural resource|farm|mining|oil/, 'Agriculture and Resources'],
	[/\bmanufactur|industrial|factory/, 'Manufacturing'],
	[/\bretail|consumer|tourism|travel|hospitality|auto sales/, 'Consumer Spending'],
	[/\bcommunity|nonprofit|minority|women owned|perspective/, 'Community Conditions'],
	[/\bservice|transport|port|logistic|business spending/, 'Nonfinancial Services'],
	[/\bsummary|overall|economic activity/, 'Overall Economic Activity']
];

/** Headings that could not be mapped, collected so the map can be extended. */
const unmapped = new Set<string>();

export function canonicalTopic(heading: string): Topic {
	const key = normalize(heading);
	if (!key) return 'Other';

	const exact = EXACT[key];
	if (exact) return exact;

	for (const [pattern, topic] of KEYWORDS) {
		if (pattern.test(key)) return topic;
	}

	unmapped.add(heading);
	return 'Other';
}

/** Headings seen this process that fell through to 'Other'. Logged after ingest. */
export function unmappedHeadings(): string[] {
	return [...unmapped].sort();
}

/** Stable display order for charts. */
export function topicOrder(topic: string): number {
	const i = (TOPICS as readonly string[]).indexOf(topic);
	return i === -1 ? TOPICS.length : i;
}
