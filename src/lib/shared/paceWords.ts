/**
 * The Fed's standardized pace vocabulary, ordered weakest to strongest.
 *
 * Lives in shared rather than beside the lexicon because the UI needs it too — the
 * scorer writes these stems into Section.paceWords and the compare view reads them
 * back to show which word the Fed swapped.
 */
export const PACE_WORD_ORDER = [
	'declined',
	'flat',
	'slight',
	'modest',
	'moderate',
	'solid',
	'strong',
	'significant',
	'sharp',
	'robust'
] as const;

export type PaceWord = (typeof PACE_WORD_ORDER)[number];

/** Chart buckets: the five ordered intensity levels, with directional words excluded. */
export const PACE_BUCKETS = ['flat', 'slight', 'modest', 'moderate', 'strong'] as const;
