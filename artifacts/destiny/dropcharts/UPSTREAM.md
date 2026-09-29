# Upstream viewer

The shared viewer, styles, translations and Section ID artwork are based on
[warmonipa/dropcharts](https://github.com/warmonipa/dropcharts). The reference
checkout inspected during archive preparation was
`e743232af6839d14bcf2829bb9fbfb6fa72535e2`.
The copied viewer includes local Destiny support and image provenance captions.
The ISC notice is retained in [LICENSE](LICENSE).

Only Destiny preview assets and the Section ID artwork are retained here;
stock-server item pictures and machine-specific fixture symlinks are excluded.
The optional cross-version tests read their data from a sibling `droptable`
checkout. The copied JavaScript and CSS are isolated research assets, not
public Angular application code.
