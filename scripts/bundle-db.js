// Copies the SQLite database into the serverless function bundle.
//
// adapter-vercel traces module imports, so it never sees a path built at runtime from
// `process.cwd()`. Without this step the function deploys without its database and
// every page fails on the first query. Runs after `vite build`; see package.json.
//
// adapter-vercel emits one real `.func` directory and symlinks every route to it, so
// this normally copies 45MB exactly once. The function root mirrors the project root
// (`.svelte-kit/`, `node_modules/`, `package.json`), and Vercel's Node launcher sets
// cwd to that root — so `join(process.cwd(), 'data', ...)` in src/lib/server/db.ts
// resolves to the file placed here.

import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DB_SOURCE = process.env.BEIGE_BOOK_DB ?? join(process.cwd(), 'data', 'beigebook.db');
const FUNCTIONS_DIR = join(process.cwd(), '.vercel', 'output', 'functions');

/** Real `.func` directories only — the symlinked routes resolve to these. */
function findFunctionRoots(dir) {
	const found = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (lstatSync(path).isSymbolicLink()) continue;
		if (!entry.isDirectory()) continue;
		if (entry.name.endsWith('.func')) found.push(path);
		else found.push(...findFunctionRoots(path));
	}
	return found;
}

if (!existsSync(DB_SOURCE)) {
	console.error(`[bundle-db] No database at ${DB_SOURCE} — run \`pnpm ingest\` first.`);
	process.exit(1);
}

if (!existsSync(FUNCTIONS_DIR)) {
	console.error(`[bundle-db] No ${relative(process.cwd(), FUNCTIONS_DIR)} — did the build run?`);
	process.exit(1);
}

const roots = findFunctionRoots(FUNCTIONS_DIR);

if (roots.length === 0) {
	console.error('[bundle-db] Found no function directories to copy the database into.');
	process.exit(1);
}

const megabytes = (statSync(DB_SOURCE).size / 1024 / 1024).toFixed(1);

for (const root of roots) {
	const target = join(root, 'data', 'beigebook.db');
	mkdirSync(join(root, 'data'), { recursive: true });
	copyFileSync(DB_SOURCE, target);
	console.log(`[bundle-db] ${megabytes}MB -> ${relative(process.cwd(), target)}`);
}
