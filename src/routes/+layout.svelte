<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { theme } from '$lib/charts/theme.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();

	$effect(() => theme.init());

	const nav = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/releases', label: 'Releases' },
		{ href: '/districts', label: 'Districts' },
		{ href: '/topics', label: 'Topics' },
		{ href: '/compare', label: 'Compare' }
	];

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<title>Beige Book Analyzer</title>
	<meta
		name="description"
		content="Sentiment analysis of the Federal Reserve Beige Book, 2026 releases."
	/>
</svelte:head>

<header>
	<div class="shell bar">
		<a class="brand" href="/">
			<span class="mark"></span>
			Beige Book Analyzer
		</a>

		<nav>
			{#each nav as item (item.href)}
				<a href={item.href} class:active={isActive(item.href)}>{item.label}</a>
			{/each}
		</nav>

		<button
			onclick={() => theme.toggle()}
			aria-label="Switch to {theme.resolved === 'dark' ? 'light' : 'dark'} theme"
			title="Switch theme"
		>
			{theme.resolved === 'dark' ? '☀' : '☾'}
		</button>
	</div>
</header>

<main class="shell">
	{@render children()}
</main>

<footer class="shell">
	<div class="inner">
		<p>
			Source text: <a
				href="https://www.federalreserve.gov/monetarypolicy/publications/beige-book-default.htm"
			>
				Federal Reserve Beige Book</a
			>. Sentiment is computed locally with a lexicon tuned to the report's own vocabulary — it is a
			reading aid, not an economic indicator.
		</p>
		<Footer />
	</div>
</footer>

<style>
	header {
		border-bottom: 1px solid var(--border);
		background: var(--surface);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding-top: 0.7rem;
		padding-bottom: 0.7rem;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 640;
		color: var(--text-primary);
		letter-spacing: -0.012em;
		white-space: nowrap;
	}

	.mark {
		width: 13px;
		height: 13px;
		border-radius: 4px;
		background: linear-gradient(135deg, var(--neg-4) 0%, var(--zero) 50%, var(--pos-4) 100%);
		flex: none;
	}

	nav {
		display: flex;
		gap: 0.25rem;
		margin-left: auto;
		flex-wrap: wrap;
	}

	nav a {
		color: var(--text-secondary);
		font-size: 0.86rem;
		padding: 0.3rem 0.6rem;
		border-radius: 7px;
	}

	nav a:hover {
		background: var(--page);
		text-decoration: none;
	}

	nav a.active {
		color: var(--text-primary);
		background: var(--page);
		font-weight: 560;
	}

	main {
		padding-top: 1.6rem;
	}

	footer {
		padding-bottom: 2.5rem;
	}

	.inner {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
		border-top: 1px solid var(--border);
		padding-top: 1rem;
	}

	footer p {
		color: var(--muted);
		font-size: 0.78rem;
		margin: 0;
		max-width: 70ch;
	}
</style>
