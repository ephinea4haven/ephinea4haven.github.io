# PSO FRAME slot3 (Red-Wolf): archive inventory and local acquisition

Investigated and acquired: 2026-09-16. Source discovery, the initial topic
inventory and local acquisition are complete. Restoration and verification of
the old gameplay claims on Ephinea remain open. No source text or images have
been imported into public pages.

## Local acquisition completed

On 2026-09-16, all **279 indexed files** were downloaded successfully: 62 HTML
documents (61 named pages plus the frame root) and 217 images/icons, totaling
13,120,440 original bytes. The local archive is under
`artifacts/redwolf-archive/`; open its `index.html` to browse. This directory is
excluded from Git and is outside the public build's input directories.

The archive contains unchanged source files, response headers and provenance,
SHA-256 hashes, UTF-8 browsing/text copies, extracted tables and links, a
resumable downloader, and a missing-resource manifest. Local browsing copies
disable source scripts and use recovered local assets.

All 279 downloaded payloads match their CDX SHA-1 digests. There are 38 further
internal references with no successful capture in the saved domain-wide CDX
results for either historical host. These include `menu.html`, the 2003–2005
logs, `psogcweapon.html`, `link.html`, the BBS endpoint and 31 image addresses.
This is a limitation of the recovered archive, not a claim that those files
never existed. The local `missing.json` records each URL and its referring pages.

The 216 PNGs decode in Chromium; the legacy 24-bit favicon decodes with Pillow
but is rejected by Chromium's `Image.decode()` and is retained unchanged.
Content interpretation and reuse decisions are deferred until the maintainer
has reviewed the acquired material.

An image-visibility follow-up checked actual rendering on all 62 pages. Of these,
31 source snapshots contain no image references, including `ctrltower.html`
and its `#kokoroquest` section. Across the others, 233 image placements resolve
to saved assets and 63 placements are unavailable, including repeated references
and an external event-counter image. The local `gallery.html` exposes all 216
PNGs directly; the index now shows per-page image coverage, and browsing copies
mark missing image positions visibly. These additions do not change raw files.

The final local `verification.json` records 279 matching payload hashes and
CDX digests, 62 rendered pages, 216 rendered gallery thumbnails, 63 visible
missing-image markers, zero automatic network requests and zero violations.
The local package `PSO_FRAME_slot3_2026-09-16.zip` includes the updated directory,
gallery and verification evidence; its ZIP integrity check passed. Its SHA-256
is `ed84182241e73ff1c95dbad07f8bea5b6884e2988e003cd38301cfed52d09934`.
Only this research record, the CDX address inventory and related task tracking
are committed; the acquired source content and local tools remain in the
ignored archive directory.

## Identity and archive access

The author's [migration notice][headline] records a move on 2005-07-02 from
`http://www.red-wolf.ac/pso/` to `http://www.red-wolf.sakura.ne.jp/pso/`.
The [original README][readme] identifies Red-Wolf as the maintainer and says the
site primarily documents GameCube PSO Episode I & II. Xbox and Blue Burst are
mentioned only insofar as their behavior is compatible. Its Section ID calculator
explicitly does not support BB or EP4.

The old hosts were not readable in this investigation. Wayback raw replay did
return the archived Shift_JIS HTML. Decode it as Shift_JIS; a successful HTTP
response alone is insufficient because a missing replay can return Wayback UI
instead of the requested page.

The [CDX query][cdx] returned 279 distinct URL records with archived status 200:
61 `.html` pages, one frame-based root and 217 image/icon URLs. The machine-readable
[CDX inventory](PSO_FRAME_CDX_2026-09-16.json) preserves those results. These are
indexed addresses, not a guarantee that every asset can still be replayed or a
complete count of the original site. `collapse=urlkey` selects a representative
capture per URL; its timestamp is not the page's authored or latest update date.

The root loads `menu.html` and `pso.html`. The menu is absent from this successful
capture inventory, and a direct replay attempt returned Wayback UI. The README
and content pages therefore provide the navigation evidence used below.

## Confirmed content families

| Family | Observed contents | Original path / evidence |
| --- | --- | --- |
| General game notebook | Character starting stats, caps, material allocation, level growth, Technique limits/bonuses, Anti and traps; equipment behavior, combinations, challenge rewards and shops | [`gcmemo.html`][memo] |
| Mag and PB reference | Evolution, feeding, colors, stats, support actions, PB behavior and specialized raising recipes | Sections within [`gcmemo.html`][memo] |
| Combat and system observations | Invulnerability, enemy targeting/behavior, status ailments, recovery, attack interactions and version-specific bugs | Sections within [`gcmemo.html`][memo] |
| Story and presentation | NPCs, endings, lobby controls, screenshots, music references and GC revision differences | Sections within [`gcmemo.html`][memo] |
| General quests and events | Offline unlock dependencies and alternative completion routes; online quest walkthroughs; shop services, seasonal events and reward lists | [`quest.html`][quests] |
| Control Tower | Seat of the Heart progression, Sue/Kireek conditions, switches, NPCs and rewards; East/West Tower room and floor progression, enemy advice and weapon-service unlocks | [`ctrltower.html`][tower] |
| Famitsu Cup | Historical event routes, kill counts, tickets, overlooked spawn triggers, beach activities and lotteries | [`famitsu.html`][famitsu] |
| Rare-item research | Ten Section ID drop tables, item-to-location lookup, ID exclusivity, rare-enemy encounter records and personal acquisition logs | [`rareitem.html`][rares] and linked tables |
| Illustrated item catalog | 30 category links covering weapons, defensive equipment, units, parts, other items and challenge rewards | [`itemlist/list.html`][items] |
| Personal/community material | Update diaries, character profiles, official BBS thread links and external links | README descriptions; `log.html`, `2002log.html`, `team.html`, `chdc_fomarl_redwolf2.html`, `bbslink.html` in CDX |
| Small tools | Section ID calculator, Mag feeding timer and Internet Time display | Described by the [README][readme]; runtime code not recovered or tested |

The notebook contains **109 distinct internal topic destinations**, counted from
its downward navigation links and deduplicated by fragment. This is not 109
separate pages. Its equipment, bug and GC revision notes need particular care
when assessing BB applicability.

## Quest coverage worth investigating further

The [general quest page][quests] covers EP1/EP2 offline unlocks and contrasts
story-focused and item-focused progression. Named sections include Gallon's
Shop, Towards the Future, Rappy's Holiday, Soul of Steel and other online quests,
plus Valentine's Day, White Day, Halloween, Christmas and Easter material.
It also includes a Respective Tomorrow section beyond the initial navigation
list. This shows why a navigation-only crawl is insufficient for a full audit.

The [tower page][tower] separates Seat of the Heart, East Tower and West Tower.
It includes route conditions, NPC interactions, switches and floor-by-floor
notes, alongside the services unlocked through these quests. These are promising
sources for a later comparison with the actual Ephinea quest versions.

The [Famitsu page][famitsu] is a historical 2003 event record. Its own dated
routes and time-limited activities must not be presented as a current Ephinea
event schedule or reward contract.

## Initial comparison with Haven

These are editorial priorities based on the inspected topics and local page
inventory, not final restore/skip decisions for individual claims.

| Topic | Existing Haven destination | Initial decision |
| --- | --- | --- |
| Quest dependencies, choices and tower progression | [Quest directory](../data/quest.html), [NPC guide](../guide/npc.html), [hunting guide](../data/monsters.html) | High-priority comparison. Existing directory, character and hunting information does not establish complete walkthrough coverage. Verify scripts and current quest behavior before adding guidance. |
| Combat details and enemy behavior | [Mechanics](../tools/mechanics.html), [monster catalog contract](MONSTER_CATALOG.md) | Compare claim by claim. Existing monster notes already cover some targeting behavior; novelty is not established by an unfamiliar old heading. |
| Character planning | [Material plans](../tools/materialplan.html), [stat simulator](../tools/status.html), [level tables](../tools/chartable.html) | Substantial topic overlap. Keep current BB data; investigate only missing explanations or independently useful comparisons. |
| Mag and PB information | [Mag guide](../tools/mag.html), [canonical PB section](../tools/mechanics.html#photon-blast) | Substantial overlap. Any verified additions belong in those existing homes. |
| Items and drops | [Item catalog contract](ITEM_CATALOG.md), sibling drop-table authority | Historical reference only; do not replace current Ephinea tables or authoritative names with GC-era values. |
| Historical events and GC-specific behavior | No automatic public destination | Preserve as research leads; consider public historical coverage only after relevance and version boundaries are established. |
| Diaries, character profiles and old BBS links | No gameplay destination proposed | Useful provenance and community history, not current gameplay rules. |

## Reuse and remaining work

The source README retains the author's rights and asks against unauthorized
republication of its writing and screenshots. Use this inventory to locate and
independently verify facts, write original explanations and cite the evidence;
it is not a license to mirror the site or its image collection.

Remaining work:

- Review the acquired catalog, drop-table and diary content beyond their
  index descriptions. Images have been downloaded and decode-checked, but their
  subject matter and applicability have not been audited.
- Recover missing navigation, external-link and tool pages if captures exist.
  Neither saved domain-wide index supplied the missing PSO resources; that does
  not prove no historical captures exist under other URL forms.
- For each proposed gameplay addition, record the original claim and version,
  current Ephinea/client evidence, existing coverage, restore/skip decision and
  destination. Do not transfer GC bugs, drop rates, offline rules or old event
  rewards by assumption.
- Validate any actual additions under the site's terminology, localization and
  page checks. On 2026-09-25 the maintainer closed the restoration task for
  now; it is no longer tracked in [TODO](TODO.md), and these steps apply only if
  it is reopened.

## Retrieved primary pages

These nine pages were inspected during the initial topic inventory. All 62 HTML
documents have since been acquired and decoded. Dates below are Wayback capture
timestamps.

| Capture | Page |
| --- | --- |
| 2005-09-24 13:20:40 | [Frame root][root] |
| 2010-08-05 06:34:21 | [Headline / migration notice][headline] |
| 2010-08-03 23:24:04 | [README and content descriptions][readme] |
| 2006-11-07 13:13:42 | [GC notebook][memo] |
| 2007-02-16 13:38:22 | [Quest guide][quests] |
| 2007-02-18 08:09:35 | [Control Tower][tower] |
| 2007-02-18 08:07:45 | [Famitsu Cup][famitsu] |
| 2007-02-18 08:08:37 | [Rare-item index][rares] |
| 2007-02-20 21:24:51 | [Illustrated catalog index][items] |

[cdx]: https://web.archive.org/cdx/search/cdx?url=red-wolf.sakura.ne.jp%2Fpso%2F&matchType=prefix&output=json&filter=statuscode:200&collapse=urlkey&fl=timestamp,original&limit=500
[root]: https://web.archive.org/web/20050924132040/http://red-wolf.sakura.ne.jp:80/pso/
[headline]: https://web.archive.org/web/20100805063421/http://www.red-wolf.sakura.ne.jp:80/pso/pso.html
[readme]: https://web.archive.org/web/20100803232404/http://www.red-wolf.sakura.ne.jp:80/pso/readme.html
[memo]: https://web.archive.org/web/20061107131342/http://www.red-wolf.sakura.ne.jp:80/pso/gcmemo.html
[quests]: https://web.archive.org/web/20070216133822/http://www.red-wolf.sakura.ne.jp:80/pso/quest.html
[tower]: https://web.archive.org/web/20070218080935/http://www.red-wolf.sakura.ne.jp:80/pso/ctrltower.html
[famitsu]: https://web.archive.org/web/20070218080745/http://www.red-wolf.sakura.ne.jp:80/pso/famitsu.html
[rares]: https://web.archive.org/web/20070218080837/http://www.red-wolf.sakura.ne.jp:80/pso/rareitem.html
[items]: https://web.archive.org/web/20070220212451/http://www.red-wolf.sakura.ne.jp:80/pso/itemlist/list.html
