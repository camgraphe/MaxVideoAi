# Narrower video gallery rail — 2026-10-29

The development preview gives more horizontal space to the composer by reducing the video rail from 240 / 272 / 320 px to 216 / 240 / 280 px at the existing 768 / 900 / 1088 px breakpoints (10–12.5%). The rail and Activity / Recents navigation share `--app-creation-rail-width`, scoped to creation pages with both the preview topbar and video results rail. Original widths remain as fallbacks; the mobile layout and other workspaces retain their existing sizing.

This is a CSS sizing change. Card controls, scrolling, media loading, the player and generation behavior keep their existing owners. At the live 1072 px viewport, the central column increased from 702 to 734 px and the composer from 654 to 686 px. The player remained 583.109 × 327.992 px; it simply recentered. The additional width let the current footer fit on one row.

Live checks at 768, 900 and 1440 px confirmed matching rail/header edges, visible Activity / Recents / View all controls and no card or page horizontal overflow. At 390 px the rail retained its full-width mobile layout. The temporary viewport override was reset. The command-bar browser tests, gallery architecture checks and desktop hydration contract pass (6 tests); `git diff --check` passes.

Private comparison images in the task visualization directory: `gallery-rail-before-narrow.png` and `gallery-rail-narrow.png`. No assets, prompt, model or generation settings were changed during verification.
