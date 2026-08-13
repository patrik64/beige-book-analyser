import { describe, expect, it } from 'vitest';
import { score, tokenize } from './score';

/** Sentences below are real or near-real Beige Book phrasing. */
describe('score', () => {
	it('reads growth as positive and decline as negative', () => {
		expect(score('Economic activity grew at a modest pace.').score).toBeGreaterThan(0);
		expect(score('Economic activity declined modestly.').score).toBeLessThan(0);
	});

	it('scales with the intensity word, not just the direction', () => {
		const slight = score('Activity increased slightly.').score;
		const modest = score('Activity increased modestly.').score;
		const robust = score('Activity increased robustly.').score;
		expect(slight).toBeLessThan(modest);
		expect(modest).toBeLessThan(robust);
	});

	it('treats the same intensity symmetrically in both directions', () => {
		const up = score('Sales rose moderately.').score;
		const down = score('Sales fell moderately.').score;
		expect(up).toBeCloseTo(-down, 5);
	});

	it('scores no-change language as neutral', () => {
		expect(score('Employment was unchanged on balance.').score).toBe(0);
		expect(score('Activity was little changed.').score).toBe(0);
		expect(Math.abs(score('Payrolls remained flat.').score)).toBeLessThan(0.05);
	});

	it('does not read "no change" as a negated increase', () => {
		const r = score('There was no change in headcount.');
		expect(r.score).toBe(0);
		expect(r.termHits.some((h) => h.term.toLowerCase().includes('no change'))).toBe(true);
	});

	it('handles negation of a direction word', () => {
		expect(score('Contacts did not increase headcount.').score).toBeLessThan(0);
	});

	it('picks up multi-word direction phrases', () => {
		expect(score('Consumer spending picked up.').score).toBeGreaterThan(0);
		expect(score('Manufacturing activity pulled back.').score).toBeLessThan(0);
	});

	describe('price inversion', () => {
		it('scores rising prices as bad news', () => {
			const r = score('Prices rose robustly across the District.', { invert: true });
			expect(r.score).toBeLessThan(-0.2);
		});

		it('scores easing price growth as good news', () => {
			const r = score('Price growth eased moderately.', { invert: true });
			expect(r.score).toBeGreaterThan(0);
		});

		it('is the exact mirror of the uninverted score', () => {
			const text = 'Input costs increased sharply.';
			expect(score(text, { invert: true }).score).toBeCloseTo(-score(text).score, 5);
		});

		it('does not invert standalone tone words', () => {
			// "uncertainty" is bad news whether or not the section is about prices.
			const plain = score('Contacts cited uncertainty.');
			const inverted = score('Contacts cited uncertainty.', { invert: true });
			expect(plain.score).toBeLessThan(0);
			expect(inverted.score).toBeLessThan(0);
		});
	});

	it('averages tone rather than accumulating it', () => {
		const sentence = 'Activity increased modestly.';
		const thrice = score(sentence.repeat(3));
		const sixTimes = score(sentence.repeat(6));
		// Past the confidence floor, repeating the same claim must not push the score
		// toward the extreme — a long section is not a more positive one.
		expect(sixTimes.score).toBeCloseTo(thrice.score, 5);
	});

	it('damps sections with only one or two scoring terms', () => {
		// A lone clause is thin evidence, so the floor of 3 holds it back from the
		// full weight the same clause reaches once corroborated.
		const once = score('Activity increased modestly.');
		const thrice = score('Activity increased modestly.'.repeat(3));
		expect(once.score).toBeLessThan(thrice.score);
		expect(thrice.score).toBeCloseTo(0.35, 2);
	});

	describe('sentence boundaries', () => {
		it('does not pair a direction word with an intensity from the next sentence', () => {
			const text = 'Oil and gas drilling increased. Manufacturing production grew modestly.';
			const r = score(text);
			// "increased" must not reach across the full stop to claim "modestly".
			for (const hit of r.termHits) expect(hit.term).not.toMatch(/\./);
		});

		it('keeps both claims when two sentences each carry one', () => {
			const r = score('Activity increased. Growth slowed.');
			const terms = r.termHits.map((h) => h.term.toLowerCase());
			expect(terms.some((t) => t.includes('increased'))).toBe(true);
			expect(terms.some((t) => t.includes('slowed'))).toBe(true);
		});

		it('does not let a negator reach back into the previous sentence', () => {
			// "not" belongs to the first sentence; "rose" must stay positive.
			expect(score('Costs did not fall. Sales rose sharply.').score).toBeGreaterThan(0);
		});

		it('still suppresses a noun subject inside one sentence', () => {
			expect(score('Price growth eased moderately.', { invert: true }).score).toBeGreaterThan(0);
		});
	});

	it('returns a neutral score for text with no lexicon matches', () => {
		const r = score('The report was prepared at the Federal Reserve Bank of Richmond.');
		expect(r.score).toBe(0);
		expect(r.termHits).toHaveLength(0);
	});

	it('gives term hits offsets that map back onto the original text', () => {
		const text = 'Activity increased at a modest pace.';
		const r = score(text);
		expect(r.termHits.length).toBeGreaterThan(0);
		for (const hit of r.termHits) {
			expect(text.slice(hit.start, hit.end)).toBe(hit.term);
		}
	});

	it('counts the Fed pace vocabulary independently of scoring', () => {
		const r = score('Growth was modest in most sectors, though a few reported moderate gains.');
		expect(r.paceWords.modest).toBe(1);
		expect(r.paceWords.moderate).toBe(1);
	});

	it('keeps scores inside [-1, 1]', () => {
		const shouty = 'Activity surged dramatically. Sales rose robustly. Growth expanded sharply.';
		expect(score(shouty).score).toBeLessThanOrEqual(1);
		expect(score(shouty, { invert: true }).score).toBeGreaterThanOrEqual(-1);
	});

	it('labels scores in readable buckets', () => {
		expect(score('Activity was unchanged.').label).toBe('neutral');
		expect(score('Activity declined sharply and dropped steeply.').label).toContain('negative');
	});
});

describe('tokenize', () => {
	it('records offsets that slice back to the token', () => {
		const text = 'Prices rose modestly.';
		for (const t of tokenize(text)) {
			expect(text.slice(t.start, t.end).toLowerCase()).toBe(t.text);
		}
	});

	it('keeps hyphenated and apostrophised words whole', () => {
		expect(tokenize("year-over-year growth didn't stall").map((t) => t.text)).toEqual([
			'year-over-year',
			'growth',
			"didn't",
			'stall'
		]);
	});
});
