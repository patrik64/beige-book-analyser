/**
 * Chart colour tokens.
 *
 * Canvas cannot read CSS custom properties, so the values Chart.js needs live here
 * in TypeScript and are mirrored by the CSS tokens in app.css. Every palette below
 * was checked with the data-viz validator rather than picked by eye:
 *
 *  - categorical (3 series)  all six checks pass in both modes; light-mode aqua sits
 *                            at 2.74:1, so those charts ship direct end-labels
 *  - diverging (sentiment)   monotone lightness, single hue per arm, gray midpoint.
 *                            Blue<->red, NOT green<->red: red still reads as bad news,
 *                            but green/red is the classic colour-blind failure and
 *                            blue/red is the validated diverging pair.
 *  - ordinal (pace words)    5 steps, monotone L, adjacent dL >= 0.06, light end
 *                            clears 2:1 against its surface in both modes
 */

export interface Palette {
	surface: string;
	gridline: string;
	axis: string;
	textPrimary: string;
	textSecondary: string;
	muted: string;
	/** Categorical slots, assigned in fixed order and never cycled. */
	series: [string, string, string];
	/** Diverging arms, ordered from the neutral midpoint outward. */
	negative: [string, string, string, string];
	positive: [string, string, string, string];
	neutral: string;
	/** Ordinal ramp, weakest to strongest. */
	ordinal: [string, string, string, string, string];
}

export const LIGHT: Palette = {
	surface: '#fcfcfb',
	gridline: '#e1e0d9',
	axis: '#c3c2b7',
	textPrimary: '#0b0b0b',
	textSecondary: '#52514e',
	muted: '#898781',
	series: ['#2a78d6', '#eb6834', '#1baf7a'],
	negative: ['#fbd9d8', '#f3a9a7', '#e56d6b', '#d03b3b'],
	positive: ['#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6'],
	neutral: '#f0efec',
	ordinal: ['#86b6ef', '#3987e5', '#256abf', '#184f95', '#0d366b']
};

export const DARK: Palette = {
	surface: '#1a1a19',
	gridline: '#2c2c2a',
	axis: '#383835',
	textPrimary: '#ffffff',
	textSecondary: '#c3c2b7',
	muted: '#898781',
	series: ['#3987e5', '#d95926', '#199e70'],
	negative: ['#6e2020', '#9c2f2f', '#d03b3b', '#e66767'],
	positive: ['#184f95', '#256abf', '#3987e5', '#86b6ef'],
	neutral: '#383835',
	ordinal: ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#b7d3f6']
};

/**
 * Map a sentiment score in [-1, 1] onto the diverging scale.
 * Scores cluster near zero, so the arms are banded rather than linear — otherwise
 * every cell in the heatmap would sit at the pale end and the map would read blank.
 */
export function divergingColor(scoreValue: number, palette: Palette): string {
	const magnitude = Math.abs(scoreValue);
	if (magnitude < 0.05) return palette.neutral;

	const arm = scoreValue < 0 ? palette.negative : palette.positive;
	if (magnitude < 0.15) return arm[0];
	if (magnitude < 0.3) return arm[1];
	if (magnitude < 0.5) return arm[2];
	return arm[3];
}

/** The legend steps for the diverging scale, strongest negative to strongest positive. */
export function divergingLegend(palette: Palette): { color: string; label: string }[] {
	return [
		{ color: palette.negative[3], label: '≤ −0.50' },
		{ color: palette.negative[2], label: '−0.30' },
		{ color: palette.negative[1], label: '−0.15' },
		{ color: palette.negative[0], label: '−0.05' },
		{ color: palette.neutral, label: '0' },
		{ color: palette.positive[0], label: '+0.05' },
		{ color: palette.positive[1], label: '+0.15' },
		{ color: palette.positive[2], label: '+0.30' },
		{ color: palette.positive[3], label: '≥ +0.50' }
	];
}
