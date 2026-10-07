# Episode III card catalog

Haven PSOBB Wiki is a multilingual wiki supporting English, Japanese and Chinese.
This catalog's **card content is English and Japanese only**. Phase 1 supplies a
committed source snapshot and artwork. Phase 2 adds the Angular list/detail pages,
search and navigation in all three site languages. The Chinese UI terminology
below was confirmed by the maintainer on 2026-10-07; it is not a card-content
translation.

## Sources and regeneration

The final GPSE8P data is authoritative. Trial/NTE is excluded. The extractor reads
the game and newserv directories without changing them, verifies all five hashes
before producing output, and uses `scripts/pso_archives.py` for PRS decompression.

| Root | Input | SHA-256 |
| --- | --- | --- |
| PSOEP3 | `files/PsoCardDataTbl_Base.prs` | `d0e5c2fb5cd4dcb2739a7846275051550ac011c31e18860da1a258375e9fe9a3` |
| newserv | `system/ep3/card-definitions.mnr` | `ea4f6e70e7f54eb2e3b457fb760b2fab34664f2601a94207a21b70a700bc8ee4` |
| PSOEP3 | `files/TextCardE.bin` | `1ecd7cf481a9d69d1d5dbd27a0e59730a57e90985cb382e745547d649200efa1` |
| PSOEP3 | `files/TextCardJ.bin` | `22ad0b8e9528a422b80f7a7b3044747a287ae2282a188bd2494e862c1ed6cf0d` |
| PSOEP3 | `files/cardtex_full.afs` | `265e4fe7f7f100890ee482741df674a7770e106f7d4157bc574d18962873ad22` |

Format reference: newserv `src/Episode3/DataIndexes.hh`, `DataIndexes.cc` and
`src/Text.cc` at commit `e89ac8ebf201fbd2c86251d8597bf3ea3083501f`.
The online table is newserv's preserved server table, last changed in commit
`e858b79b`; this is provenance, not a claim about every present-day private server.
No newserv implementation or translation table is vendored.

Local extraction needs Python 3, Pillow (verified with **12.3.0 / libwebp 1.6.0**),
`iconv`, Git and the built `gvmdump`. Pillow is already pinned in
`scripts/requirements-maps.txt`. The text/data tests need only the Python standard
library; the local tile-assembly test additionally uses Pillow.

```sh
python3 scripts/build_ep3_card_data.py \
  --psoep3-root /Users/wangzhen/Documents/PSOEP3 \
  --newserv-root /Users/wangzhen/study/newserv \
  --gvmdump /Users/wangzhen/study/resource_dasm/gvmdump \
  --date 2026-10-07
npm run test:ep3-cards
```

`--output` and `--image-dir` can place a verification run in a scratch directory.
Image URLs remain `/assets/img/ep3-cards/` regardless of the output directory.
Fix `--date` and use the same Pillow/libwebp version for byte reproducibility.
Temporary GVM/GVR/BMP files are decoded outside the repository and removed.
All 700 records live in `content/ep3-card-catalog/cards.json`; each image includes
its native output dimensions, byte size, source GVM names and AFS entry indexes.
CI needs neither the game files, newserv nor gvmdump.

## Data policy and record semantics

Both decompressed tables are 207,584 bytes. The REL footer's root points to an
ArrayRef; the extractor uses that offset and count, skips the negative-type
sentinel and checks the 700 real IDs (1–739 with 39 gaps). It does not assume that
record number equals card ID. Types: 39 Hunters SC, 39 Arkz SC, 259 Item,
120 Creature, 168 Action and 75 Assist.

Displayed gameplay values come from the online table. `diff` compares every named
gameplay field, including all three complete effect slots, except `drop_rates`.
Names, short names and unused/padding fields are not gameplay differences. AI
parameters are compared but are not emitted for unchanged cards. The 66 gameplay
IDs and eight effect IDs exactly match the approved design. The eight are
74, 239, 365, 481, 686, 695, 704 and 710. Their shared disc text may describe
the old behavior; it is not rewritten to agree with the online effects.

Stats are `{kind, value}`: `kind` is `blank`, `value`, `plus`, `minus` or `equals`;
`value` is the nonnegative magnitude, or `null` for the 999 unknown suffix. The
renderer must apply the operator, including a minus sign for `minus`. Blank
is not a displayed zero. Orland is online HP +0/AP 1/TP 0/MV 3, disc HP −3/MV 2.
The file's stored kind/value bytes are not used. `range` contains a six-row,
five-column boolean `grid` and `entireField`; the user occupies row 4, column 2
(zero based), facing toward row 0. Fixed range codes 1–9 are resolved. Assist
duration remains numeric: 90 = once, 99 = permanent.

Hidden means exactly the 24 `???` SCs (71, 72, 74–83, 682–693), class
`BOSS_ATTACK_ACTION` (84, 677–681, 694–699), or player boss SCs 702 Castor and
703 Pollux: **38 hidden, 662 default-visible out of 700**.
newserv `src/Episode3/DataIndexes.cc:1885` defines `unavailable_sc_card_defs`,
including `0x02BE CASTOR_USR` and `0x02BF POLLUX_USR`: the player versions of
boss SCs 668/669. The maintainer's 2026-10-07 evidence identifies them as
cheat-only characters, corroborated by Action Replay “Character Select:
Castor / User” and “Pollux / User” in
[the Schtserv forum code list](https://schtserv.com/forums/viewtopic.php?t=1299).
This explicit pair is hidden; membership in `unavailable_sc_card_defs` is not
a general hiding rule. Boss SCs 668/669 and generic class SCs 716–739 remain
visible. There is no evidence authorizing hiding the latter.
Rank E, Boss SCs and unobtainable cards in general are **not** additional hiding
rules. newserv documents that boss action/tech classes cannot be drawn or rewarded.

### Names and text

English display names come from text headers, joined with spaces. This produces
47 differences from `tableName.en`, which is retained as a search alias.
Examples: `Hildebear's Cane+`, `Standstill Shield+`, `Twin Blaze` and the wrapped
`Penetrate Guard`. The literal joining rule retains `Double- Edged Dice` and
`NUG2000- Bazooka`; removing those wrap spaces would yield 45 name differences.
Japanese display names come from **disc** `jp_name`, not the online cleared field
or the sometimes differently wrapped Japanese header. No Chinese item names are
added or altered.

Each language has `header` lines and `tags` with `kind`, `name`, `body`. An empty
body means the source supplies a tag without a matching explanation. Paragraph
breaks are retained, English hard wraps join with a space (no extra space after
a hyphen), Japanese hard wraps join without a space. Explicit blank lines at page boundaries (e.g. card 179) also remain paragraph
breaks. Gender, applicability and
infinity controls become `♂`, `♀`, `○`, `×`, `∞`. Colour/layout controls and both
languages' continuation markers are removed, including inline ability markers.

Header pages can continue before explanations begin (e.g. Lura/7). Body pages
can continue without a printed continuation marker (English Red Ring/422,
Japanese Guom/162). Photon Blast cards 231–236 have an unmarked explanatory
heading (`Photon Blast` / `合成テクニック`) represented as a note. Status pages
are distinguished from abilities even when their names agree (card 100).

The game occasionally disagrees with itself between a header tag and the title
of its explanation: card 667 has `A/T Swap Turn` versus `A/H Swap Turn`; Japanese
245 has `ダイス目１／２` versus `ダイス１／２`; 694 has `Leukon only` versus
`L Knight only`. Both titles are retained as separate tags, with the body attached
to its actual page title. No fuzzy matching or invented correction is applied.
Phase 2 must not label an empty body as missing translation.

### Japanese decoding and reported design disagreements

The approved design file is unchanged. These findings are reported explicitly:

1. **Design 2.2: “328 cards differ in drop_rates only.”** Raw bytes at
   `CardDefinition + 0x9C..0x9F` differ for **328 total** cards; **38 overlap** the
   66 gameplay differences, leaving **290 drop-only** cards. Example: card 57
   has online bytes `13 88 07 d1`, disc `07 d1 13 88`, and self cost 5 versus 4.
   The overlap is: 57, 96, 98, 108, 124, 151, 157, 158, 171, 185, 212, 246, 247,
   269, 339, 340, 341, 342, 357, 365, 391, 424, 444, 473, 480, 481, 500, 502,
   504, 521, 532, 540, 556, 560, 583, 602, 633, 660. Tests assert all three counts
   directly from pinned raw records. Drop rates remain outside the snapshot.
2. **Design 2.2 text generalization:** Japanese notes use `・`, not `\tD`, for
   example `TextCardJ[560]` starts its usage-note page with `・味方への使用可`.
   The pagination variations above also occur in the pinned files.
3. **Design 2.2/3.1 Sega “table”:** at the referenced checkout,
   `TextTranscoderCustomSJISToUTF8` delegates to system `iconv SHIFT_JIS`, with
   custom handling for F040–F064 in `Text.cc`. There is no independent Sega
   character table there. None of those extension codes is used in the parsed
   Japanese pages/names. Extraction checks **549 distinct source codes** one by
   one against that backend. cp932's `8160 → U+FF5E` and `817C → U+FF0D` differ
   from newserv; they are converted to **U+301C** and **U+2212** respectively.
   Private-use/replacement characters and malformed byte sequences fail.
   The 0xFF file sentinel is not decoded as Japanese text. Result: **zero U+FFFD**.
4. **Design 3.2 prefixes:** newserv `Main.cc` maps **C to large, L to medium,
   M to small**, rather than L/M/C as written in the design. GVM names and decoded
   pixels independently confirm this mapping.

All other tested table counts, IDs, types, ranks, name rules and gameplay/effect
diff sets agree with the design. TextCardE is byte-identical to decompressed
newserv `card-text.mnr`.

## Artwork mapping and visual verification

The AFS has 4,986 one-texture PRS/GVM entries: 3,454 at 256×256, 1,477 at 64×64,
31 at 128×128 and 24 at 32×32, all CMPR. Pixel decoding uses **gvmdump only**.
The extractor parses container names/dimensions but does not implement CMPR.

For decimal card ID `NNN`:

| Source | Meaning and processing |
| --- | --- |
| `C_NNN_00`, `_01`, `_02`, `_03` | 256×256 tiles, row-major: left/top, right/top, left/bottom, right/bottom. Assemble 512×512 then crop `(0,0,512,399)` to remove bottom padding. AFS entry indexes are `96 + 4*ID + tile`. |
| `L_NNN` | Native medium illustration in top-left 184×144 of a 256×256 texture. AFS entry `3417 + ID` for catalog IDs. |
| `M_NNN` | Native small illustration in top-left 58×43 of a 64×64 texture. Entry `4201 + ID`. Inspected to corroborate mapping, not published. |

Extraction selects by embedded names and validates dimensions; numeric formulas
above are corroborating evidence, not the lookup implementation. It also checks
AFS bounds, unique texture names, GVM count/flags and CMPR type.

The large slots for 92 catalog IDs are 64×64 logo placeholders. All 668 small
`C_*_*` slots across the archive have the **same compressed pixel payload**.
The medium placeholder is pixel-payload-identical to `L_000`. Thus placeholder
detection is grounded in source identity, not image appearance heuristics.

- 608 cards have real large tiles. They yield a native 512×399 detail image.
- If the native medium is a placeholder but real large tiles exist, the medium
  is downsampled from those tiles to 184×144 (e.g. Diwari/447, Soul Banish/600).
- 64 cards have only real medium art, including named SCs, hidden class icons
  and Bosses. Only the medium file/path is emitted (184×144); detail pages use
  that same medium image without upscaling. No redundant `-large.webp` is emitted.
  No unverified A/B portrait or cut-in texture is substituted.
- 28 cards have neither mapped variant: 21, 27, 702, 703 and 716–739. Their records
  omit `images`. This means no illustration in the verified ID-bound slots,
  not proof that no related character picture exists elsewhere on the disc.

### Missing-artwork investigation

The 28 cards without verified artwork are **21, 27, 702, 703 and 716–739**.
The recorded investigation searched the game archives described here and newserv
source, including the card texture mapping and SC definitions. Web checks covered
TCRF, Phantasy Star Fandom and pioneer2.net. A later TCRF response contained
anti-LLM filler content and was excluded from evidence; Fandom and pioneer2.net
denied access. No inspected source establishes which artwork the game uses for
these 28 records.

The catalog therefore shows **暂无卡图** rather than borrowing another card's
image. In particular, using boss portraits 668/669 for player versions 702/703
would assume an unverified mapping. Generic class SCs 716–739 stay visible with
the same missing-artwork label; missing artwork is not a hiding criterion.

The `SET/` files do contain medium/small textures, but are **a different 54-card
set**, not final catalog medium/small data: `cardtex_large.GVM` has 54 256×256
textures, `cardtex_middle.gvm` 54 128×128, `cardtex_small.gvm` 54 64×64, and
`cardtex.afs` 216 entries. For instance `card_01_*_humar` is an orange-armored
generic HUmar with baked-in older card UI, while final card 1 is Orland's portrait;
SET card 3 is Dragon, final card 3 is Ino'lis. All three size variants were decoded
and inspected. These files are **not used** and their precise development-era
provenance is not asserted.

Visual inspection on 2026-10-07 viewed the actual decoded BMPs (converted to PNG
for the viewer), the assembled tiles beside L/M variants, and the final WebPs:

| Card | Coverage | Observed confirmation |
| --- | --- | --- |
| 1 Orland | Hunters SC | Brown-haired male portrait, same L/M identity; C slots are logos. |
| 7 Lura | Arkz SC | Blue/white android portrait; matching L/M. |
| 13 Double Saber | Item | Green double-ended weapon; four seams align, L/M depict same weapon. |
| 24 Dice Fever+ | Assist | Two cyan dice on gold background, matching all three sizes. |
| 25 Rich+ | Assist | Fanned cards on gold background; tile order confirmed. |
| 100 Poison Lily | Creature | Flower enemy in framed art, matching all three sizes. |
| 560 Penetrate Guard | Action | Armored fighter with shield; no tile discontinuities. |
| 71 ??? | Hidden Arkz SC | Brown HU/HUmar class icon, not the C logo. |
| 682 ??? | Hidden Hunters SC | Teal HU/HUmar class icon, distinct from card 71. |
| 84 Meteor | Boss-only action | Meteors falling into a purple scene, matching L/M. |
| 667 Leukon Knight | Boss Hunters SC | Helmet and broad armor, matching L/M; C slots are logos. |
| 669 Pollux | Boss Arkz SC | Red-haired portrait, matching L/M; C slots are logos. |

Additional checks viewed Naga/73, Diwari/447 and Soul Banish/600: real large
illustrations with placeholder medium slots. The mapping is established for all
published images; missing source slots are not filled by guessing.

**Image total:** 1,280 WebPs for 672 cards, **20,143,784 bytes (19.21 MiB)**.
Lossy WebP quality 78 large / 82 medium, method 6; every source illustration is
retained at its available resolution. At this size no additional quality reduction
was needed. The snapshot records the exact count and byte total.

## External cross-check status

Game data wins over secondary sources. On 2026-10-07 network access itself worked,
but the requested pages could not be read:

- [Phantasy Star Fandom card list](https://phantasystar.fandom.com/wiki/Phantasy_Star_Online_Episode_III_C.A.R.D._Revolution/Card_List):
  browser search found the page; opening returned 402/access denial, and a direct
  HTTP request returned 403. No 20-name comparison is claimed.
- [TCRF Episode III](https://tcrf.net/Phantasy_Star_Online_Episode_III:_C.A.R.D._Revolution):
  initial opening and direct HTTP both returned 403; a later artwork investigation
  received anti-LLM filler content, which was not used as evidence. The hidden
  groups are **not independently confirmed by TCRF**.

The prepared 20-name sample is Orland (1), Kranz (2), Ino'lis (3), Sil'fer (4),
Lura (7), Break (8), Saber (9), Handgun (10), Slicer (11), Mechgun (12),
Double Saber (13), Photon Claw (14), DB's Saber (15), Soul Eater (16),
Inferno Bazooka (17), Agito (18), Akiko's Frying Pan (19), Hildebear's Cane+ (29),
Poison Lily (100), Penetrate Guard (560). All are extracted English identities;
their Fandom comparison remains pending due to access denial.

## Backlog

- Consider a detail-page card-text errata notice based on newserv
  `notes/ep3-card-corrections.txt`. These are community-sourced notes credited to
  **THG Discord via newserv**, separate from the authoritative extracted game
  text and the existing online/disc comparison. Decide source attribution before
  implementation. This notice is **not implemented** in the current catalog.

## Chinese terminology — confirmed by the maintainer on 2026-10-07

**The maintainer confirmed every row as proposed on 2026-10-07. These are UI
terms only, not Chinese card names or card text translations.** Apply
[the localization standard](PSOBB_CHINESE_LOCALIZATION.md), especially its evidence
order. EP3-specific mechanics must not be silently assigned a BB meaning.

Evidence notation: **G** = pinned game text/behavior (standard priority 2);
**B** = an already-confirmed shared PSOBB category in the localization standard;
**U** = ordinary site UI wording, no corresponding in-game string. `J#` identifies
a TextCardJ record; `E#` is the matching TextCardE record. Japanese quotations are
source strings, not newly invented Japanese labels. Where the game has no label
for a website control, the Japanese column explicitly says so. English enum names
are format identifiers and must remain the stored keys.

### Utility navigation and states — confirmed 2026-10-07

| English source | Japanese UI | Confirmed Chinese | Evidence / meaning | Status |
| --- | --- | --- | --- | --- |
| Home | ホーム | 返回主页 | U: existing monster utility navigation | 已确认 2026-10-07 |
| Item Database | アイテム図鑑 | 道具图鉴 | U: existing sibling catalog | 已确认 2026-10-07 |
| Bestiary | エネミー図鑑 | 怪物图鉴 | U: existing sibling catalog | 已确认 2026-10-07 |
| Unable to load card data | カードデータを読み込めません | 资料暂时无法加载 | U: existing site state | 已确认 2026-10-07 |
| Reload and retry | 再読み込み | 返回并重试 | U: existing site action | 已确认 2026-10-07 |
| Card not found | カードが見つかりません | 未找到卡牌 | U: absent card | 已确认 2026-10-07 |
| Image unavailable | 画像なし | 暂无卡图 | U: absent artwork | 已确认 2026-10-07 |
| User · facing ↑ | 使用者・前方 ↑ | 使用者 · 朝向 ↑ | U: range origin and facing | 已确认 2026-10-07 |

### Types, classes and factions

| English source | Japanese game source | Proposed Chinese | Evidence / meaning | Status |
| --- | --- | --- | --- | --- |
| Story Character / SC | ストーリーキャラクター, J60 note | 剧情角色（SC） | G: the player's principal character, not a summoned creature | 已确认 2026-10-07 |
| Hunters | ハンターズ, J60 note | Hunters（阵营） | G: faction; keep proper name until an EP3 Chinese authority is confirmed | 已确认 2026-10-07 |
| Arkz | アークズ, J60 note | Arkz（阵营） | G: distinct faction; no verified Chinese proper name | 已确认 2026-10-07 |
| HUNTERS_SC | Ｈヒューマー J1; ハンターズ J60 | Hunters 剧情角色 | G: type 0; faction distinct from Hunter profession | 已确认 2026-10-07 |
| ARKZ_SC | Ｄレイキャシール J7; アークズ J60 | Arkz 剧情角色 | G: type 1; D/H prefixes are source faction indicators | 已确认 2026-10-07 |
| ITEM | アイテム J1 ability; 剣系アイテム J9 | 装备卡 | G: equips Hunters SCs; not a consumable item inventory | 已确认 2026-10-07 |
| CREATURE | エネミー J100; 原生エネミー J42 | 生物卡 | G: summoned field characters; includes machines, so “生物” needs explicit review | 已确认 2026-10-07 |
| ACTION | アクションカード J2; 攻撃アクション J60 | 行动卡 | G: attack/defense action chain | 已确认 2026-10-07 |
| ASSIST (type and class) | アシストカード J24 | 辅助卡 | G: placed assist with duration/recipient | 已确认 2026-10-07 |
| HU_SC / Hunter | ハンター J1 | 猎人职业角色 | G: profession, not Hunters faction | 已确认 2026-10-07 |
| RA_SC / Ranger | レンジャー J2 | 枪手职业角色 | G: ranged profession | 已确认 2026-10-07 |
| FO_SC / Force | フォース J3 | 法师职业角色 | G: technique profession | 已确认 2026-10-07 |
| NATIVE_CREATURE | 原生エネミー J42 | 原生类生物 | G+B: Native is the series attribute, not “normal” | 已确认 2026-10-07 |
| A_BEAST_CREATURE | ＡＢエネミー J27 | 变异兽类生物 | G+B: A.Beast attribute | 已确认 2026-10-07 |
| MACHINE_CREATURE | メカエネミー J39 | 机械类生物 | G+B: Machine attribute; review consistency with Creature label | 已确认 2026-10-07 |
| DARK_CREATURE | ＤＦエネミー J51 | 暗属性生物 | G+B: Dark attribute | 已确认 2026-10-07 |
| GUARD_ITEM | 防具 J23 | 防具 | G: broader guard equipment class, not universally a BB shield | 已确认 2026-10-07 |
| MAG_ITEM | マグ J22 | 玛古 | G+B: shared Mag category, adopted BB term | 已确认 2026-10-07 |
| SWORD_ITEM | 剣系アイテム J9 | 剑系装备 | G: EP3 broad class, not only BB's Sword weapon family | 已确认 2026-10-07 |
| GUN_ITEM | 銃系アイテム J10 | 枪系装备 | G: broad gun class, not a specific Handgun item | 已确认 2026-10-07 |
| CANE_ITEM | 杖系アイテム J29 | 杖系装备 | G: broad cane class | 已确认 2026-10-07 |
| ATTACK_ACTION | 攻撃アクション J60 | 攻击行动 | G: attack action class | 已确认 2026-10-07 |
| DEFENSE_ACTION | 防御アクション J63 | 防御行动 | G: defense action class | 已确认 2026-10-07 |
| TECH | 攻撃テクニック J216; 補助テクニック J225 | 魔法 | G+B: includes attack and support techniques; shared BB category | 已确认 2026-10-07 |
| PHOTON_BLAST | 合成テクニック J231–236 | 合成魔法（Photon Blast） | G: ally ATK cost contribution; Japanese concept differs from BB PB gauge | 已确认 2026-10-07 |
| CONNECT_ONLY_ATTACK_ACTION | 単発攻撃不可 J160 | 需连接的攻击行动 | G: must connect another action after it; not usable alone | 已确认 2026-10-07 |
| BOSS_ATTACK_ACTION | 攻撃アクション / アンブラ専用 J84 | Boss 专用攻击行动 | G: boss-only class, hidden by default | 已确认 2026-10-07 |
| BOSS_TECH | No record in these 700; `CardClass::BOSS_TECH` only | BOSS_TECH（暂保留英文） | G: unused enum; no verified Japanese label, do not expose as an active filter | 已确认 2026-10-07 |

### Ranks and target modes

Rank symbols stay unchanged. They are not character levels. D1/D2/D3 are absent
and should not appear as filters. Target-mode names are internal identifiers;
the Japanese descriptions below establish context but are not a fabricated
one-to-one Japanese UI enum. The range and card explanation remain authoritative
for a particular card's recipients.

| English source | Japanese game source | Proposed Chinese | Evidence / meaning | Status |
| --- | --- | --- | --- | --- |
| Rank / CardRank | No general rank label in TextCardJ; table rank byte | 卡牌等级 | G: classification filter; needs EP3-specific confirmation before use | 已确认 2026-10-07 |
| N1 | Shared rank symbol; disc card 34 | N1 | G: preserve symbol | 已确认 2026-10-07 |
| N2 | Shared rank symbol; disc card 13 | N2 | G: preserve symbol | 已确认 2026-10-07 |
| N3 | Shared rank symbol; disc card 20 | N3 | G: preserve symbol | 已确认 2026-10-07 |
| N4 | Shared rank symbol; disc card 9 | N4 | G: preserve symbol | 已确认 2026-10-07 |
| R1 | Shared rank symbol; disc card 30 | R1 | G: preserve symbol | 已确认 2026-10-07 |
| R2 | Shared rank symbol; disc card 18 | R2 | G: preserve symbol | 已确认 2026-10-07 |
| R3 | Shared rank symbol; disc card 27 | R3 | G: preserve symbol | 已确认 2026-10-07 |
| R4 | Shared rank symbol; disc card 16 | R4 | G: preserve symbol | 已确认 2026-10-07 |
| S | Shared rank symbol; disc card 127 | S | G: preserve symbol | 已确认 2026-10-07 |
| SS | Shared rank symbol; disc card 25 | SS | G: preserve symbol | 已确认 2026-10-07 |
| E | Shared rank symbol; disc card 1 | E | G: preserve symbol; not hidden merely because E | 已确认 2026-10-07 |
| Target mode | 対象（単数・複数）, J2 ability | 目标方式 | G: targeting mode, separate from range grid | 已确认 2026-10-07 |
| NONE | 攻不 J22/J23 | 不适用 | G: no attack target mode; not “no effect” | 已确认 2026-10-07 |
| SINGLE_RANGE | 単 J1; 単数 J2 ability | 范围内单个目标 | G: single-target mode | 已确认 2026-10-07 |
| MULTI_RANGE | 複 J7; 複数 J2 ability | 范围内多个目标 | G: multiple-target mode | 已确认 2026-10-07 |
| SELF | 本人 J26 | 自己 | G: assist recipient | 已确认 2026-10-07 |
| TEAM | チーム J253 | 我方队伍 | G: team recipients | 已确认 2026-10-07 |
| EVERYONE | 全員 J24 | 所有玩家 | G: everyone assist mode | 已确认 2026-10-07 |
| MULTI_RANGE_ALLIES | 周囲１マス内にいた全ての味方キャラクター, J230 | 范围内多个友方目标 | G: includes user in this example; do not apply to all items indiscriminately | 已确认 2026-10-07 |
| ALL_ALLIES | 周囲１マス内にいる味方ストーリーキャラクター, J225 | ALL_ALLIES（友方目标） | G: enum alone does not mean unlimited range; Resta excludes user, retain identifier pending review | 已确认 2026-10-07 |
| ALL | 全 J237; 全てのキャラクター（敵味方関係なし） | 全部角色 | G: both sides; individual card restrictions still apply | 已确认 2026-10-07 |
| OWN_FCS | 味方フィールドキャラクター J244; English “your Field Characters” | 自己的场上角色 | G: Japanese/English phrasing differs; preserve ownership semantics of identifier | 已确认 2026-10-07 |

### Detail fields, controls and site copy

For website-only controls there can be no literal TextCardJ source. Those rows
say **U** and quote only any relevant existing game noun, never imply that a
new Japanese sentence came from the game.

| English source | Japanese game source | Proposed Chinese | Evidence / meaning | Status |
| --- | --- | --- | --- | --- |
| Card type | カード J2, アイテム J9 etc.; no generic filter label | 卡牌类型 | G+U: six-type selector | 已确认 2026-10-07 |
| Card class | ハンター J1 / 剣系アイテム J9 etc.; no generic filter label | 卡牌分类 | G+U: distinguish subtype from six types | 已确认 2026-10-07 |
| Card ID | NUL record IDs / table IDs; no Japanese label in TextCardJ | 卡牌编号 | G+U: decimal identity, not array position | 已确认 2026-10-07 |
| Name search | No game control; names from text/disc table | 搜索卡名 | U: searches English/Japanese names and English aliases | 已确认 2026-10-07 |
| All types / classes / ranks | No game string for these site selectors | 全部类型／全部分类／全部等级 | U: unconstrained filter | 已确认 2026-10-07 |
| Cost / self cost | ＡＴＫコスト J5 | 自身 ATK 消耗 | G: paid by user, not a card price | 已确认 2026-10-07 |
| Ally cost | 味方プレイヤー１人のＡＴＫコスト J231 | 队友 ATK 消耗 | G: contribution from one allied player | 已确认 2026-10-07 |
| HP | ＨＰ J16 | HP | G: keep abbreviation | 已确认 2026-10-07 |
| AP | ＡＰ J1 | AP | G: keep abbreviation, not BB ATP | 已确认 2026-10-07 |
| TP | ＴＰ J19 ability | TP | G: keep abbreviation in EP3 context | 已确认 2026-10-07 |
| MV | ＭＶ J31 ability | MV | G: keep the stat abbreviation used by the game | 已确认 2026-10-07 |
| Range | 攻撃レンジ J2 | 攻击范围 | G: grid, independent of target mode | 已确认 2026-10-07 |
| Entire field | 場にいる全てのキャラクター J237; fixed-range code 6 | 全场 | G: resolved range, not a finite 6×5 area | 已确认 2026-10-07 |
| Cannot move | 移動不可 J162 status | 无法自行移动 | G: item follows SC; restriction is not universally paralysis | 已确认 2026-10-07 |
| Cannot attack | 攻不 J22/J23 | 无法参与攻击 | G: includes participation, not just attacking alone | 已确认 2026-10-07 |
| Assist duration / turns | ４ターン J26 | 辅助效果持续回合 | G: duration field | 已确认 2026-10-07 |
| Once (90) | １回 J248 header; duration code 90 | 一次 | G: one-shot assist, not 90 turns | 已确认 2026-10-07 |
| Permanent (99) | ∞ J24 | 永久 | G: duration code, still subject to removal/replacement | 已确认 2026-10-07 |
| Ability | 特殊能力 J360 body | 特殊能力 | G: ability tag | 已确认 2026-10-07 |
| Usage note | ・味方への使用可 J560; no generic title | 使用说明 | G+U: usage restriction/permission tag | 已确认 2026-10-07 |
| Status condition | マヒ状態 J100 | 状态效果 | G: status explanation distinct from ability | 已确认 2026-10-07 |
| Show all cards, including hidden cards | No game string; unnamed Ｓキャラ and boss-only notes are inputs | 显示全部卡牌（含隐藏卡） | U: exactly 662 → 700, not an obtainability promise | 已确认 2026-10-07 |
| Home navigation: Episode III card catalog | No game navigation string; カード from J2 | EP3 卡牌图鉴 | U: alongside monster catalog | 已确认 2026-10-07 |
| Card names and text are not yet translated into Chinese | No in-game counterpart | 卡牌名称与说明暂未翻译为中文，当前显示英文。 | U: accurate zh-page coverage | 已确认 2026-10-07 |
| Online vs disc | No TextCardJ counterpart; two pinned tables | 联机数据与光盘数据对比 | G+U: provenance, not generic patch history | 已确认 2026-10-07 |
| Displayed values use online data | No TextCardJ counterpart | 本页数值采用联机卡牌数据。 | G+U: explicit authority | 已确认 2026-10-07 |
| In-game text may describe disc behavior | No TextCardJ counterpart | 此卡效果已在联机数据中调整，游戏内说明可能仍描述光盘版效果。 | G+U: only eight effect-diff cards | 已确认 2026-10-07 |
| Effects / effect type | 特殊能力 J360; raw effect fields from card table | 效果／效果类型 | G+U: changed raw slots only, numeric condition type remains unchanged | 已确认 2026-10-07 |
| Expression / trigger timing / arguments | No player-facing equivalents in TextCardJ; `expr`, `when`, `arg1`–`arg3` | 表达式／触发时机／参数 | G+U: raw comparison values, not translated effect descriptions | 已确认 2026-10-07 |
| Right / top link colors | No exact label in TextCardJ; `right_colors`, `top_colors` | 右侧／上方连接颜色 | G+U: raw color-array differences; retain codes until UI presentation is approved | 已确认 2026-10-07 |
| Field / online / disc | No Japanese site label; source struct fields | 字段／联机值／光盘值 | G+U: comparison columns | 已确认 2026-10-07 |
| Previous card / next card / back to list | No in-game counterpart | 上一张／下一张／返回卡牌列表 | U: preserve list filters on return in Phase 2 | 已确认 2026-10-07 |
| Previous page / next page / no results | No in-game counterpart | 上一页／下一页／没有符合条件的卡牌 | U: pagination and empty state | 已确认 2026-10-07 |
| Page jump | Go to page | 跳转页码 | U: existing item-catalog label | 已确认 2026-10-07 maintainer request |

Only these confirmed terms may be used as Chinese product strings.
Unverified proper terms retain English. Before later Chinese Item-card names are
introduced, resolve the exact English identity in `../droptable/i18n_names.json`
and regenerate with `npm run sync:i18n`; never use this table as an item dictionary.

Additional list UI approved in the 2026-10-07 redesign request (existing catalog
utility strings are reused; these are not new card-content translations):

| English | Japanese | Chinese | Evidence | Status |
| --- | --- | --- | --- | --- |
| Filters | 絞り込み | 筛选条件 | Item catalog | 已确认 2026-10-07 |
| Reset | リセット | 重置 | Item catalog | 已确认 2026-10-07 |
| Card class | 種類 | 细分类别 | Item catalog subcategory pattern | 已确认 2026-10-07 |
| Search covers every subcategory. | 検索中はすべての細分類が対象です。 | 搜索时不限细分类别。 | Item catalog | 已确认 2026-10-07 |
| Sort | 並び順 | 排序 | Item catalog | 已确认 2026-10-07 |
| Card | カード | 卡牌 | Requested table header | 已确认 2026-10-07 |
| Cost | コスト | 消耗 | Approved short form of 自身 ATK 消耗 | 已确认 2026-10-07 |
| Ally | 味方 | 队友 | Requested nonzero ally-cost presentation | 已确认 2026-10-07 |

## Tests and Phase 2 boundary

`scripts/test_build_ep3_card_data.py` is registered as `test:ep3-cards` and included
in `npm test`. The fixtures contain 20 exact disc/online CardDefinition slices and
their aligned bilingual text records; `scripts/fixtures/ep3-cards/manifest.json`
records source hashes, offsets, lengths and fixture hashes. Only the final text
sentinel is appended. The small REL-wrapper bounds test constructs its own wrapper
around an unchanged record. When local sources exist, a full-input test additionally
verifies all five pins, all card/diff/hidden sets, original fixture cuts, Japanese
characters and the TextCardE/newserv equality. Configure external roots with
`PSOEP3_ROOT` and `NEWSERV_ROOT` for that test; it is skipped on CI without inputs.

Phase 2 implements Angular components/routes, generator, per-card application JSON,
search, language/integration registration, and node/browser tests. It adds 3 list
routes and 2,100 detail routes. Local implementation and validation do not imply
maintainer acceptance or deployment. Run `npm run release:prepare` against
the final accepted release before any approved push; Phase 1 does not authorize
commit, push or deployment.

Phase 1 validation on 2026-10-07 (historical): the local extractor completed, and a separate regeneration
produced identical WebP bytes for all 1,344 files. After the page-boundary paragraph
regression was fixed, every final data record was compared with a fresh extraction.
`npm run test:ep3-cards` passes all 16 tests locally, including both full-input
tests. The source-independent tests can run without the external roots; the
Pillow assembly test alone is optional when Pillow is absent. `git diff --check`
passes. Full `npm test` reaches the existing `scripts/test_dev_proxy.mjs` test
but fails because its spawned server cannot listen on `127.0.0.1`: a reproduction
that exposes the child's stderr reports `listen EPERM: operation not permitted`.
The card tests pass within that run; no unrelated server code was changed.

## Phase 2 implementation and acceptance record

The catalog lives at `/data/ep3-cards.html` and `/data/ep3-cards/{id}.html`, with
`/en/` and `/ja/` counterparts. The redesigned list uses six category tabs,
a class/rank sidebar, a count/sort/pagination toolbar and category-specific
table columns. Pages contain 24 cards. The available pool expands from 662 to
700 with the show-all checkbox; browsing shows one category and class at a time.
All query parameters survive detail navigation and language changes; previous
and next use actual IDs, including gaps, independently of current filters.

`npm run generate:angular` and the production build run
`scripts/generate_ep3_card_catalog.mjs`. It consumes only the committed snapshot,
uses `scripts/generated_files.mjs`'s existing atomic writer (there is no separate
registry in that helper), and emits:

- `src/app/generated/ep3-card-catalog/index.json`: list fields and medium paths.
- `details.server.json`: server-only full records, injected through the loader.
- `version.json`: content hash for browser cache invalidation.
- `assets/data/ep3-cards/{id}.json`: individual details for browser navigation.

Generated files remain gitignored. SSR transfers only the requested detail;
browser navigation fetches one versioned detail. The 64 medium-only cards omit
both the large path and the redundant file; 608 large + 672 medium = 1,280 files.
All 28 missing-art cards retain the missing-art presentation.

Detail values preserve stat kinds, including `+0`, `−3`, `=0`, unknown signs and
blank fields. Range is a 6×5 grid with the user at row 4 / column 2 facing upward;
entire-field ranges use text instead of pretending the grid bounds the effect.
Headers and ability/note/status paragraphs retain the source languages. Only
66 cards show the online/disc section; exactly eight also show the effect-change
notice. Raw changed effect slots and link-color arrays remain literal data.

The Chinese UI is restricted by a test derived from the approved table above.
Utility navigation, error states, artwork availability and range orientation use
the additional Chinese wording confirmed on 2026-10-07 above. Effect comparisons
show only changed slots, with the six labelled fields `type`, `expr`, `when`,
`arg1`–`arg3`; changed fields have a bold accent and an asterisk. Changed metadata
fields are included under their original identifiers (card 365 changes only
`nameIndex`, 0 on disc to 12 online). Color arrays use comma-separated raw codes.

Review findings corrected during implementation:

- Missing native large art was being encoded again as a smaller “large” file.
  Regeneration removes all 64 files, with exact count, dimensions and full-source
  mapping assertions.
- The shared search route exclusion treated any final `404.html` as the error
  document. It now excludes only root language error routes; card 404 is indexed
  in all languages. The real Pagefind fixture covers it.
- The first feature template used `data-pagefind-body`, which caused Pagefind to
  select only EP3 pages and ignore aliases appended outside that element. It now
  follows the existing catalogs' shared indexing-body convention. The fixture
  uses the actual EP3 root markup alongside ordinary pages, verifies aliases
  and existing categories, and browser tests cover both EP3 and existing search.
- An initial list prerender omission and an incorrectly placed alias statement
  failed build/tests and were corrected before acceptance validation. The first
  browser filter test also used an exact label-text selector that included
  option text; it now uses the observed accessible combobox name.

The total published JavaScript gzip cap changes from 1,003,000 to 1,040,000 bytes
to cover this new feature. The final build uses 1,038,518 bytes, leaving about
1.5 KB of headroom; the maintainer accepted this cap on 2026-10-07. Single-chunk, per-route, translated-edition, inline
script and hydration caps are unchanged. No dependencies were added.

### Production build measurement (2026-10-07)

These are local wall-clock measurements of the complete `npm run build`, including
Angular generation/prerender, installation, search and budget checks. Output size
is the sum of `_site` file bytes, not filesystem allocation. They are individual
local runs, not a controlled benchmark (caches and concurrent validation vary).

| Measurement | Before Phase 2 | Final Phase 2 |
| --- | ---: | ---: |
| Angular prerender routes | 3,802 | 5,905 |
| Detail routes added | — | 2,100 |
| List routes added | — | 3 |
| Event fragment resources | 135 | 135 |
| All HTML files | 3,937 | 6,040 |
| Build wall time | 60.43 s | 70.67 s |
| Output bytes | 403,588,579 | 469,824,733 |
| Output MiB | 384.89 | 448.06 |
| Published JavaScript gzip bytes | 999,617 | 1,034,337 (1,038,518 after the list redesign and bottom pagination) |
| WebP files / bytes | 1,344 / 20,448,018 | 1,280 / 20,143,784 |

Net output growth: 66,236,154 bytes (63.17 MiB); time difference: 10.24 s.
The final search contains **6,024 actual fragments**, including all 2,100 card
pages, the 3 list pages, ordinary site pages and historical event entries.
All three card-404 routes and all three Excalibur item routes were inspected in
those fragments. All 2,100 rendered card headings were compared with their source
language names. English/Japanese edition gzip totals are 527,882 / 584,480 bytes,
both under the unchanged 700,000-byte caps.

### Validation command record

Commands use the local RTK prefix (`rtk proxy` for unfiltered commands). The
build timing wrapper calls `npm run build`, records `time.monotonic()` and sums
`_site` file sizes. Read-only `cat`, `rg`, `ls`, `sed`, `tail`, `git status`,
`git diff`, and source/HTML/fragment inspection scripts were also used; they
changed no repository content. An initial lookup guessed three nonexistent
monster component filenames, then used the actual directory inventory.

| Command | Observed result |
| --- | --- |
| `python3 scripts/build_ep3_card_data.py --psoep3-root /Users/wangzhen/Documents/PSOEP3 --newserv-root /Users/wangzhen/study/newserv --gvmdump /Users/wangzhen/study/resource_dasm/gvmdump --date 2026-10-07` | Pass: 700 cards, 1,280 images, 20,143,784 bytes. |
| `node scripts/generate_ep3_card_catalog.mjs` | Pass: 700 cards, 2,103 routes. Also invoked by builds and node tests. |
| `npx tsc --noEmit -p tsconfig.app.json` | Pass. |
| `node --experimental-strip-types --test scripts/test_ep3_card_catalog.mjs` | Final pass: 6 tests. Initial card-404 route failure exposed and fixed the exclusion rule. |
| `node --test scripts/test_build_search.mjs` | Final pass: 7 tests, including actual EP3 root markup, aliases and all category fragments. Earlier misplaced-alias failure was fixed. |
| `node --experimental-strip-types --test scripts/test_ep3_card_catalog.mjs scripts/test_build_search.mjs` | Pass: 13 tests. |
| `npm test` | Final direct runs pass; 17 Python EP3 tests (full local inputs), 6 node EP3 tests, architecture/localization, search and development proxy checks. Earlier run exposed the misplaced alias; shell-wrapped run hit the environment restriction below. |
| `node --test scripts/test_dev_proxy.mjs` | Isolated sandboxed invocation failed with `Server exited 1`; reproduced child stderr below. The same test passed in final direct `npm test`. |
| `node scripts/serve_site.mjs _site 0` | Direct invocation successfully listened on 127.0.0.1; stopped after diagnosis. |
| `node --input-type=module -e '…spawn(process.execPath,["scripts/serve_site.mjs","/tmp","0"])…'` | Diagnostic child invocation exposed exact `listen EPERM` below. |
| `npm run build` (timed) | Baseline and final pass. Intermediate failures: missing list prerender; misplaced alias statement; total JS budget. All corrected; no budget check disabled. Intermediate successful builds preceded the search-marker fix and final layout/HTML-language adjustment. |
| `git diff --check` | Pass. |

A shell-wrapped Playwright invocation also failed before running tests with:

```text
Error: listen EPERM: operation not permitted 127.0.0.1:4173
Error: Process from config.webServer was not able to start. Exit code: 1
```

The development proxy child diagnostic reported:

```text
Error: listen EPERM: operation not permitted 127.0.0.1
code: 'EPERM', errno: -1, syscall: 'listen', address: '127.0.0.1'
```

These errors are retained rather than treated as passes. Direct tool invocations
subsequently ran the same tests successfully; no test or server implementation
was modified to suppress them. One initial browser invocation was interrupted
because it started before the new build was published into `_site`.


Japanese search also indexes derived word tokens for zh/ja: `Intl.Segmenter`
word boundaries after NFKC normalization, followed by NFD combining-mark removal, matching Pagefind
1.5.2's browser query normalization. Original Japanese display names and raw
aliases remain unchanged. A diagnostic miniature index proved that the raw
`ヒルデベアケイン＋` alias alone failed in zh/ja, while the derived tokens matched
that exact query, the ASCII-plus variant and the suffix-free query. This corrects
search tokenization rather than inventing another card name. The all-language
browser regression keeps the exact source-name query.

Temporary Playwright probes inspected query behavior and a miniature Pagefind
index; they passed and were removed afterward. An earlier direct Node browser
probe was blocked by Chromium's sandbox environment with
`bootstrap_check_in ... Permission denied (1100)`; the normal Playwright command
successfully performed the same diagnostic. No browser flags or tests were
changed to bypass that restriction.


The full production-index probe additionally showed that fullwidth `＋` still
failed even after kana words matched. The shared search engine now applies NFKC
to queries before Pagefind tokenization, consistent with the catalog's name
search; the EP3 alias tokens apply the same normalization. On the actual full
index, the exact original fullwidth query then found card 29. The miniature
index did not expose this symbol-shard interaction, so final acceptance relies
on the full production browser suite, not the miniature probe alone.

The medium-only extractor regression was also fault-injected in memory: restoring
`large = medium.copy()` makes the new test fail on the unexpected `large` key.
The real implementation passes all 17 Python tests, including full local inputs;
no source file was changed by that fault-injection check.


The affected search cache test helper was corrected after trace inspection:
it selected all categories with `Excal` still entered, then cleared the input
261 ms later, beyond the 180 ms debounce. The seven extra downloads were valid
guide/reference results for that intermediate query, not a cache failure.
The helper now clears input before changing category. The same-query no-new-
download assertion remains intact; production cache behavior was not changed.

The EP3 pagination test now awaits the source-expected first row of page 2 before
capturing its link. A loaded full-suite run exposed a stale read immediately
after the asynchronous router click (page 1's link was captured while the page 2
round trip correctly returned page 2). The expected page-2 identity and preserved
query assertion are both retained.

### Final validation outcome

**PASS — 2026-10-07.** No known in-scope implementation finding remains.
Final `npm test` passed, including all 17 extractor tests, all 6 catalog node
tests and the existing business/architecture/localization/search suites.
`npm run build` passed with the final metrics above. The final affected browser
suite passed **129 / 129 in 43.3 s**, including all 12 new EP3 scenarios and its
`@smoke` scenario:

```sh
npx playwright test \
  tests/e2e/ep3-card-catalog.spec.mjs \
  tests/e2e/monster-catalog.spec.mjs \
  tests/e2e/home-navigation.spec.mjs \
  tests/e2e/home-language.spec.mjs \
  tests/e2e/site-language.spec.mjs \
  tests/e2e/site-search.spec.mjs
```

Earlier full browser runs reported 109/20, 127/2, 126/3 and two 128/1
pass/fail totals while the indexing, normalization and harness issues documented
above were being resolved. Those failures were not skipped or converted to
passes. Final desktop/390px list and detail screenshots were inspected;
accessibility and viewport checks pass. The six card types' complete source
headers and tags are checked in both English and Japanese.

Additional executed checks: `python3 -m unittest scripts.test_build_ep3_card_data`
(17 passed); in-memory old-code fault injection (one expected failure proving
regression coverage); final HTML/search/artwork inventory assertions (passed);
`git diff --check` and new-file whitespace checks (passed). Temporary browser
probe files/indexes were removed. No requested validation remains blocked by the
earlier sandbox failures; no outside-sandbox rerun is needed to complete this
local Phase 2 validation.

No commit, push, branch, PR or deployment was performed. The full release-only
`npm run release:prepare` and publication remain pending maintainer acceptance.
Phase 1's inaccessible Fandom/TCRF external comparisons remain recorded as such;
Phase 2 adds no claim that those comparisons succeeded.


## Acceptance corrections — 2026-10-07

This record supersedes the earlier Phase 2 validation outcome for these changes.
Nothing was committed, pushed or deployed.

1. **Difference presentation:** the generic object formatter serialized complete
   effect arrays, so unchanged slots overwhelmed the actual change. The shared
   presenter now selects changed slots and displays `type`, `expr`, `when`,
   `arg1`–`arg3` as labelled rows, marking changed fields with bold/accent styling
   and `*`. Changed additional metadata remains visible by raw identifier.
   Audited slot numbers: 74→3, 239→3, 365→2, 481→2, 686→1, 695→2, 704→1,
   710→1. Card 365 changes only `nameIndex` (online 12, disc 0); card 481 changes
   only slot 2 `expr` (`d` versus `d-1`). Raw right/top colors are compact,
   comma-separated codes. Node tests cover all eight cards, metadata-only
   differences, every changed color array and exact field-change flags. Browser
   regressions cover the same cards in all three languages.
2. **Text structure:** the normalizer joined every nonblank line as prose, and
   separately joined page bodies with a space. It now collects each complete tag
   body across pages before normalization, preserves applicability rows containing
   `○`/`〇`/`×`, and starts separate entries for numeric colon-labelled outcomes
   and numeric example equations while joining their wrapped explanations.
   The audit scanned all 700 cards' tag bodies in both languages, including
   continuation pages. Besides status applicability, affected structures were
   dice outcomes (158 and 164) and damage examples (193 and 242); prose such as
   “Prevents Abnormal Conditions:” remains joined. Full extractor regeneration
   changed 59 English and 57 Japanese tag bodies, only in whitespace. Headers,
   tag identities, all non-text card fields and metadata are identical to the
   pre-fix snapshot. Artwork remains 1,280 files / 20,143,784 bytes. Python
   regressions cover both languages, both applicability marks, dice/equation
   entries, ordinary prose, hyphens, blank paragraphs, cross-page boundaries
   and applicability rows from every locally available source card. Browser
   assertions compare exact text content, including newlines.
3. **Chinese UI:** six Chinese message entries had English values; the utility
   nav also omitted sibling catalogs. They now use the exact maintainer-confirmed
   strings recorded above, with the monster catalog's utility link pattern:
   home `/`, items `/data/items.html`, bestiary `/data/enemies.html`, each localized
   by the existing language service. Node tests assert all six exact translations;
   browser tests cover utility links, orientation, absent artwork and load failure.
4. **Stat grid:** seven fields occupied a four-column grid whose background
   filled the unused eighth position. The final field now spans the remaining
   columns at desktop and mobile widths; eight-field Assist layouts remain full.
   Browser regressions measure every row's right edge for cards 100, 481 and 24
   in all three languages at 1280px and 390px.

Validation executed against these corrections:

| Command | Result |
| --- | --- |
| Full documented extractor command, fixed `--date 2026-10-07` | Passed; regenerated `content/ep3-card-catalog/cards.json` and artwork. |
| `npm test` | Failed at the existing development search-server test (`scripts/test_dev_proxy.mjs:10`), reporting `Server exited 1`. The matching spawned-server reproduction exposed `Error: listen EPERM: operation not permitted 127.0.0.1`. All preceding suites passed, including 20 EP3 Python tests and 8 EP3 Node tests. The final development group had 10 passed / 1 failed. |
| `npm run test:dev` diagnostic rerun | Same server-start failure, 10 passed / 1 failed. |
| `npm run build` | Failed: Angular CLI child terminated with `SIGABRT` after `Building...`, with empty stderr. The matching macOS crash report records `EXC_CRASH`, `Abort trap: 6`, and `___BUG_IN_CLIENT_OF_LIBMALLOC_POINTER_BEING_FREED_WAS_NOT_ALLOCATED` in the native `node.napi.node` stack. No successful production build is claimed. |
| `node node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js -p tsconfig.app.json` | Passed (exit 0); only the two existing monster-template NG8107 warnings. This checks templates/types, not production build completion. |
| `npx playwright test tests/e2e/ep3-card-catalog.spec.mjs` | Blocked before tests: `Error: listen EPERM: operation not permitted 127.0.0.1:4173`; `Process from config.webServer was not able to start. Exit code: 1`. No browser pass or visual verification is claimed. |
| `git diff --check` | Passed. |

Before changing implementation, the new normalizer regression produced six
expected assertion failures and the confirmed-Chinese regression failed on
`Home` versus `返回主页`. The new UI regressions were also attempted before
implementation but could not start because of the same localhost permission
error. Final card unit tests pass; browser and full production acceptance remain
unverified because of the command failures above. No tests were skipped or
weakened to turn these failures into passes, and no unrelated server/build
configuration was changed.

## List redesign — 2026-10-07

Classification follows newserv `system/ep3/text-english.json`, lines 435–452:
“All types, Hunters, Arkz, Item, Creature, Action, Assist”, followed by
“N1 N2 N3 N4 R1 R2 R3 R4 S SS E”. The UI deliberately omits All types.
The ordered tabs are HUNTERS_SC (39), ARKZ_SC (39), ITEM (259), CREATURE (120),
ACTION (168), ASSIST (75). With hidden cards excluded their counts are
26, 26, 259, 120, 156, 75. The default is Hunters. Chinese labels are Hunters,
Arkz, 装备卡, 生物卡, 行动卡, 辅助卡; Japanese uses the confirmed game terms.

The layout follows the item catalog’s category-tabs, catalog-layout, filter-heading,
result-toolbar, sort-control and mobile-filter patterns. The sidebar lists only
CardClass values present in the active category and hidden-card scope, in source
order, with counts and no all-class option. Story Characters use HU/RA/FO
professions; Arkz also retains the three boss records whose actual CardClass
is DARK_CREATURE, rather than relabelling or losing them.
The first class is the default. Rank has an all-ranks option and only ranks in
that category, ordered as above. Reset retains the category and clears the rest.

Search matches English, Japanese and table names across all six categories;
tabs display match counts. Entering a query selects the first matching category,
and users can then select any category. Search disables and ignores class but
retains rank filtering. Clearing search returns to default Hunters browsing.
Hidden-card visibility also affects category and class counts. Category changes
reset class, rank and page. Other filter/sort changes reset page.

Table columns after Card and Rank:

| Category | Columns |
| --- | --- |
| Hunters / Arkz | HP, AP, TP, MV |
| Item | Cost, HP, AP, TP |
| Creature | Cost, HP, AP, TP, MV |
| Action | Cost, Target mode |
| Assist | Cost, Assist duration / turns |

Cost always includes self cost; ally cost is appended only when nonzero
(e.g. `3 + 队友 2`). Target mode and assist duration come directly from the
source snapshot through the lightweight generated index. Sort is ID ascending,
self cost ascending, HP descending or AP descending, with ID as a stable tie
breaker. Signed stats sort numerically; blank and unknown stats sort last.
No unconfirmed sort label was introduced: 卡牌编号, 消耗, HP and AP are used.
Card content remains English/Japanese; Chinese names were not invented.

URL keys are `type, class, rank, all, sort, page, q`. Omitted/invalid values
resolve to documented defaults; detail links, previous/next, language changes,
and return links retain the URL state. At 390px the sidebar is collapsible and
tabs/table scroll within their own containers, preserving column headers.

The new direct-URL browser regression initially failed in all three languages:
`rank=N4` filtered the data but the rank select displayed its first option.
A second probe reproduced the same mechanism for `class=RA_SC` after the
category options changed. Native select values were applied before dynamic
options existed. All three dynamic selects now bind each option’s selected
state, following the item catalog’s existing subcategory implementation.
The regression retains exact selected-value assertions after direct opening,
refresh and details round trips. Source data and filter expectations were not
changed to accommodate the UI failure.

During validation, one rebuild failed with this exact Angular CLI child result:

```text
signal: SIGABRT
stdout: ❯
```

Final redesign validation (supersedes intermediate results above):

| Command | Final result |
| --- | --- |
| `npm test` | Passed, including 20 EP3 Python tests and 10 EP3 Node tests; development server group 11/11. |
| `npm run build` | Passed: 5,905 prerendered routes, 135 event fragments; published JS gzip 1,037,886 / 1,040,000 bytes; en 527,980 and ja 584,575 / 700,000 bytes. |
| `npx playwright test tests/e2e/ep3-card-catalog.spec.mjs` | Passed 24/24 in 6.5 s, including @smoke, all languages, exact category cells, direct URL/refresh/detail return, mobile filters, overflow and accessibility. |
| `node node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js -p tsconfig.app.json` | Passed; two existing monster-template NG8107 warnings. |
| `git diff --check` | Passed. |

Desktop and 390px list screenshots were inspected. Fresh review checked scoped
counts, default class selection, rank ordering, signed/unknown stat sorting,
category-dependent columns, nonzero ally costs, reset and URL preservation.
No known in-scope defect remains. The earlier native build crash and failed
server-test invocation are retained above; successful retries did not modify
configuration or skip checks. No commit, push or deployment was performed.

## Hidden-rule update validation — 2026-10-07

This later update adds 702/703 to the hidden set (38 hidden / 662 visible).
The regression failed on the old snapshot with exactly 702 and 703 missing.
Full extraction and application-data regeneration completed; comparison against
the pre-update snapshot found only those two `hidden` flags changed. All 700
generated detail records and index visibility flags match the snapshot. Artwork
remains 1,280 files / 20,143,784 bytes, with the same 28 missing-artwork IDs.
Python and Node checks preserve visibility of 668/669 and all 716–739; the added
browser regression covers boss opt-in and representative generic SC placeholders.

These command results apply to this update; earlier successful runs above do not
validate the changed snapshot:

| Command | Result |
| --- | --- |
| `npm test` | Exit 1 in the final development-server group (10 passed, 1 failed): `Server exited 1`. A direct child-process diagnostic reproduced `listen EPERM: operation not permitted 127.0.0.1`. EP3 Python 20/20 and Node 10/10 passed. |
| `npm run build` | Both attempts exited 1: Angular CLI `build haven-tools` child terminated with `SIGABRT`, stdout `❯ Building...`, stderr empty. |
| `npx playwright test tests/e2e/ep3-card-catalog.spec.mjs` | Exit 1 before tests: configured web server failed with `listen EPERM: operation not permitted 127.0.0.1:4173`. Browser assertions remain unverified. |
| `git diff --check` | Passed. |

No commit, push or deployment was performed. No errata notice was implemented.

## Bottom list pagination — 2026-10-07

The list now mirrors the item catalog’s bottom `.pagination` bar: localized
page range, previous/next buttons and a labelled page-number input. Exact
existing Chinese, English and Japanese wording and responsive CSS are reused;
no new Chinese wording was introduced. The top toolbar remains available.
Both controls use the same URL-derived page and navigation handler, preserve
filters/sorting, clamp jumps to valid pages and scroll to the results start
after navigation, matching the item catalog. Page 1 omits the URL page key.
Empty results omit the bottom bar. Detail neighbor navigation is unchanged.

Six browser regressions cover zh/en/ja at 390px and 1280px: bottom navigation,
top/bottom synchronization, range text, disabled boundaries, Enter/change
jumps, invalid jumps, preserved URL state, reload, result scrolling and overflow.
The existing round-trip test explicitly selects the top Next page button.

Validation against these changes:

| Command | Result |
| --- | --- |
| `npm test` | Passed, including EP3 Python 20/20, Node 10/10 and development-server tests 11/11. |
| `npm run build` | Passed: 5,905 routes, 135 event fragments; published JavaScript gzip 1,038,518 / 1,040,000 bytes. |
| `npx playwright test tests/e2e/ep3-card-catalog.spec.mjs` | Passed 31/31 in 8.0 s, including all six new pagination regressions. |
| Angular `ngc -p tsconfig.app.json` | Passed; only the two existing monster-template NG8107 warnings. |
| `git diff --check` and browser-spec syntax check | Passed. |

The initial unit run rejected the reused page-jump label because this document’s
terminology table lacked it. Adding the explicitly requested existing label fixed
that failure; no test assertion was weakened. An initial RTK-filtered browser
invocation exited 1 with only `PASS (0) FAIL (0)` / `Time: 107ms`; the raw-output
retry above ran all 31 tests successfully. These runs reported no sandbox
`listen EPERM` or native crash. Earlier such failures remain documented above
and are not results of this pagination change.

Fresh scoped review checked shared page size, URL merging, page-one URL cleanup,
localized wording, result scrolling, empty-state omission and separation from
detail-neighbor styling. No commit, push or deployment was performed.

## Release acceptance — 2026-10-07

The maintainer reviewed the list (category tabs, sidebar filters, top and bottom
pagination) and detail pages in a local preview, accepted the result, accepted
the 1,040,000-byte published JavaScript cap and authorized commit and push on
2026-10-07. `npm run release:prepare` passed against the final tree: locked
install, 0 vulnerabilities, full business tests, production build, reproducible
build comparison, 21 smoke scenarios and 6,304 browser tests. This acceptance
record does not by itself confirm a successful site deployment.
