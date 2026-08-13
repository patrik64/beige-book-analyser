import {
	dashboardStats,
	districtMatrix,
	listYears,
	nationalTrend,
	paceTrend
} from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load = (async ({ url }) => {
	const years = await listYears();
	const requested = Number(url.searchParams.get('year'));
	// The heatmap, ranked bars and pace tracker are per-year; the tone chart is not.
	const year = years.includes(requested) ? requested : years.at(-1);

	const [stats, longRun, trend, matrix, pace] = await Promise.all([
		dashboardStats(year),
		nationalTrend(),
		nationalTrend(year),
		districtMatrix(year),
		paceTrend(year)
	]);

	return { years, year, stats, longRun, trend, matrix, pace };
}) satisfies PageServerLoad;
