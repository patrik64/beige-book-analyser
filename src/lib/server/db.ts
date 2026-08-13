import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqlDatabase } from 'remult';
import { NodeSqliteDataProvider } from 'remult/remult-node-sqlite';

export const DB_PATH = process.env.BEIGE_BOOK_DB ?? join(process.cwd(), 'data', 'beigebook.db');

/**
 * Vercel's filesystem is read-only outside /tmp and every invocation may land on a
 * fresh instance, so a writable database file there would be pointless even if it
 * were possible. The .db ships inside the function bundle instead (see
 * scripts/bundle-db.js) and is opened read-only; ingest writes to the same file
 * locally, and publishing new data means re-running ingest and redeploying.
 */
export const READ_ONLY = Boolean(process.env.VERCEL);

/**
 * Uses Node's built-in `node:sqlite` rather than better-sqlite3: no native module to
 * rebuild, and none of the Vite externalization required to keep a prebuilt .node
 * binary out of the bundle.
 */
function create() {
	// Creating the directory is both impossible and unnecessary on a read-only
	// filesystem — the file is already in place next to the bundled server.
	if (!READ_ONLY) mkdirSync(dirname(DB_PATH), { recursive: true });
	return new SqlDatabase(
		new NodeSqliteDataProvider(new DatabaseSync(DB_PATH, { readOnly: READ_ONLY }))
	);
}

let instance: SqlDatabase | undefined;

/** One connection per process, shared by the API and the ingest CLI. */
export function db(): SqlDatabase {
	instance ??= create();
	return instance;
}
