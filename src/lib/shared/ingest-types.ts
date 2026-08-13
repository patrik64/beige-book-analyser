/** Result of an ingest run. Shared so the browser can type the RPC response. */
export interface IngestReport {
	year: number;
	releases: { label: string; slug: string; sections: number; skipped?: string }[];
	unmappedHeadings: string[];
}
