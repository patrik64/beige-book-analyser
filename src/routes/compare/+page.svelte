<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SectionText from '$lib/components/SectionText.svelte';
	import SentimentBadge from '$lib/components/SentimentBadge.svelte';
	import { paceDiff } from '$lib/shared/paceDiff';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let scope = $state<'all' | 'national' | 'highlight' | 'district'>('highlight');
	let expanded = $state<string | null>(null);

	const from = $derived(data.comparison?.a.slug ?? '');
	const to = $derived(data.comparison?.b.slug ?? '');

	function choose(which: 'from' | 'to', slug: string) {
		const url = new URL(page.url);
		url.searchParams.set('from', which === 'from' ? slug : from);
		url.searchParams.set('to', which === 'to' ? slug : to);
		goto(url, { keepFocus: true });
	}

	const pairs = $derived(
		(data.comparison?.pairs ?? []).filter((p) => scope === 'all' || p.scope === scope)
	);

	const movers = $derived(pairs.filter((p) => Math.abs(p.delta) >= 0.05));

	// A highlight blurb is headed by its own district name, so "Richmond — Richmond"
	// would just repeat itself.
	const titleOf = (pair: (typeof pairs)[number]) =>
		pair.scope === 'national'
			? pair.heading
			: pair.scope === 'highlight'
				? pair.district
				: `${pair.district} — ${pair.heading}`;
</script>

<h1>Compare releases</h1>
<p class="lede">
	The same section, two editions apart. Sentiment moves are one signal; the pace words the Fed
	swapped are another — "moderate" becoming "modest" is a deliberate downgrade that barely shifts
	the score.
</p>

{#if !data.comparison}
	<div class="empty"><p>At least two releases are needed to compare. Run <code>pnpm ingest</code>.</p></div>
{:else}
	<div class="controls">
		<select
			value={from}
			onchange={(e) => choose('from', e.currentTarget.value)}
			aria-label="Compare from"
		>
			{#each data.releases as release (release.id)}
				<option value={release.slug}>{release.label}</option>
			{/each}
		</select>

		<span class="arrow">→</span>

		<select value={to} onchange={(e) => choose('to', e.currentTarget.value)} aria-label="Compare to">
			{#each data.releases as release (release.id)}
				<option value={release.slug}>{release.label}</option>
			{/each}
		</select>

		<select bind:value={scope} aria-label="Which sections">
			<option value="highlight">District highlights</option>
			<option value="national">National summary</option>
			<option value="district">District detail</option>
			<option value="all">Everything</option>
		</select>

		<span class="badge">{movers.length} of {pairs.length} moved by 0.05 or more</span>
	</div>

	{#if pairs.length === 0}
		<div class="empty"><p>No matching sections between these two releases.</p></div>
	{:else}
		<div class="pairs">
			{#each pairs as pair (pair.key)}
				{@const changes = paceDiff(pair.from.paceWords, pair.to.paceWords)}
				<article class="card">
					<div class="pair-head">
						<h2>{titleOf(pair)}</h2>
						<span class="delta" class:up={pair.delta > 0} class:down={pair.delta < 0}>
							{pair.delta > 0 ? '▲' : pair.delta < 0 ? '▼' : '■'}
							{pair.delta > 0 ? '+' : ''}{pair.delta.toFixed(2)}
						</span>
					</div>

					<div class="scores">
						<span>{data.comparison.a.label} <SentimentBadge score={pair.from.sentimentScore} /></span>
						<span class="arrow">→</span>
						<span>{data.comparison.b.label} <SentimentBadge score={pair.to.sentimentScore} /></span>
					</div>

					{#if changes.length}
						<div class="pace">
							<span class="pace-label">Pace words:</span>
							{#each changes as change (change.word)}
								<span class="chip" class:more={change.delta > 0} class:less={change.delta < 0}>
									{change.word}
									{change.delta > 0 ? '+' : ''}{change.delta}
								</span>
							{/each}
						</div>
					{:else}
						<p class="pace-none">No change in pace vocabulary.</p>
					{/if}

					<button
						class="expand"
						onclick={() => (expanded = expanded === pair.key ? null : pair.key)}
						aria-expanded={expanded === pair.key}
					>
						{expanded === pair.key ? 'Hide text' : 'Read both'}
					</button>

					{#if expanded === pair.key}
						<div class="texts">
							<div class="col">
								<h3>{data.comparison.a.label}</h3>
								<SectionText body={pair.from.body} termHits={pair.from.termHits} />
							</div>
							<div class="col">
								<h3>{data.comparison.b.label}</h3>
								<SectionText body={pair.to.body} termHits={pair.to.termHits} />
							</div>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
{/if}

<style>
	.lede {
		color: var(--text-secondary);
		max-width: 70ch;
		margin: 0.4rem 0 1.5rem;
		font-size: 0.95rem;
	}

	.arrow {
		color: var(--muted);
	}

	.pairs {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.pair-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.pair-head h2 {
		font-size: 1rem;
	}

	.delta {
		font-variant-numeric: tabular-nums;
		font-weight: 580;
		font-size: 0.9rem;
		color: var(--muted);
		white-space: nowrap;
	}

	.delta.up {
		color: var(--pos-4);
	}

	.delta.down {
		color: var(--neg-4);
	}

	.scores {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin-top: 0.5rem;
	}

	.scores span {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.pace {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-top: 0.7rem;
	}

	.pace-label,
	.pace-none {
		font-size: 0.78rem;
		color: var(--muted);
		margin: 0.7rem 0 0;
	}

	.pace-label {
		margin: 0;
	}

	.chip {
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 0.08rem 0.5rem;
		color: var(--text-secondary);
	}

	.chip.more {
		border-color: var(--pos-3);
	}

	.chip.less {
		border-color: var(--neg-3);
	}

	.expand {
		margin-top: 0.85rem;
		font-size: 0.8rem;
	}

	.texts {
		display: grid;
		gap: 1.4rem;
		margin-top: 1rem;
		border-top: 1px solid var(--gridline);
		padding-top: 1rem;
	}

	@media (min-width: 900px) {
		.texts {
			grid-template-columns: 1fr 1fr;
		}
	}

	.col h3 {
		font-size: 0.8rem;
		color: var(--muted);
		margin-bottom: 0.4rem;
		font-weight: 560;
	}

	code {
		background: var(--page);
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 0.1rem 0.35rem;
	}
</style>
