# Armor particle source audit

These files are **client source textures**, not item appearance screenshots. The
Destiny `particleentry.dat` and `effect_nt.xvm` from the installed `data.gsl`
determine their pixels. The renderer interpretation below comes from the stock
`Psobb.exe` with SHA-256 recorded in `texture-manifest.json`; the packed Destiny
executable has not been proven to have identical rendering code or metadata.

| Armor | PMT group | Particle ID | Record name | XVM texture ID/index | Renderer | Frames |
| --- | ---: | ---: | --- | --- | --- | ---: |
| FLAME GARMENT | `0x2e` | `0x22` | `gifeio_hatudou` | `750071` / 42 | 3 | 16, 4×4 atlas |
| LUMINOUS FIELD | `0x2b` | `0x11b` | `core_hamon` | `700531` / 9 | 3 | 1 |
| AURA FIELD | `0x31` | `0xe1` | `bm4_tamasii` | `700460` / 5 | 4 | 1 |
| GUARD WAVE | `0x29` | `0xe0` | `bm4_nodam` | `700511` / 35 | 3 | 1 |
| DF FIELD | `0x2a` | `0x32` | `anti_karadahika` | `700460` / 5 | 4 | 1 |
| BRIGHTNESS CIRCLE | `0x30` | `0xb0` | `gate_circle` | `700531` / 9 | 3 | 1 |
| ELECTRO FRAME | `0x32` | `0x106` | `bm7_gattai` | `750061` / 47 | 4 | 16, 4×4 atlas |
| SACRED CLOTH | `0x33` | `0x192` | `barta_lv1kira` | `700431` / 21 | 4 | 1 |
| SMOKING PLATE | `0x34` | `0x1bc` | `gsmoke` | `700201` / 41 | 3 | 16, 4×4 atlas |
| WEDDING DRESS | `0x3e` | `0x192` | `barta_lv1kira` | `700431` / 21 | 4 | 1 |
| DRESS PLATE | `0x44` | `0x1be` | `heart01` | `750801` / 52 | 3 | 1 |
| LOVE HEART | `0x2d` | `0x1be` | `heart01` | `750801` / 52 | 3 | 1 |
| SWEETHEART | `0x45` | `0x1be` | `heart01` | `750801` / 52 | 3 | 1 |

The original nine armor PMT records have `flags_type=2`. In the stock client,
`ArmorFrameParticleEffectInit` selects the particle ID by armor group;
`BarrierCountdownHelperEffectConstructor_005e0d58` invokes the equip handler,
then `InitializeParticleEffect_005e0ee8` periodically creates that particle
effect at the player's position. `create_particle_effect4` indexes the 152-byte
`particleentry.dat` record, and the single-particle constructor resolves its
`texture_id` against `effect_nt.xvm`.

The stock client's `effect_nt_metadata` starts at virtual address `0xa101c0`
with 40-byte entries. Twelve use a 16×16 half-size camera-facing sprite; GUARD
WAVE uses 32×32. All except SMOKING PLATE use source-alpha/one additive
blending (`unknown_renderstate_blend_save` → blend selector 8/10 →
`D3DBLEND_SRCALPHA`/`D3DBLEND_ONE`). Renderer 4 also rotates
the sprite by the particle angle. All single-frame entries use UV `[0,0,1,1]`.
`BossUI_ParticleRenderer_InitializeGlobalData_00801638` generates each atlas's
sixteen 0.25×0.25 UV rectangles in row-major order.

BRIGHTNESS CIRCLE, ELECTRO FRAME, SACRED CLOTH, SMOKING PLATE and the four
added armors have
`particle_type=1`, so they use the separate `simulate_type1.py` path. SMOKING
PLATE has metadata flag 2, selecting source-alpha/inverse-source-alpha
blending instead of additive source-alpha/one blending.

The runtime effect is a sequence of spawned particles rather than one static
model. The constructor samples RNG for spawn coordinates, scale, velocity and
angle (a zero variation field makes the corresponding coordinate fixed);
the update loop uses time, the player position, camera distance and perspective.
A composite image can be reconstructed by choosing a fixed frame, camera,
player origin and RNG seed, then following the spawn/update code. Those inputs
must be recorded with any result, which should be labeled as an offline static
effect preview until compared with a Destiny runtime capture. The decoded
texture PNGs alone must not be labeled as the equipped armor's full appearance.

Run `uv run python extract_effect_textures.py` from this directory to regenerate
the PNGs and manifest. The script asserts each stock renderer entry and records
SHA-256 hashes for the exact source records, texture payloads and PNGs.

Wedding Dress's group `0x3e` is explicitly routed by `init_item_armor_frame`
to `ArmorFrameParticleEffectInit`. The latter reads the stock executable's
`0x92d1a4` table entry, verified as particle `0x192` and cycle mode 2.
`on_equip_armor` routes groups `0x2d`, `0x44` and `0x45` to
`InitializeLoveHeartEffect_005cbf28`. `UpdateLoveHeartEffect_005cbf54` checks
its timer, map/floor and nearby players before calling `create_particle_effect`
with `0x1be` at the weapon position. This constructor sets emitter field
`+0x34` to 1; `update_particle_effect` retires it after the first update while
its particles survive. The offline heart previews therefore use one burst,
not a continuously emitting aura. They do not reproduce the gameplay trigger.

`uv run python render_all_previews.py` regenerates the thirteen 800×800 offline
effect images and `render-manifest.json`. Each preview uses seed `0x51bb`, the
40th frame (20th for the heart burst), player origin `(0,0,0)`, a 30° downward
camera, and source renderer size/blend/UV rules. The camera distance is selected
to contain each effect's particles; this is a documented viewing choice. The
images all retain alpha, with no baked-in background. SMOKING PLATE keeps
source-over alpha, including black pixels. For additive effects the renderer
stores clamped emitted RGB as premultiplied color, chooses alpha=max(RGB), and
unpremultiplies for PNG storage. Consumers use `mix-blend-mode: plus-lighter`
to restore additive display; ordinary alpha display would darken the backdrop.
`transparentBackground` and `displayBlend` record this contract in the manifest.
These images omit the character model and have not been compared with Destiny
runtime output. The shared source inventory includes BB armors absent from
Destiny's item list; the Destiny exporter only includes its own named items.
