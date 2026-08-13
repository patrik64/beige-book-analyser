import {
	DEFAULT_INTENSITY,
	DIRECTIONS,
	DIRECTION_PHRASES,
	FLAT_PHRASES,
	FLAT_WORDS,
	INTENSITIES,
	NEGATORS,
	PACE_WORD_STEMS,
	TONE
} from './lexicon';
import { sentimentLabel, type SentimentResult, type TermHit } from '$lib/shared/sentiment-types';

interface Token {
	text: string;
	start: number;
	end: number;
	/** Which sentence this token belongs to. Clauses never pair across a boundary. */
	sentence: number;
}

/** Word tokens with character offsets, so hits can be highlighted in the original text. */
export function tokenize(text: string): Token[] {
	const tokens: Token[] = [];
	const re = /[A-Za-z][A-Za-z'-]*/g;
	let m: RegExpExecArray | null;
	let sentence = 0;
	let previousEnd = 0;

	while ((m = re.exec(text)) !== null) {
		// A terminator in the gap since the last word opens a new sentence. Abbreviations
		// ("St. Louis") split spuriously, which only narrows a search window — far
		// cheaper than letting a clause pair with a word from the next sentence.
		if (/[.!?]/.test(text.slice(previousEnd, m.index))) sentence++;
		tokens.push({
			text: m[0].toLowerCase(),
			start: m.index,
			end: m.index + m[0].length,
			sentence
		});
		previousEnd = m.index + m[0].length;
	}
	return tokens;
}

export interface ScoreOptions {
	/**
	 * Flip the sign of directional clauses. Set for Prices sections: "prices rose
	 * robustly" is upbeat language but bad economic news, and every chart in the app
	 * reads green = good. Standalone tone words are never inverted.
	 */
	invert?: boolean;
}

/** How far from a direction word we look for the intensity that modifies it. */
const INTENSITY_WINDOW = 4;
/** How far back from a direction word a negator can reach. */
const NEGATION_WINDOW = 3;

export function score(text: string, options: ScoreOptions = {}): SentimentResult {
	const invert = options.invert ?? false;
	const tokens = tokenize(text);
	const lower = text.toLowerCase();

	const hits: TermHit[] = [];
	const paceWords: Record<string, number> = {};

	// Tokens already consumed by a matched clause, so an intensity word isn't also
	// counted as a standalone term and phrases don't overlap.
	const consumed = new Set<number>();

	// Pace words are counted across the whole text, independent of what scores.
	for (const t of tokens) {
		const stem = PACE_WORD_STEMS[t.text];
		if (stem) paceWords[stem] = (paceWords[stem] ?? 0) + 1;
	}

	// --- 1. Flat phrases ("remained unchanged", "little changed") -------------
	// Matched on raw text first so they can't be torn apart into a direction word
	// plus a negator ("no change" must not read as a negated increase).
	for (const phrase of FLAT_PHRASES) {
		let from = 0;
		for (;;) {
			const at = lower.indexOf(phrase, from);
			if (at === -1) break;
			from = at + phrase.length;
			const covered = tokens.filter((t) => t.start >= at && t.end <= at + phrase.length);
			if (covered.some((t) => consumed.has(tokens.indexOf(t)))) continue;
			covered.forEach((t) => consumed.add(tokens.indexOf(t)));
			hits.push({ term: text.slice(at, at + phrase.length), weight: 0, start: at, end: at + phrase.length, pace: true });
		}
	}

	// --- 2. Directional clauses ------------------------------------------------
	// First locate every candidate, then drop the ones that are really subjects
	// rather than claims (see below), then score what survives.
	interface Candidate {
		start: number;
		end: number;
		sign: 1 | -1;
	}
	const candidates: Candidate[] = [];

	for (let i = 0; i < tokens.length; i++) {
		if (consumed.has(i)) continue;

		let sign: 1 | -1 | undefined;
		let endIndex = i;

		// Two-word direction phrases ("picked up", "pulled back") take precedence.
		if (i + 1 < tokens.length && !consumed.has(i + 1)) {
			const pair = `${tokens[i].text} ${tokens[i + 1].text}`;
			if (DIRECTION_PHRASES[pair] !== undefined) {
				sign = DIRECTION_PHRASES[pair];
				endIndex = i + 1;
			}
		}
		if (sign === undefined) sign = DIRECTIONS[tokens[i].text];
		if (sign === undefined) continue;

		// "up"/"down" are only directional next to a real subject; on their own they
		// produce far too many spurious hits, so skip the prepositional uses
		// ("up to 5 percent", "down from last month").
		if (['up', 'down'].includes(tokens[i].text) && endIndex === i) {
			const next = tokens[i + 1]?.text;
			if (next === 'to' || next === 'from') continue;
		}

		candidates.push({ start: i, end: endIndex, sign });
		i = endIndex;
	}

	// English puts the subject before the verb, so in a run of direction words the
	// last one carries the claim: "price growth eased", "employment gains slowed",
	// "sales declines moderated". Without this, the noun and the verb are scored as
	// two independent clauses pointing opposite ways and cancel each other out.
	const governing = candidates.filter((c, idx) => {
		const next = candidates[idx + 1];
		if (!next) return true;
		// Only a following direction word in the SAME sentence can be the governing
		// verb; "activity increased. Growth slowed" is two claims, not one.
		if (tokens[next.start].sentence !== tokens[c.end].sentence) return true;
		return next.start - c.end > 2;
	});

	for (const candidate of governing) {
		const i = candidate.start;
		const endIndex = candidate.end;
		const sign = candidate.sign;

		// Nearest intensity word within the window, preferring the closest.
		let magnitude = DEFAULT_INTENSITY;
		let intensityIndex = -1;
		let bestDistance = Infinity;
		for (let j = Math.max(0, i - INTENSITY_WINDOW); j <= Math.min(tokens.length - 1, endIndex + INTENSITY_WINDOW); j++) {
			if (j >= i && j <= endIndex) continue;
			if (consumed.has(j)) continue;
			// "drilling increased. Manufacturing production grew modestly" must not let
			// "increased" claim the "modestly" that belongs to the next sentence.
			if (tokens[j].sentence !== tokens[i].sentence) continue;
			const mag = INTENSITIES[tokens[j].text];
			if (mag === undefined) continue;
			const distance = j < i ? i - j : j - endIndex;
			if (distance < bestDistance) {
				bestDistance = distance;
				magnitude = mag;
				intensityIndex = j;
			}
		}

		// Negation: "did not increase", "no growth in".
		let negated = false;
		for (let j = Math.max(0, i - NEGATION_WINDOW); j < i; j++) {
			if (tokens[j].sentence !== tokens[i].sentence) continue;
			if (NEGATORS.includes(tokens[j].text)) negated = true;
		}

		let weight = sign * magnitude * (negated ? -1 : 1);
		if (invert) weight = -weight;

		const spanStart = Math.min(tokens[i].start, intensityIndex >= 0 ? tokens[intensityIndex].start : Infinity);
		const spanEnd = Math.max(tokens[endIndex].end, intensityIndex >= 0 ? tokens[intensityIndex].end : 0);

		for (let j = i; j <= endIndex; j++) consumed.add(j);
		if (intensityIndex >= 0) consumed.add(intensityIndex);

		hits.push({
			term: text.slice(spanStart, spanEnd),
			weight,
			start: spanStart,
			end: spanEnd,
			pace: intensityIndex >= 0 && PACE_WORD_STEMS[tokens[intensityIndex].text] !== undefined
		});
	}

	// --- 3. Standalone flat words and tone words -------------------------------
	for (let i = 0; i < tokens.length; i++) {
		if (consumed.has(i)) continue;
		const t = tokens[i];

		if (FLAT_WORDS.includes(t.text)) {
			consumed.add(i);
			hits.push({ term: text.slice(t.start, t.end), weight: 0, start: t.start, end: t.end, pace: true });
			continue;
		}

		const tone = TONE[t.text];
		if (tone !== undefined) {
			consumed.add(i);
			hits.push({ term: text.slice(t.start, t.end), weight: tone, start: t.start, end: t.end, pace: false });
		}
	}

	hits.sort((a, b) => a.start - b.start);

	// --- 4. Aggregate ----------------------------------------------------------
	// Mean of hit weights, so this reads as "average tone of the passage" and a long
	// section isn't scored higher merely for being long. The floor of 3 keeps a
	// section with one or two hits from swinging to an extreme on thin evidence.
	const total = hits.reduce((sum, h) => sum + h.weight, 0);
	const divisor = Math.max(hits.length, 3);
	const raw = hits.length === 0 ? 0 : total / divisor;
	const finalScore = Math.max(-1, Math.min(1, Number(raw.toFixed(4))));

	return {
		score: finalScore,
		label: sentimentLabel(finalScore),
		termHits: hits,
		paceWords
	};
}

export function countWords(text: string): number {
	return tokenize(text).length;
}
