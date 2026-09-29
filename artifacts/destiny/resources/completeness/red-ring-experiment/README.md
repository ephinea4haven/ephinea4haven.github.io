# Red Ring source-material experiment

This experiment uses Destiny's extracted `ItemModelEp4.afs` slot 354 and
`ItemTextureEp4.afs` slot 378, already retained as `model_354.xj` and
`texture_378.xvm` under `../../model-previews/assets/`. It does not modify the
published gallery or shared renderer.

The four `*-source.png` images were generated at 800×800 with the unmodified
`render_textured.py` and their exact source and PNG hashes are in
`source-manifest.json`. Regenerate the manifest with
`rtk python3 artifacts/destiny/resources/completeness/red-ring-experiment/write_manifest.py`.
These are static client-resource previews; their runtime appearance remains
unverified.

`render_culled.py` separately tests one-sided rendering by discarding back
faces when the parsed material says `double_sided=False`. This is **not**
proven XJ source state: the XJ parser leaves the IR's default `False` value,
and the client explicitly changes D3D cull mode around some unrelated model
draws. Its output must not be treated as a faithful client render. Reproduce
the experiment:

```sh
rtk blender -b -t 4 --python artifacts/destiny/resources/completeness/red-ring-experiment/render_culled.py -- artifacts/destiny/resources/model-previews/assets/model_354.xj artifacts/destiny/resources/model-previews/assets/texture_378.xvm artifacts/destiny/resources/completeness/red-ring-experiment/red-ring-culled.png --size 400 --samples 16
```

The experimental culling removes the visible back/bottom plane from the unculled render,
but the front and sides remain opaque. Primitive 0 has source blend 4/5
(`SRCALPHA`/`INVSRCALPHA`), alpha use disabled, fully opaque vertex colors and
an opaque DXT1 texture. Primitive 1 is additive 4/1, while primitive 2 is
additive with source vertex alpha 102/255. No alpha mask was inferred from
RGB. The `*-source.png` previews retain the real opaque faces and source
colors; their match to in-game appearance has not been established.

The stock PSOBB client PE at `/Users/wangzhen/study/PSOBB-Haven/Psobb.exe`
matches addresses in the local decompilation. For Red Ring, its
`ConstructArmorBarrierEffect_005e192b` sets helper vtables at `0xb0f2d8`
and `0xb0f2f0`. Their action callbacks are `0x5e5dc8` (passive HP restore)
and `0x5e5de0` (another player restore call), respectively. Those helpers
do not construct a graphic particle. The colored-ring emitter uses tables
at `0x92c060` (`[-1, 0x1be, 0x1bf, 0x91, 0x20, 0x1a0, 0x1a1, 0xb1]`) and
`0x92c040` (`[1, 1, 1, 0, 1, 0, 0, 0]`), indexed by
`(group_idx - 0x53) & 7`. Anti-Dark Ring (`0x73`) and Anti-Light Ring
(`0x7b`) both select index 0, whose particle ID is `-1`; Molten Ring
(`0xa9`) does not enter this branch. This verifies only the examined stock
client. The Destiny executable is available at
`artifacts/destiny/resources/originals/psobbw.exe` (SHA-256
`b444294b65715af4a335ac9e6a54cdd8e06e9be27e84a51e6a628655e85ccfb3`),
but it is UPX packed: the code/data sections have zero raw bytes and the
entry point is in `.UPX2`. The stock PE callback tables therefore cannot be
assumed to match Destiny runtime behavior without unpacking and checking it.

The extracted `rico_ring.bml` is loaded by `LoadQuestLoadingScreenBML` for a
quest loading screen. It is unrelated to the equipped Red Ring model.
