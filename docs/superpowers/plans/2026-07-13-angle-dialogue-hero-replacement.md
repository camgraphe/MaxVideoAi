# Angle Dialogue Hero Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Angle landing hero’s cinema-camera packshot with four genuine, premium dialogue-coverage frames generated from one ImageGen source and the authenticated Angle tool.

**Architecture:** Keep the existing `ANGLE_ORBIT_ASSETS.hero` registry, four discrete view IDs, and `AngleOrbitStudio` client interaction unchanged. Overwrite only the four tracked hero WebPs, localize the view descriptions in EN/FR/ES, and preserve the stable social-image path so canonical, hreflang, schema, and metadata wiring do not move.

**Tech Stack:** Next.js App Router, React, TypeScript, localized JSON dictionaries, Next Image, built-in ImageGen, MaxVideoAI Qwen Multiple Angles, Sharp, Node test runner, browser screenshot automation.

## Global Constraints

- Work only on branch `codex/angle-search-growth`; do not merge or deploy to `main`.
- Preserve pointer drag, arrow buttons, keyboard navigation, reduced-motion behavior, image preloading, failed-image fallback, slider semantics, and live-region announcements.
- Generate one source image with ImageGen and create every alternate hero view with the authenticated Angle tool; do not use ImageGen as a substitute for an Angle output.
- Keep the two fictional adult actors’ identity, wardrobe, seating positions, eyelines, and hotel-bar environment consistent across all four frames.
- Preserve the 180-degree rule and make the field/reverse-field pair unmistakable.
- Replace the existing four hero files in place; do not add duplicate or orphan marketing assets.
- Use each published asset in one Angle-page section only.
- Keep all four public hero assets at `1600 × 1200`, WebP quality `82`, and below `500 KB` each.
- Preserve the current title, description, canonical URL, hreflang, JSON-LD, route paths, heading hierarchy, and stable social-image URL.
- Do not add autoplay, video, WebGL, a 3D dependency, or a new client component.
- Keep the user’s unrelated dirty files untouched.
- Capture before and after screenshots at the same `1440 × 1000` viewport.

---

## File Map

- Modify `frontend/messages/en.json` — English dialogue view labels, per-view alt text, and social-image alt text.
- Modify `frontend/messages/fr.json` — idiomatic French dialogue coverage labels and alt text.
- Modify `frontend/messages/es.json` — idiomatic Spanish dialogue coverage labels and alt text.
- Modify `tests/angle-orbit-assets.test.ts` — lock the four localized dialogue view IDs, labels, and removal of product-camera wording.
- Modify `frontend/public/assets/tools/angle-orbit-hero-source.webp` — source two-shot from ImageGen.
- Modify `frontend/public/assets/tools/angle-orbit-hero-45.webp` — accepted field/over-the-shoulder Angle output and initial hero/social frame.
- Modify `frontend/public/assets/tools/angle-orbit-hero-90.webp` — accepted reverse-field Angle output.
- Modify `frontend/public/assets/tools/angle-orbit-hero-elevated.webp` — accepted elevated Angle output.
- Modify `docs/seo/angle-orbit-visual-generation-log.md` — full prompt, settings, render URLs, rejection evidence, conversion audit, and screenshot evidence.
- Create only as ignored working evidence under `.superpowers/sdd/angle-hero-dialogue/` — accepted and rejected full-resolution generation files.
- Create only as visual QA output under `/Users/adrienmillot/.codex/visualizations/2026/07/13/019f5a77-03ca-7320-a5a4-a641aae33caf/` — matched before/after screenshots.

## Task 1: Lock and ship localized dialogue semantics

**Files:**
- Modify: `tests/angle-orbit-assets.test.ts`
- Modify: `frontend/messages/en.json:6570-6635`
- Modify: `frontend/messages/fr.json:6605-6670`
- Modify: `frontend/messages/es.json:6597-6662`

**Interfaces:**
- Consumes: `toolMarketing.angle.hero.orbit.views` and `toolMarketing.angle.meta.imageAlt` from each locale dictionary.
- Produces: four localized view objects with the unchanged IDs `front`, `threeQuarter`, `profile`, and `elevated` for `AngleOrbitStudio`.

- [ ] **Step 1: Add the failing localized dialogue contract**

Append this test to `tests/angle-orbit-assets.test.ts`:

```ts
test('Angle hero describes one localized dialogue coverage sequence', () => {
  const locales = [
    {
      path: 'frontend/messages/en.json',
      labels: ['Dialogue two-shot', 'Field on Actor B', 'Reverse on Actor A', 'Elevated dialogue view'],
      dialogue: /dialogue|conversation/i,
    },
    {
      path: 'frontend/messages/fr.json',
      labels: ['Plan à deux', 'Champ sur l’acteur B', 'Contrechamp sur l’actrice A', 'Plan dialogue surélevé'],
      dialogue: /dialogue|conversation/i,
    },
    {
      path: 'frontend/messages/es.json',
      labels: ['Plano de dos', 'Campo sobre el actor B', 'Contracampo sobre la actriz A', 'Plano alto del diálogo'],
      dialogue: /diálogo|conversación/i,
    },
  ] as const;

  for (const locale of locales) {
    const angle = JSON.parse(readFileSync(join(root, locale.path), 'utf8')).toolMarketing.angle;
    assert.deepEqual(angle.hero.orbit.views.map((view: { id: string }) => view.id), [
      'front',
      'threeQuarter',
      'profile',
      'elevated',
    ]);
    assert.deepEqual(angle.hero.orbit.views.map((view: { label: string }) => view.label), locale.labels);
    assert.match(angle.meta.imageAlt, locale.dialogue);
    for (const view of angle.hero.orbit.views as Array<{ alt: string }>) {
      assert.match(view.alt, locale.dialogue);
      assert.doesNotMatch(view.alt, /compact cinema camera|caméra de cinéma compacte|cámara de cine compacta/i);
    }
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-orbit-assets.test.ts
```

Expected: FAIL because the dictionaries still describe a compact cinema camera and their labels do not match the dialogue sequence.

- [ ] **Step 3: Replace the English orbit and social-image descriptions**

Keep the existing JSON structure and view IDs, but set the English values to:

```json
"imageAlt": "AI-generated over-the-shoulder camera angle from a cinematic two-actor dialogue.",
"views": [
  {
    "id": "front",
    "label": "Dialogue two-shot",
    "degreeLabel": "Source · Two-shot",
    "alt": "Source two-shot of two actors in conversation across a table in a contemporary hotel bar."
  },
  {
    "id": "threeQuarter",
    "label": "Field on Actor B",
    "degreeLabel": "Generated · Field",
    "alt": "AI-generated over-the-shoulder camera angle looking past Actor A toward Actor B in the same dialogue."
  },
  {
    "id": "profile",
    "label": "Reverse on Actor A",
    "degreeLabel": "Generated · Reverse",
    "alt": "AI-generated reverse over-the-shoulder camera angle looking past Actor B toward Actor A in the same dialogue."
  },
  {
    "id": "elevated",
    "label": "Elevated dialogue view",
    "degreeLabel": "Generated · High angle",
    "alt": "AI-generated elevated camera angle showing both actors and the hotel-bar setting during the same conversation."
  }
]
```

- [ ] **Step 4: Replace the French orbit and social-image descriptions**

Set the French values to:

```json
"imageAlt": "Champ par-dessus l’épaule généré par IA dans un dialogue cinématographique à deux acteurs.",
"views": [
  {
    "id": "front",
    "label": "Plan à deux",
    "degreeLabel": "Source · Face-à-face",
    "alt": "Plan source de deux acteurs en pleine conversation autour d’une table dans un bar d’hôtel contemporain."
  },
  {
    "id": "threeQuarter",
    "label": "Champ sur l’acteur B",
    "degreeLabel": "Généré · Champ",
    "alt": "Champ généré par IA par-dessus l’épaule de l’actrice A vers l’acteur B dans le même dialogue."
  },
  {
    "id": "profile",
    "label": "Contrechamp sur l’actrice A",
    "degreeLabel": "Généré · Contrechamp",
    "alt": "Contrechamp généré par IA par-dessus l’épaule de l’acteur B vers l’actrice A dans le même dialogue."
  },
  {
    "id": "elevated",
    "label": "Plan dialogue surélevé",
    "degreeLabel": "Généré · Plongée légère",
    "alt": "Angle surélevé généré par IA montrant les deux acteurs et le bar d’hôtel pendant la même conversation."
  }
]
```

- [ ] **Step 5: Replace the Spanish orbit and social-image descriptions**

Set the Spanish values to:

```json
"imageAlt": "Campo sobre el hombro generado por IA en un diálogo cinematográfico entre dos actores.",
"views": [
  {
    "id": "front",
    "label": "Plano de dos",
    "degreeLabel": "Fuente · Dos actores",
    "alt": "Plano fuente de dos actores en una conversación frente a frente en una mesa de un bar de hotel contemporáneo."
  },
  {
    "id": "threeQuarter",
    "label": "Campo sobre el actor B",
    "degreeLabel": "Generado · Campo",
    "alt": "Ángulo de cámara generado por IA sobre el hombro de la actriz A hacia el actor B en el mismo diálogo."
  },
  {
    "id": "profile",
    "label": "Contracampo sobre la actriz A",
    "degreeLabel": "Generado · Contracampo",
    "alt": "Contracampo generado por IA sobre el hombro del actor B hacia la actriz A en el mismo diálogo."
  },
  {
    "id": "elevated",
    "label": "Plano alto del diálogo",
    "degreeLabel": "Generado · Ángulo alto",
    "alt": "Ángulo alto generado por IA con los dos actores y el bar de hotel durante la misma conversación."
  }
]
```

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-orbit-assets.test.ts
```

Expected: both Angle asset tests PASS.

- [ ] **Step 7: Commit the localized dialogue contract**

```bash
git add tests/angle-orbit-assets.test.ts frontend/messages/en.json frontend/messages/fr.json frontend/messages/es.json
git commit -m "seo: describe angle dialogue coverage"
```

## Task 2: Produce and replace the four genuine dialogue assets

**Files:**
- Modify: `frontend/public/assets/tools/angle-orbit-hero-source.webp`
- Modify: `frontend/public/assets/tools/angle-orbit-hero-45.webp`
- Modify: `frontend/public/assets/tools/angle-orbit-hero-90.webp`
- Modify: `frontend/public/assets/tools/angle-orbit-hero-elevated.webp`
- Modify: `docs/seo/angle-orbit-visual-generation-log.md`
- Create ignored evidence: `.superpowers/sdd/angle-hero-dialogue/imagegen/accepted/source.png`
- Create ignored evidence: `.superpowers/sdd/angle-hero-dialogue/angle/accepted/{field,reverse,elevated}.png`
- Create rejected attempts only when needed: `.superpowers/sdd/angle-hero-dialogue/angle/rejected/*.png`

**Interfaces:**
- Consumes: the unchanged `ANGLE_ORBIT_ASSETS.hero` paths and the current initial view `threeQuarter`.
- Produces: four `1600 × 1200` WebPs that can replace the current hero without changes to `angle-landing-assets.ts`, the route metadata image URL, or `AngleOrbitStudio.client.tsx`.

- [ ] **Step 1: Capture the current packshot hero before any asset replacement**

Open `http://localhost:3000/tools/angle` at `1440 × 1000`, wait for fonts and the initial `threeQuarter` image, and save a full-page screenshot to:

```text
/Users/adrienmillot/.codex/visualizations/2026/07/13/019f5a77-03ca-7320-a5a4-a641aae33caf/angle-hero-dialogue-before.png
```

Expected: the initial hero shows the compact black cinema camera on the ivory plinth.

- [ ] **Step 2: Generate exactly one new source image with ImageGen**

Use this full prompt without adding text or logos:

```text
Use case: photorealistic-natural. Asset type: premium 4:3 landing-page hero source image demonstrating cinematic camera-angle generation through dialogue coverage. Primary request: create one coherent side-on master two-shot of two fictional adult actors in a quiet conversation, designed so later camera rotations can produce a clear field and reverse-field pair. Scene: a refined contemporary hotel bar at blue hour, warm amber practical lamps inside, large cool-blue window in the background, dark walnut and pale limestone materials, elegant but uncluttered, no signage and no other people. Actor A: adult woman seated screen-left, chin-length dark wavy hair, burnt-sienna tailored jacket over an ivory blouse, calm focused expression. Actor B: adult man seated screen-right, short salt-and-pepper hair, deep teal tailored jacket over a charcoal shirt, calm focused expression. Blocking: actors sit opposite each other at a small round dark-walnut table, bodies and faces in readable three-quarter profile, matching eyelines, Actor A remains screen-left and Actor B screen-right, hands separated and resting naturally, two identical clear water glasses only. Style: premium contemporary cinematic editorial photography, natural skin texture, restrained color grade, realistic fabrics and architecture, sophisticated human drama rather than advertising. Composition: landscape 4:3, medium-wide waist-up two-shot, both complete heads and shoulders comfortably inside face-safe margins, actors occupy about 70 percent of the frame together, enough depth behind each shoulder for later over-the-shoulder views, 50 mm cinema lens character, no exaggerated bokeh. Lighting: soft warm key light on both faces balanced with cool blue-hour window light, luminous and readable rather than dark. Constraints: exactly two fictional adult people, stable neutral seated poses, no celebrity likeness, no waiter, no crowd, no extra limbs, no merged hands, no duplicate props, no alcohol branding, no logo, no text, no watermark, no production equipment, no product packshot, no surreal geometry.
```

Save the accepted raw generation to `.superpowers/sdd/angle-hero-dialogue/imagegen/accepted/source.png`. Reject it before Angle generation if faces, hands, eyelines, wardrobe, actor positions, table geometry, or the two-glass count are incorrect.

- [ ] **Step 3: Produce the field shot with the authenticated Angle tool**

Upload the accepted source to `/app/tools/angle`, choose `Qwen Multiple Angles`, disable multi-output, and make the first attempt with:

```text
rotation 55° · tilt 2° · zoom 1.5 · safe mode on
```

Accept only a close over-the-shoulder composition from behind Actor A toward Actor B that preserves both wardrobes, Actor B’s face, Actor A’s shoulder silhouette, table, glasses, window, and light direction. If the viewpoint is too frontal, retry at `65° / 2° / 1.6`; if identity drifts, retry the better rotation once at the same settings. Save the accepted full-resolution download as `.superpowers/sdd/angle-hero-dialogue/angle/accepted/field.png` and preserve rejected downloads with descriptive filenames.

- [ ] **Step 4: Produce the reverse shot with the authenticated Angle tool**

Re-upload the same accepted source and make the first Qwen attempt with:

```text
rotation 305° · tilt 2° · zoom 1.5 · safe mode on
```

Accept only a reverse over-the-shoulder composition from behind Actor B toward Actor A with matching eyelines and stable scene direction. If the viewpoint is too frontal, retry at `295° / 2° / 1.6`; if identity drifts, retry the better rotation once at the same settings. Save the accepted full-resolution download as `.superpowers/sdd/angle-hero-dialogue/angle/accepted/reverse.png` and preserve rejected downloads with descriptive filenames.

- [ ] **Step 5: Produce the elevated dialogue view with the authenticated Angle tool**

Re-upload the same accepted source and make the first Qwen attempt with:

```text
rotation 25° · tilt 18° · zoom 1.25 · safe mode on
```

Accept only a visibly elevated three-quarter view that still includes both actors, the round table, two glasses, and recognizable hotel-bar architecture. If the elevation is weak, retry at `25° / 22° / 1.25`; if identity or table geometry drifts, retry at `20° / 15° / 1.3`. Save the accepted full-resolution download as `.superpowers/sdd/angle-hero-dialogue/angle/accepted/elevated.png` and preserve rejected downloads with descriptive filenames.

- [ ] **Step 6: Audit all four full-resolution frames together**

Open the source, field, reverse, and elevated files at original detail. Reject any set containing face drift, changed hair, wardrobe mutations, actor-side reversal, mismatched eyelines, extra or missing glasses, merged hands, distorted furniture, new signage, text artifacts, or a crop that would cut a face in the existing 4:3 hero viewport.

- [ ] **Step 7: Convert and overwrite only the four stable public paths**

From `frontend/`, use the installed Sharp runtime to resize with cover-safe 4:3 framing and encode WebP quality `82`:

```bash
node --input-type=module -e "import sharp from 'sharp'; const pairs=[['../.superpowers/sdd/angle-hero-dialogue/imagegen/accepted/source.png','public/assets/tools/angle-orbit-hero-source.webp'],['../.superpowers/sdd/angle-hero-dialogue/angle/accepted/field.png','public/assets/tools/angle-orbit-hero-45.webp'],['../.superpowers/sdd/angle-hero-dialogue/angle/accepted/reverse.png','public/assets/tools/angle-orbit-hero-90.webp'],['../.superpowers/sdd/angle-hero-dialogue/angle/accepted/elevated.png','public/assets/tools/angle-orbit-hero-elevated.webp']]; for (const [input,output] of pairs) await sharp(input).resize(1600,1200,{fit:'cover',position:'attention'}).webp({quality:82}).toFile(output+'.next'); for (const [,output] of pairs) { const fs=await import('node:fs/promises'); await fs.rename(output+'.next',output); }"
```

Expected: exactly the four existing hero files change; `angle-landing-assets.ts` and the other eleven Angle assets remain byte-for-byte untouched.

- [ ] **Step 8: Record generation provenance and rejected attempts**

Append a dated `Hero dialogue replacement` section to `docs/seo/angle-orbit-visual-generation-log.md` containing the full ImageGen prompt, accepted raw path, every Angle attempt’s engine/settings/latency/cost/render URL/status, accepted full-resolution paths, public filenames, dimensions, bytes, and rejection reasons. Update the introduction so it states that the published hero source is the approved dialogue replacement.

- [ ] **Step 9: Verify asset integrity and image budgets**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-orbit-assets.test.ts
npm --prefix frontend run audit:images
git diff --check
```

Expected: both Angle asset tests PASS; the audit reports the four hero files at `1600 × 1200` and below `500 KB`; `git diff --check` exits zero.

- [ ] **Step 10: Commit the genuine dialogue visual replacement**

```bash
git add frontend/public/assets/tools/angle-orbit-hero-source.webp frontend/public/assets/tools/angle-orbit-hero-45.webp frontend/public/assets/tools/angle-orbit-hero-90.webp frontend/public/assets/tools/angle-orbit-hero-elevated.webp docs/seo/angle-orbit-visual-generation-log.md
git commit -m "feat: replace angle hero with dialogue coverage"
```

## Task 3: Prove the interaction, localized routes, and visual result

**Files:**
- Modify: `docs/seo/angle-orbit-visual-generation-log.md`
- Create QA output: `/Users/adrienmillot/.codex/visualizations/2026/07/13/019f5a77-03ca-7320-a5a4-a641aae33caf/angle-hero-dialogue-after.png`

**Interfaces:**
- Consumes: the committed localized dictionaries and four stable hero asset URLs.
- Produces: matched visual evidence and a logged three-locale interaction smoke test without changing the hero component contract.

- [ ] **Step 1: Ensure the local server serves the current branch**

Run `curl -I http://localhost:3000/tools/angle`. If it does not return an HTTP response, start `npm --prefix frontend run dev` and keep the server session alive.

- [ ] **Step 2: Capture the matched after screenshot**

Open `http://localhost:3000/tools/angle` at `1440 × 1000`, wait for fonts and the initial `threeQuarter` field image, and save a full-page screenshot to:

```text
/Users/adrienmillot/.codex/visualizations/2026/07/13/019f5a77-03ca-7320-a5a4-a641aae33caf/angle-hero-dialogue-after.png
```

Compare it with the before screenshot at the same viewport. Expected: layout, typography, CTA, and hero-card geometry remain stable while the camera packshot is replaced by the premium field shot.

- [ ] **Step 3: Smoke-test all four EN views**

On `/tools/angle`, verify the initial label is `Field on Actor B`; use both arrow buttons to reach all four labels; use ArrowLeft and ArrowRight while the slider is focused; drag horizontally beyond the 64 px threshold in both directions; confirm the live-region text changes and no image fails to load.

- [ ] **Step 4: Smoke-test French and Spanish output**

Open `/fr/outils/angle` and verify `Champ sur l’acteur B`, `Contrechamp sur l’actrice A`, and the French drag instruction. Open `/es/herramientas/angle` and verify `Campo sobre el actor B`, `Contracampo sobre la actriz A`, and the Spanish drag instruction. Confirm the four frames are identical across locales and that no untranslated English orbit label appears.

- [ ] **Step 5: Run focused and repository validation**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-orbit-assets.test.ts tests/angle-orbit-state.test.ts tests/tool-marketing-landing-architecture.test.ts
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: all focused tests PASS, lint commands exit zero, and no whitespace error is reported.

- [ ] **Step 6: Record QA evidence and commit the final log**

Append the before/after absolute screenshot paths, viewport, EN/FR/ES routes, interaction methods, and validation command outcomes to the generation log. Then commit only the log if this step adds new evidence:

```bash
git add docs/seo/angle-orbit-visual-generation-log.md
git commit -m "docs: record angle dialogue hero qa"
```

- [ ] **Step 7: Verify branch hygiene**

Run:

```bash
git branch --show-current
git status --short
git log --oneline -5
```

Expected: branch is `codex/angle-search-growth`; only the user’s pre-existing unrelated files remain dirty; the dialogue copy, visual replacement, and QA evidence commits are present; no merge or deployment occurred.
