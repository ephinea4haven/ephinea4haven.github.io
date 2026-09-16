# Ephinea launcher guide evidence

Scope: `guide/launcher.html`, checked on 2026-09-16. The page is Chinese with
English UI labels. Screenshots show the Windows application running in
Parallels Desktop, not Wine rendering.

## Executables and interpretation

- Launcher version: 3.5.2.0.
- SHA-256: `a8ae2aa8a0af475b41eb131cfe58f2a68a75aa74ac22c96a8577d7e2d86b9a83`.
- The supplied macOS app's `Contents/SharedSupport/prefix/drive_c/EphineaPSO/online.exe`
  and the PD copy at `C:\Users\wangzhen\EphineaPSO\online.exe` have the same hash.
- ILSpy extraction of `online.exe`: `online/MainWindow.cs`, `Nutella.cs`,
  embedded language strings, and `mainwindow.baml`. This establishes UI
  controls, visibility dependencies, configuration ranges, and save behavior.
- `option.exe`: `Option/optionsdialog.cs` and native module code establish
  preset values, original detail settings, font enumeration, and Save/Cancel.
- Game-side effects are explained using launcher tooltips and the official
  announcements linked next to the relevant sections. This work did not
  perform in-game validation of every effect or renderer combination.

Important code checks in `MainWindow.cs`:

- `WriteRegistry` writes the launcher configuration; `ReadRegistry` loads it.
  Use these defaults rather than static `Nutella` field initializers.
- `Options_Btn_Click` only switches visibility. START GAME, QUIT and MORE
  write settings. MORE starts `option.exe` and closes the launcher.
- REVERT calls `ReadRegistry` and refreshes the controls.
- RESET ALL assigns a subset of settings. It omits later fields including
  several bank/menu, XInput and camera-key options; it is not a complete reset.
  It resets the in-memory language to English; persistence happens through a
  subsequent save operation. User language changes themselves save and update.
- `Primitive_Scale_Slider_Changed` writes `PrimitiveScaleMultiplier`, saved as
  `PRIMITIVE_SCALE`. Rain/Laser Scale is visibly present on page 1.
- `HandleVisibility_CameraKeys` depends on `CameraControl > 0`; key fields also
  require camera keys to be enabled. XInput and pickup/PB controls likewise
  expose dependent controls conditionally.
- Old labels alone do not establish visible controls: SLOT strings and
  CHARACTER_BANK persistence remain, but the photographed main window has no
  slot selector. PHONG SHADING, ENABLE ALT+ENTER, SW VIDEO DECODE and USE FLIP
  MODEL are not listed as current visible settings.
- SAVE PARTY INFO was initially a placeholder; the August 1, 2026 official
  announcement says the feature is enabled. Do not reuse the older claim.

## Native screenshot capture

The user requested PD-native English screenshots. Existing reliable workflow:
`../psobb-addons/docs/ephinea-quest-translation-backlog.md`, section describing
the verified 2026-08-14 automation path, and
`../psobb-addons/diagnostics/control_ephinea_ui.ps1`.

1. Obtain the actual launcher PID using `prlctl exec 'Windows 11' --current-user`.
   Without `--current-user`, process inspection returned a zero main-window
   handle even though the window was visible.
2. Use the helper's Windows UI Automation `InvokePattern` with `OPTIONS` and
   `NEXT__SPACE__PAGE`. Host coordinate clicks moved the cursor but failed to
   operate the launcher in this session.
3. Capture using `prlctl capture 'Windows 11' --file ...` after the transition
   has completed. A capture can return an all-black transitional frame;
   inspect the result and recapture rather than accepting file creation alone.
4. MORE opens a separate WinForms application. Its buttons were not exposed
   to the helper's UIA search here. Activating the option process and sending
   Escape returned to the launcher without saving changes in that window.
5. Crop only the application rectangle using Pillow. No rendering, relabeling,
   retouching, or reconstruction was applied to the screenshots.

Source screenshots were 3024 × 1822 pixels. Crops use left/top/right/bottom:

| Assets | Rectangle | Output |
| --- | --- | --- |
| `main.png`, `page1.png` … `page5.png` | 712, 264, 2312, 1464 | 1600 × 1200 |
| `more.png` | 916, 574, 2108, 1144 | 1192 × 570 |

Assets reside in `assets/img/launcher/`. No game was started, no credentials
were entered, and no settings switches were changed for these captures.
MORE performs its normal save of the current launcher configuration. The
user's CUSTOM resource selection and English labels were preserved.

## Review-fix ledger (2026-09-16)

Scope: the entire new launcher page, its stylesheet and seven screenshots,
home/graphics-guide entry links, source evidence, and generated route. Existing
project-identity edits on the home page and other unrelated work are excluded.

### Iteration 1 — consolidated findings

| ID | Severity / status | Root cause and expanded scope | Regression / closure evidence |
| --- | --- | --- | --- |
| LG-001 | Should-fix / Fixed | UI labels were interpreted without enough behavioral evidence. NO MINIMAP SCALE was described as preserving the HUD box size; the May 12/22, 2022 announcements describe internal map zoom and icon scaling. CLASSIC INTRO FMV was described as a playback on/off switch, while the September 3, 2022 staff reply distinguishes the original PAE player from the newer movie-player path. Rechecked all option descriptions against tooltips, read/write handlers and linked announcements. | Both descriptions now explain the actual distinction and link the primary sources. The two semantic regression cases failed on the original page and pass after correction (`npm run test:launcher-guide`). |
| LG-002 | Should-fix / Fixed | RESET ALL documentation did not distinguish in-memory reset from persistence and omitted resetting Language to English. Expanded scope to REVERT, language changes, OPTIONS, START GAME, QUIT, MORE and original option.exe Save/Cancel. `Set_Defaults_Btn_Click` sets `Nutella.Language = 0` and calls `InitWindows`, without `WriteRegistry`; `Lang_Box_Select` saves on user language changes. | The page now explains unsaved reset state, English/CUSTOM consequences, and language-switch save/update behavior. The reset/lifecycle regression case failed before the correction and passes (`npm run test:launcher-guide`). |
| LG-003 | Should-fix / Fixed | New evidence documentation was silently excluded by the repository's docs allowlist. `git check-ignore -v docs/EPHINEA_LAUNCHER_EVIDENCE.md` identified `.gitignore:24:docs/*`. Without a rule change, a normal acceptance commit would omit the provenance and reusable capture method. Expanded scope to the ledger and guide assets. | Added one narrow exception to the existing docs allowlist. The real `git check-ignore --no-index --quiet` regression failed before the fix and passes afterward. Seven PNG dimensions, full-size links, local anchors and both entry points also pass (`npm run test:launcher-guide`: 6/6). |

Sources for LG-001:

- [May 12, 2022 — high-resolution HUD changes and staff explanation](https://www.pioneer2.net/community/threads/dll-update-for-may-12th-2022-dllアップデート.23143/).
- [May 22, 2022 — NO_MINIMAP_SCALE added](https://www.pioneer2.net/community/threads/server-maintenance-completed-for-may-22nd-at-00-00-utc-サーバメンテナンス完了.23197/).
- [September 3, 2022 — Classic Intro FMV player distinction](https://www.pioneer2.net/community/threads/no-episode-2-end-credits-on-classic.24232/post-190564).

No game settings or VM state need to be changed for this review.

Iteration 1 verification: the new suite reproduced four failures on the original
page/ignore rules; the screenshot and local-link cases already passed. After
the fixes, all six cases pass. The suite is included in `npm test`.

### Iteration 2 — convergence

Fresh full-scope review found no remaining Blocking or Should-fix findings.
Reviewed the final page and stylesheet, all seven image assets, the two entry
links, generator handling of passive HTML/styles/anchors, test integration,
ignore exception and this evidence file. Unchanged surrounding launcher
controls were checked against the extracted labels/tooltips and save handlers;
option.exe preset and Cancel/Save behavior were also checked. The static text
contracts guard the corrected statements; they do not simulate game behavior.

Observed validation:

- `npm run test:launcher-guide`: 6 passed; before fixes the four relevant
  regression cases failed, while the image and link cases passed.
- `npm run test:graphics-guide`: passed.
- `node scripts/verify_angular_architecture.mjs`: passed, 107 HTML sources.
- `node scripts/verify_zh_localization.mjs`: passed.
- `npm run build`: passed, 1,268 prerendered routes, 45 event fragments,
  JavaScript gzip 948,789 / 1,000,000 bytes.
- `git diff --check`: passed.
- A local Pillow `ImageChops.difference` check compared all seven PNGs against
  their recorded rectangles in the original PD captures: exact pixel equality.
- Browser review of the new build: all six chapter links reached the intended
  headings, all seven images loaded, no console errors or horizontal overflow.
  At a 320 px viewport the corrected table text remained within the page;
  the normal viewport was restored afterward.

Final verdict: PASS. No live game-effect matrix was run. No VM settings were
changed in this review; no commit, push, or deployment was performed. This is a
scoped guide review, not a release audit of unrelated repository changes.

## Final review and acceptance (2026-09-16)

A fresh read-only final review found no new Blocking or Should-fix issues.
The six launcher checks, graphics-guide contract, Angular architecture check,
Chinese localization check and `git diff --check` passed again. All seven
published-build image files matched the source assets, and every source asset
matched the recorded native capture rectangle pixel for pixel. The generated
route contained the corrected minimap, intro-player and reset descriptions.

After reviewing that result, the maintainer explicitly authorized documentation
alignment, commit and push. This authorization is separate from the earlier
review verdict. The submission includes the launcher guide, its assets, links,
tests and maintenance documentation. After the maintainer asked about the
earlier README wording, the scope also includes the coordinated multilingual
project positioning in the README, homepage and project documents, together
with the updated roadmap organization. Production status must be checked
against the Pages workflow for the pushed commit, not inferred from local
validation.

### Pre-push release verification

The local release stages passed: complete `npm test`, `npm run build`
(1,268 routes, 45 fragments, 948,789 / 1,000,000 gzip JavaScript bytes), and
all 1,430 Playwright tests. The build and browser stage were rerun outside the
sandbox after an Angular subprocess SIGABRT and a denied local server bind
(`listen EPERM`), respectively.

The first browser run passed 1,429 tests and failed the existing monster
detail reload-anchor assertion. Focused repetition then exposed an immediate
post-click position assertion racing the component's `afterRenderEffect`.
That assertion now polls for the same less-than-60-pixel condition; no product
code or tolerance changed. The focused scenario passed ten consecutive runs,
and the complete suite then passed 1,430/1,430. The original reload-only failure
did not recur; its log, trace and context were retained locally under
`/tmp/launcher-release-first-failure`. If it recurs, investigate reload scroll
restoration separately rather than assuming the polling correction fixes it.
