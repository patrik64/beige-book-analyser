<script lang="ts">
	import Chart from '$lib/charts/Chart.svelte';
	import { sparkConfig } from '$lib/charts/configs';
	import SentimentBadge from '$lib/components/SentimentBadge.svelte';
	import { DISTRICTS } from '$lib/shared/districts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const labels = $derived(data.matrix.releases.map((r) => r.shortLabel));
	const span = $derived(
		`${data.matrix.releases[0]?.year ?? ''}–${data.matrix.releases.at(-1)?.year ?? ''}`
	);

	const rowFor = (district: string) =>
		data.matrix.cells[data.matrix.districts.indexOf(district)] ?? [];

	const latestFor = (district: string) => {
		const row = rowFor(district).filter((v): v is number => v !== null);
		return row.at(-1) ?? 0;
	};
</script>

<h1>Districts</h1>
<p class="lede">
	Each of the twelve Reserve Banks reports on its own region, {span}. Small multiples share one
	scale, so the panels are directly comparable — a flat line here is a flat economy, not a quiet
	chart.
</p>

<div class="grid-districts">
	{#each DISTRICTS as district (district.number)}
		<a class="card panel" href="/districts/{district.slug}">
			<div class="panel-head">
				<h2>{district.name}</h2>
				<SentimentBadge score={latestFor(district.name)} />
			</div>
			<span class="num">District {district.number}</span>
			<Chart
				label="Sentiment trend for the {district.name} district, {span}"
				height={110}
				config={(p) => sparkConfig(p, labels, rowFor(district.name))}
			/>
		</a>
	{/each}
</div>

<style>
	.lede {
		color: var(--text-secondary);
		max-width: 66ch;
		margin: 0.4rem 0 1.5rem;
		font-size: 0.95rem;
	}

	.grid-districts {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
	}

	.panel {
		color: var(--text-primary);
		display: block;
	}

	.panel:hover {
		border-color: var(--accent);
		text-decoration: none;
	}

	.panel-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.8rem;
	}

	h2 {
		font-size: 1rem;
	}

	.num {
		display: block;
		font-size: 0.72rem;
		color: var(--muted);
		margin-bottom: 0.5rem;
	}
</style>
