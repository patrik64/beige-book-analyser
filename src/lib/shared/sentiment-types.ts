/**
 * Shared between the server-side scorer and the browser UI, so it lives outside
 * `$lib/server`.
 */

export interface TermHit {
	/** The matched surface form, e.g. "at a modest pace". */
	term: string;
	/** Signed contribution after negation and price inversion. */
	weight: number;
	/** Character offsets into Section.body, for inline highlighting. */
	start: number;
	end: number;
	/** True when this hit is one of the Fed's standardized pace words. */
	pace: boolean;
}

export interface SentimentResult {
	score: number;
	label: string;
	termHits: TermHit[];
	paceWords: Record<string, number>;
}

/** Buckets used for the label and for the chart legend. */
export function sentimentLabel(score: number): string {
	if (score <= -0.6) return 'strongly negative';
	if (score <= -0.3) return 'negative';
	if (score <= -0.1) return 'slightly negative';
	if (score < 0.1) return 'neutral';
	if (score < 0.3) return 'slightly positive';
	if (score < 0.6) return 'positive';
	return 'strongly positive';
}
