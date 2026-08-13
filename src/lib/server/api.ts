import { remultApi } from 'remult/remult-sveltekit';
import { Release, Section } from '$lib/shared/entities';
import { IngestController, registerIngestRunner } from '$lib/shared/IngestController';
import { ingestYear } from './ingest/ingestYear';
import { db, READ_ONLY } from './db';

// Hand the shared controller its implementation. This module is server-only, so the
// scraping code never enters the client bundle. Registering is what makes the ingest
// endpoints callable at all, so a read-only deployment deliberately skips it: there
// the database cannot be written anyway, and an open endpoint would just be a way to
// make the server scrape on a stranger's behalf.
if (!READ_ONLY) registerIngestRunner((year, options) => ingestYear(year, options));

export const api = remultApi({
	entities: [Release, Section],
	controllers: [IngestController],
	dataProvider: db(),
	// Remult creates any missing tables and columns on startup. It only ever adds —
	// never drops or alters — which suits a schema this small. The bundled database is
	// opened read-only, so there the schema is already whatever ingest last wrote and
	// the CREATE statements would only error.
	ensureSchema: !READ_ONLY,
	// The admin UI is unauthenticated, so it stays off anywhere the app is published.
	admin: !READ_ONLY
});
