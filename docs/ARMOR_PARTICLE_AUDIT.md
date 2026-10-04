# Armor particle binding investigation (2026-10-04)

## Result

The 88 catalog armors resolve to 15 assigned particle effects, one visibility effect (Stealth Suit), and 72 entries with no individual particle in the reviewed client paths. A missing standalone model was not used as the criterion. The 15 entries use 12 distinct particle IDs; three heart items and two sparkle items deliberately share verified bindings.

This is a source-path result, not a runtime capture or a full audit of Ephinea injected code. The audit's 19 resource-only findings are therefore not promoted to confirmed absence. The site uses category boxes for entries without an individual preview; the audit's evidence classifications are not extra UI states.

## Evidence

- Stock BB executable: `../PSOBB-Haven/Psobb.exe`, SHA-256 `211eea328f2f0f3ad88d5033c77704da72fcb9892f9f5c03b93e0def08faa78c`.
- Ephinea PMT: `../newserv/tools/param_dumps_ephinea/ItemPMT.prs`, SHA-256 `33b6243f8fde94a0bc1b299ca9a7277ff759aeaca1465f8c0caa7950205dc689`.
- Particle records: `particleentry.dat`, SHA-256 `72da95d3e2771ffb6d8037e6d255c75260ada295309de981ce7cc149c60a7a5e`.
- `init_item_armor_frame`: FlagsType 2 selects the particle constructor; Wedding Dress has an explicit override.
- `ArmorFrameParticleEffectInit` at `005E0FE8`: group 0x29–0x34 table at `0092D1C4`; Wedding Dress record at `0092D1A0` is exactly `(0x3E, 0x192, 2)`. Binary instructions and table bytes were read directly.
- `on_equip_armor`: groups 0x2D/0x44/0x45 create the heart helper; `005CBF54` emits particle 0x1BE subject to timer/map/player proximity.
- Passive helper vtables were read from the executable: HP regen `00B0F2D8` dispatches to `005E5DC8` (`add_player_hp`); TP regen `00B0F2F0` to `005E5DE0` (`add_player_tp`). Neither dispatch function creates a particle. HP drain `00B0D8E0` dispatches to `005E5D3C`; its effect is damage, not an individual armor particle.
- `unknown_check_armor_effects`: Technique boosts/TP changes for cloak and Mother Garb groups; visibility packets for Stealth Suit. `ResetItemEffectOnPlayer_005C42F4` refreshes stats and restores/clamps HP/TP, not an armor particle selector.
- `ConstructArmorBarrierEntity_005D12FC` and `ConstructArmorBarrierInstance_005D145C` do create particles, but their only inspected constructor call sites are shield equip code (`ConstructArmorBarrierEffect_005E192B`, shield 0x1A and colored rings). They are not armor paths despite decompiler names.
- All functions with named armor-slot lookups were enumerated: equip/unequip checks, set/stat calculations, menu display and challenge validation; no extra direct particle-emission branch was found there. This is not a claim that keyword search proves every indirect call absent.

## Assigned particle effects

| Item code | Armor | Particle | Resource name | Route |
| --- | --- | --- | --- | --- |
| 010129 | Guard Wave | `0xE0` | `bm4_nodam` | FlagsType 2 -> table 0092D1C4 |
| 01012A | DF Field | `0x32` | `anti_karadahika` | FlagsType 2 -> table 0092D1C4 |
| 01012B | Luminous Field | `0x11B` | `core_hamon` | FlagsType 2 -> table 0092D1C4 |
| 01012C | Chu Chu Fever | `0x17D` | `chu_chu` | FlagsType 2 -> table 0092D1C4 |
| 01012D | Love Heart | `0x1BE` | `heart01` | on_equip_armor -> 005CBF28 -> 005CBF54 (conditional heart burst) |
| 01012E | Flame Garment | `0x22` | `gifeio_hatudou` | FlagsType 2 -> table 0092D1C4 |
| 01012F | Virus Armor: Lafuteria | `0x6B` | `rafute` | FlagsType 2 -> table 0092D1C4 |
| 010130 | Brightness Circle | `0xB0` | `gate_circle` | FlagsType 2 -> table 0092D1C4 |
| 010131 | Aura Field | `0xE1` | `bm4_tamasii` | FlagsType 2 -> table 0092D1C4 |
| 010132 | Electro Frame | `0x106` | `bm7_gattai` | FlagsType 2 -> table 0092D1C4 |
| 010133 | Sacred Cloth | `0x192` | `barta_lv1kira` | FlagsType 2 -> table 0092D1C4 |
| 010134 | Smoking Plate | `0x1BC` | `gsmoke` | FlagsType 2 -> table 0092D1C4 |
| 01013E | Wedding Dress | `0x192` | `barta_lv1kira` | Wedding Dress constructor override -> 0092D1A4 |
| 010144 | Dress Plate | `0x1BE` | `heart01` | on_equip_armor -> 005CBF28 -> 005CBF54 (conditional heart burst) |
| 010145 | Sweetheart | `0x1BE` | `heart01` | on_equip_armor -> 005CBF28 -> 005CBF54 (conditional heart burst) |

## Remaining entries

The following entries have no assigned particle in the reviewed paths. This does not substitute a shield effect or manufacture per-item variants.

| Item code | Armor | Result |
| --- | --- | --- |
| 010100 | Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 010101 | Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010102 | Psy Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010103 | Giga Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 010104 | Soul Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 010105 | Cross Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010106 | Solid Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 010107 | Brave Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010108 | Hyper Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 010109 | Grand Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 01010A | Shock Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 01010B | King's Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 01010C | Dragon Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 01010D | Absorb Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 01010E | Protect Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 01010F | General Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010110 | Perfect Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 010111 | Valiant Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 010112 | Imperial Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010113 | Holiness Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010114 | Guardian Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010115 | Divinity Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010116 | Ultimate Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 010117 | Celestial Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010118 | Hunter Field | No individual particle in reviewed frame constructor/equip/update paths |
| 010119 | Ranger Field | No individual particle in reviewed frame constructor/equip/update paths |
| 01011A | Force Field | No individual particle in reviewed frame constructor/equip/update paths |
| 01011B | Revival Garment | No individual particle in reviewed frame constructor/equip/update paths |
| 01011C | Spirit Garment | No individual particle in reviewed frame constructor/equip/update paths |
| 01011D | Stink Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 01011E | D-Parts ver1.01 | No individual particle in reviewed frame constructor/equip/update paths |
| 01011F | D-Parts ver2.10 | No individual particle in reviewed frame constructor/equip/update paths |
| 010120 | Parasite Wear: De Rol | No individual particle in reviewed frame constructor/equip/update paths |
| 010121 | Parasite Wear: Nelgal | No individual particle in reviewed frame constructor/equip/update paths |
| 010122 | Parasite Wear: Vajulla | No individual particle in reviewed frame constructor/equip/update paths |
| 010123 | Sense Plate | No individual particle in reviewed frame constructor/equip/update paths |
| 010124 | Graviton Plate | No individual particle in reviewed frame constructor/equip/update paths |
| 010125 | Attribute Plate | No individual particle in reviewed frame constructor/equip/update paths |
| 010126 | Flowen's Frame | No individual particle in reviewed frame constructor/equip/update paths |
| 010127 | Custom Frame ver.OO | No individual particle in reviewed frame constructor/equip/update paths |
| 010128 | DB's Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010135 | Star Cuirass | No individual particle in reviewed frame constructor/equip/update paths |
| 010136 | Black Hound Cuirass | No individual particle in reviewed frame constructor/equip/update paths |
| 010137 | Morning Prayer | No individual particle in reviewed frame constructor/equip/update paths |
| 010138 | Black Odoshi Domaru | No individual particle in reviewed frame constructor/equip/update paths |
| 010139 | Red Odoshi Domaru | No individual particle in reviewed frame constructor/equip/update paths |
| 01013A | Black Odoshi Red Nimaidou | No individual particle in reviewed frame constructor/equip/update paths |
| 01013B | Blue Odoshi Violet Nimaidou | No individual particle in reviewed frame constructor/equip/update paths |
| 01013C | Dirty Lifejacket | No individual particle in reviewed frame constructor/equip/update paths |
| 01013D | Kroe's Sweater | No individual particle in reviewed frame constructor/equip/update paths |
| 01013F | Sonic Team Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010140 | Red Coat | No individual particle in reviewed frame constructor/equip/update paths |
| 010141 | Thirteen | No individual particle in reviewed frame constructor/equip/update paths |
| 010142 | Mother Garb | No individual particle in reviewed frame constructor/equip/update paths |
| 010143 | Mother Garb+ | No individual particle in reviewed frame constructor/equip/update paths |
| 010146 | Ignition Cloak | No individual particle in reviewed frame constructor/equip/update paths |
| 010147 | Congeal Cloak | No individual particle in reviewed frame constructor/equip/update paths |
| 010148 | Tempest Cloak | No individual particle in reviewed frame constructor/equip/update paths |
| 010149 | Cursed Cloak | No individual particle in reviewed frame constructor/equip/update paths |
| 01014A | Select Cloak | No individual particle in reviewed frame constructor/equip/update paths |
| 01014B | Spirit Cuirass | No individual particle in reviewed frame constructor/equip/update paths |
| 01014C | Revival Cuirass | No individual particle in reviewed frame constructor/equip/update paths |
| 01014D | Alliance Uniform | No individual particle in reviewed frame constructor/equip/update paths |
| 01014E | Officer Uniform | No individual particle in reviewed frame constructor/equip/update paths |
| 01014F | Commander Uniform | No individual particle in reviewed frame constructor/equip/update paths |
| 010150 | Crimson Coat | No individual particle in reviewed frame constructor/equip/update paths |
| 010151 | Infantry Gear | No individual particle in reviewed frame constructor/equip/update paths |
| 010152 | Lieutenant Gear | No individual particle in reviewed frame constructor/equip/update paths |
| 010153 | Infantry Mantle | No individual particle in reviewed frame constructor/equip/update paths |
| 010154 | Lieutenant Mantle | No individual particle in reviewed frame constructor/equip/update paths |
| 010155 | Union Field | No individual particle in reviewed frame constructor/equip/update paths |
| 010156 | Samurai Armor | No individual particle in reviewed frame constructor/equip/update paths |
| 010157 | Stealth Suit | Stealth visibility packets 0x7A/0x7B; not a particle emitter |
