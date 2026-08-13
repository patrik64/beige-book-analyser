<script lang="ts">
	/**
	 * Legend for the diverging sentiment scale. Blue<->red rather than green<->red:
	 * red still reads as bad news, but green/red is the classic colour-blind failure.
	 */
	const steps = [
		{ token: 'var(--neg-4)', label: '−0.50' },
		{ token: 'var(--neg-3)', label: '−0.30' },
		{ token: 'var(--neg-2)', label: '−0.15' },
		{ token: 'var(--neg-1)', label: '−0.05' },
		{ token: 'var(--zero)', label: '0' },
		{ token: 'var(--pos-1)', label: '+0.05' },
		{ token: 'var(--pos-2)', label: '+0.15' },
		{ token: 'var(--pos-3)', label: '+0.30' },
		{ token: 'var(--pos-4)', label: '+0.50' }
	];
</script>

<div class="scale" aria-hidden="true">
	<span class="end">worse</span>
	<div class="ramp">
		{#each steps as step (step.label)}
			<span class="step" style="background: {step.token}" title={step.label}></span>
		{/each}
	</div>
	<span class="end">better</span>
</div>

<style>
	.scale {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.74rem;
		color: var(--muted);
	}

	.ramp {
		display: flex;
		gap: 2px;
	}

	.step {
		width: 17px;
		height: 10px;
		border-radius: 2px;
	}

	.end {
		white-space: nowrap;
	}
</style>
