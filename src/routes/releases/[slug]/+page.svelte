<script lang="ts">
	import SectionText from '$lib/components/SectionText.svelte';
	import SentimentBadge from '$lib/components/SentimentBadge.svelte';
	import { districtByName } from '$lib/shared/districts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let openDistrict = $state<string | null>(null);

	const sectionsFor = (district: string) => data.districts.filter((s) => s.district === district);

	const meanScore = (values: number[]) =>
		values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
</script>

<nav class="crumb"><a href="/releases">Releases</a> <span>/</span> {data.release.label}</nav>

<div class="head">
	<div>
		<h1>Beige Book — {data.release.label}</h1>
		<p class="lede">
			Compiled by the {data.release.preparedBy || 'Federal Reserve'} from information collected on or
			before {data.release.dataCutoff || 'the cutoff date'}.
		</p>
	</div>
	<div class="links">
		<a class="btn" href={data.release.summaryUrl} rel="external">Fed original</a>
		{#if data.release.pdfUrl}<a class="btn" href={data.release.pdfUrl} rel="external">PDF</a>{/if}
	</div>
</div>

<p class="hint">
	Highlighted phrases are what the scorer matched — hover any of them to see its contribution.
</p>

<section>
	<h2>National summary</h2>
	<div class="national">
		{#each data.national as section (section.id)}
			<article class="card">
				<div class="card-title">
					<h3>{section.heading}</h3>
					<SentimentBadge score={section.sentimentScore} label={section.sentimentLabel} />
				</div>
				{#if section.topic === 'Prices'}
					<p class="card-note">Inverted: rising prices score negative.</p>
				{/if}
				<SectionText body={section.body} termHits={section.termHits} />
			</article>
		{/each}
	</div>
</section>

<section>
	<h2>Highlights by district</h2>
	<p class="section-note">
		The one-paragraph summary each district contributes to the national report.
	</p>
	<div class="highlights">
		{#each data.highlights as highlight (highlight.id)}
			{@const slug = districtByName(highlight.district)?.slug}
			{@const detail = sectionsFor(highlight.district)}
			<article class="card">
				<div class="card-title">
					<h3><a href="/districts/{slug}">{highlight.district}</a></h3>
					<SentimentBadge score={highlight.sentimentScore} label={highlight.sentimentLabel} />
				</div>
				<SectionText body={highlight.body} termHits={highlight.termHits} />

				{#if detail.length}
					<button
						class="expand"
						onclick={() =>
							(openDistrict = openDistrict === highlight.district ? null : highlight.district)}
						aria-expanded={openDistrict === highlight.district}
					>
						{openDistrict === highlight.district ? 'Hide' : 'Show'}
						{detail.length} full sections
						<span class="agg">
							avg {meanScore(detail.map((s) => s.sentimentScore)).toFixed(2)}
						</span>
					</button>

					{#if openDistrict === highlight.district}
						<div class="detail">
							{#each detail as section (section.id)}
								<div class="sub">
									<div class="sub-head">
										<h4>{section.heading}</h4>
										<SentimentBadge score={section.sentimentScore} showScore />
									</div>
									<SectionText body={section.body} termHits={section.termHits} />
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</article>
		{/each}
	</div>
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

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.lede {
		color: var(--text-secondary);
		max-width: 62ch;
		margin: 0.35rem 0 0;
		font-size: 0.93rem;
	}

	.links {
		display: flex;
		gap: 0.5rem;
	}

	.hint {
		font-size: 0.8rem;
		color: var(--muted);
		margin: 1rem 0 0;
	}

	section {
		margin-top: 2rem;
	}

	.section-note {
		color: var(--muted);
		font-size: 0.82rem;
		margin: 0.25rem 0 0;
	}

	.national,
	.highlights {
		display: grid;
		gap: 1rem;
		margin-top: 0.9rem;
	}

	@media (min-width: 950px) {
		.highlights {
			grid-template-columns: 1fr 1fr;
		}
	}

	.card-title h3 a {
		color: var(--text-primary);
	}

	.expand {
		margin-top: 0.9rem;
		font-size: 0.8rem;
		width: 100%;
		justify-content: space-between;
	}

	.agg {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.detail {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		border-top: 1px solid var(--gridline);
		padding-top: 1rem;
	}

	.sub-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.3rem;
	}

	h4 {
		font-size: 0.88rem;
		color: var(--text-primary);
	}
</style>
