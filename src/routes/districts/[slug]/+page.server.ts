import { error } from '@sveltejs/kit';
import { districtDetail } from '$lib/server/queries';
import { districtBySlug } from '$lib/shared/districts';
import type { PageServerLoad } from './$types';

export const load = (async ({ params, url }) => {
	const district = districtBySlug(params.slug);
	if (!district) error(404, `No district "${params.slug}"`);

	// The prose is fetched one release at a time — ten years of a district's text is
	// far more than the page needs.
	return districtDetail(district.name, url.searchParams.get('release') ?? undefined);
}) satisfies PageServerLoad;
