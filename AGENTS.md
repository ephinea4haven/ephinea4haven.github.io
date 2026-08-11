# Engineering Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in working end-to-end layers. Add each new capability on top of a product that already works; never trade a working product for unfinished complexity.
- Keep components modular, with concerns and ownership clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Check the dependencies already in the project, along with their documentation and types, before implementing common functionality or adding packages.
- Keep scope small without knowingly choosing disposable architecture. Make architectural decisions for the long term; do not accept stopgaps that are already expected to be replaced.
- For significant product or architectural decisions, study how established products solve the problem and adopt proven patterns and conventions instead of inventing a custom approach without a clear reason.

# Git Workflow

- This is a single-maintainer repository.
- By default, commit directly to `master` and push to `origin/master`.
- Do not create feature branches or pull requests unless the user explicitly requests them.
