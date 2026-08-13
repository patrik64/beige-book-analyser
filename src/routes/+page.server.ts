import {
	dashboardStats,
	districtMatrix,
	listYears,
	nationalTrend,
	paceTrend
} from '$lib/server/queries';
import { READ_ONLY } from '$lib/server/db';
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

	// Ingest writes to SQLite, which the deployed copy cannot do — the button is only
	// meaningful where the database is writable.
	return { years, year, stats, longRun, trend, matrix, pace, canIngest: !READ_ONLY };
}) satisfies PageServerLoad;
