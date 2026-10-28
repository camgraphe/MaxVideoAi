# Refinement 4 — first integration in the app

2026-10-28. Draft PR #555. **Local development sample only; no live Milo call or credit charge.**

The approved interaction now renders inside the actual video/image Composer and audio editor. Prompt remains available for manual editing. The conversation has its own scroll area and a clearly labelled Message Milo input. Suggested text starts collapsed to two lines; Use prompt / Use script stays outside the expanded editor and the transcript. The full text can be applied and undone while the draft is unchanged.

References reuse the app's real inventory. The plus is unboxed, filenames are absent from the compact row, thumbnails are 32 px, and controls retain comfortable targets. Settings use a subtle fill and stronger text. A single thin outer input focus border replaces the doubled outline seen during the first app check.

## Checks and evidence

- The authenticated `/app`, `/app/image` and `/app/audio` routes were opened locally with the actual sidebar, controls and results. Video uses Seedance 2.5, image Seedream, and audio Eleven v4. The audio sample offers Use script. No Generate action was clicked.
- Five real-component fixture widths: 320, 390, 768, 1024 and 1440 px; 1024 uses a 600 px height. Reduced motion is enabled; the mobile capture uses dark theme. Ten exchanges, independent transcript overflow, focus return, collapsed/full text, application/undo and zero generation are checked.
- The Kling fixture applies 2,400 characters within that model's 2,500-character limit. The reducer test separately preserves 4,000 characters. We did not raise or bypass an engine limit to obtain a screenshot.
- Replacing references invalidates the suggestion. Switching audio intent retires a pending response. Voice application/undo preserves music style, lyrics, model and reference; Audio 1 focuses Message Milo without changing speech.
- Production-mode rendering does not expose the simulated assistant. The development-only gate also rejects an enabled flag in production at the reducer boundary.

Publicly safe screenshots use synthetic media in the real components, not the user's wallet or generation history: [desktop](evidence/refinement-4/composer-1440.png), [390 px](evidence/refinement-4/composer-390.png). The private authenticated app screenshot was kept locally outside Git. Previous design: [revision 3](REFINEMENT-3.md).

## Final review and verification

One independent whole-branch review identified missing video-context inputs, the hidden Character library opener and the missing direct source entry point. Each regression was reproduced before correction. Video proposals and Undo now invalidate for subject/settings changes, including a value changed away and back; the compact inventory preserves field actions; Modify and Extend present their required source before either writing input.

Final focused suite: **107/107 passed**. Full production build, TypeScript, frontend lint, i18n parity and public-exposure checks passed. Lint retains seven existing warnings in unrelated Studio/billing files. The static DOM fixture loader was updated for the new CSS module; real browser fixtures continue loading product CSS. Required remote Quality CI remains a merge gate, not a claim made by these local checks.

## Seedance local environment

The apparent Seedance 2.5 regression came from missing local environment controls. Chat de Pilotage confirmed that the earlier correction targeted Vercel Preview and deliberately preserved local files. The six previously qualified non-secret controls were reconciled only in this worktree's ignored `.env.local`. The real local catalogue then reported all five modes available; the app removed its warnings and displayed Generate with a quote. No production setting, tariff, credential or provider job was changed.

## Limits

At this revision the sample conversation was labelled in the UI (revision 5 removes that visual-only label at the user’s request): it repeats the current draft or supplies fixed example text. It cannot demonstrate prompt quality, model specialization, credit consumption or persistence. Full service integration is the next increment in the same draft PR.

Physical mobile keyboard behavior and true 200% browser zoom have not been qualified in this pass. The whole app column still scrolls; Use prompt is independent of the prompt/transcript scroll areas, not fixed to the browser viewport. Audio soundtrack and lyrics assistance remain outside this first adapter. Existing provider mention numbering remains in place pending stable alias translation. See [engineering ownership](../../engineering/prompt-assistance.md).
