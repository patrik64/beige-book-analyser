import { Entity, Fields } from 'remult';
import type { TermHit } from '../sentiment-types';

/**
 * `scope` mirrors how the Fed actually publishes a release:
 *
 *  - `national`  the three parts of the National Summary page
 *  - `highlight` the twelve one-paragraph district blurbs on that same page,
 *                under "Highlights by Federal Reserve District"
 *  - `district`  the full sections on each of the twelve district pages
 */
export type SectionScope = 'national' | 'highlight' | 'district';

/** One addressable block of prose, scored. Roughly 100 rows per release. */
@Entity<Section>('sections', {
	allowApiCrud: true,
	defaultOrderBy: { releaseId: 'asc', ordinal: 'asc' }
})
export class Section {
	@Fields.autoIncrement()
	id = 0;

	@Fields.integer()
	releaseId = 0;

	@Fields.string<Section>()
	scope: SectionScope = 'national';

	/** Empty for `national`; the district name otherwise. */
	@Fields.string()
	district = '';

	/** The heading exactly as the Fed wrote it. */
	@Fields.string()
	heading = '';

	/** `heading` folded into a comparable topic — see shared/topics.ts. */
	@Fields.string()
	topic = '';

	@Fields.string()
	body = '';

	@Fields.integer()
	wordCount = 0;

	/** −1..1. Price sections are inverted, so negative always means bad news. */
	@Fields.number()
	sentimentScore = 0;

	/** Human-readable bucket, e.g. "modestly negative". */
	@Fields.string()
	sentimentLabel = '';

	/** Scoring terms with character offsets, so the UI can highlight them in `body`. */
	@Fields.json<Section>()
	termHits: TermHit[] = [];

	/** Counts of the Fed's standardized pace words, e.g. { modest: 3, moderate: 1 }. */
	@Fields.json<Section>()
	paceWords: Record<string, number> = {};

	/** Position within the release, for stable ordering. */
	@Fields.integer()
	ordinal = 0;
}
