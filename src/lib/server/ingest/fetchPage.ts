import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const FED_ORIGIN = 'https://www.federalreserve.gov';
export const INDEX_URL = `${FED_ORIGIN}/monetarypolicy/publications/beige-book-default.htm`;

const RAW_DIR = join(process.cwd(), 'data', 'raw');

/**
 * federalreserve.gov publishes no robots.txt and applies no rate limiting we could
 * observe, but it is a public good funded by someone else — so identify ourselves and
 * space requests out. Every response is cached to disk, which means re-parsing (the
 * thing we actually iterate on) never touches the network again.
 */
const USER_AGENT =
	'beige-book-analyzer/1.0 (local research tool; https://github.com/; contact via repository)';
const POLITE_DELAY_MS = 1000;

let lastFetch = 0;

async function throttle() {
	const wait = lastFetch + POLITE_DELAY_MS - Date.now();
	if (wait > 0) await new Promise((r) => setTimeout(r, wait));
	lastFetch = Date.now();
}

function cachePath(key: string): string {
	return join(RAW_DIR, `${key}.html`);
}

export interface FetchOptions {
	/** Ignore any cached copy and re-request from the Fed. */
	force?: boolean;
}

/**
 * Fetch a page, caching the body under data/raw/<key>.html.
 * `key` is a filename-safe identifier, e.g. "beigebook202601-boston" or "index-2026".
 */
export async function fetchPage(url: string, key: string, options: FetchOptions = {}): Promise<string> {
	const path = cachePath(key);

	if (!options.force) {
		try {
			return await readFile(path, 'utf8');
		} catch {
			// not cached yet — fall through and fetch
		}
	}

	await throttle();
	const response = await fetch(url, {
		headers: { 'user-agent': USER_AGENT, accept: 'text/html' }
	});

	if (!response.ok) {
		throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
	}

	const html = decode(await response.arrayBuffer());
	await mkdir(dirname(path), { recursive: true });
	// Cached as UTF-8 regardless of what the wire encoding was.
	await writeFile(path, html, 'utf8');
	return html;
}

/**
 * Pages from before ~2017 are Windows-1252 and declare no charset, so `response.text()`
 * decodes them as UTF-8 and silently turns every em-dash, curly quote and accented
 * name into U+FFFD. Try UTF-8 strictly first and fall back, rather than accepting a
 * lossy decode: this text is the input to the scorer.
 */
function decode(buffer: ArrayBuffer): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
	} catch {
		return new TextDecoder('windows-1252').decode(buffer);
	}
}
