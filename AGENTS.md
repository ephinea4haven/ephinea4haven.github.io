# Engineering Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in working end-to-end layers. Add each new capability on top of a product that already works; never trade a working product for unfinished complexity.
- Keep components modular, with concerns and ownership clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Check the dependencies already in the project, along with their documentation and types, before implementing common functionality or adding packages.
- Keep scope small without knowingly choosing disposable architecture. Make architectural decisions for the long term; do not accept stopgaps that are already expected to be replaced.
- For significant product or architectural decisions, study how established products solve the problem and adopt proven patterns and conventions instead of inventing a custom approach without a clear reason.

# Chinese Localization

- Treat PSOBB as the mandatory context for every translation. Translate the in-game concept, mechanic, item, or player action—not isolated English words.
- Do not accept literal wording that is unnatural or changes the PSOBB meaning. Inspect the source page, the feature's actual behavior, and the maintained Chinese client terminology before choosing a translation.
- Follow [`docs/PSOBB_CHINESE_LOCALIZATION.md`](docs/PSOBB_CHINESE_LOCALIZATION.md) as the repository localization standard. Apply its evidence order, terminology rules, and consistency checks to all new or revised Chinese content.
- Before writing or changing any item name, look up its exact English identity in the drop-table authority at `../droptable/i18n_names.json`. Site item names must match that authority and be regenerated with `npm run sync:i18n`; do not create page-local alternative translations.
- When a term is ambiguous, keep the verified English identifier temporarily and investigate; never invent a Chinese translation from the dictionary meaning alone.

# Git Workflow

- This is a single-maintainer repository.
- By default, commit directly to `master` and push to `origin/master`.
- Do not create feature branches or pull requests unless the user explicitly requests them.
