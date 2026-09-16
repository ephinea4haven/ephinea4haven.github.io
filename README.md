# Haven PSOBB Wiki

A multilingual wiki for *Phantasy Star Online: Blue Burst* players worldwide,
focused on the [Ephinea](https://ephinea.pioneer2.net/) community server.
Maintained by the Haven guild and open to everyone, it supports English, Japanese
and Chinese.

**Live site:** [www.psohaven.com](https://www.psohaven.com)

The site covers onboarding and client setup, drop tables, quest and RBR rotation
guides, seasonal events, item and monster catalogs, damage formulas, and
character-planning tools such as the stat simulator and combo calculator.

Language coverage varies by page and feature; support for three languages does
not mean every guide or source excerpt has been translated into all three.

## Architecture at a glance

- **Angular 22, statically deployed.** Every public page is an Angular route,
  prerendered at build time and served from GitHub Pages. There is no backend and
  no server-side rewriting.
- **Stable URLs.** Historical `.html` paths are part of the product contract; the
  build installs each prerendered route at its original location.
- **Content as HTML sources.** Guides and reference pages live as plain HTML under
  `guide/`, `data/`, `event/` and `tools/`. They contain markup and styles only;
  all behavior is owned by Angular.
- **Data-driven pages.** Item names, the monster bestiary, RBR rotations and event
  milestones are generated from committed datasets and upstream authorities rather
  than edited by hand.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

## Repository layout

| Path | Contents |
|---|---|
| `index.html`, `404.html` | Landing and error page sources |
| `guide/`, `data/`, `event/`, `tools/` | Content page sources, served at their historical paths |
| `src/app/` | Angular bootstrap, routing, shared shell and interactive features |
| `content/` | Curated catalog facts, provenance and challenge-map data |
| `assets/` | Stylesheets, fonts, images and build-time data |
| `scripts/` | Generators, upstream synchronizers, verifiers and the site build |
| `tests/e2e/` | Playwright browser and accessibility tests |
| `third_party/` | Licenses and provenance for synchronized upstream code |
| `docs/` | Architecture, deployment records and domain contracts |

## Getting started

### Prerequisites

- Node.js 24 and npm
- Python 3, for the data generators and their tests
- To regenerate challenge maps only: the [`potrace`](https://potrace.sourceforge.net)
  binary on `PATH`, `pip install -r scripts/requirements-maps.txt`, and
  `npx playwright install chromium` for `scripts/render_challenge_maps.mjs`
- A checkout of [`warmonipa/dropcharts`](https://github.com/warmonipa/dropcharts)
  next to this repository. Its `i18n_names.json` is the sole authority for Chinese
  item names. To use a different location, set `DROPTABLE_I18N_AUTHORITY` to the
  file's path.

```text
parent/
├── droptable/                     # warmonipa/dropcharts
│   └── i18n_names.json
└── ephinea4haven.github.io/       # this repository
```

### Install and run

```bash
npm ci
npx playwright install chromium   # browser tests and map preview rendering
npm run dev                       # build, then serve _site at http://127.0.0.1:5173
```

`npm run dev` performs a full production build rather than running a watch
server, so rerun it after changing sources.

## Common tasks

| Command | Purpose |
|---|---|
| `npm run build` | Generate, prerender, validate and atomically publish `_site` |
| `npm run preview` | Serve the existing `_site` at `http://127.0.0.1:4173` |
| `npm test` | Run data, localization, architecture and domain checks |
| `npm run test:e2e` | Run the Playwright suite against the production build |
| `npm run release:prepare` | Run all checks, the build and the browser suite in sequence |
| `npm run sync:i18n` | Regenerate site item names from the drop-table authority |
| `npm run sync:combo` | Refresh the combo calculator from its pinned upstream |
| `npm run sync:anniversary` | Refresh the anniversary milestone snapshot |
| `npm run generate:challenge-maps` | Regenerate the Episode I SVG maps |
| `npm run generate:challenge-maps:ep2` | Regenerate the Episode II SVG maps |
| `npm run test:challenge-maps` | Check the EP1 map JSON structure |
| `npm run test:launcher-guide` | Check launcher settings descriptions, native screenshots and guide links |

[`scripts/README.md`](scripts/README.md) describes every generator and verifier.

## Deployment

Every push to `master` runs the **Verify and deploy Pages** workflow. It installs
locked dependencies, audits them, runs the business tests, builds the site twice
to confirm the output is reproducible, runs the browser suite, and only then
deploys the exact artifact it tested. Pull requests run the same checks without
deploying.

Release history and verification notes are kept in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Contributing

- **Localization.** Translate the in-game concept, not the dictionary meaning of
  individual words. Follow
  [`docs/PSOBB_CHINESE_LOCALIZATION.md`](docs/PSOBB_CHINESE_LOCALIZATION.md), and
  never introduce a page-local item name; update the drop-table authority and run
  `npm run sync:i18n` instead.
- **No page scripts.** Content sources must not contain `<script>` tags or inline
  event handlers. Add behavior through an Angular directive or component; the
  architecture verifier rejects anything else.
- **No compatibility layers.** Remove obsolete paths outright. Git history is the
  rollback mechanism.
- **Validate before publishing.** Run `npm run release:prepare` locally before
  pushing to `master`.

Engineering principles and repository workflow are defined in
[`AGENTS.md`](AGENTS.md).

## Further reading

- [Architecture](docs/ARCHITECTURE.md)
- [Angular migration record](docs/ANGULAR_MIGRATION.md)
- [Item catalog](docs/ITEM_CATALOG.md) and [monster catalog](docs/MONSTER_CATALOG.md)
- [Mechanics guide illustrations and review record](docs/MECHANICS_VISUAL_EVIDENCE.md)
- [Launcher settings guide](guide/launcher.html) and [native screenshot evidence and review record](docs/EPHINEA_LAUNCHER_EVIDENCE.md)
- [Challenge-map implementation, generation and remaining work](docs/CHALLENGE_MAP_REDRAW.md)
- [Combo calculator synchronization](docs/SOP_COMBO_CALCULATOR_SYNC.md)
- [RBR data workflow](scripts/RBR_DATA.md)
- [Roadmap](docs/TODO.md)

## Community

Players from every country and community are welcome. Guild membership is not
required to use the wiki. To connect with Haven, join the guild's QQ group:
**956652396**.

## Acknowledgements

*Phantasy Star Online* is a trademark of SEGA. This is an unofficial,
community-run project and is not affiliated with SEGA or the Ephinea staff.

The combo calculator is synchronized from
[phelix-/psostats-client](https://github.com/phelix-/psostats-client) under the
MIT License; see [`third_party/psostats-combo/`](third_party/psostats-combo/).
Game data and descriptions draw on the
[Ephinea Wiki](https://wiki.pioneer2.net/).
