# Beige Book Analyzer

Reads the Federal Reserve's [Beige Book](https://www.federalreserve.gov/monetarypolicy/publications/beige-book-default.htm),
scores every section for sentiment, and presents the prose next to the charts that
sentiment produces. Covers **2003–2026 — 188 releases, 19,400 sections, 2.9M words**.

SvelteKit + Remult + local SQLite. No API keys, no external services.

## Try

live at https://beige-book-analyser.vercel.app/

## Quick start

```sh
pnpm install
pnpm ingest --all    # scrape, parse, score, store (~15 min on first run)
pnpm dev
```

The database lands at `data/beigebook.db` and the raw HTML is cached under
`data/raw/`, both gitignored. Re-running the ingest is idempotent — it refreshes
scores in place rather than duplicating rows, and re-parsing works entirely off the
cache, so iterating on the parser or the lexicon costs no network at all.

```sh
pnpm ingest                       # the current year only
pnpm ingest --year 2019
pnpm ingest --from 2003 --to 2010
pnpm ingest --all --force         # re-request every page instead of using the cache
```

## Does it actually work?

The scores were never tuned against outcomes, so the long-run series is a fair test.
Sorting the national sections by score puts the extremes exactly where economic
history says they belong:

| | |
|---|---|
| Weakest activity | **April 2020**, May 2020 — the COVID shutdown — then **December 2008, January 2009, October 2008** — the financial crisis |
| Worst prices | **March 2022**, October 2021 — the inflation surge |
| Best prices | **April 2020** — the deflation shock |

The 2008–09 ranking is a fair out-of-sample test: the lexicon was written against 2026
prose and those editions were ingested a decade of releases later, with no tuning in
between.

## How sentiment is computed

The Fed writes the Beige Book with a deliberately controlled vocabulary — activity is
always *declining*, *flat*, *slight*, *modest*, *moderate*, *solid*, *strong* or
*robust*. That makes a lexicon genuinely informative here, where it usually wouldn't be,
so no LLM is involved and every score is reproducible.

Nearly every substantive clause is **direction + intensity**:

```
"activity increased at a slight to modest pace"
"employment was unchanged on balance"
```

So the scorer pairs each direction word with the nearest intensity word in the same
sentence and emits one signed hit per clause — `sign(direction) × magnitude(intensity)`
— rather than summing independent word weights, which would make "declined modestly"
and "declined sharply" both saturate. A section's score is the mean of its hits, with a
floor of three so a lone clause can't swing to an extreme on thin evidence.

Details that matter:

- **Prices are inverted.** "Prices rose robustly" is upbeat language but bad economic
  news. Price sections flip sign, so on every chart up means better news.
- **Sentence boundaries are respected.** In "drilling increased. Manufacturing grew
  modestly", the first clause can't reach across the full stop to claim "modestly".
- **Noun subjects don't double count.** In "price growth eased", `growth` is the
  subject and `eased` is the claim; only the governing verb scores.
- **Negation** flips a clause within a three-token window, and fixed phrases like
  "no change" are matched first so they don't read as a negated increase.

Each stored section keeps the character offsets of its scoring terms, which is what
lets the UI highlight them inline in the report text.

## Colour

Sentiment uses a **blue ↔ red** diverging scale with a neutral gray midpoint, not the
conventional green ↔ red: red still means bad news, but red/green is the most common
colour-blind failure. Every palette was checked for lightness banding, chroma, CVD
separation and contrast rather than picked by eye, and every chart also ships a table
view.

## Layout

```
src/lib/shared/      entities, districts, canonical topics, pace words  (client + server)
src/lib/server/      scraper, both parsers, sentiment engine, queries    (server only)
src/lib/charts/      Chart.js wrapper, config factories, validated palette
src/routes/          dashboard, releases, districts, topics, compare
scripts/ingest.ts    CLI entry point
```

`IngestController` lives in `shared` so the browser gets a typed RPC for the Refresh
button, but it holds no reference to `$lib/server`; the server registers the real
implementation at startup. Importing server code from a client-reachable module builds
fine in dev and fails the production build, so the dependency deliberately points one
way.

## Scraping notes

The Fed publishes no robots.txt and applied no rate limiting we could observe, but
requests are still spaced ~1/sec with an identifying User-Agent, and every response is
cached to disk so re-parsing never re-hits their servers.

**Release URLs are never constructed from a date.** The slug is `beigebook{YYYY}{NN}`
where `NN` looks like a month but is an ordinal over the eight yearly releases — in 2026
March is `02` and June is `05`, and `beigebook202603` is a 404. One release abandons the
pattern entirely (May 2023 is `beigebook20230531`), which is why `slug` rather than
`(year, seq)` is the natural key. The index table is the only authoritative mapping, so
discovery always starts there — the current year from the landing page, earlier years
from `/monetarypolicy/beigebook{YYYY}.htm`.

### Three publication formats

The Fed has reorganised the report twice in this window, so `format` is recorded per
release and drives which parser runs:

| Era | URL | Layout | Districts opened by |
|---|---|---|---|
| 2003–2010 | `/fomc/beigebook/{year}/{date}/FullReport.htm` | one page, `<b>`/`<strong>` runs | `First District--Boston` as a bold run |
| 2011–2016 | `/monetarypolicy/beigebook/beigebook{YYYY}{NN}.htm` | one page, `<strong>` runs | `<h2>First District--Boston</h2>` |
| 2017–2023 | `/monetarypolicy/beigebook{YYYY}{NN}.htm` | one page, `<strong>` runs | `<h4>Federal Reserve Bank of Boston</h4>` |
| 2024– | summary page **plus twelve district pages** | real `<h4>`/`<h5>` headings | its own page |

All four produce the same scopes, so everything downstream is format-agnostic.

**`EARLIEST_YEAR` is 2003** because that is where section headings begin. From 2002 back
to 1996 the reports bold the *first sentence of each paragraph* instead of using
headings — there are no topics to extract, and the heading-and-topic model the whole app
rests on simply doesn't exist in those editions.

### What changes in the older editions

- **No district highlights.** The one-paragraph-per-district summary is a 2017 invention.
  Before that the heatmap falls back to averaging each district's own report — see
  `DISTRICT_TONE` in `queries.ts`, which prefers the highlight and degrades silently.
- **The national summary is organised by sector**, not into the modern three parts, and
  the overall read is an *unheaded* opening paragraph. It is filed as
  "Overall Economic Activity" so the long-run trend stays continuous.
- **Labour and prices were one section** ("Employment, Wages, and Prices") from 2011 to
  2016, so the separate Prices series has a gap over those years rather than a
  fabricated number.
- **Pages are Windows-1252** and declare no charset. `response.text()` would decode them
  as UTF-8 and turn every em-dash and curly quote into U+FFFD, so `fetchPage` decodes
  UTF-8 strictly and falls back rather than accepting a lossy result — this text is the
  scorer's input.

### Markup traps, all of which cost a section before they were handled

- Section headings are matched by **text, never by `id`** — the ids are regenerated every
  release, and all twelve district `h5` ids on a summary page are byte-identical.
- "Highlights by Federal Reserve District" appears three different ways: as an `<h4>`
  (2017–18), as its own `<strong>` (2023), and sharing one `<strong>` with the first
  district via a `<br/>` (Sept 2023, June 2021). The last variant silently swallowed
  Boston's blurb.
- Not every `<strong>` is a heading. January 2018 contains `positive<strong>.</strong>`
  — a bolded full stop mid-sentence — so runs that don't look like headings are folded
  back into the surrounding text instead of starting a section.
- March 2013 contains `S<strong>ervices…</strong>`, with the first letter left outside
  the tag. A short trailing fragment before a bold run is treated as part of the heading.
- Legacy pages use numeric entities (`&#160;`) and unclosed `<p>` tags, and nest the
  prose in layout tables — so the walk descends into the tree rather than reading direct
  children, and entity decoding is general rather than a list of the few named forms the
  modern pages use.
- Headings drift constantly: "Employment and Wages" became "Labor Markets" in 2018, the
  same section appears as "Overview", "Summary", "Prices and Wages", "Wages"; district
  sub-headings are free-form throughout. All are normalised in `shared/topics.ts`.

## Commands

| | |
|---|---|
| `pnpm dev` | dev server |
| `pnpm ingest --all` | scrape + score + store, every supported year |
| `pnpm test` | sentiment and parser tests (offline, against saved fixtures) |
| `pnpm check` | type check |
| `pnpm build` / `pnpm start` | production build and serve |

Remult's admin UI is available at `/api/admin` for browsing the raw tables.

## A note on scale

Aggregates run as SQL `GROUP BY` in `src/lib/server/queries.ts`, not in JavaScript.
When this app only held 2026 it loaded every section into memory to average them;
across 24 years that is 19,400 rows carrying 2.9M words of body text, and the page
would have spent most of its time deserialising prose nobody was going to read. Only
the routes that actually display text fetch `body`. Pages serve in 20–80ms.

## Known data defects (upstream)

About 100 sections from 2003–2010 contain U+FFFD replacement characters — em-dashes
and fractions that the Fed's own pages lost during some historical migration. The
bytes served today are literally `EF BF BD`, so the original characters are
unrecoverable from the HTML; they are left in place rather than guessed at. The PDFs
of those editions are intact if a passage ever matters enough to check by hand.

## Caveats

The sentiment score is a reading aid, not an economic indicator. It measures the
language the Fed chose, which is a deliberate signal but not a measurement. District
sub-headings are free-form and folded into ten canonical topics to make districts
comparable; anything unrecognised falls back to `Other` and is logged by the ingest so
the mapping in `src/lib/shared/topics.ts` can be extended.
