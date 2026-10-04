# Price guide data and localization

## Ownership and maintenance

Haven PSOBB Wiki supports English, Japanese and Chinese. Price-guide UI labels,
references and explanatory text follow the selected language. Item-name coverage
depends on the authority; this does not claim every item has three translations.

- Source snapshot: `assets/js/price_guide_data.js`, extracted by
  `scripts/scrape_price_guide.py` from the Ephinea Wiki price guide.
- Angular projection: `scripts/generate_angular_content.mjs` produces the ignored
  `src/app/generated/data/price-data.ts`; do not edit that projection.
- Presentation: `src/app/price-guide/price-guide.component.*` handles rendering,
  filtering and language state; `price-guide.messages.ts` owns the labels and
  whole-identity localization shared by both translated editions.
- Item names: `../droptable/i18n_names.json` is authoritative. Run
  `npm run sync:i18n`; never add page-local item translations. Exact identity
  matching wins; case-insensitive matching is accepted only when unambiguous.
- Category labels are distinct from item identities. In particular, `Swords`
  in the combination table is the sword category, not the `SWORDS` item.
- Column keys are unique. Duplicate display headers use occurrence suffixes
  such as `Price [2]`, which the renderer strips from the visible heading.
  Empty name headers become `Item Name`; other unnamed columns are explicitly
  labeled instead of dropped or assigned guessed attribute values. Wiki
  navigation boxes do not belong to the price dataset.
- Chinese item cells retain the English identity with the generated Chinese
  name. References and compound lists localize complete names. An unavailable
  translation remains a complete English identifier, never a partly replaced word.
- Search includes raw English and both localized forms, including compound cells.

A full upstream refresh is separate from this repair. Write scraper output to a
candidate file, review its price and schema changes, then replace the snapshot.
Validate with `npm run test:price-guide` (also part of `npm test`), build, and the
price-guide tests in `tests/e2e/site-smoke.spec.mjs`. Business tests read only
committed dictionary/data inputs because CI runs them before Angular generation.

## October 4, 2026 repair record

Contract: align Chinese, English and Japanese price-guide labels, references,
compound cells and item identities; preserve numeric prices and distinct columns.
Use the generated authority for item names. Upstream Wiki and item-name authority
writes are outside this repair. The maintainer authorized commit and push on
2026-10-04; deployment is verified separately through the matching CI run.

| ID | Status | Root cause / affected scope | Required evidence |
| --- | --- | --- | --- |
| PG-1 | Fixed | Japanese substring replacement corrupts referenced identities | Every snapshot reference, exact/case-insensitive identities, language switching |
| PG-2 | Fixed | Category cells treated as item identities (Swords) | Categories vs items, reference targets and searches |
| PG-3 | Fixed | Chinese localization bypasses ordinary and compound cells | All headers, labels, specials, techniques, paint and ES lists, service prices |
| PG-4 | Fixed | Extraction drops blank header columns; generic navigation included | Blank/duplicate headers, snapshot row/column schema, rendered frame names |
| PG-5 | Fixed | Tests skip component content and only sample references | Whole-snapshot coverage plus independent expected-output regressions and browser tests |

Baseline evidence: three prerendered editions each have 63 tables / 860 body rows;
Japanese references contain `Love ハート` and `マグic Rock "ハート Key"`;
Chinese combination table says `Swords 双刀`; frame names are absent; Chinese
Level headers, Mag labels, technique groups and unsealing rates remain English.
Existing 4 browser and 36 data-page tests passed despite these defects.

Stopping condition: all entries fixed with regression evidence, full business
tests and production build pass, relevant browser tests pass, fresh review has
no actionable in-scope findings. Publication additionally requires the complete
local release gates and the matching successful CI deployment.

## Verification and final review

- PG-1/2/3: one PriceLocalizer handles both editions with full-identity lookups,
  exact-case precedence and ambiguity rejection. Category labels take precedence
  over same-spelled item identities. No substring replacement remains. Compound
  cells, ordinary labels, rates and level headers are covered by snapshot tests.
- PG-4: 4 new extraction regressions failed against the original parser, then
  passed after the fix. A fifth fixture crosses two header rows, rowspans and
  repeated prices. Empty headers now have visible keys; duplicate prices have
  distinct keys; navigation tables are excluded.
- Root-cause expansion also found overwritten EP1 and old-paint prices. Restored
  35 / 25 PD and 2–3 / 5 PD respectively from
  https://wiki.pioneer2.net/w/Price_guide (checked 2026-10-04).
  Other existing price values were preserved; this is not a market-price refresh.
- PG-5: new content and column browser tests failed against the old build, then
  passed against the corrected production build. Added test:price-guide to npm test.
- npm test: passed (full business suite; extraction suite initially 6 cases).
- python3 -m unittest scripts.test_scrape_price_guide: 7 passed including the final
  additional multi-header/rowspan fixture.
- node --test scripts/test_price_guide_i18n.mjs: 5 passed; covers all snapshot
  labels/cells and all 21 See references plus the RL note.
- npm run build: passed; 3,802 routes; JavaScript gzip 1,000,930 / 1,003,000 bytes.
- npm run test:e2e -- tests/e2e/site-smoke.spec.mjs --grep 'Angular price guide':
  6 passed, including every price cell/column in all three editions.
- npm run sync:i18n and git diff --check: passed.
- Fresh output review: each edition has 62 tables / 851 body rows. The nine wiki
  navigation rows are removed. Titles and document languages match their routes.
  All 22 reference/note forms render; no Japanese partial-name corruption remains.

Intentional boundaries: unlocalized item identities, ES identifiers, and the
Chinese technique identities Rabarta/Reverser/Ryuker remain complete English where
no authoritative translation exists. Unnamed source columns are exposed explicitly
rather than silently dropped or assigned invented attribute values. No upstream
name changes or full live price refresh are included. Publication status belongs
in [the deployment runbook](DEPLOYMENT.md#october-4-2026-price-guide-internationalization).

Final verdict: PASS. No actionable in-scope findings remain.

The release preflight found and fixed a test-only CI ordering dependency: the
new unit test originally imported ignored generated item data. It now reads
the committed dictionary input. The same five tests pass in a temporary tree
containing only their committed inputs and no Angular generated directory.
