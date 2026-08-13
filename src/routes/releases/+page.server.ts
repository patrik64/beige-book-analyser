import { districtMatrix, listReleases, nationalTrend } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load = (async () => {
	const [releases, trend, matrix] = await Promise.all([
		listReleases(),
		nationalTrend(),
		districtMatrix()
	]);
	return { releases, trend, matrix };
}) satisfies PageServerLoad;
