import { PACE_WORD_ORDER } from './paceWords';

export interface PaceChange {
	word: string;
	from: number;
	to: number;
	delta: number;
}

/**
 * Which of the Fed's pace words were swapped between two versions of a section.
 *
 * This is the change worth seeing: when a district goes from "moderate growth" to
 * "modest growth", the sentiment score barely moves but the Fed has said something
 * quite deliberate.
 */
export function paceDiff(
	from: Record<string, number>,
	to: Record<string, number>
): PaceChange[] {
	const words = new Set([...Object.keys(from ?? {}), ...Object.keys(to ?? {})]);

	return [...words]
		.map((word) => {
			const a = from?.[word] ?? 0;
			const b = to?.[word] ?? 0;
			return { word, from: a, to: b, delta: b - a };
		})
		.filter((change) => change.delta !== 0)
		.sort((x, y) => {
			const rank = (word: string) => {
				const i = (PACE_WORD_ORDER as readonly string[]).indexOf(word);
				return i === -1 ? PACE_WORD_ORDER.length : i;
			};
			const order = rank(x.word) - rank(y.word);
			return order !== 0 ? order : x.word.localeCompare(y.word);
		});
}
