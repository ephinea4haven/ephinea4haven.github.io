# Destiny client category-art audit

`audit.json` covers the 317 drop names without a mapped item image at the time of the recorded `missing-image-audit.json` snapshot. Its item family is included only when that name has exactly one PMT code candidate; an ambiguous name has no assigned family. **No inspected atlas has a verified item-category image**, so `categoryImage` is null for every row. Regenerate with:

```sh
rtk python3 artifacts/destiny/resources/category-images/build_audit.py
```

The original installed Destiny `data.gsl` has SHA-256 `043a6e96a04756ea9a373f2c9758d5ce7d1f90c6158b23b198e8f9942e74c229`; the read-only copy at `/Users/wangzhen/study/bb-psov4/ref/destiny_psobb_assets/original/data/data.gsl` matches it. Its `f256_uniticon.prs`, `infoicon.xvm`, and `itemmagedit.prs` members are in `sources/`. The first PRS expands to a 256×256 multiplayer menu atlas, containing MU labels and player symbols. `infoicon.xvm` contains two 64×64 save-slot notices. `itemmagedit.prs` decompresses to 1,792 bytes of non-XVM table data. The installed client's `texturejapanese.xvm` and `ccconsole_j.xvm` are also in `sources/`; the former contains menu text, the latter character creation graphics. Decoded atlas PNGs and `atlas-contact.png` permit visual review.

`../originals/item.bml` contains 35 named resources, including `ixm_box*.xj` ground-pickup models, scanner and bullet effects. In the local client decompilation, `get_item_bml_data` chooses an NJCM model and NJTL texture using item state; `render_item_box` draws that model. These are shared world box appearances, not unique images for Trimate, grinders, materials, units or armor. No exact category-to-box choice has been proven here, so none is assigned to a drop name.

The local DestinyReader static-analysis note lists ten embedded `assets/icon*.png` paths used by that companion overlay. Its executable and unpacked image resources were not found in the available local artifacts or installed game directory. Their picture contents and category mapping therefore remain unverified; they are not counted as client images.

Code evidence: `/Users/wangzhen/study/original-psobb-client-source/src/Psobb.exe-05112026.c`, functions `get_item_bml_data`, `render_item_box`, and `SetItemState_005c3e3c`; BML layout `/Users/wangzhen/study/newserv/src/BMLArchive.cc`. Decoding uses `/Users/wangzhen/study/gc-psov3/tools/dolphin-re/xvm_dump.py`.
