# Supplemental XVM validation

The original supplemental extractor rejected 11 resource pairs. `inspect_excluded.py` reads each AFS slot from the archived Destiny client files, verifies the recorded archive/member SHA-256 and PRS-decompresses it. Its byte-level results are in `excluded-structure.json`.

Seven texture archives have complete, bounded XVMH/XVRT chunks with valid dimensions and DXT formats. Their XVRT bodies are contiguous but some texture data is mipmapped and ends before a 64-byte boundary. Some files also have one or two zero bytes after the declared final chunk. The existing strict `xvm_inspect.parse_xvm` rejects these layouts. A scan of all 546 `ItemTextureEp4.afs` slots found 10 completely parsed archives with unaligned chunks and 13 with one or two zero trailing bytes; these layouts therefore occur beyond the reported items. [Phantasmal World's IFF parser](/Users/wangzhen/study/pso-assets/ref/phantasmal-world/psolib/src/commonMain/kotlin/world/phantasmal/psolib/fileFormats/Iff.kt) follows each declared chunk size and ignores fewer than eight trailing bytes. [pso-blender's XVM reader](/Users/wangzhen/study/pso-assets/ref/pso-blender/pso_blender/xvm.py) likewise advances by each chunk's declared size.

`normalize_xvm.py` writes only `normalized/texture_NNN.xvm` for those seven. It accepts bounded XVMH/XVRT chunks, zero internal padding, supported DXT formats and dimensions, and at most two **zero** terminal bytes. It adds only zero alignment bytes after a texture payload and updates that chunk's body size. It verifies each payload's SHA-256 before and after and validates the output with the unmodified strict parser. `normalization-report.json` records both source and normalized hashes and the exact changes. Reproduce with:

```sh
rtk python3 artifacts/destiny/resources/supplemental-render/inspect_excluded.py
rtk python3 artifacts/destiny/resources/supplemental-render/normalize_xvm.py
```

Four pairs remain excluded:

- `JUDGEMENT BLADE`: NJCM pointer at `0x13ab4` targets `0xbec01a37`, beyond its `0x149d8`-byte body.
- `M&A85 FURY`: NJCM pointer at `0x10c60` targets `0x2840284`, beyond its `0x115b8`-byte body.
- `LAST EMPEROR`: complete two-chunk XVM has a nonzero `ffff` trailer. It was not silently removed.
- `TWIN CYCLONE`: the texture PRS has no explicit end marker before the input ends. Both independent local PRS decoders fail (`IndexError` in the gc-psov3 decoder; `PrsError` in bb-psov4).

Normalization establishes a valid texture file, not a visually approved item image or runtime-confirmed item identity. Rendering and visual review are separate steps.
