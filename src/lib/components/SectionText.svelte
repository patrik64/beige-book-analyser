<script lang="ts">
	import type { TermHit } from '$lib/shared/sentiment-types';

	interface Props {
		body: string;
		termHits: TermHit[];
		/** Show the scoring terms picked out in the prose. */
		highlight?: boolean;
	}

	let { body, termHits, highlight = true }: Props = $props();

	interface Segment {
		text: string;
		hit?: TermHit;
	}

	/**
	 * Slice the body into plain and scored segments using the character offsets the
	 * scorer recorded. Hits never overlap and arrive sorted, so a single pass is
	 * enough; anything out of range is skipped rather than trusted.
	 */
	const segments = $derived.by<Segment[]>(() => {
		if (!highlight || !termHits?.length) return [{ text: body }];

		const out: Segment[] = [];
		let cursor = 0;

		for (const hit of termHits) {
			if (hit.start < cursor || hit.end > body.length) continue;
			if (hit.start > cursor) out.push({ text: body.slice(cursor, hit.start) });
			out.push({ text: body.slice(hit.start, hit.end), hit });
			cursor = hit.end;
		}
		if (cursor < body.length) out.push({ text: body.slice(cursor) });
		return out;
	});

	const toneOf = (hit: TermHit) => (hit.weight > 0 ? 'pos' : hit.weight < 0 ? 'neg' : 'flat');

	const titleOf = (hit: TermHit) =>
		hit.weight === 0
			? `"${hit.term}" — no change`
			: `"${hit.term}" — contributes ${hit.weight > 0 ? '+' : ''}${hit.weight.toFixed(2)}`;
</script>

<p class="body">
	{#each segments as segment, i (i)}
		{#if segment.hit}
			<mark class={toneOf(segment.hit)} title={titleOf(segment.hit)}>{segment.text}</mark>
		{:else}
			{segment.text}
		{/if}
	{/each}
</p>

<style>
	.body {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.92rem;
		line-height: 1.68;
		white-space: pre-wrap;
		max-width: 78ch;
	}

	mark {
		background: var(--highlight-flat);
		color: var(--text-primary);
		border-radius: 3px;
		padding: 0.05em 0.12em;
		/* An underline keeps the marks legible without colour, and in forced-colors. */
		border-bottom: 2px solid var(--muted);
		cursor: help;
	}

	mark.pos {
		background: var(--highlight-pos);
		border-bottom-color: var(--pos-4);
	}

	mark.neg {
		background: var(--highlight-neg);
		border-bottom-color: var(--neg-4);
	}
</style>
