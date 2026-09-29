# Destiny ItemKT image export

These PNGs are decoded directly from the two copied Destiny AFS archives, in **archive entry order**. They are trimmed preview textures. The numeric entry label is an AFS index, not an item code or PMT ID.

| Archive | SHA-256 | Entries | Decoded PNGs | Contact sheet |
| --- | --- | ---: | ---: | --- |
| `ItemKT.afs` | `497d84515052abf3d678efb6f795cc7a70065cb1f023ea117d12eab61001e902` | 448 | 448 | `ItemKT-contact-sheet.png` |
| `ItemKTep4.afs` | `a41e53c406a3335a3495f1369c203280953da386dc8fb317f96b03187dab53b1` | 505 | 504 | `ItemKTep4-contact-sheet.png` |

`manifest.json` records every AFS entry's index, offset, size and payload SHA-256; every decoded PNG has a relative path, dimensions and SHA-256. `ItemKTep4.afs` entry 45 did not decode with the existing tool. It starts with `ff58564d` (`0xff` followed by `XVM`), unlike the recognized containers. It remains explicitly listed in the manifest with no image.

From the repository root, regenerate the images with the existing decoder and then rebuild the manifest and contact sheets:

```sh
rtk python3 /Users/wangzhen/study/gc-psov3/tools/dolphin-re/dump_item_textures.py artifacts/destiny/resources/originals/ItemKT.afs --limit 10000 -o artifacts/destiny/resources/itemkt-images/ItemKT --trim
rtk python3 /Users/wangzhen/study/gc-psov3/tools/dolphin-re/dump_item_textures.py artifacts/destiny/resources/originals/ItemKTep4.afs --limit 10000 -o artifacts/destiny/resources/itemkt-images/ItemKTep4 --trim
rtk python3 artifacts/destiny/resources/itemkt-images/build_manifest.py
```

The first decoder must report 448 decoded blocks and the second 504. The manifest builder checks archive hashes against `../inventory.json` and verifies each PNG. Code-to-entry mapping requires separate client evidence; it is not inferred from archive order or PMT `skin` values here.
