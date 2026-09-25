# RBR Data Sources and Automation Limits

## Summary

Most objective RBR data can be automated, but tier ratings cannot be generated
automatically as they are.

- The candidate quest pool, mechanics, the Wiki's current rotation, quest EXP and
  enemy counts can already be fetched automatically.
- Drop rates can be joined with the repository's existing Ephinea drop tables.
- Prices can be joined with the existing Price Guide scrape.
- Tiers still need human review, because they reflect routes, clear times, party
  requirements, execution difficulty, market liquidity and the author's
  preferences.

The home page RBR cards and the detail page's tier chart share the ratings and
`recommendedSectionIds` in `data/rbr/tiers.json`, and their colors come from the
site's BB drop table palette. The home page shows the recommended color through a
colored top border, a color dot and the ID name, along with the tier and rating
date, and makes clear the rating is an unofficial farming value assessment. The
rotation is still read from `data/rbr/source.json`, so the current quests, colors
and ratings are never hard-coded in the page. After the sync script writes a new
rotation, `npm run build` updates both the home page cards and the detail page
data. The sync script itself does not commit or deploy; changes reach production
only after they are committed, pushed and published through Pages.

## Data chain

```text
Ragol Boost Road Wiki ──> candidate pool (EP1 23 / EP2 21 / EP4 14) and boost rules
In-game `/rbr` ────────> this week's three quests (the only authoritative source)
RagolBoostRoad template ─> Ephinea Wiki mirror and candidate diff baseline
58 quest Wiki pages ───> episode, category, Ultimate EXP, enemy count
Ephinea drop tables ───> enemy × Section ID × item × base drop rate
Price Guide ───────────> item price ranges
Player measurements ───> route, party size, clear time, failure rate
                           │
                           └──> expected drops per run / value per hour / suggested ID
                                      │
note tiers + human judgment ─────────> final tier
```

## Implemented generator

Run:

```bash
python3 scripts/build_rbr_data.py
python3 -m unittest scripts/test_build_rbr_data.py
```

Output: `data/rbr/source.json`

## Weekly update entry point

RBR no longer polls the Ephinea Wiki on a GitHub Actions schedule. The old
`sync-rbr.yml` was retired, because the Wiki is only a mirror that can lag behind
and cannot stand in for the game server's actual rotation.

Each week the maintainer provides the raw output of the in-game `/rbr` command and
confirms the three quest abbreviations for Episodes 1, 2 and 4. The current
planner accepts only those three separated abbreviations and cannot yet parse the
raw `/rbr` text directly. It validates the input, the Tracker state, the site
projection and the Ephinea Wiki candidate diff. Site data updates are not run by a
scheduled job. The two Ephinea Wiki templates can be updated explicitly by the
locally authenticated publisher.

## Automation status

Read-only research and plan validation are complete:

- the in-game `/rbr` command is established as the only authoritative source for
  the current rotation;
- the three quest abbreviations, episode assignment, week and Tracker state are all
  validated;
- candidate Wikitext, revisions and diffs are generated for both Ephinea Wiki
  templates;
- the site's current and Tracker projection is generated and passes the same
  structural checks as the candidate Wiki templates;
- candidate Wikitext is previewed only through `action=parse`, with no external
  writes.

A cross-target publishing flow of "enter `/rbr` once and update both the site and
the Ephinea Wiki automatically" is not implemented:

- there is no parser for raw `/rbr` text;
- the planner and Wiki publisher do not write or commit the site's
  `data/rbr/source.json`; the site snapshot is updated by the generator with human
  review, a commit and a Pages release;
- the local publisher handles only the two Ephinea Wiki templates and does not
  commit to the site;
- there is still no ordered publishing, partial failure recovery or idempotent
  retry across the two targets.

The `localProjection` and Wiki diff from the read-only planner are therefore
candidate results, not publication records. Only the per-template revisions and
post-write verification returned by `publish_rbr_update.py` count as Wiki
publication records.

## Known update paths for both targets

The site is not MediaWiki; it is a static GitHub Pages site published from a Git
repository. Its update path is already defined: update `data/rbr/source.json`
with the three quests from the in-game `/rbr`, run the RBR tests and the production
build, commit to `master`, and publish through the Pages workflow. What is missing
is an implementation that builds a complete snapshot directly from `/rbr` input and
runs that publishing chain; the existing `localProjection` cannot replace it.

The Ephinea Wiki uses the standard MediaWiki Action API. The local publisher opens
an in-memory cookie session, logs in through `clientlogin`, fetches a CSRF token,
reads the latest revision and timestamp of both templates, and submits
`action=edit` with `baserevid`, `basetimestamp` and `starttimestamp`, re-reading to
verify after each write. If one template succeeds and the run is then interrupted,
a rerun recognizes the intermediate state and completes only the remaining template.
Any unknown inconsistent state stops the run.

The site and the Wiki share no transaction, so they cannot be claimed to update
"atomically together". The two templates within the Wiki are not a single
transaction either, but the publisher records each template's revision and allows
safe retries from the same input.

## Syncing the site after someone else updates the Wiki

When the maintainer asks to adopt an already-updated Wiki, the site can be synced
through the generator. This does not mean the in-game `/rbr` was checked
independently. First check the current quests, episode assignment, Tracker and UTC
Sunday date, then review the snapshot diff:

```bash
python3 scripts/build_rbr_data.py --require-current
git diff -- data/rbr/source.json
npm run test:rbr
npm run build
```

When the mirror date is stale or the Tracker is inconsistent, `--require-current`
prints `RBR rotation pending` and exits with status 0 without writing files, so the
exit code alone does not prove a sync happened. When the local snapshot already
belongs to the current week, the option skips fetching entirely. To re-check the
remote content, use a separate temporary output path.

If the Wiki date is wrong, first generate a temporary diagnostic snapshot and check
the cause; never change an arbitrary old date to the current week automatically.
When the maintainer confirms that only the site's date should be corrected, fix
`current.week` in the site snapshot, keep `expectedWeek` and `isFresh` consistent,
and remove the resolved date warning. Keep any other warnings and the source
revisions actually read. The update record keeps the Wiki's original date and the
reason for the site correction, so a manual correction is never mistaken for source
data.

After review, commit and push to `master`, and confirm that both the `build` and
`deploy` jobs of the matching Pages run succeed. Site releases and Ephinea Wiki
edits are recorded separately, and a site date correction never modifies the
remote templates.

### 2026-09-06 update record

- The maintainer asked to sync a Wiki that someone else had updated; the in-game
  `/rbr` was not read this time.
- The current template was read at revision `43522` and the Tracker at revision
  `43520`, and both list the same quests: EP1 `SU2`, EP2 `LSR`, EP4 `WoL2`. The
  candidate pool is still 58 quests.
- The Wiki template was labeled `05 September 2026` when read, while the current
  UTC Sunday was `06 September 2026`. With the maintainer's confirmation, the site
  date was corrected to September 6. The Ephinea Wiki was not edited.
- Data sync commit `fde585f`; date correction and release dependency fix commit
  `e2c7678`. The latter updated `fast-uri` to `3.1.7` and `qs` to `6.16.0`,
  clearing the dependency audit blocker.
- 54 local RBR tests and the production build passed. The first full local browser
  run passed 116 tests with 1 anchor positioning failure, which passed when rerun on
  its own. CI passed all 117 browser tests, and the dependency audit, business
  tests, reproducible build and Pages deployment all succeeded. The release run was
  `34004094751`; it was cleaned up on 2026-09-14 at the maintainer's request, and
  its logs are no longer available.

### 2026-09-13 update record

- The maintainer provided an in-game `/rbr` screenshot confirming EP1
  `Scarlet Realm #1` (`SR1`), EP2 `Lost DEMON'S RAILGUN` (`LDR`) and EP4
  `War of Limits 5` (`WoL5`).
- The Wiki's current template was still revision `43522`, with the original date
  text `5 September 2026`. Following the confirmed September 6 record above, only
  the old week date in this run's planning input was corrected before running the
  existing quest pool, episode, Tracker advancement and MediaWiki render preview
  checks. The remote templates were updated directly to the current week,
  `13 September 2026`, without adding general date tolerance or changing the
  publisher's validation rules.
- At the maintainer's request, both templates were submitted with their original
  revisions and timestamps and read back one by one:
  [current quests revision 43587](https://wiki.pioneer2.net/index.php?title=Template:RagolBoostRoad&oldid=43587)
  and
  [Tracker revision 43588](https://wiki.pioneer2.net/index.php?title=Template:RagolBoostRoadTracker&oldid=43588).
- The site then generated a complete snapshot from these two published revisions
  through `build_rbr_data.py --require-current`. The objective data for all 58
  quests was unchanged, and the enemy count notes for the 5 random-spawn quests
  were kept.
- 54 local RBR tests, the production build, and browser tests covering the RBR
  Tracker and the tier chart's current quest markers passed. The site's current
  quests and Tracker were also checked one by one against the reviewed publishing
  plan and match exactly.

### 2026-09-20 update record

- The maintainer provided an in-game `/rbr` screenshot confirming EP1
  `Sweep-up Operation #1` (`SU1`), EP2 `Penumbral Surge #1` (`PS1`) and EP4
  `Sweep-up Operation #13` (`SU13`).
- The read-only planner found the Wiki current template still at revision
  `43587` (September 13), while Tracker revision `43611` already matches the
  screenshot. Candidate validation and both MediaWiki render previews passed.
- The Wiki current template was subsequently published and read back at
  [revision 43613](https://wiki.pioneer2.net/index.php?title=Template:RagolBoostRoad&oldid=43613).
  The already-correct Tracker required no edit.
- The site snapshot was regenerated from published revisions `43613` and
  `43611`. Its current quests and Tracker match the reviewed plan exactly;
  all 58 quest records, ratings and enemy-count warnings were retained.
- EP2 has no remaining possible quests this cycle; its reset belongs to the
  next weekly transition. The maintainer approved publishing both targets;
  this snapshot is included in the site release.
- 55 RBR tests, the production build and both home RBR browser tests passed
  for the updated rotation.

### 2026-09-14 home page release record

- `548e78e` committed and released the home page tier, recommended ID and color
  display. The home page and the detail page's tier chart share rating and
  recommendation data; the current rotation and ratings were not changed.
- [Pages run 34821846682](https://github.com/ephinea4haven/ephinea4haven.github.io/actions/runs/34821846682)
  passed business tests, the production build, the repeated build comparison,
  1,386 browser tests and deployment.
- A live refresh of `https://www.psohaven.com/` confirmed that SR1, LDR and WoL5
  are all Tier D with recommended IDs Pinkal, Bluefull and Pinkal, and that the
  colored top border, color dot and the rating note `2025-11，非官方`
  (2025-11, unofficial) display correctly.

## Validating a Wiki update plan

The in-game `/rbr` command is the only authoritative source for the server's actual
rotation, and the server has no public RBR API. The first stage only validates the
update plan; it neither edits the Ephinea Wiki nor overwrites the site's
`data/rbr/source.json`:

```bash
python3 scripts/plan_rbr_update.py \
  --episode-1 EN3 \
  --episode-2 PS2 \
  --episode-4 NMU5
```

The planner reads the candidate pool, the current template and the Tracker,
confirms the Wiki is at most one week behind or already current, validates each
abbreviation's episode and the current round state, generates two candidate
Wikitexts, and runs a read-only render preview through MediaWiki `action=parse`.
The JSON output includes the source revisions, template diffs, preview HTML size
and the current and Tracker projection the site will use.

`.github/workflows/validate-rbr-update.yml` provides the same manual input entry
point. The workflow has only `contents: read` permission; it reads no Wiki
credentials, never calls `action=edit` and commits no files. It only validates the
plan and is not a publishing flow for the site or the Ephinea Wiki.

## Publishing the two Wiki templates locally

Credentials live in the Git-ignored `.secrets/ephinea-wiki.json`:

```json
{
  "username": "account name",
  "password": "account password"
}
```

The file must be readable and writable only by the current user:

```bash
chmod 600 .secrets/ephinea-wiki.json
```

Publish command:

```bash
python3 scripts/publish_rbr_update.py \
  --episode-1 EN3 \
  --episode-2 PS2 \
  --episode-4 NMU5
```

The publisher still runs the full plan and MediaWiki render preview first. If both
templates are already in the target state, it completes login and read
verification and returns `already-current`, without fetching a CSRF token or
making an empty edit. Credentials are never written to output, Git, command-line
arguments or cookie files.

The two manually curated tier tables are stored in `data/rbr/tiers.json`. An
integrity test confirms that each of the 58 RBR candidate quests appears exactly
once, with no omissions or duplicates:

```bash
python3 -m unittest scripts/test_rbr_tiers.py
```

`scripts/build_rbr_tier_charts.py` renders both tier charts from these tables in
Chinese, English and Japanese, into `assets/img/guide/rbr/{zh,en,ja}/`. The
guide's written tier notes live in `guide/rbr.html` (Chinese) and
`content/i18n/pages/{en,ja}/guide/rbr.html`; when a tier or its notes change,
regenerate the charts and update all three texts together:

```bash
python3 scripts/build_rbr_tier_charts.py
python3 -m unittest scripts.test_rbr_tier_charts
```

The generator:

1. Reads the `Ragol Boost Road` page through the MediaWiki API.
2. Audits that the candidate counts are still EP1 23, EP2 21 and EP4 14, for 58 in
   total.
3. Reads `Template:RagolBoostRoad` to get the week and three quests published on
   the Wiki.
4. Reads the 58 quest pages concurrently.
5. Extracts the Wiki revision, quest category, Ultimate EXP, enemy count and
   conditional count notes.
6. Writes the JSON atomically, so network or critical structure errors never
   corrupt the existing file.

The five current Wiki pages for `Anomalous Ordeal` have no fixed spawn table,
because those quests feature random spawns. The generator marks them
`enemyCountStatus: "unavailable"` instead of inventing counts.

## "Current RBR" is not a fully reliable public API

The in-game `/rbr` command and the lobby counter are the authoritative sources for
the server's actual state. The Wiki's `Template:RagolBoostRoad` is a public,
scrapeable mirror, but it is maintained by Wiki editors and can lag behind the
server rotation at 00:00 UTC every Sunday.

The generator computes the most recent Sunday and writes:

- `current.expectedWeek`
- `current.isFresh`

When running the generator by hand, `--require-current` rejects a Wiki mirror that
does not yet match the current UTC week. It is only a local diagnostic gate and is
no longer called by a scheduled Action. Without the flag, the generator can still
produce a diagnostic snapshot with warnings.

## Calculating drop value automatically

Given the enemy count `n` and the final drop probability `p` for a single enemy,
the probability of at least one drop is:

```text
P(at least one per run) = 1 - (1 - p)^n
```

The next stage can join `source.json` with `data/droptable/bb/data/en.js` to
generate, for each quest and Section ID:

- the drop probability of each rare item per run;
- the recommended Section ID;
- probabilities with RBR 1–4 player boosts applied;
- the PD value per run, estimated from Price Guide median prices;
- value per hour once measured clear times are added.

This first requires confirming Ephinea's exact formula for combining DAR and RDR
boosts; boosts must not be multiplied onto the final drop rate twice.

## Why tiers cannot be fully automated

The tiers in the two note articles are not simply sorted by enemy count. They
clearly also use:

- partial routes, such as farming only Area 1 or leaving mid-quest;
- time savings from 2:2 or four-way party splits;
- equipment and difficulty conditions such as Hell, Divine Punishment and
  Anguish 1;
- extra rewards such as bosses, boxes, Lucky Coins, quest tickets and Meseta;
- market prices and item liquidity at the time;
- map travel distance, getting lost, puzzles, failure risk and party experience.

The safest approach is therefore "automatically generated objective tables plus
manually maintained route times and tiers". When the note text, a Wiki revision or
the drop tables change, automated checks flag the need for re-evaluation instead of
changing tiers on their own.
