import { sequence } from '@sveltejs/kit/hooks';
import { api as handleRemult } from '$lib/server/api';

// Puts a request-scoped `remult` in context so `repo(...)` works directly against
// SQLite inside +page.server.ts load functions, with no HTTP round trip.
export const handle = sequence(handleRemult);
