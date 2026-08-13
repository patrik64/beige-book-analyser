import { compareReleases, listReleases } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load = (async ({ url }) => {
	const releases = await listReleases();
	if (releases.length < 2) return { releases, comparison: undefined };

	// Default to the two most recent releases — the comparison people actually want.
	const from = url.searchParams.get('from') ?? releases.at(-2)!.slug;
	const to = url.searchParams.get('to') ?? releases.at(-1)!.slug;

	return { releases, comparison: await compareReleases(from, to) };
}) satisfies PageServerLoad;
