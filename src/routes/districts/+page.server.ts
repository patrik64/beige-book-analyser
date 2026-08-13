import { districtMatrix } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load = (async () => ({ matrix: await districtMatrix() })) satisfies PageServerLoad;
