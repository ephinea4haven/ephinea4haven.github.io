# Destiny shared pickup-box previews

These PNGs are renders of the actual models and textures in the installed Destiny client's `item.bml` (SHA-256 `195aad4d282ce5569aecb9e6639cf8daaa6730b4ff9add637709c43677c96a1e`). They represent **shared ground pickup boxes**, not unique artwork for a weapon, armor, unit, Mag or tool. `manifest.json` supplies `entries[]` with family, image, SHA-256, caption, and source evidence. An `unknown` family uses one real red box as a generic specimen and explicitly leaves its category unconfirmed.

The BML has 35 entries. Its payload begins at `0x1000` after the 35-entry table. The last stream is complete but the archive omits five bytes of final alignment padding; parsers assuming a fixed `0x800` payload start or requiring final alignment fail. The first BML member supplies a 40-texture XVM for all five box models. Some contiguous XVRT chunks are not 64-byte aligned, so `build_assets.py` adds only zero alignment padding, adjusts chunk lengths, verifies every texture payload hash and rechecks the result with `xvm_inspect.parse_xvm`. It does not alter model geometry or texture pixel data.

The original Blue Burst client reads `g_ItemStateTable_0092BB88 = [0,1,1,2,3]` for item group bytes `0..4`; `get_item_bml_data(state)` then selects BML model chunk `state + 2`. The `is_rare_weapon` check overrides the state to `4` when the calculated star value is at least 9. Thus the ordinary base categories are orange weapon, blue armor/shield/unit/Mag, green tool, yellow Meseta; red is the rare override. These code bytes were read from the original-client Ghidra archive using `ReadItemState.java`, and the corresponding five XJ models were extracted from Destiny `item.bml`. The Destiny executable's runtime selection table has not been independently located, so the manifest marks that limit explicitly. Family fallback art illustrates the **nonrare base** category and should not claim the displayed box color is the item's exact runtime appearance.

Rebuild and render from the repository root:

```sh
rtk python3 artifacts/destiny/resources/category-previews/build_assets.py
for state in 0 1 2 3 4; do
  rtk env BLENDER_GPU_BACKEND=OPENGL blender -b --python-exit-code 1 \
    --python artifacts/destiny/resources/category-previews/render_category.py -- \
    artifacts/destiny/resources/category-previews/assets/box-state-${state}.xj \
    artifacts/destiny/resources/category-previews/assets/shared-textures.xvm \
    artifacts/destiny/resources/category-previews/box-state-${state}.png \
    --size 600 --samples 32
done
rtk python3 artifacts/destiny/resources/category-previews/build_manifest.py
```

The OpenGL backend selection avoids a Blender 5.2 Metal startup crash observed on this host. The rendered PNGs were visually inspected: all five are visible, textured and have transparent backgrounds.
