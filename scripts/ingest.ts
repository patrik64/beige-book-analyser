/**
 * Seed or refresh the local database.
 *
 *   pnpm ingest                      # the current year
 *   pnpm ingest --year 2019          # one past year
 *   pnpm ingest --from 2017 --to 2020
 *   pnpm ingest --all                # everything the parsers support (2017 onwards)
 *   pnpm ingest --all --force        # re-request every page instead of using the cache
 *
 * Runs through vite-node so it resolves $lib and compiles the decorators that
 * Remult's entities rely on, exactly as the app does.
 */
import { remult, repo } from 'remult';
import { Release, Section } from '../src/lib/shared/entities';
import { EARLIEST_YEAR } from '../src/lib/server/ingest/discover';
import { db } from '../src/lib/server/db';
import { ingestYear } from '../src/lib/server/ingest/ingestYear';

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	return i === -1 ? undefined : process.argv[i + 1];
}

const currentYear = new Date().getFullYear();
const force = process.argv.includes('--force');

let years: number[];
if (process.argv.includes('--all')) {
	years = range(EARLIEST_YEAR, currentYear);
} else if (arg('from') || arg('to')) {
	years = range(Number(arg('from') ?? EARLIEST_YEAR), Number(arg('to') ?? currentYear));
} else {
	years = [Number(arg('year') ?? currentYear)];
}

function range(from: number, to: number): number[] {
	return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// Point the global remult at SQLite. Without this, repo() falls back to the REST
// provider and tries to call an API server that isn't running. Assigning the global
// is safe here in a way it would not be inside the app: this is a one-shot process
// with a single request scope.
remult.dataProvider = db();

// remultApi() creates missing tables when the server boots; running standalone we
// have to ask for the same thing ourselves.
await remult.dataProvider.ensureSchema?.([repo(Release).metadata, repo(Section).metadata]);

let grandTotal = 0;
const allUnmapped = new Set<string>();

for (const year of years) {
	let report;
	try {
		report = await ingestYear(year, { force });
	} catch (error) {
		console.log(`\n${year}  ✗ ${error instanceof Error ? error.message : String(error)}`);
		continue;
	}

	console.log(`\nBeige Book ${report.year}`);
	for (const r of report.releases) {
		if (r.skipped) console.log(`  ✗ ${r.label.padEnd(16)} ${r.skipped}`);
		else console.log(`  ✓ ${r.label.padEnd(16)} ${String(r.sections).padStart(3)} sections`);
	}
	grandTotal += report.releases.reduce((sum, r) => sum + r.sections, 0);
	report.unmappedHeadings.forEach((h) => allUnmapped.add(h));
}

console.log(`\n  ${grandTotal} sections across ${years.length} year(s)`);

if (allUnmapped.size) {
	console.log(`\n  Headings that fell through to "Other" — extend shared/topics.ts:`);
	for (const h of [...allUnmapped].sort()) console.log(`    - ${h}`);
}
