import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqlDatabase } from 'remult';
import { NodeSqliteDataProvider } from 'remult/remult-node-sqlite';

export const DB_PATH = process.env.BEIGE_BOOK_DB ?? join(process.cwd(), 'data', 'beigebook.db');

/**
 * Uses Node's built-in `node:sqlite` rather than better-sqlite3: no native module to
 * rebuild, and none of the Vite externalization required to keep a prebuilt .node
 * binary out of the bundle.
 */
function create() {
	mkdirSync(dirname(DB_PATH), { recursive: true });
	return new SqlDatabase(new NodeSqliteDataProvider(new DatabaseSync(DB_PATH)));
}

let instance: SqlDatabase | undefined;

/** One connection per process, shared by the API and the ingest CLI. */
export function db(): SqlDatabase {
	instance ??= create();
	return instance;
}
