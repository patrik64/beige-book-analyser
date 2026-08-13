/**
 * The Beige Book lexicon.
 *
 * The Fed writes this report with a deliberately controlled vocabulary. Nearly every
 * substantive clause is DIRECTION + INTENSITY:
 *
 *   "activity increased at a slight to modest pace"
 *   "employment was unchanged on balance"
 *   "prices rose modestly further"
 *
 * So rather than summing independent word weights (which would make "declined
 * modestly" and "declined sharply" both saturate at -1), we pair each direction word
 * with the nearest intensity word and emit one signed hit per clause:
 *
 *   weight = sign(direction) x magnitude(intensity)
 *
 * Intensity words carry no sign of their own — "modest" is only positive or negative
 * once you know whether it modifies "growth" or "decline". That pairing is what makes
 * this lexicon fit the source material rather than generic finance prose.
 */

/** Direction words: +1 for expansion, -1 for contraction. */
export const DIRECTIONS: Record<string, 1 | -1> = {
	// expansion
	increased: 1,
	increase: 1,
	increases: 1,
	increasing: 1,
	rose: 1,
	rise: 1,
	rising: 1,
	risen: 1,
	grew: 1,
	grow: 1,
	growing: 1,
	growth: 1,
	expanded: 1,
	expand: 1,
	expanding: 1,
	expansion: 1,
	improved: 1,
	improve: 1,
	improving: 1,
	improvement: 1,
	improvements: 1,
	strengthened: 1,
	strengthening: 1,
	gained: 1,
	gains: 1,
	gain: 1,
	advanced: 1,
	accelerated: 1,
	accelerating: 1,
	higher: 1,
	upward: 1,
	boosted: 1,
	climbed: 1,
	up: 1,

	// contraction
	declined: -1,
	decline: -1,
	declines: -1,
	declining: -1,
	decreased: -1,
	decrease: -1,
	decreasing: -1,
	fell: -1,
	fall: -1,
	falling: -1,
	dropped: -1,
	drop: -1,
	contracted: -1,
	contract: -1,
	contracting: -1,
	contraction: -1,
	weakened: -1,
	weaken: -1,
	weakening: -1,
	softened: -1,
	soften: -1,
	softening: -1,
	slowed: -1,
	slow: -1,
	slowing: -1,
	slowdown: -1,
	deteriorated: -1,
	deteriorating: -1,
	worsened: -1,
	eased: -1,
	ease: -1,
	easing: -1,
	cooled: -1,
	cooling: -1,
	lower: -1,
	downward: -1,
	reduced: -1,
	shrank: -1,
	down: -1
};

/** Multi-word direction phrases, checked before single tokens. */
export const DIRECTION_PHRASES: Record<string, 1 | -1> = {
	'picked up': 1,
	'ticked up': 1,
	'edged up': 1,
	'moved up': 1,
	'trended up': 1,
	'pulled back': -1,
	'ticked down': -1,
	'edged down': -1,
	'moved down': -1,
	'trended down': -1,
	'scaled back': -1,
	'fell off': -1,
	'tapered off': -1
};

/**
 * Intensity magnitudes, 0..1. Unsigned by design — the paired direction word
 * supplies the sign.
 */
export const INTENSITIES: Record<string, number> = {
	marginal: 0.15,
	marginally: 0.15,
	slight: 0.2,
	slightly: 0.2,
	somewhat: 0.25,
	mild: 0.3,
	mildly: 0.3,
	modest: 0.35,
	modestly: 0.35,
	moderate: 0.5,
	moderately: 0.5,
	solid: 0.65,
	solidly: 0.65,
	notable: 0.65,
	notably: 0.65,
	appreciable: 0.65,
	appreciably: 0.65,
	healthy: 0.65,
	strong: 0.8,
	strongly: 0.8,
	significant: 0.8,
	significantly: 0.8,
	substantial: 0.8,
	substantially: 0.8,
	considerable: 0.8,
	considerably: 0.8,
	sharp: 0.85,
	sharply: 0.85,
	marked: 0.8,
	markedly: 0.8,
	rapid: 0.8,
	rapidly: 0.8,
	robust: 0.9,
	robustly: 0.9,
	steep: 0.9,
	steeply: 0.9,
	dramatic: 0.95,
	dramatically: 0.95,
	sizable: 0.7,
	sizably: 0.7,
	broad: 0.6,
	broadly: 0.6
};

/** A direction word with no nearby intensity is treated as "moderate". */
export const DEFAULT_INTENSITY = 0.45;

/** Phrases meaning "no change" — a real, scoreable neutral, not an absence of signal. */
export const FLAT_PHRASES = [
	'little changed',
	'little change',
	'no change',
	'not changed',
	'held steady',
	'held stable',
	'remained steady',
	'remained stable',
	'remained flat',
	'remained unchanged',
	'was unchanged',
	'were unchanged',
	'essentially flat',
	'largely unchanged',
	'roughly flat',
	'on par with',
	'about the same',
	'the same as'
];

export const FLAT_WORDS = ['flat', 'unchanged', 'stable', 'steady', 'sideways', 'plateaued'];

/**
 * Standalone tone words. These carry their own sign and are NOT inverted for price
 * sections — "uncertainty" is bad news whatever it is about. Weights are deliberately
 * smaller than clause weights so they colour a section without dominating it.
 */
export const TONE: Record<string, number> = {
	// positive
	optimism: 0.5,
	optimistic: 0.5,
	confidence: 0.4,
	confident: 0.4,
	upbeat: 0.5,
	resilient: 0.4,
	resilience: 0.4,
	favorable: 0.4,
	encouraged: 0.35,
	encouraging: 0.35,
	hopeful: 0.35,

	// negative
	uncertainty: -0.5,
	uncertain: -0.45,
	uncertainties: -0.5,
	layoffs: -0.6,
	layoff: -0.6,
	furloughs: -0.6,
	cautious: -0.3,
	caution: -0.3,
	cautiously: -0.25,
	concern: -0.35,
	concerns: -0.35,
	concerned: -0.35,
	worried: -0.4,
	weakness: -0.5,
	sluggish: -0.5,
	subdued: -0.4,
	soft: -0.35,
	softness: -0.45,
	headwinds: -0.45,
	pessimistic: -0.5,
	pessimism: -0.5,
	closures: -0.5,
	bankruptcies: -0.6,
	delinquencies: -0.45,
	defaults: -0.5,
	tariff: -0.35,
	tariffs: -0.35,
	strained: -0.4,
	strain: -0.35,
	pressures: -0.25,
	difficult: -0.35,
	difficulty: -0.35,
	challenging: -0.35,
	challenges: -0.3
};

/** Negators that flip the sign of a direction word within a short window. */
export const NEGATORS = ['no', 'not', 'never', 'without', 'hardly', 'barely', 'nor', 'neither'];

/**
 * The Fed's standardized pace vocabulary, folded to a canonical stem. Tracked
 * separately from scoring: the raw frequency of these words across a release is a
 * tone signal in its own right, independent of any weighting we apply.
 */
export const PACE_WORD_STEMS: Record<string, string> = {
	declined: 'declined',
	decline: 'declined',
	declines: 'declined',
	declining: 'declined',
	flat: 'flat',
	unchanged: 'flat',
	steady: 'flat',
	stable: 'flat',
	marginal: 'slight',
	marginally: 'slight',
	slight: 'slight',
	slightly: 'slight',
	modest: 'modest',
	modestly: 'modest',
	moderate: 'moderate',
	moderately: 'moderate',
	solid: 'solid',
	solidly: 'solid',
	strong: 'strong',
	strongly: 'strong',
	significant: 'significant',
	significantly: 'significant',
	substantial: 'significant',
	substantially: 'significant',
	sharp: 'sharp',
	sharply: 'sharp',
	robust: 'robust',
	robustly: 'robust'
};

// Display order lives in shared/paceWords.ts — the UI needs it as well as the scorer.
export { PACE_WORD_ORDER } from '$lib/shared/paceWords';
