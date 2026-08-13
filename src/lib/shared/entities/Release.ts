import { Entity, Fields } from 'remult';

/**
 * One Beige Book publication.
 *
 * `seq` is the two-digit number in the Fed's URL slug (beigebook202601). It looks
 * like a month but isn't: 2026 runs 01, 02, 04, 05, 07, 08, 10, 11 for its eight
 * releases, so March 2026 is `02` and beigebook202603 is a 404. Never derive it
 * from the date — it comes from the index table.
 */
@Entity<Release>('releases', {
	allowApiCrud: true,
	defaultOrderBy: { releaseDate: 'asc' }
})
export class Release {
	@Fields.autoIncrement()
	id = 0;

	@Fields.integer()
	year = 0;

	/**
	 * The `NN` in beigebook{YYYY}{NN} — an ordinal, not a month. Zero for the one
	 * release that breaks the pattern (May 2023 is `beigebook20230531`), which is why
	 * `slug` rather than (year, seq) is the natural key.
	 */
	@Fields.integer()
	seq = 0;

	/** e.g. "beigebook202601". Unique across all years; the upsert key. */
	@Fields.string()
	slug = '';

	/**
	 * Which page layout this edition uses — 'full-report' for 2017-2023, 'multi-page'
	 * for 2024 onwards. Recorded so a re-ingest doesn't have to re-derive it.
	 */
	@Fields.string()
	format = '';

	@Fields.dateOnly()
	releaseDate = new Date();

	/** e.g. "January 2026" */
	@Fields.string()
	label = '';

	@Fields.string()
	summaryUrl = '';

	@Fields.string()
	pdfUrl = '';

	/** The Reserve Bank that compiled this edition, from the note in `p#f2`. */
	@Fields.string()
	preparedBy = '';

	/** "information collected on or before <date>", from the same note. */
	@Fields.string()
	dataCutoff = '';

	@Fields.integer()
	sectionCount = 0;

	@Fields.date()
	fetchedAt = new Date();
}
