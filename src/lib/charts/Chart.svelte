<script lang="ts">
	import {
		BarController,
		BarElement,
		CategoryScale,
		Chart as ChartJS,
		Filler,
		Legend,
		LineController,
		LineElement,
		LinearScale,
		PointElement,
		Tooltip,
		type ChartConfiguration
	} from 'chart.js';
	import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
	import { theme } from './theme.svelte';

	ChartJS.register(
		BarController,
		BarElement,
		CategoryScale,
		Filler,
		Legend,
		LineController,
		LineElement,
		LinearScale,
		PointElement,
		Tooltip,
		MatrixController,
		MatrixElement
	);

	interface Props {
		/**
		 * Built fresh whenever the palette changes, so dark mode restyles correctly.
		 * Typed loosely because the factories return several concrete chart types
		 * (line, bar, and the plugin's matrix) that share no common narrow type.
		 */
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		config: (palette: typeof theme.palette) => ChartConfiguration<any>;
		height?: number;
		/** Describes the chart for screen readers; the table view carries the data. */
		label: string;
	}

	let { config, height = 320, label }: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();

	$effect(() => {
		if (!canvas) return;
		// Reading the palette here registers the dependency: a theme flip tears the
		// chart down and rebuilds it against the new surface, rather than leaving
		// light-mode ink on a dark canvas.
		const built = config(theme.palette);
		const chart = new ChartJS(canvas, built);
		return () => chart.destroy();
	});
</script>

<div class="chart" style="height: {height}px">
	<!-- The label is the canvas fallback, so the description is available to assistive
	     tech and to anyone the canvas fails for; each chart also ships a table view. -->
	<canvas bind:this={canvas} aria-label={label}>{label}</canvas>
</div>

<style>
	.chart {
		position: relative;
		width: 100%;
	}
</style>
