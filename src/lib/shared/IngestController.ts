import { BackendMethod } from 'remult';
import type { IngestReport } from './ingest-types';

/**
 * The Refresh button's backend.
 *
 * This class is reachable from the browser, so it must not reference `$lib/server`
 * at all — not even through a dynamic `import()`, which SvelteKit still traces and
 * rejects at build time ("Cannot import $lib/server/... into code that runs in the
 * browser"). Instead the server registers the real implementation at startup and
 * this module only knows its signature, so the dependency points server -> shared
 * and never the other way.
 */
export type IngestRunner = (year: number, options: { force: boolean }) => Promise<IngestReport>;

let runner: IngestRunner | undefined;

/** Called once from $lib/server/api.ts, which only ever loads on the server. */
export function registerIngestRunner(fn: IngestRunner) {
	runner = fn;
}

function requireRunner(): IngestRunner {
	if (!runner) throw new Error('Ingest is not available on this server');
	return runner;
}

/**
 * Ingest is exposed only where a server actually registered an implementation.
 *
 * These methods scrape federalreserve.org, so leaving them at `allowed: true` let
 * anyone who knew the endpoint drive outbound traffic and billed compute — hiding the
 * button only removed them from the UI. Deployments that serve the read-only bundled
 * database never register a runner, so remult rejects the call before the method body
 * runs and nothing is fetched.
 */
const ingestAvailable = () => runner !== undefined;

export class IngestController {
	@BackendMethod({ allowed: ingestAvailable })
	static async refresh(year: number): Promise<IngestReport> {
		return requireRunner()(year, { force: false });
	}

	/** Re-fetch from the Fed rather than reusing the on-disk HTML cache. */
	@BackendMethod({ allowed: ingestAvailable })
	static async refreshFromSource(year: number): Promise<IngestReport> {
		return requireRunner()(year, { force: true });
	}
}
