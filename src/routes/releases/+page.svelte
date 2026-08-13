<script lang="ts">
	import SentimentBadge from '$lib/components/SentimentBadge.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	/** Average of the twelve district highlights for a release — its overall reading. */
	function toneOf(releaseIndex: number): number {
		const values = data.matrix.cells
			.map((row) => row[releaseIndex])
			.filter((v): v is number => v !== null);
		return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
	}

	const topicScore = (releaseIndex: number, topic: string) =>
		data.trend.series[data.trend.topics.indexOf(topic)]?.[releaseIndex] ?? null;

	// Newest first, grouped by year — eighty rows in one flat list is unreadable.
	const byYear = $derived.by(() => {
		const groups = new Map<number, { release: (typeof data.releases)[number]; index: number }[]>();
		data.releases.forEach((release, index) => {
			const list = groups.get(release.year) ?? [];
			list.push({ release, index });
			groups.set(release.year, list);
		});
		return [...groups.entries()].sort((a, b) => b[0] - a[0]);
	});
</script>

<h1>Releases</h1>
<p class="lede">
	The Beige Book is published eight times a year. Each edition is compiled by a different Reserve
	Bank from interviews conducted in the weeks before a fixed cutoff date.
</p>

{#if data.releases.length === 0}
	<div class="empty"><p>No releases ingested yet — run <code>pnpm ingest --all</code>.</p></div>
{:else}
	{#each byYear as [year, entries] (year)}
		<section class="year">
			<div class="year-head">
				<h2>{year}</h2>
				<span class="badge">{entries.length} releases</span>
			</div>
			<div class="list">
				{#each entries as { release, index } (release.id)}
					<a class="row" href="/releases/{release.slug}">
						<div class="main">
							<span class="label">{release.label.replace(` ${year}`, '')}</span>
							<span class="meta">
								{release.preparedBy.replace('Federal Reserve Bank of ', '') || '—'} · data through
								{release.dataCutoff || '—'}
							</span>
						</div>

						<div class="scores">
							{#each data.trend.topics as topic (topic)}
								{@const value = topicScore(index, topic)}
								<span class="score">
									<span class="score-label">{topic.replace('Overall Economic ', '')}</span>
									<span class="score-value">
										{value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}`}
									</span>
								</span>
							{/each}
						</div>

						<SentimentBadge score={toneOf(index)} />
					</a>
				{/each}
			</div>
		</section>
	{/each}
{/if}

<style>
	.lede {
		color: var(--text-secondary);
		max-width: 66ch;
		margin: 0.4rem 0 1.6rem;
		font-size: 0.95rem;
	}

	.year {
		margin-bottom: 1.8rem;
	}

	.year-head {
		display: flex;
		align-items: baseline;
		gap: 0.7rem;
		margin-bottom: 0.6rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--border);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.8rem 1.1rem;
		color: var(--text-primary);
	}

	.row:hover {
		border-color: var(--accent);
		text-decoration: none;
	}

	.main {
		display: flex;
		flex-direction: column;
		min-width: 190px;
	}

	.label {
		font-weight: 580;
		font-size: 0.95rem;
	}

	.meta {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.scores {
		display: flex;
		gap: 1.4rem;
		margin-left: auto;
	}

	.score {
		display: flex;
		flex-direction: column;
	}

	.score-label {
		font-size: 0.7rem;
		color: var(--muted);
	}

	.score-value {
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
		font-weight: 560;
	}

	code {
		background: var(--page);
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 0.1rem 0.35rem;
	}
</style>
