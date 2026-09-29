# Remaining Destiny model previews

This directory contains source-preserving recovery evidence for M&A85 Fury, Last Emperor, Twin Cyclone, and Judgement Blade. `source-manifest.json` binds each archive slot to its exact AFS and PRS SHA-256. The transparent `*-candidate.png` files are the images intended for the drop viewer; `*-site.png` composites the same pixels over the viewer's `#1a1a2e` background for visual QA. `manifest.json` binds each candidate image to its exact source and renderer hashes. The item-name association is the separately documented six-parameter Unitxt/website correlation, not proof of a runtime name.

Run from the repository root:

```sh
rtk python3 artifacts/destiny/resources/completeness/render-fixes/prepare_candidates.py
rtk python3 artifacts/destiny/resources/completeness/render-fixes/inspect_models.py
rtk python3 artifacts/destiny/resources/completeness/render-fixes/prepare_last_emperor_xvm.py
rtk python3 artifacts/destiny/resources/completeness/render-fixes/prepare_twin_xvm.py
rtk python3 artifacts/destiny/resources/completeness/render-fixes/render_candidates.py
rtk python3 artifacts/destiny/resources/completeness/render-fixes/write_manifest.py
```

M&A85 Fury's XJ node graph has four complete root meshes. Its optional POF0 table incorrectly tags two index-buffer data fields as relocated pointers, so the strict `psomodel` container audit fails on values `0x02840284` and `0x02870285`. `render_relocated.py` bypasses only that optional audit; the normal XJ reader still checks every node, mesh, vertex, state, and index pointer that it follows. `inspect_models.py` proves where those two fields lie. The same mechanism affects Judgement Blade (three POF0 entries point into vertex data), and the recovered preview now renders its client model through the same checked reader. No website screenshot is used.

Last Emperor's source XVM declares two complete XVRT chunks followed by a terminal `ffff` outside the declared chunks. The [pso-blender XVM reader](https://github.com/jtuu/pso-blender/blob/master/pso_blender/xvm.py) iterates the declared XVR count and does not treat trailing bytes as another texture. `prepare_last_emperor_xvm.py` exposes those exact two chunks to the stricter preview renderer and records all byte ranges in `last-emperor-xvm-audit.json`; no header or texture payload byte changes.

Twin Cyclone's source PRS ends at an opcode boundary without an explicit stop marker. The existing `bb-psov4` bounded decoder reports `input_end` after producing a complete XVMH/XVRT container plus one extra byte. `prepare_twin_xvm.py` extracts only the declared complete container, with no guessed compressed or texture bytes, and records the stop state and hashes in `twin-xvm-audit.json`. The source model contains two root meshes at the same static origin; in-game equipped transforms may separate them. Its static preview passed visual review on the site's background; its runtime pose remains unverified.

Four rings have opaque surfaces in the source XJ/XVM material data. The earlier claim that their static previews were invalid because separate runtime ring effects were missing was not established: Red Ring's examined stock-client helper callbacks are attribute restoration, not graphics. Their current raw source-material previews are documented in `../red-ring-experiment/README.md` and approved as static resource views with runtime appearance explicitly unverified. No inferred alpha mask, culling override, or website screenshot is used.
