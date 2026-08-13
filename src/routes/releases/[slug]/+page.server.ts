import { error } from '@sveltejs/kit';
import { releaseDetail } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load = (async ({ params }) => {
	const detail = await releaseDetail(params.slug);
	if (!detail) error(404, `No release "${params.slug}"`);
	return detail;
}) satisfies PageServerLoad;
