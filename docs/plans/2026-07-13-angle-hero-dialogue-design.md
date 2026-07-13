# Angle Hero Dialogue — Design Specification

## Objective

Replace the current cinema-camera packshot in the public Angle landing-page hero with a premium, immediately understandable shot/reverse-shot demonstration. Preserve the existing draggable four-view interaction and make the visual itself explain that Angle can create new camera coverage from one source image.

## Approved Creative Direction

The scene is a refined two-actor dialogue in a contemporary hotel bar at blue hour. Warm practical lighting inside contrasts with a cool blue window view. The visual language is cinematic and editorial, but bright enough to remain legible inside the light hero card.

The actors sit opposite each other at a small table. They have clearly different silhouettes, wardrobe colors, hairstyles, and positions so that identity and screen direction remain easy to track between generated angles. The frame contains no brand, readable text, production equipment, or product packshot.

## Four-View Story

The current orbit interaction and asset slots remain unchanged:

1. `front` — a balanced two-shot establishing both actors, the table, and their eyelines.
2. `threeQuarter` — an over-the-shoulder shot from Actor A toward Actor B.
3. `profile` — the reverse over-the-shoulder shot from Actor B toward Actor A.
4. `elevated` — a restrained high three-quarter establishing view of both actors and the bar environment.

Dragging horizontally moves through these four views. Each frame must feel like coverage of the same conversation, not a different scene or a simple object orbit.

The existing initial state remains `threeQuarter`, so the first visible hero frame is the over-the-shoulder shot toward Actor B. The balanced source two-shot is revealed through the first drag or previous-angle control. This also makes the social preview, which points to the `45` asset, a human-led cinematic frame.

## Visual Continuity Constraints

- Keep both actor identities, age range, wardrobe, hair, seating positions, and table props stable.
- Preserve the 180-degree rule: Actor A remains screen-left in the master, while matching eyelines and shoulder direction make the two singles read as a coherent field/reverse field pair.
- Use one restrained prop at most, such as two identical water glasses, to provide continuity without distracting from the faces.
- Keep skin texture natural, expressions subtle, and body language conversational.
- Avoid merged hands, duplicate props, face drift, wardrobe mutations, floating objects, distorted furniture, or inconsistent window architecture.
- Maintain a landscape composition suitable for the existing `object-cover` hero viewport, with face-safe margins on desktop and mobile crops.

## Asset Production

1. Generate one new high-quality source scene with ImageGen.
2. Use the actual Angle tool to create the three alternate camera views from that source.
3. Review all four frames together for identity, wardrobe, screen direction, eyelines, lighting, and crop consistency.
4. Reject and regenerate any angle that looks like an unrelated still or violates dialogue continuity.
5. Replace the four existing tracked hero asset files in place so no duplicate or orphan hero assets are introduced:
   - `angle-orbit-hero-source.webp`
   - `angle-orbit-hero-45.webp`
   - `angle-orbit-hero-90.webp`
   - `angle-orbit-hero-elevated.webp`

The hero must not reuse assets shown elsewhere on the Angle page.

## Copy, Localization, and SEO

Update the hero orbit labels and alternative text in English, French, and Spanish so they describe dialogue coverage rather than a camera product. The English wording should naturally support the page intent around changing a camera angle with AI; translations should remain idiomatic rather than literal keyword repetitions.

The page title, canonical URL, hreflang, schema, heading hierarchy, route, and social-image URL remain structurally unchanged. The social preview continues to reference the `45` asset path, which will now resolve to the new over-the-shoulder frame.

## Interaction and Accessibility

- Preserve pointer drag, arrow buttons, keyboard navigation, reduced-motion behavior, lazy preloading, and failed-image fallback logic.
- Preserve the existing slider semantics and live-region announcement.
- Update per-view accessible labels so the announced angle matches the visible dialogue shot.
- Do not add autoplay, video, WebGL, or a heavy 3D dependency.

## Validation

- Capture a desktop screenshot before replacement and a desktop screenshot after replacement at the same viewport.
- Smoke-test the hero on `/tools/angle`, `/fr/outils/angle`, and `/es/herramientas/angle`.
- Verify all four views by drag, buttons, and keyboard.
- Run the focused Angle orbit asset and marketing landing architecture tests.
- Run the relevant frontend lint, `git diff --check`, and confirm no unrelated user files were modified.

## Acceptance Criteria

- A first-time viewer understands that the image is being reframed into cinematic dialogue coverage.
- The result reads as premium editorial photography, not a generic AI image or product packshot.
- The two over-the-shoulder views form an unmistakable shot/reverse-shot pair.
- Actor identity and scene continuity remain convincing in all four frames.
- No hero asset is duplicated elsewhere on the page.
- The existing SEO and accessible interaction contracts remain intact.
