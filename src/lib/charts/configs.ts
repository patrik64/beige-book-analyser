import type { ChartConfiguration, ChartDataset } from 'chart.js';
import { divergingColor, type Palette } from './palette';

/**
 * Chart.js configuration factories.
 *
 * Each takes the active palette so a theme flip rebuilds against the right surface.
 * Shared conventions: 2px lines, >=8px hit targets, recessive grid and axes, tooltips
 * on by default, and no chart carries a second y-axis.
 */

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

/**
 * On a dense series the markers are dropped so the line stays readable — but a point
 * with no neighbours has no line to belong to, and would vanish entirely. The Fed
 * reported prices jointly with labour from 2011 to 2016, leaving exactly that: a
 * handful of isolated readings. This draws those, and only those.
 */
function isolatedPointRadius(values: (number | null)[], dense: boolean) {
	if (!dense) return 4;
	return (ctx: { dataIndex: number }) => {
		const i = ctx.dataIndex;
		if (values[i] == null) return 0;
		const alone = values[i - 1] == null && values[i + 1] == null;
		return alone ? 3 : 0;
	};
}

function baseScales(palette: Palette, opts: { min?: number; max?: number; stacked?: boolean } = {}) {
	return {
		x: {
			stacked: opts.stacked ?? false,
			grid: { display: false },
			border: { color: palette.axis },
			ticks: { color: palette.muted, font: { family: FONT, size: 11 } }
		},
		y: {
			stacked: opts.stacked ?? false,
			min: opts.min,
			max: opts.max,
			grid: { color: palette.gridline, drawTicks: false },
			border: { display: false },
			ticks: { color: palette.muted, font: { family: FONT, size: 11 }, padding: 8 }
		}
	};
}

function baseTooltip(palette: Palette) {
	return {
		backgroundColor: palette.surface,
		titleColor: palette.textPrimary,
		bodyColor: palette.textSecondary,
		borderColor: palette.axis,
		borderWidth: 1,
		padding: 10,
		cornerRadius: 7,
		displayColors: true,
		titleFont: { family: FONT, size: 12, weight: 600 as const },
		bodyFont: { family: FONT, size: 12 }
	};
}

/** Legend entries carry identity alongside the direct labels, never colour alone. */
function baseLegend(palette: Palette, display = true) {
	return {
		display,
		position: 'top' as const,
		align: 'end' as const,
		labels: {
			color: palette.textSecondary,
			boxWidth: 10,
			boxHeight: 10,
			usePointStyle: true,
			pointStyle: 'circle' as const,
			font: { family: FONT, size: 12 }
		}
	};
}

/** The three National Summary parts over the year. Three fixed categorical slots. */
export function nationalTrendConfig(
	palette: Palette,
	labels: string[],
	topics: string[],
	series: (number | null)[][]
): ChartConfiguration<'line'> {
	// Eighty releases can't each carry a visible marker without the line disappearing
	// under them, so past ~20 points the dots drop out and hover does the work.
	const dense = labels.length > 20;

	const datasets: ChartDataset<'line'>[] = topics.map((topic, i) => ({
		label: topic,
		data: series[i] as number[],
		borderColor: palette.series[i],
		backgroundColor: palette.series[i],
		borderWidth: 2,
		pointRadius: isolatedPointRadius(series[i], dense),
		// The hit target stays generous even when the marker isn't drawn.
		pointHitRadius: dense ? 12 : 8,
		pointHoverRadius: 6,
		pointBorderWidth: 2,
		pointBorderColor: palette.surface,
		tension: dense ? 0.15 : 0.25,
		// Never bridge a gap. The Fed reported labour and prices as one section from
		// 2011 to 2016, so the Prices series genuinely stops for six years — drawing a
		// line across that would invent data.
		spanGaps: false
	}));

	return {
		type: 'line',
		data: { labels, datasets },
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: {
				...baseScales(palette, { min: -0.75, max: 0.75 }),
				x: {
					...baseScales(palette).x,
					ticks: {
						color: palette.muted,
						font: { family: FONT, size: 11 },
						maxRotation: 0,
						autoSkip: true,
						// Thin the axis labels rather than tilting them.
						maxTicksLimit: dense ? 10 : 8
					}
				}
			},
			plugins: {
				legend: baseLegend(palette),
				tooltip: {
					...baseTooltip(palette),
					callbacks: {
						label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)}`
					}
				}
			}
		}
	};
}

/** District x release grid. Cells are diverging-coloured by sentiment. */
export function heatmapConfig(
	palette: Palette,
	rowLabels: string[],
	colLabels: string[],
	cells: (number | null)[][],
	onCellClick?: (row: number, col: number) => void
): ChartConfiguration<'bar'> {
	const data = cells.flatMap((row, rowIndex) =>
		row.map((value, colIndex) => ({
			x: colLabels[colIndex],
			y: rowLabels[rowIndex],
			v: value,
			rowIndex,
			colIndex
		}))
	);

	return {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		type: 'matrix' as any,
		data: {
			datasets: [
				{
					label: 'Sentiment',
					data,
					// A 2px surface gap between cells, per the mark spec.
					backgroundColor: (ctx: { raw?: { v: number | null } }) =>
						ctx.raw?.v == null ? palette.gridline : divergingColor(ctx.raw.v, palette),
					borderColor: palette.surface,
					borderWidth: 2,
					borderRadius: 4,
					width: ({ chart }: { chart: { chartArea?: { width: number } } }) =>
						(chart.chartArea?.width ?? 0) / colLabels.length,
					height: ({ chart }: { chart: { chartArea?: { height: number } } }) =>
						(chart.chartArea?.height ?? 0) / rowLabels.length
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} as any
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			onClick: onCellClick
				? (_event: unknown, elements: { index: number }[]) => {
						const first = elements[0];
						if (!first) return;
						const point = data[first.index];
						onCellClick(point.rowIndex, point.colIndex);
					}
				: undefined,
			scales: {
				x: {
					type: 'category',
					labels: colLabels,
					offset: true,
					grid: { display: false },
					border: { color: palette.axis },
					ticks: { color: palette.muted, font: { family: FONT, size: 11 } }
				},
				y: {
					type: 'category',
					labels: [...rowLabels].reverse(),
					offset: true,
					grid: { display: false },
					border: { display: false },
					ticks: { color: palette.textSecondary, font: { family: FONT, size: 11 }, padding: 6 }
				}
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					...baseTooltip(palette),
					callbacks: {
						title: (items: { raw: { x: string; y: string } }[]) =>
							`${items[0].raw.y} — ${items[0].raw.x}`,
						label: (ctx: { raw: { v: number | null } }) =>
							ctx.raw.v == null ? 'no data' : `sentiment ${ctx.raw.v.toFixed(2)}`
					}
				}
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any
	};
}

/** Districts ranked for one release. Bars diverge from zero; colour carries polarity. */
export function rankedBarsConfig(
	palette: Palette,
	labels: string[],
	values: number[]
): ChartConfiguration<'bar'> {
	return {
		type: 'bar',
		data: {
			labels,
			datasets: [
				{
					label: 'Sentiment',
					data: values,
					backgroundColor: values.map((v) => (v < 0 ? palette.negative[3] : palette.positive[3])),
					borderRadius: 4,
					borderSkipped: false,
					barPercentage: 0.78
				}
			]
		},
		options: {
			indexAxis: 'y',
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				x: {
					grid: { color: palette.gridline, drawTicks: false },
					border: { display: false },
					ticks: { color: palette.muted, font: { family: FONT, size: 11 } }
				},
				y: {
					grid: { display: false },
					border: { color: palette.axis },
					ticks: { color: palette.textSecondary, font: { family: FONT, size: 11 } }
				}
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					...baseTooltip(palette),
					callbacks: { label: (ctx) => `sentiment ${Number(ctx.parsed.x).toFixed(2)}` }
				}
			}
		}
	};
}

/**
 * Share of the Fed's intensity vocabulary per release, as a 100% stacked bar.
 * The buckets are ordered (flat -> strong), so they take a single-hue ordinal ramp:
 * the reader sees the ordering in the colour, not just the legend.
 */
export function paceConfig(
	palette: Palette,
	labels: string[],
	buckets: string[],
	shares: number[][]
): ChartConfiguration<'bar'> {
	return {
		type: 'bar',
		data: {
			labels,
			datasets: buckets.map((bucket, i) => ({
				label: bucket,
				data: shares[i],
				backgroundColor: palette.ordinal[i],
				borderColor: palette.surface,
				borderWidth: 2,
				borderRadius: 3,
				barPercentage: 0.72
			}))
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: {
				...baseScales(palette, { stacked: true, min: 0, max: 100 }),
				y: {
					...baseScales(palette, { stacked: true, min: 0, max: 100 }).y,
					ticks: {
						color: palette.muted,
						font: { family: FONT, size: 11 },
						padding: 8,
						callback: (v) => `${v}%`
					}
				}
			},
			plugins: {
				legend: baseLegend(palette),
				tooltip: {
					...baseTooltip(palette),
					callbacks: {
						label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(1)}%`
					}
				}
			}
		}
	};
}

/**
 * A single-series trend, used for the per-topic and per-district small multiples.
 * One series means no legend box — the panel title names it.
 */
export function sparkConfig(
	palette: Palette,
	labels: string[],
	values: (number | null)[],
	color = palette.series[0]
): ChartConfiguration<'line'> {
	const dense = labels.length > 20;
	return {
		type: 'line',
		data: {
			labels,
			datasets: [
				{
					label: 'Sentiment',
					data: values as number[],
					borderColor: color,
					backgroundColor: color,
					borderWidth: 2,
					pointRadius: isolatedPointRadius(values, dense),
					pointHitRadius: dense ? 12 : 8,
					pointHoverRadius: 5,
					pointBorderWidth: 2,
					pointBorderColor: palette.surface,
					tension: 0.25,
					// A district that stopped covering a topic leaves a break, not a line.
					spanGaps: false
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: {
				x: {
					grid: { display: false },
					border: { color: palette.axis },
					ticks: {
						color: palette.muted,
						font: { family: FONT, size: 10 },
						maxRotation: 0,
						autoSkip: true,
						maxTicksLimit: dense ? 6 : 5
					}
				},
				y: {
					suggestedMin: -0.5,
					suggestedMax: 0.5,
					grid: { color: palette.gridline, drawTicks: false },
					border: { display: false },
					ticks: { color: palette.muted, font: { family: FONT, size: 10 }, maxTicksLimit: 4 }
				}
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					...baseTooltip(palette),
					callbacks: { label: (ctx) => `sentiment ${Number(ctx.parsed.y).toFixed(2)}` }
				}
			}
		}
	};
}
