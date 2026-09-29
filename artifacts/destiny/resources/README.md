# Destiny local resource inventory

`inventory.json` records source paths, byte sizes, source modification times and SHA-256 hashes. The `originals/` directory contains unchanged copies of the six item AFS archives, `item.bml`, three Unitxt PRS files, the captured `ItemPMT.prs`, and two Solylib Lua files. SHA-256 hashes of all copies were checked against the source hashes.

The Windows client was read from `C:\Program Files\PSOBB Destiny` through the existing Parallels VM and `Z:` Mac Home share. A recursive filename search found the listed Unitxt and custom-related files. The `addons\customdlls` directory contained only `README`; its content was not interpreted. The client's `data\destiny` directory contained only `events\current_event.dst`. No second local Unitxt file was found.

The non-mutating PMT probe reports only a **low-confidence PRS candidate** based on the extension. It does not establish the decoded format, game version, or item semantics. No client files were changed.

## Item names

`item-names.json` compares the 1,756 records in `../pmt/records.json` with the unmodified `unitxt_j.prs` and exact three-byte code comments in the installed client's Solylib `items_list.lua`. Regenerate it with `rtk python3 build_item_names.py` using the local newserv executable named in the script. Newserv's `UnicodeTextSet` parser (`src/TextIndex.cc`) confirms the PRS/UTF-16LE group format; `/Users/wangzhen/study/ItemPMT/src/main/java/com/psohaven/itempmt/unitxt/BbHandler.java` selects group 1 for BB item names. `solylib/unitxt.lua` reads group 1 at the supplied ID in memory, but no runtime client state was traced here.

The filename suffix `_j` is not a reliable language label: the decoded item strings are English. The other local files decode successfully but contain separate text sets: `unitxt_shop_j.prs` has 19 groups, and `unitxt_ws_j.prs` has one group. No additional language's item-name set was found in this client inventory, and no translations were synthesized.

The raw PMT ID is **not** a valid universal Unitxt index for this pair of files. For example, code `010100` has PMT ID 744, while `Frame` is Unitxt index 740; code `010300` has PMT ID 997, while `Knight/Power` is index 993; code `020000` has PMT ID 1219, while `Mag` is index 1171. The generic Solylib comments independently confirm those code/name associations. The observed index differences are 0 for weapons/tools, −4 for armor/shield/unit, and −48 for MAGs. They are treated as candidates, not blanket runtime rules for later custom records.

Only 940 records have an **exact source match** between the proposed Unitxt index and the same code's Solylib base comment. Those rows have `names.en`, `name_status: source_matched`, and a `name_index`. The other 816 have empty `names`, `name_status: unresolved`, and an explicit reason. Every row retains the raw proposed index, Unitxt text and Solylib comment in `mapping_candidate` for audit. In particular, 44 late equipment records cross the observed equipment-name boundary (Unitxt index 1164), where applying −4 would return special labels or MAG names; the anomalous MAG `025200` breaks its ID sequence. The cross-check establishes agreement between two installed source files, not the actual runtime display name. MAG codes retain the PMT parser's `first_two_bytes` match rule.

## ItemKT mapping

The Destiny `ItemKT.afs` hash exactly matches the documented stock BB v4 448-entry archive in `/Users/wangzhen/study/ItemPMT/artifacts/itemkt-exports/README.md`. Its `ItemKTep4.afs` has 505 entries but a different hash from that document's stock archive. The local preview manifest associates some stock PMT `type`/`skin` values with AFS entries, but it does not prove the rule for Destiny's altered Episode 4 archive or every item family. In the Destiny PMT, 118 weapon records have different `type` and `skin` values; 37 weapon skins are at least 505, beyond either archive's entry count. No item image mapping was exported without a validated client selection rule.
