<script lang="ts">
	interface Props {
		score: number;
		label?: string;
		/** Show the numeric score alongside the words. */
		showScore?: boolean;
	}

	let { score, label, showScore = true }: Props = $props();

	// The dot repeats what the words already say, so colour never carries the meaning alone.
	const tone = $derived(score > 0.05 ? 'pos' : score < -0.05 ? 'neg' : 'flat');
</script>

<span class="badge">
	<span class="dot {tone}"></span>
	{#if label}{label}{/if}
	{#if showScore}
		<span class="score">{score > 0 ? '+' : ''}{score.toFixed(2)}</span>
	{/if}
</span>

<style>
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: none;
	}
	.dot.pos {
		background: var(--pos-4);
	}
	.dot.neg {
		background: var(--neg-4);
	}
	.dot.flat {
		background: var(--muted);
	}
	.score {
		color: var(--text-primary);
		font-weight: 560;
	}
</style>
