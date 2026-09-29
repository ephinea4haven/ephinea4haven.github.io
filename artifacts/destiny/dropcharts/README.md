# Destiny drop chart preview

From the repository root, serve the checked-in preview with
`rtk node scripts/serve_site.mjs artifacts/destiny/dropcharts 18770`, then open
<http://127.0.0.1:18770/destiny/>. Generate its data with
`rtk node artifacts/destiny/build-viewer-data.mjs`. This is a repository research
preview; it is not included in `_site/` or the public navigation. The checked-in
preview can be served without the original Destiny client files. Full image
rerendering requires local original client binaries and unpacked resources,
which, along with experimental render caches, are Git-ignored.

The data file assigns `window.DROP_DATA_EN` in the existing drop chart schema:

```js
window.DROP_DATA_EN = {
  sectionIds: ['Viridia', 'Greenill', 'Skyly', 'Bluefull', 'Purplenum',
    'Pinkal', 'Redria', 'Oran', 'Yellowboze', 'Whitill'],
  sectionColors: ['#00A562', '#76FE43', '#59F9F9', '#4488FF', '#CC00FF',
    '#FF87CB', '#F70F0F', '#F7830F', '#F7F715', '#FFFFFF'],
  data: {
    Normal: {monsters: {'Episode 1': [], 'Episode 2': [], 'Episode 4': []}},
    Hard: {monsters: {'Episode 1': [], 'Episode 2': [], 'Episode 4': []}},
    'Very Hard': {monsters: {'Episode 1': [], 'Episode 2': [], 'Episode 4': []}},
    Ultimate: {monsters: {'Episode 1': [], 'Episode 2': [], 'Episode 4': []}}
  }
};
```

Each monster entry is `{name, dropRate, drops}`. `drops` contains exactly ten
cells in Section ID order. A cell is `{item, rate}` or `{items: [{item, rate},
...]}` if the source lists multiple drops. Use `null` for absent items and for
rates the Destiny source does not provide. Keep `dropRate` as the source DAR
string, including `"0%"` when the source explicitly states zero; use `null`
when the DAR is absent. Preserve unresolved source strings such as `"1/???"`
and `"???"` for auditability. The viewer displays them, and present items with
`rate: null`, as “Rate unavailable”. The rate toggle converts valid fraction
strings such as `"1/100"` to percent; source percentage strings remain
percentages in both modes.

Only English is enabled. There are no box tables or Ephinea item/monster Wiki
links. Destiny item previews use only exact names in
`destiny/images/mapping.json`, whose values are image filenames in that same
directory; an unmapped item has no preview. The shared stock mapping is never
used for Destiny. The image gallery is at `destiny/images.html`. Of 517 distinct
drop names, 271 have an item-specific or variant preview, including nine armor
particle previews without a character model. The other 246 have labeled shared
category art, which does not count as an item-specific preview. See
`destiny/images/coverage.json` for the current breakdown and image provenance.
Section ID artwork comes from the copied upstream assets.
Monsters without a verified area are labeled “Area not specified” while their
source order is preserved. The copied viewer and styles are isolated in this
preview and do not change the existing site.

Run portable Destiny viewer and gallery checks with `rtk npm run test:destiny`.
For BB/DC/NGC regression checks, run `rtk npm run test:destiny:upstream` with
the sibling `../droptable` checkout present; the tests read its fixtures directly.
No personal absolute-path symlinks are part of the preview package.
