# Type 1 armor particles: offline source audit

`simulate_type1.py` produces fixed-seed, fixed-frame candidates from the
installed Destiny `particleentry.dat`. It does not reproduce a Destiny runtime
capture, the player model, entity movement, camera culling, or competing calls
to the client's global RNG.

The stock PSOBB executable dispatch table at file offset `0x5b94f8` contains
`0x0050ebd0` for type 0 and `0x005083ec` for type 1 (`+8` bytes). The latter
calls `ParticleEffectInstanceConstructor_005101b8` through
`ParticleEffectInitialize_005083ec` (decompiled C lines 287430–287447).
The emitter dispatch is at C lines 288165–288330. The type 1 constructor,
update, and render paths are at C lines 292849–292940, 292307–292695, and
292719–292817. `particle_effect_single_particle_Constructor_00508460`
(C lines 287483–287545) initializes common fade and texture state.

The ordinary type 1 constructor samples coordinates over `origin ± variation`,
scale over `scale_x + rand*scale_y`, angular speed from
`vacume + rand*opt5`, vertical speed from `gravity + rand*opt2`, and orbit
radius from `radius + rand*opt1`. Its lifetime is
`trunc(duration + rand*appear)` frames, unless texture flag 1 substitutes the
texture frame count. Each update advances a 16-bit angle by
`trunc(angular_speed*65536/360)`, places the sprite on an XZ circle around its
sampled center, increases vertical offset, multiplies scale by `scale_z`,
advances the texture frame, and applies color and fade. Color is calculated
from the previous age while frame selection uses the new age. Type 1 interprets
record offsets `+0x50`, `+0x38`, `+0x3c` as RGB slopes; the field names
`gamma`, `speed_x`, `cr_rt` are inherited from the type 0 interpretation.
The renderer changes width and height by `1 ± opt4*cos(secondary_angle)`.

The stock PE confirms the constants: RNG divisor 32768, position bias -0.5,
position range multiplier 2, angle circle 65536, degrees per turn 360, and
color quantizer 254. These values describe the stock renderer; the packed
Destiny executable has not been shown to use identical code.

| Armor | Particle ID | Record | Texture ID | XVM index | Stock renderer | Frames | `effect_nt` flags |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| BRIGHTNESS CIRCLE | `0xb0` | `gate_circle` | 700531 | 9 | 3 | 1 | 1 |
| ELECTRO FRAME | `0x106` | `bm7_gattai` | 750061 | 47 | 4 | 16 | 1 |
| SACRED CLOTH | `0x192` | `barta_lv1kira` | 700431 | 21 | 4 | 1 | 1 |
| SMOKING PLATE | `0x1bc` | `gsmoke` | 700201 | 41 | 3 | 16 | 2 |

The XVM indices and renderer metadata were read from Destiny `effect_nt.xvm`
and the stock PE renderer table at virtual address `0xa101c0` with 40-byte
entries. All four renderer entries have sprite half-size 16×16. The 16-frame
textures are 128×128 atlases of 32×32 cells.

The type 0 simulator's cadence, RNG generator, output shape, and static
renderer can be reused. Its spawn displacement, velocity update, and color
slopes cannot: type 0 particles move by velocity, while type 1 particles orbit
their sampled centers and interpret several record fields differently.
