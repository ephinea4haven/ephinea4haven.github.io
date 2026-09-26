# PSOBB Chinese Localization Standard

Haven PSOBB Wiki serves players worldwide and supports English, Japanese and
Chinese. This document governs its Chinese content; it does not limit the site's
audience or the languages supported by other pages and features.

Every Chinese translation on this site assumes the game context of *Phantasy Star
Online: Blue Burst* (PSOBB). This standard applies to page titles, navigation,
body text, tables, tool interfaces, the item dictionary, event descriptions,
metadata and test assertions.

## Core principle

First establish what the English term refers to in PSOBB, then translate its
actual in-game function and the player action it describes. Do not split an
English term into isolated words and translate them one by one, and do not reuse
a Chinese word merely because a dictionary gives the same meaning.

A translation must be all of the following:

1. **Semantically accurate**: it conveys what the object is in PSOBB, what it does
   and how it is used.
2. **Natural to players**: it uses wording players understand at once, not stiff
   literal phrasing.
3. **Consistent across the site**: one concept uses one translation in titles,
   navigation, body text, tools and the dictionary.
4. **Faithful to names**: item names, class names, stat abbreviations, quest names
   and server-specific proper nouns follow verified names and are never
   paraphrased.

## Evidence order

When a term is ambiguous, resolve it in this order:

1. The Chinese client text actually used by the current PSOBB version, together
   with the English and Japanese client text at the same index.
2. Verified game data and in-game behavior, including ItemPMT, ItemPT, ItemRT,
   Unitxt and quest scripts.
3. The authoritative Chinese–English item dictionary of the PSOBB drop tables and
   the data generated from it. Site item names must match the drop-table authority.
4. The full context of the Ephinea Wiki, event announcements and server notices.
5. Stable, unambiguous wording used by Chinese PSOBB players.
6. General dictionary meanings. These may only polish ordinary language after the
   ambiguity is resolved; they never decide a game term on their own.

English and Japanese serve different purposes. English usually confirms the
meaning, and Japanese helps confirm the series' original concept and conventions.
The final Chinese must still read the way Chinese PSOBB players speak.

## Translation workflow

1. Identify the object type: item, equipment category, character stat, mechanic,
   quest, NPC, interface action or plain narration.
2. Read the full passage, the page's purpose and the related data to confirm what
   consumes the term at this location and what effect it has.
3. Look up existing Chinese client text, the authoritative item dictionary and
   how the site already translates the same concept.
4. Phrase the Chinese around the in-game result or player action instead of
   copying English word order.
5. Search the whole site for synonyms and outdated translations, and update page
   titles, entry links, body text, tool labels, metadata and tests together.
6. Reread the Chinese sentence and confirm it is natural, clear and unambiguous
   without the English beside it.

## Item names and drop-table alignment

`../droptable/i18n_names.json` is the sole authority for Chinese and English item
names on this site. Follow this workflow for every weapon, frame, barrier, unit,
Mag, technique disk, consumable, event item or currency name:

1. Look up the matching key in `items` by the full English item name. Never guess
   from an abbreviation, a word fragment or a similar item.
2. The displayed name must equal that entry's `zh` exactly. Case differences are
   only allowed at the English lookup layer and must never merge distinct items.
3. Pages should store the English item identity and display Chinese through the
   generated `ITEM_TRANSLATIONS` or `data-item-en`, instead of copying the Chinese
   name.
4. When the authority lacks an item or a translation looks wrong, verify it first
   against the same-version Chinese and English Unitxt, the ItemPMT index or the
   actual in-game consumer, then change `../droptable/i18n_names.json`.
5. After committing the authority change, pin `.github/workflows/pages.yml` to
   that authority commit, run `npm run sync:i18n`, commit the regenerated site
   output and run `npm run test:i18n`.
6. Never edit only `assets/js/i18n/items_i18n.js`. It is generated, and the next
   sync overwrites manual changes.

When body text must show both the Chinese and English item names, check both
against the same authority entry and never abbreviate the Chinese yourself. For
example:

```text
Photon Drop    → 光子微晶 PD
Photon Crystal → 光子水晶 PC
Photon Sphere  → 光子结晶 PS
```

## Confirmed terms

| English concept | Adopted translation | PSOBB context |
| --- | --- | --- |
| `Material` / `Materials` (consumables that raise character stats) | 能力药 | Not a crafting "material". Specific items use their client names, such as 攻击力药, 防御力药, 精神力药, 回避力药, 运气药, HP药 and TP药. |
| `Material plan` / `Material plans` | 能力药配点 | The page shows how each class allocates material uses and combines them with Mags and units to reach target stats. It is not a "materials plan". |
| `Mag` (the trainable support equipment) | 玛古 | Chinese descriptions and category names use 玛古. Keep `Mag` only in official English item names, external page titles and technical identifiers. |
| `Unit` / `Units` (equipment slotted into a frame) | 插件 | Not a generic "unit". The English phrase "reinforcing unit" corresponds to the client text 防具的扩展插件. |
| `Frame` / `Armor` (worn body armor) | 铠甲 | Specific item names follow the client dictionary and may contain 铠, 装甲 or 防具. The category name does not switch with the English word form. |
| `Barrier` / `Shield` (worn shield equipment) | 盾牌 | Specific item names follow the client dictionary. Non-equipment objects in mechanics, such as temporary energy barriers, are translated by their actual meaning. |
| `Technique` / `Techniques` (TP-consuming spell abilities) | 魔法 | The core client menus use 魔法, 魔法窗口 and 使用魔法. Do not generalize it to a real-world skill, and do not adopt the variant 术法 from isolated newer text. Specific names keep fixed translations such as 火球术. |
| `Technique disk` / ` disk` (dynamic item name for learning a technique) | 魔法光盘 | The category uses the authority's `disk` entry, 魔法光盘. Specific technique names and level formats are checked against actual client text. Never write 法术盘, 技能盘 or 魔法书. |
| `Grinder` (item or value that raises a weapon's grind) | 打磨石 / 磨数 | Item names use 小磨石 / 中磨石 / 大磨石. A weapon's `+N` value is written 磨数 in context and is never rendered as a crafting material. |
| `Shot` / `shotgun` / `散弾銃` (the shotgun weapon family) | 霰弹枪 | The client and the authority use 霰弹枪 for the family, the S-Rank / ES `SHOT` category and every name such as 重型霰弹枪 or 军用霰弹枪. Both 霰弹枪 and the colloquial 散弹枪 are simplified Chinese; the standard term is used, and 散弹 is rejected by the client audit. |
| `Handgun` / `small gun` / `pistol` / `短銃` (the handgun weapon family) | 光枪 | Confirmed September 26, 2026 for the whole family: 光枪「伽尔德」, 光枪「米拉」, 红色光枪 and the S-Rank / ES `GUN` category. Never write 小枪, 手枪 or 短枪. |
| `Photon Drop` / `Photon Crystal` / `Photon Sphere` | 光子微晶 PD / 光子水晶 PC / 光子结晶 PS | Three distinct items whose names must match both the Chinese client and the drop-table authority. Never write the literal 光子水滴, and never mix up 水晶, 结晶 or the abbreviations. |

The Chinese in this table only governs the corresponding PSOBB concept. In plain
narration, words such as `material` (texture, raw material), `unit` (measurement
or organizational unit) and `shield` (a boss energy barrier) must be translated
by their actual meaning. Unconditional global replacement is forbidden.

## Confirmed NPC names

Confirm an NPC's English client identity first, then use the Japanese client text
to determine the pronunciation. English spelling alone cannot prove a particular
set of Japanese kanji. When no primary source gives the kanji, use a stable
Chinese transliteration and keep the English name for disambiguation.

| English client name | Adopted translation | PSOBB context |
| --- | --- | --- |
| `Shino` | 希诺 | The Japanese client writes 「シノ」, which confirms only the pronunciation. Do not back-derive 紫乃 or 志乃 from the English. The NPC profile shows 希诺（Shino）. |
| `Gizel` | 吉泽尔 | The male NPC in *The Value of Money*. Uses the Chinese transliteration of the English name, 吉泽尔（Gizel）. |

## Contextual translation examples

- `Material Plans` → **能力药配点**: the page is a character build plan, so the
  title states the player's purpose directly.
- `Minimum Units, Maximum Stats` → **以最少插件达到属性上限**: express the build
  outcome instead of the literal 最小插件，最大状态.
- `unit` in a frame slot description → **插件**; in "per unit of time" →
  **单位时间**.
- `shield` as an equipment category → **盾牌**; as a boss's protective field →
  **护盾** or **屏障**.
- `material` as a stat-raising item → **能力药**; as a weapon crafting substance →
  **材料** or **材质**.
- `Technique disks` as an item category → **魔法光盘**. Specific technique names
  and level formats are checked against actual client text.
- `Special Rank` in the ES weapon special-attack cost table → **特殊攻击等级**,
  never shortened to the vague 特殊等级.
- Weapon attribute columns `N / AB / M / D` → **Native（原生）/ A.Beast（变异兽）/
  Machine（机械）/ Dark（暗）**. Never guess from single letters, such as
  普通 / 吸收 / 魔防 / 防御.

## Consistency requirements

- The browser title, page header title and main entry links for a page must
  express the same name. An entry link may be shortened for space but must not
  switch to a different concept.
- Keep category names distinct from specific item names. Unifying a category
  never means rewriting a verified proper item name.
- Every item name on the site must match the drop-table authority entry by entry.
  If the client and the drop table disagree, check the version, the item index
  and the actual consumer, then record the conclusion. Never pick one arbitrarily.
- English abbreviations such as ATP, ATA, DFP, EVP, MST, LCK, HP, TP, PB and
  Section ID may be kept. Give the Chinese meaning on first use where needed.
- Code fields, URLs, file names, query parameters and upstream data keys are never
  renamed for display-layer localization.
- An uncertain term must be recorded with its evidence and open questions. Never
  ship a temporary literal translation that merely looks like Chinese.

## 2026-09-09 cross-project verification record

- The Black Paper's Dangerous Deal reward for Dorphon on Normal uses the
  authoritative identity `DB's Saber (3069 Chris)`, with the data key
  `db_s_saber_3069_chris`. The old key `db_s_saber_3069` did not distinguish the
  manufacturer and was removed. Identity source:
  [Ephinea quest reward table, revision 42514](https://wiki.pioneer2.net/index.php?title=Black_Paper%27s_Dangerous_Deal&oldid=42514).
  The Chinese name is still generated from the authority.
- `test_structured_rewards_resolve_current_authority` checks every structured
  reference in the Black Paper deal and the Coren prize list. The build also
  rejects unknown item IDs.
- Silver Badge and Gold Badge in the anniversary event are short names for the
  anniversary badges and are shown with the existing event-context labels. They
  must not match the same-named aliases of the old WEAPONS badges. Dynamic
  exchange replies apply the same context handling.
- The event reward `Hammer` and the ES weapon `HAMMER` are different identities.
  An exact-case match wins. Case-insensitive lookup is allowed only when it yields
  a unique translation. The Christmas history text and overview both localize
  items.

The source chain for this pass:

- localization: `5a679c5e2f9857f54b83a9b8b415931ac172324e`. The SHA-256 of the
  main Chinese table is
  `720cfd525b5645198d89661ea71c628696df6e024e4a03ef4db75bf1110cf401`.
- droptable: `8fbbde4fe3a65819067f6037da7a8d6562e8956a`, pinned in the site CI.
  The authority's SHA-256 is
  `cbb4b89da0cfb213494edba99eccc2aabc7c1660bf5b52022b6575ee82c753ed`, with 1,566
  entries. That commit adds handover documentation; its dictionary content is
  identical to the name-fix commit `62cdfbdbe011ae33ecd3927a6118e371ab7d8878`.

Earlier checks covered only active drops or tagged page references, so they missed
old aliases and untagged outdated translations. This pass expanded coverage to the
entire dictionary, 547 structured references across the Black Paper deal and the
Coren prize list, 351 stat simulator equipment names and variants, name
references in guides, historical events and dynamic replies. Six more outdated
translations in the equipment recommendations were converted to `data-item-en`
references, and a required-entry count check was added so that untagged
references can no longer escape checking.

Final verification:

- `npm run sync:i18n` and `python3 scripts/sync_item_i18n.py --check`: the
  dictionary and Mag names match upstream exactly, and the Mag rules are
  unchanged.
- `npm test`: all project checks pass, including 8 sync tests and 4,212 catalog
  cases in the stat-domain check.
- `npm run build`: 58 prerendered routes and 45 event fragments.
- `npm run test:e2e`: 122 browser tests pass, covering the full dictionary,
  equipment variants, language switching, share links, reward models, event
  context and repeated clicks.

The later naming-policy discussion did not change `Caduceus → 赫尔墨斯杖`,
`Excalibur → 王者之剑` or `Glide Divine → 澄蓝之杖「神游」`. The site keeps the
authoritative translations. A passing sync review is not a re-review of every
translation and does not replace in-game display verification. The docs, code and
generated data were committed to master in `cc835f4`.

### 2026-09-10 release verification addendum

The CI variable `DROPTABLE_I18N_AUTHORITY` was originally passed only to the
business tests, so the browser tests could not find the checked-out dictionary.
`f4f9f18` moved the variable up to the whole build job, and both test suites now
use the same pinned authority. After the dependency audit blocker was cleared and
the patch updates were merged, `186ce35`, which includes the localization commit
above, passed every check in Pages run `34427458809` and deployed successfully.
That run was cleaned up on 2026-09-14 and its logs are no longer available. This
pass ran 129 browser tests, including 7 new homepage event-state tests. The
earlier count of 122 is kept as the September 9 local verification record. See the
[deployment record](DEPLOYMENT.md#september-10-2026-release) for release details.

### 2026-09-18 UN-10 / UN-11 synchronization

The confirmed Unitxt decisions in psobb-localization
`a0081273bb4f523b1c2d7f73613d4a462ed1caa9` are synchronized through droptable
into the site dictionary: 46 authority entries changed. The authority SHA-256 is
`761980abc3d3658ed20a148a112e9f0b820a2351b6b8f035f7f121ef51aebc98`.
The upstream Chinese resource SHA-256 is
`681f4a69785d2a976ac115d2611c6ee81d08790ec3888aa17b69b8f1d487f75c`.
No upstream resource change is required. See droptable's
`docs/unitxt-alignment-review.md` for the source and regression record.

Local verification passed droptable's `npm run verify:localization`, Haven's
`npm test` and build (1,268 prerendered routes), and 64 focused browser tests
covering items, monsters, mechanics, authored item references and status equipment.
The added rename regression verifies Chinese detail hydration, English switching,
return to Chinese and reload for magazine, armor, TypeM and parts identities.

The maintainer approved separate commits, pushes and deployment on September 18.
Haven now pins droptable `fa878d073e4cb0d0d8d47ab4582d52f37f043e27` in
`.github/workflows/pages.yml`. This revision includes the synchronized authority
and the BB monster presentation changes. The Pages workflow must pass its full
checks and deployment before production publication is considered complete.

### 2026-09-26 UN-12 handgun and shotgun terms

psobb-localization `e626ab877ad62f73480052f773348aae3cf8fef9` (UN-12) unifies the
handgun family as 光枪 in 16 client entries after the maintainer confirmed each
one. Droptable `085d0c2a36fded23924ed4e44ab1b1be3d02a968` regenerates the authority
and adds the DC/NGC legacy spellings `HANDGUN:GULD` / `HANDGUN:MILLA` as aliases;
the authority SHA-256 is `aec7cf48d60c6c221d797e259711166383fcda6c0d1c64ef5f63b8f1e1e4bae5`. Haven pins that revision and syncs the dictionary.

Site-authored text that still said 散弹, 小枪 or 手枪 now says 霰弹枪 or 光枪: the
item catalog's weapon-type labels and two behaviour notes, the acronym, Anguish,
class, V50x, weapon-special and item-drop pages, and the tooling-only drop-chart
snapshot. The same acronym row corrects the typo 金祭音速机器 to 金祭音速机枪.

