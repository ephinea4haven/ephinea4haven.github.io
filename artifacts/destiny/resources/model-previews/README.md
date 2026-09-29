# Destiny model preview resources

`jobs.json` contains 37 dropped weapon/shield preview jobs whose model and texture archive entries were extracted, PRS-decompressed and signature checked. The paired `.xj` and `.xvm` files are in `assets/`; `assets-manifest.json` records their exact source archive, entry, compressed and decompressed sizes, and SHA-256 hashes. `resource_verified: true` means the archive slots and XJ/XVM signatures were validated. `visual_qa` starts as `pending` until the rendered PNG is reviewed.

The 37 jobs comprise seven weapons with an unusable ItemKT image, 20 shields with no ItemKT client branch, and ten weapons whose unresolved local Unitxt text uniquely matches a website name and all six comparable numeric PMT parameters. Those ten carry `source_status: website_parameter_correlated_candidate`. [name-candidates.json](name-candidates.json) lists all 16 such website correlations, including six items absent from the drop list. This is a reviewable association, not proof of the runtime display name.

Fifteen additional dropped shields are listed in `jobs.json.excluded`: their PMT `type` and `skin` are both `65535`, so adding the shield offsets yields out-of-range slots. No visible model/texture pair was inferred for them.

The resource slot rule is documented in `/Users/wangzhen/study/bb-psov4/ref/custom_item_assets/WORKFLOW.md`: weapon model=`type`, texture=`skin`; shield model=`type+354`, texture=`skin+378`. The source archives are the unchanged Destiny copies under `../originals/`.

From the repository root, regenerate candidate evidence and extract jobs with:

```sh
rtk python3 artifacts/destiny/resources/model-previews/audit_candidates.py
rtk python3 artifacts/destiny/resources/model-previews/prepare_jobs.py
```

`prepare_jobs.py` checks both archive hashes against `../inventory.json` and validates decompressed model (`NJTL`/`NJCM`) and texture (`XVMH`) signatures. It does not render or publish images. The renderer consumes `jobs.json` and should mark `visual_qa` only after checking the PNGs.

## Textured renderer and QA

Run `rtk python3 artifacts/destiny/resources/model-previews/render_jobs.py artifacts/destiny/resources/model-previews/jobs.json` from the repository root. The batch runner skips rejected jobs, calls Blender on each remaining verified model/texture pair, and checks that each result is an RGBA PNG. `make_contact_sheet.py` combines all 37 jobs with names and explicit placeholders for rejected previews. Thirty-six jobs are marked `visual_qa: passed`; Red Ring remains rejected with its source-alpha limitation in `jobs.json`.

The renderer uses the XJ UVs and decoded XVM pixels without a V flip, matching the `pso-blender` XJ importer (`xj.py` pixel assignment near line 835 and UV assignment near line 1022). Run `rtk python3 artifacts/destiny/resources/model-previews/verify_uv_orientation.py` to reproduce a non-symmetric Ill Gill Reaper sample: raw UV `(0.6739, 0.577)` reads `(1.0, 0.588, 0.839, 1.0)`, while a V-flipped lookup reads black. DXT2 textures are converted from premultiplied RGB before Blender applies them.

Blender 5.2's `ShaderNodeVertexColor` read the generated color layer as black despite correct mesh values. `ShaderNodeAttribute` with `attribute_name = "vertex_color"` reads the source colors correctly. `check_render_colors.py` is a focused regression check for the resulting Rupika and Ill Gill Reaper renders: it checks that enough opaque pixels retain visible color. Ordinary textured primitives require source UVs; truly untextured primitives render from source vertex and diffuse color.

`model_adapters.py` follows root-level sibling pointers that the upstream `psomodel` parser rejects; Skyfall has five root nodes and Stormrender has two. Orotiagito and Gal Wind each have an identical second NJCM chunk (`60414c72499df870` SHA-256 prefix) containing a projectile/effect; `primary_model_only` keeps only the first, item-shaped NJCM chunk for their static previews. XJ state 7/1 generates texture coordinates from source vertex normals transformed to camera space, following [Microsoft's Direct3D definition](https://learn.microsoft.com/en-us/windows/win32/direct3d9/automatically-generated-texture-coordinates). XJ blend indices 4/1 are SRCALPHA/ONE in the `pso-blender` enum; additive layers transmit the surface behind them. This reveals Custom Barrier's face and Honeycomb's colored cells without masking their base geometry.

Cycles writes the additive color of a transparent surface with alpha zero, which browsers would hide. After rendering, the script gives each such pixel the minimum representable alpha (`max(RGB)`) and scales its straight RGB by that alpha, preserving its color over black and making it visible on the site's dark background. A static transparent PNG cannot reproduce the game's additive response against every possible background; this is a preview approximation. Check the contact sheet composited onto the site's background, since a black RGB viewer can display color hidden under alpha zero.

Run `verify_special_models.py`, `verify_uv_orientation.py`, `check_render_colors.py`, and `verify_render_alpha.py` from the repository root after rendering. Produce the web-background QA sheet with `rtk python3 artifacts/destiny/resources/model-previews/make_contact_sheet.py artifacts/destiny/resources/model-previews/jobs.json artifacts/destiny/resources/model-previews/contact-sheet-site.png --site-background`.

Red Ring's first texture is opaque DXT1 (all 1,024 pixels have alpha 1) and its base primitive has fully opaque source vertex alpha. Its current flat plate is not a faithful standalone preview of the expected translucent ring, so the job stays rejected. No alpha mask was fabricated from color.

The model parser identifies the actual container format from its chunks; a `.xj` filename can hold an NJ model. Both XJ and NJ parse into the same model representation used by this renderer. Three Seals was confirmed as NJ by `read_model` and visually reviewed after rendering its complete textured geometry.
