# Seedance 2.5 marketing video launch design

**Date:** 2026-08-07

**Status:** approved creative direction; awaiting written-spec review before execution

**Owner:** MaxVideoAI product owner

**Operational source:** `docs/model-launch/seedance-2-5.md`

## Objective

Launch the Seedance 2.5 model page with a small, premium evidence pack rather
than a large gallery of weak clips. The first release uses two 24-second
cinematic hero videos. A third 15-second human-dialogue video is produced only
if the Seedance 2.5 audio path passes the same billing, polling, durable-storage,
and refund protections as the existing silent path.

The assets must visibly demonstrate long-form continuity, camera control,
large-object consistency, physical coherence, human performance, and dialogue.
They must look suitable for a flagship MaxVideoAI model page, not like low-cost
four-second canary outputs.

## Approved scope

### Included

- Two 24-second, 16:9, 720p, 24 FPS text-to-video hero generations.
- One optional 15-second, 16:9, 720p, 24 FPS text-to-video generation with two
  adult characters and short English dialogue.
- One initial take per concept.
- At most one selective content retry across the complete pack.
- MaxVideoAI durable storage for every accepted asset.
- Marketing-page incorporation using the established model-page templates.
- Curation into the Seedance 2.5 example playlist after acceptance.
- Postproduction captions, restrained sound finishing where appropriate, and a
  4K delivery upscale if desired. Any upscale must be described as finishing,
  not native 4K generation.
- QA evidence recorded in the Seedance 2.5 launch packet.

### Excluded

- 480p marketing generations.
- More than three launch concepts.
- Automatic variations or unattended retries.
- Generated logos, product labels, subtitles, or interface text.
- Public claims that the generated assets prove reference-to-video, editing,
  extension, or native 4K output.
- Public provider, canary, pricing-infrastructure, or implementation caveats.
- Public launch, indexation, or generation activation without the separate
  launch gates in `docs/model-launch/seedance-2-5.md`.

## Prompting approach

The prompts follow BytePlus ModelArk guidance: precise subject, action,
environment, lighting, camera movement, visual style, quality, constraints, and
chronological beats. Each film has one dominant action and one coherent camera
grammar. Dialogue is short, attributed to a specific character, and placed in
double quotes.

The production prompts are written in English because it is the universally
supported ModelArk prompt language. Localized subtitles and marketing copy are
added after generation.

## Video 1 — The city in the suitcase

**Role:** primary hero candidate

**Duration:** 24 seconds

**Purpose:** long-form coherence, scale transition, environmental detail, and
controlled camera movement

### Production prompt

```text
Cinematic 24-second landscape video, 16:9. A woman in her early thirties waits
alone on a quiet European railway platform at sunrise. She wears a timeless
camel coat and places a weathered brown suitcase on the ground. Maintain her
appearance, clothing, the suitcase design, and the platform architecture
consistently throughout the video.

0-4 seconds: medium-low camera angle. She opens the suitcase. A warm golden
light immediately illuminates her face from inside. The camera begins one slow,
continuous forward dolly toward the open suitcase.

4-17 seconds: inside the suitcase, a realistic miniature coastal city unfolds
and comes alive in one continuous action: compact buildings rise, a small train
moves along the coast, tiny cars begin moving, harbor water ripples, and waves
reach the shore. The camera continues the same smooth forward movement and
descends into the city. Preserve believable scale, geometry, gravity, and
natural motion. No sudden transformation, no cut, no change of visual style.

17-24 seconds: the camera gently rises into a wide view showing the complete
living coastal city still contained inside the open suitcase. The woman remains
visible beyond it at giant scale, watching in quiet amazement. Golden sunrise,
subtle sea mist, realistic materials, cinematic contrast, premium feature-film
photography. End on a stable, readable composition with no text, no logo, and
no watermark.
```

### Acceptance criteria

- The woman and suitcase remain recognizable and geometrically stable.
- The miniature city is visibly contained in the suitcase at the final reveal.
- The camera movement feels continuous rather than like unrelated shots.
- The train, cars, water, and buildings move without obvious physical errors.
- No illegible text, signage, logo, extra limbs, or major object morphing.
- The last two seconds provide a clean frame usable on the model page.

## Video 2 — The glass lightning train

**Role:** primary hero candidate

**Duration:** 24 seconds

**Purpose:** first-frame impact, large-object consistency, speed, atmosphere,
lighting, and a cinematic payoff

### Production prompt

```text
Cinematic 24-second landscape video, 16:9. A long matte-black freight train
crosses a vast salt desert at high speed during a violent nighttime storm.
Maintain the locomotive, wagon count, proportions, direction of travel, and
desert horizon consistently throughout the video.

0-4 seconds: the camera tracks extremely low beside the moving wheels. Rain,
salt dust, and reflections react naturally to the train's speed. A powerful
lightning bolt strikes the ground directly ahead and instantly solidifies into
one monumental arch of transparent luminous glass. Strong visual hook in the
first second.

4-18 seconds: the train passes through a sequence of glass arches created one
by one by lightning strikes. Use one continuous lateral tracking movement. The
arches refract blue-white lightning across the black metal train and wet salt
surface. Keep the train stable and realistic; no wagon duplication, bending,
melting, or direction change.

18-24 seconds: the same camera movement gradually cranes upward into an epic
wide aerial reveal. Dozens of luminous glass arches extend toward the horizon
while the train continues through the storm. Monumental scale, realistic rain,
volumetric clouds, controlled highlights, premium cinematic photography. End
on a stable wide composition with no text, no logo, and no watermark.
```

### Acceptance criteria

- The locomotive and wagons remain coherent across the full shot.
- At least one glass arch is clearly formed by lightning in the opening beat.
- Reflections and storm effects strengthen the scene without hiding the train.
- The final crane reveal remains legible and materially larger in scale.
- No derailed geometry, duplicated train, random cuts, text, logo, or watermark.
- The first two seconds work as an autoplay hook without sound.

## Video 3 — The runaway sock

**Role:** optional human-performance and audio proof

**Duration:** 15 seconds

**Purpose:** natural adult faces, eyelines, small gestures, comic timing,
dialogue, and lip synchronization

### Audio gate

This production request doubles as the Seedance 2.5 audio canary. It may run
only after the route accepts `generate_audio` without weakening the dedicated
kill switch, administrator-only access, pricing snapshot, terminal-state
polling, durable copy, and exactly-once refund behavior. If the audio contract
cannot be validated, omit this asset and launch with the two hero videos. Do
not replace it with another effects-heavy silent video.

### Production prompt

```text
Cinematic 15-second landscape video, 16:9, with synchronized English dialogue
and natural laundromat ambience. Two adults in their early thirties stand near
the same washing machine in a stylish late-night laundromat. The woman has
short dark hair and wears a green jacket. The man has curly brown hair and wears
a navy overshirt. Maintain both faces, clothing, positions, and eyelines
consistently. Warm practical lights mix with soft blue neon from the windows.
Use one extremely subtle continuous dolly-in; no cuts and no dramatic camera
movement.

0-4 seconds: a single red sock falls from the man's laundry basket. The woman
picks it up, looks at him, and smiles. Natural hand movement and restrained
facial acting.

4-9 seconds: she offers him the red sock and says playfully, "I think your sock
is trying to escape." Her mouth movement, expression, voice, and timing match
the sentence. The man listens and maintains correct eye contact.

9-15 seconds: he accepts the sock, studies it with mock seriousness, then says,
"It always wanted to travel." His mouth movement and expression match the
sentence. They share a small natural laugh while the washing machines continue
turning behind them. Clear voices, subtle room tone, no music overpowering the
dialogue, no subtitles, no text, no logo, and no watermark.
```

### Acceptance criteria

- Both adult faces remain stable, natural, and distinct.
- Eyelines, handoff of the sock, and reactions follow the correct order.
- Each line is spoken by the correct character and remains intelligible.
- Lip movement is acceptably synchronized, with no overlapping or invented
  dialogue.
- Ambience supports rather than masks the voices.
- No extra fingers, fused hands, identity swapping, subtitles, text, logo, or
  watermark.

## Cost and stop-loss policy

The estimate uses the current MaxVideoAI Seedance 2.5 720p token dimensions and
the recorded ModelArk no-video rate. Actual provider billing must be replaced
with returned usage when available.

| Generation | Estimated provider cost | MaxVideoAI member quote |
| --- | ---: | ---: |
| City in the suitcase, 24 s | USD 5.55 | USD 13.87 |
| Glass lightning train, 24 s | USD 5.55 | USD 13.87 |
| Runaway sock, 15 s | USD 3.47 | USD 8.67 |
| Approved base pack | **USD 14.56** | **USD 36.41** |

Individual rows are rounded for readability; the pack total is calculated from
the unrounded token estimates.

The dialogue generation itself is the audio canary, so there is no separate
paid four-second audio test in the base estimate.

Only one selective content retry is authorized after reviewing the initial
outputs:

- retrying a 24-second hero adds about USD 5.55 provider cost and USD 13.87 at
  the member quote;
- retrying the 15-second dialogue adds about USD 3.47 provider cost and USD
  8.67 at the member quote;
- the maximum approved provider-cost envelope is therefore USD 20.11;
- no further generation is allowed without a new explicit approval.

Failed or rejected tasks must still be reconciled according to the launch
packet. A technical failure does not automatically authorize an additional
request.

## Production sequence

1. Re-read the operational launch packet and inspect the current `main` branch,
   worktree, flags, pricing, and tests.
2. Complete the real failure/timeout/refund proof before paid marketing work.
3. Keep Seedance 2.5 administrator-only and enable only the dedicated controls
   required for the approved request.
4. Compute and record the preflight quote before each generation.
5. Generate the two silent 24-second hero candidates at 720p.
6. Inspect each full video against its acceptance criteria before authorizing
   any retry.
7. Validate the audio request contract, then generate the 15-second dialogue
   asset as the first complete audio canary. If the contract is not safe, skip
   it.
8. Use at most one selective retry across the pack.
9. Confirm durable video, preview, thumbnail, library visibility, actual usage,
   provider cost, receipt, and downloadable range response for every accepted
   asset.
10. Copy the accepted asset ledger and sanitized QA evidence into
    `docs/model-launch/seedance-2-5.md`.
11. Integrate only accepted assets into the standard Seedance 2.5 marketing
    page and example playlist.
12. Keep public generation and indexation closed until their separate launch
    gates are explicitly approved.

## Marketing integration design

- The strongest of the two hero videos becomes the primary model-page media.
- The second hero appears in the first examples block and remains available as
  an alternate social/launch asset.
- The dialogue video appears as a clearly different human-performance example,
  not as the first autoplay media.
- Every video receives a durable MaxVideoAI URL, poster frame, concise title,
  localized description, prompt disclosure, and accessibility text.
- Accepted assets populate the canonical `examples-seedance-2-5` playlist and
  may later be reused on watch pages, Benchmark Lab evidence, and selected
  comparison pages.
- The page sells creative outcomes. Internal provider identity, prices, flags,
  and canary limitations stay in engineering documentation.

## Verification requirements

Before the assets are called launch-ready:

- generation and polling tests remain green;
- exactly-once refund behavior is proven on a real terminal failure or timeout;
- every accepted video is watched from beginning to end at full size;
- video duration, 1280×720 dimensions, 24 FPS, and audio presence/absence match
  the approved request;
- durable URLs survive independently of expiring provider URLs;
- no secrets, signed URLs, provider task IDs, or private account identifiers are
  committed;
- the localized model routes render the accepted media without layout shift or
  autoplay audio;
- canonical, hreflang, JSON-LD, noindex/index state, sitemap behavior, and
  example-page links match the explicitly approved launch phase;
- `git diff --check` and the focused Seedance/model-page contracts pass before a
  broader verification run.

## Decision record

The product owner approved the 2 + 1 direction on 2026-08-07 after reviewing
the reduced concept set and cost estimate. Approval covers this design and the
USD 20.11 provider-cost ceiling. It does not by itself authorize public
activation, deployment, indexation, changes to customer pricing, or more than
one content retry.
