import { remultApi } from 'remult/remult-sveltekit';
import { Release, Section } from '$lib/shared/entities';
import { IngestController, registerIngestRunner } from '$lib/shared/IngestController';
import { ingestYear } from './ingest/ingestYear';
import { db } from './db';

// Hand the shared controller its implementation. This module is server-only, so the
// scraping code never enters the client bundle.
registerIngestRunner((year, options) => ingestYear(year, options));

export const api = remultApi({
	entities: [Release, Section],
	controllers: [IngestController],
	dataProvider: db(),
	// Remult creates any missing tables and columns on startup. It only ever adds —
	// never drops or alters — which suits a schema this small.
	ensureSchema: true,
	admin: true
});
