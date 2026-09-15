# Mechanics Guide Illustrations and Review Record

Date: 2026-09-15. This record covers the illustration changes to
`tools/mechanics.html`, their mechanics sources, verification results and closed
review issues. For the deployment steps, see the
[release runbook](DEPLOYMENT.md#september-15-2026-mechanics-illustrations).

## E: knockdown threshold chart

The E-section chart compares a single hit against 25% of maximum HP, not against
remaining HP. It uses internal damage before integer truncation, with a maximum HP
of 1,000 and internal damage of 240, 250 and 260 as examples. A value such as 250.5
crosses the threshold while the integer HP loss is still 250.

The chart describes only the general damage threshold. It does not cover
knockdown, death or other states set directly by special attacks, and it does not
claim that every attack passes through this check.

The [Ephinea Wiki / Game mechanics / Knockdown](https://wiki.pioneer2.net/w/Game_mechanics#Knockdown)
page, read on 2026-09-15, summarizes the rule as "25% or more". The page's
expandable source note records this wording difference and its version limits.

## C: action illustrations and the limits of the measured formula

- The original page's attribution to the
  [SLW measurement video](https://www.youtube.com/watch?v=J2FgRRGCQEM) is kept for
  evasion, differences between Guard animations and the approximate hit-rate
  relationship.
- This pass did not rewatch the video or verify it frame by frame, and did not
  trace every hit and zero-damage outcome for players. The illustrations add no
  claims about the enemy hit-rate formula beyond the cited measurements.
- The figures, knockback paths, displacement arrows and HP bars in the diagrams
  are explanatory sketches, not in-game screenshots. They do not represent exact
  displacement distances or stagger durations.
- The section covers only ordinary, evadable physical attacks, and keeps the body
  text's notes on exceptions such as fixed damage.

## Change scope

- C: decision branches, three outcomes, before-and-after position comparison, and
  a link to E.
- E: internal damage scale, the threshold boundary, the truncation note and an
  expandable source note.
- Formulas and item identities in A, B, D, F, G and H are unchanged.
- A 320 px browser check found that the D-section class boost table widened the
  whole page. It now sits in a keyboard-focusable local horizontal scroll
  container, with the table data unchanged.
- The illustrations use semantic HTML, decorative inline SVG and page-specific
  CSS. Jump links and source notes use native links and `details`, with no new
  dependency or JavaScript runtime.

## Local verification results

- `npm run sync:i18n` ran with no extra differences in generated files, and
  `npm run test:i18n` passed 8 tests.
- `npm run build` passed with 1,265 Angular prerendered routes and 45 event
  fragments. Final gzip JavaScript was 882,022 / 1,000,000 bytes.
- `npm run test:e2e -- --grep 'mechanics authored item references|mechanics diagrams remain readable|authored item names stay aligned across guides and tools' --workers=1`
  passed 3 tests, including the existing cross-page item check.
- `node scripts/verify_zh_localization.mjs`,
  `node scripts/verify_angular_architecture.mjs` and `git diff --check` passed.
- parse5 found no parse errors or duplicate IDs, and every in-page link and
  `aria-labelledby` points to an existing ID. All 15 item identities, across 17
  references, are unchanged. Apart from item reference key casing, the body text
  of F through H is unchanged.
- Chrome desktop screenshots were reviewed for the flow connectors, the three
  action comparisons and the threshold scale. The C-to-E link and the expandable
  source note were exercised by hand.
- Automated checks at 320, 390, 760, 761, 1,024 and 1,440 px passed, and desktop,
  390 px and 320 px screenshots were reviewed by hand. Neither the illustrations
  nor the page overflow horizontally, and the class boost table scrolls within
  its own container.
- Automated WCAG A/AA scans of the illustrations, source notes and table scroll
  area passed, as did keyboard jumps and expand actions.
- No browser error or warning logs were captured.
- Local preview entry points: `http://127.0.0.1:4173/tools/mechanics.html#incoming-physical`,
  with the E section at `#knockdown`.

## Review-fix-loop log

The review found that the earlier "references unchanged" check only proved the
illustration edits had not altered existing references; it could not prove the
references matched the authority's keys. The 6 attributes introduced in `f1dff12`
used 5 non-authoritative casings, and the browser's lenient lookup still displayed
Chinese, so the earlier display checks missed the problem. The page's attributes
are now `OROTIAGITO` (2 places), `FOIE MERGE`, `DOUBLE CANNON`, `LAVIS BLADE` and
`GAL WIND`. Semantic identities, Chinese translations, formulas and values are
unchanged.

The new `tests/e2e/mechanics.spec.mjs` uses parse5 to check every item key in the
source file before page rendering and case normalization. It failed before the fix
and listed all 6 items, and it passes after the fix. It also verifies 6 viewport
widths, keyboard jumps and source note expansion, and WCAG A/AA within the
illustrations. The existing cross-page item E2E test is kept and its assertions
were not relaxed.

| ID | Severity / status | Root cause and check scope | Fix and closure evidence |
| --- | --- | --- | --- |
| M-01 | Should-fix / Fixed | Case normalization in the display layer hid non-authoritative keys in the source file. The existing cross-page test's item attributes were parsed across every tested page, and all 6 missing exact keys were in `mechanics.html`. | All 6 were fixed and a source-level exact-key test was added. It listed 6 failures before the fix and passes after. The existing cross-page test went from failing to passing without relaxed assertions. Sync, 8 unit tests, 3 focused E2E tests, the build and integrity checks passed. |

The final full diff review found no other actionable issues and no remaining
Blocking or Should-fix. Verdict: **PASS**.

## Verification limits

- This local verification did not run the full site test suite. The complete
  release gates run in the Pages workflow for the matching commit, and release
  status follows that build and deploy result.
- The measurements cited in section C were not reproduced, and section E was not
  re-verified in game. The page body and its source notes keep these limits.

## 2026-09-15 PB consolidation review ledger

Scope: `8b235b2..141d070`, covering the mechanics guide illustrations, the
consolidated PB content, the Mag and acronym table entry links, styles, tests and
docs. It also applied the user's new instruction: after local completion, wait for
acceptance, and do not push or deploy without explicit approval. This section
records review evidence; the PB formula text is maintained only in
`tools/mechanics.html#photon-blast`.

Current status: on 2026-09-15 the user accepted the work and authorized commit and
push; see [User acceptance and push authorization](#user-acceptance-and-push-authorization).
The pending-acceptance wording in each round below is kept as the process record of
that time.

### Round 1: review and reproduction

- The full diff, Angular content generation and related entry links were reviewed.
  New formulas, input parameters and scope were checked against the Ephinea Wiki
  Game mechanics, Photon Blasts and Mags pages. The diagram values were recomputed
  independently, and no formula or example errors were found.
- parse5 checks of the mechanics guide, Mag page and acronym table found no parse
  errors, duplicate IDs, dangling in-page links or broken `aria-labelledby`.
- The existing mechanics tests passed 2 tests. A temporary probe removed every PB
  icon after load and the existing tests still passed 2 tests, confirming a gap.

| ID | Severity / status | Root cause and impact | Regression coverage and closure evidence |
| --- | --- | --- | --- |
| PB-R01 | Should-fix / Fixed | Icon and section checks iterated over the current DOM, so the loop never ran when nodes were missing, and mismatched icons were only checked for loading. This affected the six PB icons, the four-chain icon order and eight section entry links. Existing cross-page links had been verified by hand only once. | A fixed set of required icons and sections now verifies name-to-icon pairing, chain order, and the three entry links and return paths from the Mag and acronym pages. The mechanics tests pass 3 tests, and temporary probes for a missing icon, a wrong icon and a missing section are each caught by the new assertions. |
| PB-R02 | Should-fix / Fixed | The intro area used a top-level `header` for layout, which together with page-chrome's `header` exposed two unnamed banner landmarks. The original WCAG tags and scoped selectors did not check page-wide landmark uniqueness. This affected assistive-technology navigation between the page header and the intro. | A page-wide Axe `landmark-unique` probe reproduced it. The intro container is now a `div`, and checks for the banner count and page-wide landmark uniqueness were added. All 9 final focused E2E tests passed, including this regression. |
| PB-R03 | Blocking / Fixed | The user's request for a per-skill analysis was narrowed to a list of formulas and parameters. The six PB cards had only brief effects and formulas, with no use cases, limits, stat differences or chain role. The original acceptance covered only formulas and icons and missed content completeness. | Each of the six PBs now has its mechanism, parameter effects, usage analysis, chain role, its original icon and a new SVG sketch. The skill analysis comes first, with six new jump links and a same-conditions damage comparison. The new regression failed on the old page for lacking the six analysis entry links. After implementation it verifies each skill's effect, stat differences, key limits, image-text association and keyboard jumps, and passes. |

The user's workflow change was handled separately: `AGENTS.md` now says to wait for
acceptance after local verification. This round made no commit, push or deploy.

### Round 2: post-fix review

The PB-R01 regression test initially used an accessible link name without spaces.
After checking the browser accessibility snapshot, the test locator was corrected
and all 3 formal tests passed. This was a test tooling problem; the product was not
changed to satisfy a wrong assertion.

The three fault probes then confirmed that a missing icon, a wrong icon and a
missing section each fail. The new page-wide landmark check found PB-R02, which was
fixed; this intermediate state was not treated as a completion verdict.

### Round 3: completing the per-skill analysis

- The user pointed out that the "analysis of each PB skill" was still missing. The
  gap was recorded as PB-R03, with an explicit acknowledgment that the scope had
  been narrowed to a formula summary. The new test
  `each PB explains its role, stat scaling and limits beside its illustration`
  reproduced the failure on the old build: 6 skill analysis entry links expected,
  0 found.
- The six skills were written up one by one from the effect descriptions and
  formulas in [Ephinea Photon Blasts](https://wiki.pioneer2.net/w/Photon_Blasts).
  The text clearly separates sourced facts from derived advice, and the sketches do
  not claim specific distances, exact ranges or targeting rules.
- The same-conditions examples for the four attack PBs were recomputed
  independently, and base power and final damage match the text. Each PB still has
  a single main card, and the attack, recovery and support formulas are maintained
  with its analysis. The Mag page and acronym table still point to the mechanics
  guide instead of copying the guide.
- The full local diff and related entry links were reviewed. The visual review
  changed the twin-PB diagram, which had shown ATP and DFP labels under different
  players, to "攻防 ↑" (ATP/DFP up) for each player, so it cannot be read as each
  player receiving only one boost. After rebuilding, screenshots were retaken and
  reviewed, and the same 9 tests passed.

Final verification:

```sh
rtk npm run build
rtk npm run test:e2e -- --grep 'mechanics authored|mechanics diagrams|each PB explains|Mag and acronym PB|/(tools/(mechanics|mag)|guide/acronym)\.html prerendered|authored item names stay aligned|Angular protocol, Vol Opt, and Mag controls'
rtk node scripts/verify_zh_localization.mjs
rtk node scripts/verify_angular_architecture.mjs
rtk git diff --check
```

- The build succeeded with 1,265 prerendered routes and 45 event fragments, and
  gzip JavaScript of 894,263 / 1,000,000 bytes.
- 9 focused E2E tests passed. They cover no horizontal page or card overflow at
  320, 390, 760, 761, 1,024 and 1,440 px, required icon pairing and loading,
  keyboard jumps to every section and skill, the three cross-page entry links and
  returns, scoped WCAG checks, page-wide landmark uniqueness and related Angular
  interactions.
- The Chinese consistency check and the Angular ownership check across 105 HTML
  source files passed. parse5 checks of the three related pages found no parse
  errors, duplicate IDs or dangling links and `aria-labelledby`.
- Local screenshots were reviewed by hand: `/tmp/pb-skills-desktop.png`,
  `/tmp/pb-support-desktop.png`, `/tmp/pb-estlla-mobile.png`,
  `/tmp/pb-twins-mobile.png` and `/tmp/pb-comparison-desktop.png`. Skill icons,
  sketches, text and formulas are readable, and phones show a single column.

No Blocking or Should-fix issues remained. Verdict: **PASS**. This round was local
content and display verification only; it did not run the full `release:prepare` or
claim in-game testing. The changes were not committed, pushed or deployed, and user
acceptance remained a precondition for release.

### Round 4: aligning with Wiki rules and examples (user follow-up)

At the user's request to "calibrate and align", the whole PB section and the Mag
and acronym entry links were re-checked. Sources were the Ephinea Wiki
`Photon Blasts` page (cited revision 41842) and `Game mechanics#Special attacks`,
with the level concepts for Mag auto-activation and PB casting also checked against
`Mags#Trigger types`.

| ID | Severity / status | Root cause and impact | Regression coverage and closure evidence |
| --- | --- | --- | --- |
| PB-R04 | Should-fix / Fixed | Rules were compressed and cited only broad sources. The text did not say that an overwritten player loses the chain bonus when adjacent PBs repeat. The twin-PB level examples did not mark their derived nature nearby and lacked a comparison of donating participants against effective PB count. The last sentence on PB accumulation pointed its special-attack restriction to the Photon Blasts page, which does not state that restriction. This affected the twin card, parameter table, chain and donation paragraph, and the PB accumulation source. | Added the overwrite consequence, same-room and timing conditions and exact source links, clarified the meaning of Shifta and Deband levels, and added regressions for conditional donation and chain examples. The old page failed on the missing overwrite consequence, and 10 final focused E2E tests passed. Formulas were recomputed item by item with no numeric errors found. |

The regression first failed because a new accessible name did not exist yet. After
switching to the existing chain list locator, the old page failed specifically on
the assertion "被覆盖的玩家不会获得该次连锁收益" (an overwritten player does not
receive that chain bonus), confirming the coverage targeted missing content. After
the first fix, 10 tests passed. A manual screenshot review then found that the
level column required horizontal scrolling on phones by default, so the table was
changed to show all four columns on narrow screens, and the regression now checks
that every column and its text is visible at 320 and 390 px.

| ID | Severity / status | Root cause and impact | Regression coverage and closure evidence |
| --- | --- | --- | --- |
| PB-R05 | Should-fix / Fixed | The new phone table rule had lower selector specificity than the site-wide `.content-container table th/td`, so 15 px of left and right padding remained. With fixed column widths, the Q and level text overflowed their cells. This affected the table's header and data cells on narrow screens. | A 320 px cell content size assertion reproduced it. Computed styles confirmed `12px 15px`, with a 36 px Q column needing 41 px. After scoping the rule to the mechanics guide with higher specificity, header and cell size assertions and screenshots at 320 and 390 px passed, and all four columns are readable without horizontal scrolling. |

Final rebuild and review:

```sh
rtk npm run build
rtk npm run test:e2e -- --grep 'mechanics authored|mechanics diagrams|each PB explains|PB donation rules|Mag and acronym PB|/(tools/(mechanics|mag)|guide/acronym)\.html prerendered|authored item names stay aligned|Angular protocol, Vol Opt, and Mag controls'
rtk node scripts/verify_zh_localization.mjs
rtk node scripts/verify_angular_architecture.mjs
rtk git diff --check
```

- The build succeeded with 1,265 routes, 45 event fragments and gzip JavaScript of
  895,760 / 1,000,000 bytes. 10 final focused E2E tests passed, and the Chinese
  check, the ownership check across 105 HTML source files and the diff check
  passed.
- parse5 parsing, ID uniqueness, in-page links and `aria-labelledby` integrity
  passed for the three related pages. The new level table was recomputed through
  independent algebraic simplification, and all six scenarios match the page.
- Screenshots under
  `test-results/mechanics-PB-donation-rule-81698--facts-from-worked-examples/`,
  namely `pb-levels-desktop.png`, `pb-levels-mobile-320.png` and
  `pb-levels-mobile-390.png`, show method, Q, N and level readable together on
  desktop and both phone widths, with no overlapping or clipped text.
- The final review covered the six original PB cards, parameter definitions,
  damage, recovery and support formulas, donation and chain rules, the new level
  table and related entry links, and found no remaining Blocking or Should-fix.
  Verdict for this round: **PASS**.
- This round maintained PB text only in the mechanics guide, with the docs
  recording sources and acceptance status. The text notes where content is
  compiled and derived from the Wiki. No in-game testing or full `release:prepare`
  was done. All changes stayed local, uncommitted, unpushed and undeployed,
  pending user acceptance.

### Round 5: user invoked review-fix-loop again

- All 7 locally changed files were re-reviewed with nothing staged. The related Mag
  and acronym entry links, HTML-to-Angular body, URL and style generation, page
  header, route configuration and test selectors were checked, and no new
  actionable issues were found.
- The Ephinea Wiki Photon Blasts page was re-read to check the six effects,
  first-caster parameters, truncation formulas, Q and N, donation and overwrite
  rules, and the twin revival restriction. The attack comparison, Pilla single,
  donated and four-chain casts, and the six twin level scenarios were recomputed
  independently and match the page. Rules, derived advice and untested limits
  remain clearly labeled.
- PB-R01 through PB-R05 remain Fixed. Required icon and name matching, a unique
  banner, six independent analyses, rule sources and the donation level comparison,
  and phone cell content sizes all pass their existing regressions. No new defects
  were found in this round, so only the review record was added.
- All verification commands from Round 4 were rerun. The build succeeded (1,265
  routes, 45 fragments, gzip JavaScript 895,760 / 1,000,000 bytes), all 10 focused
  E2E tests passed, and the Chinese, 105-file HTML ownership and diff checks passed.
  parse5 again found no parse errors, duplicate IDs or dangling in-page or
  `aria-labelledby` references across the three related pages.
- The regenerated `pb-levels-desktop.png`, `pb-levels-mobile-320.png` and
  `pb-levels-mobile-390.png` were reviewed by hand, and all four columns and their
  text are fully readable. External reference checks were based on the Wiki text and
  page link targets; external site availability and in-game testing were not part
  of the local E2E.
- The final full review found no remaining Blocking or Should-fix. Verdict:
  **PASS**. Verification covered the mechanics guide and related modules only,
  without the full `release:prepare`. All changes remained uncommitted, unpushed
  and undeployed, and user acceptance was still required before release.

### User acceptance and push authorization

- On 2026-09-15, after confirming the illustration assets and the Round 5 review,
  the user explicitly asked to align the docs, commit and push.
  The mechanics guide changes were accepted and commit and push were
  authorized.
- The delivery includes icons, skill sketches and independent analyses for all six
  PBs, damage, recovery and support level parameters, Wiki rule calibration, the
  donation level comparison, the phone display fix, and the matching regression
  tests. PB text is maintained only in the mechanics guide.
- The docs moved this item from pending acceptance to done and keep the repository
  rule that later work must be accepted before pushing. After acceptance only the
  doc status was updated. Product verification relies on the Round 5 build, 10
  focused E2E tests, and Chinese and architecture checks; it was not extended to a
  full `release:prepare`.
- This version was committed directly to `master` and pushed to `origin/master`.
  The Git commit history matches this delivery, and actual deployment status
  follows the Pages workflow result for that commit.
