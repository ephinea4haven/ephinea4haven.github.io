# Destiny ItemPMT parameter export

`records.json` is a read-only export of the local Destiny Blue Burst `ItemPMT.prs` capture. It is a parameter table, **not** a drop table: it contains no enemy, quest, section ID, rate, or source assignment. Item names are also absent; join them from the matching Destiny text resource after verifying its identity.

## Provenance and format

- Source: `/Users/wangzhen/study/psobb-sniffers/data/captures/param_dumps_destiny/ItemPMT.prs`
- Source size: 26,152 bytes; SHA-256 `5104ab3a43d147b5c0894c66cb58a5304396a26069550b8de15560bf0a5bfbbd`.
- PRS payload: 96,704 bytes; SHA-256 `96e3e8f3b4668d4e63bf434b24fac908775f3a3d701d0d38f88876a88a57dd73`.
- Interpretation: PSO Blue Burst V4, little endian. The footer and index layout validate against the BB V4 layout in `../ItemPMT` and newserv's `ItemParameterTable` implementation. The file has 314 delta entries, 238 weapon subcategories, and 27 tool subcategories.
- Decompression was independently checked with `../newserv/build/newserv decompress-prs`; its payload SHA-256 matches the exporter's PRS decompressor.

## Coverage and field meanings

The export contains 1,756 parameter records: 1,007 weapons, 117 armor, 216 shields, 139 units, 83 mags, and 194 tools. The project `FirstSystemParser` and `SecondSystemParser` agree on every exported record's bytes and file offset. `ItemPMTVerifier` reports 13 passed / 0 failed, including combination, event, unsealable, ranged special, mag feed, and pointer tables. Auxiliary tables were validated but are outside this record-focused JSON.

`code` is six uppercase hexadecimal digits representing the three item-code bytes. For weapons and tools, the third byte indexes a record within its subcategory; armor, shield, and unit use their respective subcategory and record index. Mag codes use the second byte to identify the PMT record and the third byte for color/variation. Mag rows therefore show a representative `02XX00` code and `code_match: first_two_bytes`; other rows use `code_match: exact`. This follows `ItemCodeUtils.resolveItemId` in the existing ItemPMT project.

`pmt_id`, `type`, `skin`, and `team_points` are the BB V4 record header fields. `parameters` follows the existing Java model's primitive fields. Java `byte` and `short` fields can appear negative in that object; use `raw_hex` for exact unsigned or signed interpretation. `file_offset` is relative to the decompressed payload. Repeated PMT IDs are present, so use item code and family when joining records; do not assume the PMT ID is unique.

## Regeneration

From the wiki repository root, with `../ItemPMT/target/classes` available:

```sh
rtk java --class-path ../ItemPMT/target/classes artifacts/destiny/pmt/ExportDestinyPmt.java \
  /Users/wangzhen/study/psobb-sniffers/data/captures/param_dumps_destiny/ItemPMT.prs \
  artifacts/destiny/pmt/records.json
```

The exporter reads the source only and writes the requested JSON. Its structural bounds, category counts, and cross-parser checks fail closed if this capture does not match the expected BB V4 layout.
