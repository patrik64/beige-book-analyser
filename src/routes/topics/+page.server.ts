import { listYears, topicBreakdown } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load = (async ({ url }) => {
	const years = await listYears();
	const requested = url.searchParams.get('year');
	// "all" averages across every year; otherwise narrow to one.
	const year = requested && years.includes(Number(requested)) ? Number(requested) : undefined;

	return { years, year, ...(await topicBreakdown(year)) };
}) satisfies PageServerLoad;
