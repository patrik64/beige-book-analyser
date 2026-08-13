<script lang="ts">
	import Chart from '$lib/charts/Chart.svelte';
	import { heatmapConfig, sparkConfig } from '$lib/charts/configs';
	import DivergingLegend from '$lib/components/DivergingLegend.svelte';
	import { districtByName } from '$lib/shared/districts';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const labels = $derived(
		data.releases.map((r) => (data.year ? r.label.replace(` ${data.year}`, '') : r.shortLabel))
	);
	const span = $derived(
		data.year
			? String(data.year)
			: `${data.releases[0]?.year ?? ''}–${data.releases.at(-1)?.year ?? ''}`
	);

	function selectYear(value: string) {
		const url = new URL(page.url);
		if (value === 'all') url.searchParams.delete('year');
		else url.searchParams.set('year', value);
		goto(url, { keepFocus: true, noScroll: true });
	}
	// The heatmap gets short district names so twelve columns fit without rotating.
	const shortDistricts = $derived(
		data.districts.map((d) => (d === 'San Francisco' ? 'SF' : d === 'Philadelphia' ? 'Philly' : d))
	);

	function openCell(topicIndex: number, districtIndex: number) {
		const slug = districtByName(data.districts[districtIndex])?.slug;
		if (slug) goto(`/districts/${slug}`);
	}
</script>

<h1>Topics</h1>
<p class="lede">
	Each Reserve Bank files under its own headings — Boston writes "Retail and Tourism" where Dallas
	writes "Retail Sales". Those are folded into ten shared topics so districts can be compared at
	all; a district that never covers a topic leaves a gap rather than a zero.
</p>

<div class="controls">
	<select
		value={data.year ? String(data.year) : 'all'}
		onchange={(e) => selectYear(e.currentTarget.value)}
		aria-label="Choose a year"
	>
		<option value="all">All years</option>
		{#each [...data.years].reverse() as year (year)}
			<option value={String(year)}>{year}</option>
		{/each}
	</select>
	<span class="badge">{data.releases.length} releases</span>
</div>

<section class="card">
	<div class="card-title">
		<h2>Topic by district</h2>
		<DivergingLegend />
	</div>
	<p class="card-note">Averaged across {span}. Click a cell for the district.</p>
	<Chart
		label="Heatmap of sentiment by topic and Federal Reserve district"
		height={430}
		config={(p) => heatmapConfig(p, data.topics, shortDistricts, data.cells, openCell)}
	/>
	<details class="table-view">
		<summary>Table view</summary>
		<div class="scroll-x">
			<table>
				<thead>
					<tr>
						<th>Topic</th>
						{#each data.districts as district (district)}<th class="num">{district}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each data.topics as topic, i (topic)}
						<tr>
							<td>{topic}</td>
							{#each data.cells[i] as value, j (j)}
								<td class="num">{value === null ? '—' : value.toFixed(2)}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</section>

<section class="trends">
	<h2>How each topic moved through {span}</h2>
	<p class="section-note">
		Averaged across the twelve districts. All panels share the same scale.
	</p>
	<div class="grid-topics">
		{#each data.topics as topic, i (topic)}
			<article class="card">
				<h3>{topic}{topic === 'Prices' ? ' *' : ''}</h3>
				<Chart
					label="Sentiment trend for {topic} across the 2026 releases"
					height={120}
					config={(p) => sparkConfig(p, labels, data.trend[i])}
				/>
			</article>
		{/each}
	</div>
	<p class="footnote">* Prices are inverted — the line falls when prices rise.</p>
</section>

<style>
	.lede {
		color: var(--text-secondary);
		max-width: 70ch;
		margin: 0.4rem 0 1.5rem;
		font-size: 0.95rem;
	}

	.trends {
		margin-top: 2rem;
	}

	.section-note {
		color: var(--muted);
		font-size: 0.82rem;
		margin: 0.25rem 0 0.9rem;
	}

	.grid-topics {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	}

	.grid-topics h3 {
		font-size: 0.92rem;
		margin-bottom: 0.4rem;
	}

	.footnote {
		color: var(--muted);
		font-size: 0.78rem;
		margin-top: 0.9rem;
	}
</style>
