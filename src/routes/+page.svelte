<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import Chart from '$lib/charts/Chart.svelte';
	import {
		heatmapConfig,
		nationalTrendConfig,
		paceConfig,
		rankedBarsConfig
	} from '$lib/charts/configs';
	import DivergingLegend from '$lib/components/DivergingLegend.svelte';
	import SentimentBadge from '$lib/components/SentimentBadge.svelte';
	import { IngestController } from '$lib/shared/IngestController';
	import { districtByName } from '$lib/shared/districts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let refreshing = $state(false);
	let refreshError = $state('');

	async function refresh() {
		refreshing = true;
		refreshError = '';
		try {
			await IngestController.refresh(new Date().getFullYear());
			await invalidateAll();
		} catch (error) {
			refreshError = error instanceof Error ? error.message : String(error);
		} finally {
			refreshing = false;
		}
	}

	function selectYear(year: string) {
		const url = new URL(page.url);
		url.searchParams.set('year', year);
		goto(url, { keepFocus: true, noScroll: true });
	}

	const yearLabels = $derived(data.trend.releases.map((r) => r.label.replace(` ${data.year}`, '')));
	const longRunLabels = $derived(data.longRun.releases.map((r) => r.shortLabel));

	const toneWord = $derived(
		data.stats.latestTone > 0.05
			? 'expanding'
			: data.stats.latestTone < -0.05
				? 'softening'
				: 'flat'
	);

	// The one-paragraph-per-district summary is a 2017 invention; before that the
	// grid averages each district's own report instead, and should say so.
	const hasHighlights = $derived(data.trend.releases.some((r) => r.format !== 'legacy'));
	const districtSource = $derived(
		hasHighlights ? "each district's highlight paragraph" : "the average of each district's report"
	);

	function openCell(rowIndex: number, colIndex: number) {
		const district = data.matrix.districts[rowIndex];
		const slug = districtByName(district)?.slug;
		if (slug) goto(`/districts/${slug}?release=${data.matrix.releases[colIndex].slug}`);
	}
</script>

{#if data.stats.releaseCount === 0}
	<div class="empty">
		<h2>No data yet</h2>
		<p>Run <code>pnpm ingest --all</code>, or pull this year's releases straight from the Fed.</p>
		<button onclick={refresh} disabled={refreshing}>
			{refreshing ? 'Fetching…' : 'Fetch latest releases'}
		</button>
		{#if refreshError}<p class="error">{refreshError}</p>{/if}
	</div>
{:else}
	<div class="head">
		<div>
			<h1>The Beige Book, read by tone</h1>
			<p class="lede">
				Every section of all {data.stats.releaseCount} releases from {data.years[0]}–{data.years.at(
					-1
				)}, scored against the Fed's own vocabulary of pace. The latest edition — {data.stats.latest
					?.label} — reads <strong>{toneWord}</strong>.
			</p>
		</div>
		<button onclick={refresh} disabled={refreshing} title="Fetch any new releases from the Fed">
			{refreshing ? 'Refreshing…' : '↻ Refresh'}
		</button>
	</div>

	{#if refreshError}<p class="error">{refreshError}</p>{/if}

	<section class="stats">
		<div class="stat">
			<span class="stat-label">Latest tone</span>
			<span class="stat-value">
				{data.stats.latestTone > 0 ? '+' : ''}{data.stats.latestTone.toFixed(2)}
			</span>
			{#if data.stats.toneChange !== null}
				{@const change = data.stats.toneChange}
				<span class="stat-note">
					{#if Math.abs(change) < 0.005}
						unchanged vs previous
					{:else}
						{change > 0 ? '▲' : '▼'}
						{Math.abs(change).toFixed(2)} vs previous
					{/if}
				</span>
			{/if}
		</div>
		<div class="stat">
			<span class="stat-label">Districts improving</span>
			<span class="stat-value">{data.stats.positiveDistricts}<span class="of">/12</span></span>
			<span class="stat-note">{data.stats.negativeDistricts} softening</span>
		</div>
		<div class="stat">
			<span class="stat-label">Sections scored</span>
			<span class="stat-value">{data.stats.sectionCount.toLocaleString()}</span>
			<span class="stat-note">{data.years.length} years of reports</span>
		</div>
		<div class="stat">
			<span class="stat-label">Words analysed</span>
			<span class="stat-value">{(data.stats.wordCount / 1_000_000).toFixed(1)}M</span>
			<span class="stat-note">
				latest prepared by {data.stats.latest?.preparedBy.replace('Federal Reserve Bank of ', '')}
			</span>
		</div>
	</section>

	<section class="card">
		<div class="card-title">
			<h2>National tone, {data.years[0]}–{data.years.at(-1)}</h2>
		</div>
		<p class="card-note">
			The three parts of the National Summary across every release. Prices are inverted, so rising
			prices pull the line down — on every chart here, up means better news. Lines break rather
			than bridge: the Fed reported prices jointly with labour for much of 2011–2016, so that
			series genuinely stops instead of being interpolated.
		</p>
		<Chart
			label="Line chart of sentiment for Overall Economic Activity, Labor Markets and Prices across every Beige Book release from {data
				.years[0]} to {data.years.at(-1)}"
			height={330}
			config={(p) =>
				nationalTrendConfig(p, longRunLabels, data.longRun.topics, data.longRun.series)}
		/>
		<details class="table-view">
			<summary>Table view</summary>
			<div class="scroll-x">
				<table>
					<thead>
						<tr>
							<th>Release</th>
							{#each data.longRun.topics as topic (topic)}<th class="num">{topic}</th>{/each}
						</tr>
					</thead>
					<tbody>
						{#each data.longRun.releases as release, i (release.id)}
							<tr>
								<td><a href="/releases/{release.slug}">{release.label}</a></td>
								{#each data.longRun.topics as _, t (t)}
									{@const value = data.longRun.series[t][i]}
									<td class="num">{value === null ? '—' : value.toFixed(2)}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	</section>

	<div class="year-bar">
		<h2>Detail for</h2>
		<select value={String(data.year)} onchange={(e) => selectYear(e.currentTarget.value)} aria-label="Choose a year">
			{#each [...data.years].reverse() as year (year)}
				<option value={String(year)}>{year}</option>
			{/each}
		</select>
		<span class="badge">{data.stats.yearReleaseCount} releases</span>
	</div>

	<div class="grid two">
		<section class="card">
			<div class="card-title"><h2>National tone in {data.year}</h2></div>
			<p class="card-note">The same three series, zoomed to the selected year.</p>
			<Chart
				label="Line chart of national sentiment across the {data.year} releases"
				height={280}
				config={(p) => nationalTrendConfig(p, yearLabels, data.trend.topics, data.trend.series)}
			/>
		</section>

		<section class="card">
			<div class="card-title"><h2>{data.stats.latest?.label} by district</h2></div>
			<p class="card-note">Ranked on {districtSource}.</p>
			<Chart
				label="Bar chart ranking the twelve Federal Reserve districts by sentiment"
				height={280}
				config={(p) =>
					rankedBarsConfig(
						p,
						data.stats.ranked.map((r) => r.district),
						data.stats.ranked.map((r) => r.score)
					)}
			/>
			<details class="table-view">
				<summary>Table view</summary>
				<div class="scroll-x">
					<table>
						<thead>
							<tr><th>District</th><th class="num">Score</th><th>Reading</th></tr>
						</thead>
						<tbody>
							{#each data.stats.ranked as row (row.district)}
								<tr>
									<td><a href="/districts/{districtByName(row.district)?.slug}">{row.district}</a></td>
									<td class="num">{row.score > 0 ? '+' : ''}{row.score.toFixed(2)}</td>
									<td>{row.label}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</details>
		</section>
	</div>

	<section class="card wide">
		<div class="card-title">
			<h2>District heatmap — {data.year}</h2>
			<DivergingLegend />
		</div>
		<p class="card-note">
			{hasHighlights ? "Each district's highlight paragraph" : "The average of each district's report"},
			release by release. Click a cell to read the district.
		</p>
		<Chart
			label="Heatmap of sentiment for twelve Federal Reserve districts across the {data.year} releases"
			height={430}
			config={(p) =>
				heatmapConfig(p, data.matrix.districts, yearLabels, data.matrix.cells, openCell)}
		/>
		<details class="table-view">
			<summary>Table view</summary>
			<div class="scroll-x">
				<table>
					<thead>
						<tr>
							<th>District</th>
							{#each yearLabels as label (label)}<th class="num">{label}</th>{/each}
						</tr>
					</thead>
					<tbody>
						{#each data.matrix.districts as district, i (district)}
							<tr>
								<td><a href="/districts/{districtByName(district)?.slug}">{district}</a></td>
								{#each data.matrix.cells[i] as value, j (j)}
									<td class="num">{value === null ? '—' : value.toFixed(2)}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	</section>

	<section class="card wide">
		<div class="card-title"><h2>How hard the Fed is leaning on each pace word — {data.year}</h2></div>
		<p class="card-note">
			The Beige Book grades everything on a fixed scale — flat, slight, modest, moderate, strong.
			Their shifting mix is the report's own tone signal, before any scoring. Direction words like
			"declined" are excluded here: they describe which way, not how fast.
		</p>
		<Chart
			label="Stacked bar chart showing the share of each intensity word per release in {data.year}"
			height={260}
			config={(p) => paceConfig(p, yearLabels, data.pace.buckets, data.pace.shares)}
		/>
		<details class="table-view">
			<summary>Table view (occurrences)</summary>
			<div class="scroll-x">
				<table>
					<thead>
						<tr>
							<th>Pace word</th>
							{#each yearLabels as label (label)}<th class="num">{label}</th>{/each}
						</tr>
					</thead>
					<tbody>
						{#each data.pace.buckets as bucket, i (bucket)}
							<tr>
								<td>{bucket}</td>
								{#each data.pace.counts[i] as n, j (j)}<td class="num">{n}</td>{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	</section>

	<section class="releases">
		<h2>{data.year} releases</h2>
		<div class="release-list">
			{#each data.trend.releases as release, i (release.id)}
				{@const tone = data.matrix.cells
					.map((row) => row[i])
					.filter((v): v is number => v !== null)}
				<a class="release" href="/releases/{release.slug}">
					<span class="release-label">{release.label.replace(` ${data.year}`, '')}</span>
					<SentimentBadge
						score={tone.length ? tone.reduce((a, b) => a + b, 0) / tone.length : 0}
						showScore
					/>
					<span class="release-meta">{release.sectionCount}</span>
				</a>
			{/each}
		</div>
	</section>
{/if}

<style>
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
		margin-bottom: 1.4rem;
	}

	.lede {
		color: var(--text-secondary);
		max-width: 64ch;
		margin: 0.4rem 0 0;
		font-size: 0.95rem;
	}

	.lede strong {
		color: var(--text-primary);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 1rem;
		margin-bottom: 1.1rem;
	}

	.stat {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.12rem;
	}

	.stat-label {
		font-size: 0.76rem;
		color: var(--muted);
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}

	.of {
		font-size: 1rem;
		color: var(--muted);
		font-weight: 500;
	}

	.stat-note {
		font-size: 0.76rem;
		color: var(--text-secondary);
	}

	.year-bar {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin: 2rem 0 1rem;
		padding-top: 1.2rem;
		border-top: 1px solid var(--border);
	}

	.wide {
		margin-top: 1.1rem;
	}

	.releases {
		margin-top: 1.8rem;
	}

	.release-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 0.7rem;
		margin-top: 0.7rem;
	}

	.release {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.7rem 0.9rem;
		color: var(--text-primary);
	}

	.release:hover {
		border-color: var(--accent);
		text-decoration: none;
	}

	.release-label {
		font-weight: 560;
		font-size: 0.9rem;
	}

	.release-meta {
		margin-left: auto;
		font-size: 0.75rem;
		color: var(--muted);
	}

	.error {
		color: var(--neg-4);
		font-size: 0.85rem;
	}

	code {
		background: var(--page);
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 0.1rem 0.35rem;
		font-size: 0.85em;
	}
</style>
