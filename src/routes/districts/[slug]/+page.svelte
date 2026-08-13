<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Chart from '$lib/charts/Chart.svelte';
	import { sparkConfig } from '$lib/charts/configs';
	import SectionText from '$lib/components/SectionText.svelte';
	import SentimentBadge from '$lib/components/SentimentBadge.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const labels = $derived(data.releases.map((r) => r.shortLabel));

	function selectRelease(slug: string) {
		const url = new URL(page.url);
		url.searchParams.set('release', slug);
		goto(url, { keepFocus: true, noScroll: true });
	}
</script>

<nav class="crumb"><a href="/districts">Districts</a> <span>/</span> {data.district}</nav>

<h1>{data.district}</h1>
<p class="lede">
	Every section this Reserve Bank filed since {data.releases[0]?.releaseDate.slice(0, 4)}, scored.
	Prices are inverted, so a falling line always means worse news.
</p>

<section class="card">
	<div class="card-title"><h2>Overall activity</h2></div>
	<p class="card-note">
		The district's own "Summary of Economic Activity" section across all {data.releases.length} releases.
	</p>
	<Chart
		label="Overall economic activity sentiment for {data.district} across every release"
		height={280}
		config={(p) => sparkConfig(p, labels, data.overall)}
	/>
</section>

<section class="card wide">
	<div class="card-title"><h2>By topic</h2></div>
	<p class="card-note">Averaged across this district's sections for each topic and release.</p>
	<div class="grid-topics">
		{#each data.topics as topic, i (topic)}
			<div class="mini">
				<h3>{topic}{topic === 'Prices' ? ' *' : ''}</h3>
				<Chart
					label="Sentiment trend for {topic} in {data.district}"
					height={110}
					config={(p) => sparkConfig(p, labels, data.byTopic[i])}
				/>
			</div>
		{/each}
	</div>
	<p class="footnote">* Prices are inverted — the line falls when prices rise.</p>
</section>

<section class="text">
	<div class="controls">
		<h2>Report text</h2>
		<select
			value={data.selected?.slug ?? ''}
			onchange={(e) => selectRelease(e.currentTarget.value)}
			aria-label="Choose a release"
		>
			{#each [...data.releases].reverse() as release (release.id)}
				<option value={release.slug}>{release.label}</option>
			{/each}
		</select>
		{#if data.selected}
			<span class="badge">data through {data.selected.dataCutoff || '—'}</span>
			<a class="btn" href="/releases/{data.selected.slug}">Full release</a>
		{/if}
	</div>

	{#if data.sections.length === 0}
		<div class="empty"><p>No sections stored for this release.</p></div>
	{:else}
		<div class="sections">
			{#each data.sections as section (section.id)}
				<article class="card">
					<div class="card-title">
						<h3>{section.heading}</h3>
						<SentimentBadge score={section.sentimentScore} label={section.sentimentLabel} />
					</div>
					<p class="card-note">
						{section.topic}{section.topic === 'Prices' ? ' · inverted' : ''} · {section.wordCount} words
					</p>
					<SectionText body={section.body} termHits={section.termHits} />
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.crumb {
		font-size: 0.8rem;
		color: var(--muted);
		margin-bottom: 0.6rem;
	}
	.crumb span {
		margin: 0 0.2rem;
	}

	.lede {
		color: var(--text-secondary);
		max-width: 64ch;
		margin: 0.35rem 0 1.4rem;
		font-size: 0.94rem;
	}

	.wide {
		margin-top: 1.1rem;
	}

	.grid-topics {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		margin-top: 0.5rem;
	}

	.mini h3 {
		font-size: 0.85rem;
		margin-bottom: 0.3rem;
	}

	.footnote {
		color: var(--muted);
		font-size: 0.78rem;
		margin-top: 0.9rem;
	}

	.text {
		margin-top: 2rem;
	}

	.controls h2 {
		margin-right: 0.5rem;
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
