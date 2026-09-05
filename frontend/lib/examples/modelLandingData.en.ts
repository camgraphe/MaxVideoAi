import type { CanonicalExampleModelSlug, LocalizedModelDescriptor } from '@/lib/examples/modelLandingTypes';

export const EN_MODEL_DATA: Partial<Record<CanonicalExampleModelSlug, LocalizedModelDescriptor>> = {
  sora: {
    subtitle: 'Cinematic examples, reusable prompts, and shot-level settings for Sora workflows.',
    intro:
      'Use this page to review real Sora examples before you run new renders. You can inspect prompt style, duration, and framing patterns that usually perform well on cinematic scenes, product storytelling, and social cuts. The goal is to help you recreate outputs consistently without mixing unrelated model behavior.',
    promptPatterns:
      'Start with scene intent, camera movement, and a clear subject anchor. Sora examples perform best when prompts separate composition, motion, and lighting constraints in short blocks.',
    strengthsLimits:
      'Sora generally excels in cinematic coherence and polished motion. Limits vary by mode and queue conditions, so keep test runs short before scaling to longer variants.',
    pricingNotes:
      'Pricing depends on duration, resolution, and add-ons. Open an example to inspect its recorded render cost before comparing Sora runs with other engines or starting batch generation.',
    faq: [
      {
        question: 'What prompts work best for Sora examples?',
        answer: 'Structured prompts with clear subject, camera, and motion constraints are the most reliable baseline.',
      },
      {
        question: 'Are these Sora examples reusable in the workspace?',
        answer: 'Yes. You can clone examples and adapt duration, resolution, and style details to your own brief.',
      },
      {
        question: 'How should I budget Sora test runs?',
        answer: 'Start with short test clips, validate motion and composition, then upscale winning variants.',
      },
    ],
  },
  veo: {
    metaTitle: 'Veo 3.1 Examples, Prompts, Settings & Image-to-Video | MaxVideoAI',
    metaDescription:
      'Browse Veo 3.1 examples, prompts, settings, and image-to-video patterns, then open a video detail page to see its recorded render cost on MaxVideoAI.',
    heroTitle: 'Veo 3.1 examples, prompts, settings and image-to-video patterns',
    subtitle: 'Veo 3.1 examples, prompts, settings, and image-to-video patterns across the current Veo family.',
    intro:
      'Browse Veo 3.1, Veo 3.1 Fast, and Veo 3.1 Lite examples, prompts, reusable settings, and image-to-video patterns, then open the model pages for specs, limits, and pricing. Use this page to study prompt structure, text-to-video AI patterns, and model-specific image-to-video settings before opening the matching Veo model page.',
    summary:
      'Veo 3.1 leads this page for examples, prompts, settings, and image-to-video patterns, with Veo 3.1 Fast and Veo 3.1 Lite kept visible as current Veo variants for faster iteration and lower-cost audio-ready tests.',
    promptPatterns:
      'Veo 3.1 examples usually improve when prompts specify shot objective first, then movement, lighting, and any image-to-video reference constraints.',
    strengthsLimits:
      'Veo is strong on controllable framing and consistent movement in short text-to-video and image-to-video runs. Capability details still vary by mode, so verify available options before large jobs.',
    pricingNotes:
      'Open a video detail page to see its recorded render cost, which reflects duration, resolution, and audio behavior. Keep a stable preset to compare Veo outputs across multiple briefs.',
    faq: [
      {
        question: 'How should I use Veo 3 for image-to-video?',
        answer:
          'Start from a strong source still, define one clear motion goal, and keep camera direction explicit. Veo 3.1 image-to-video workflows usually work best when the prompt extends the source image instead of replacing it completely.',
      },
      {
        question: 'Which Veo 3 model should I use for prompt testing?',
        answer:
          'Start with Veo 3.1 Fast or Veo 3.1 Lite when you want cheaper draft passes and quicker prompt testing, then move to Veo 3.1 for stronger final-quality cinematic output and more reference-guided control.',
      },
      {
        question: 'Can these Veo 3.1 examples help me structure text-to-video AI prompts?',
        answer:
          'Yes. Use them as Veo 3.1 text-to-video AI baselines by keeping the same subject, motion goal, camera direction, and format while changing only one prompt variable at a time.',
      },
    ],
  },
  luma: {
    metaTitle: 'Luma Ray 3.2 Modify & Reframe Examples | MaxVideoAI',
    metaDescription:
      'Browse Luma Ray 3.2 examples for source-video Modify, AI video Reframe, guide/keyframe edits, silent 5s/10s tests, reusable prompts, and Ray 2 / Flash context on MaxVideoAI.',
    subtitle: 'Luma Ray 3.2 examples for source-video Modify, Reframe, guide/keyframe edits, aspect ratios, and cost-controlled silent tests.',
    intro:
      'This page is the family view for Luma Ray inside MaxVideoAI. It now leads with Ray 3.2 examples for source-video Modify, guide/keyframe edits, and Reframe delivery work, while Ray 2 and Ray 2 Flash remain useful context for older examples and fallback coverage. The model pages handle detailed specs; this gallery is for prompt patterns, edit examples, and cost-aware settings.',
    promptPatterns:
      'Luma examples work best when prompts stay mode-specific. For Modify, write what stays from the source video before the requested change. For Reframe, name subject priority and canvas fill. For supporting generation, keep one subject, one motion goal, a camera move, the target aspect ratio, and the intended duration/resolution.',
    strengthsLimits:
      'Ray 3.2 is the current Luma route for source-video modification, keyframed visual direction, reframing delivery cuts, product edit passes, and supporting short motion tests. It is not an audio or lip-sync engine in MaxVideoAI, so judge examples on source preservation, framing, product continuity, edit discipline, and prompt control rather than soundtrack features. Ray 2 and Ray 2 Flash examples stay available as older production context.',
    pricingNotes:
      'Start with 5s clips at 540p or 720p when validating motion, then move only approved shots to longer or higher-resolution renders. Pricing follows the site quote before generation; direct Luma routing keeps the same customer price while fallback protects availability.',
    faq: [
      {
        question: 'When should I start from the Luma examples page?',
        answer: 'Start here when you want to see Ray 3.2 Modify and Reframe patterns before opening the model page or cloning a prompt into the app.',
      },
      {
        question: 'Does Ray 3.2 generate audio?',
        answer: 'No. Treat Ray 3.2 examples as silent video outputs and add voice, music, or sound design later in the workflow.',
      },
      {
        question: 'Should I start from text or an image?',
        answer: 'Start from a source video when the timing already works. Use text or an image only when you need a new short silent clip before a later Modify or Reframe pass.',
      },
    ],
  },
  wan: {
    subtitle: 'Wan examples for structured prompts, transitions, and reference-driven consistency.',
    intro:
      'These Wan examples are curated for multi-beat shots, smooth transitions, and reference-aware sequences. They are useful when you need controlled pacing rather than random variation. Review the examples here before cloning so your first run starts with realistic expectations on motion and continuity.',
    promptPatterns:
      'Wan prompts work best with concise beat structure: setup, action, and close. Explicit transition language helps keep cuts and pacing cleaner.',
    strengthsLimits:
      'Wan is often reliable for short structured sequences and reference-guided continuity. Keep prompts focused to reduce drift across longer action chains.',
    pricingNotes:
      'Price varies by mode and clip settings. Validate cost on a short baseline run, then expand successful shots into multi-variant batches.',
    faq: [
      {
        question: 'Are Wan examples optimized for multi-shot prompts?',
        answer: 'Yes. Most examples are built around short structured beats with explicit transitions.',
      },
      {
        question: 'Can I adapt Wan examples to vertical formats?',
        answer: 'Yes. Keep the core motion brief and update framing, ratio, and pacing for vertical output.',
      },
      {
        question: 'What is the safest way to test Wan pricing?',
        answer: 'Run one short clip at your target format, then scale once output quality is validated.',
      },
    ],
  },
  kling: {
    metaTitle: 'Kling AI Video Examples: Prompts, Motion & Product Shots',
    metaDescription:
      'Explore Kling AI examples with prompts, reference-to-video, source-video V2V, start-frame settings and pricing across Kling 3.0 Omni and Kling 3.',
    heroTitle: 'Kling AI Video Examples, Prompts & Settings',
    subtitle:
      'Kling AI video examples, prompts, reference workflows, image-to-video patterns, and model guidance for Kling 3.0 Omni, Kling 3, and supported older versions.',
    intro:
      'Browse Kling AI video examples, prompts, reusable settings, and workflow patterns for Kling 3.0 Omni Pro, Standard, and 4K, then compare them with Kling 3 start-frame routes and supported older Kling setups. Use this page to separate reference-guided O3 prompts from classic Kling 3 image-to-video prompts before opening the matching model page.',
    summary:
      'Kling 3.0 Omni Pro and Standard are the current routes for reference images, storyboard inputs, and source-video V2V. Kling 3 Pro and Standard remain the start-frame image-to-video routes, while Kling 3.0 Omni 4K is the native 4K reference-guided delivery route.',
    promptPatterns:
      'Start by deciding whether the uploaded media should be a reference or the visible first frame. Use @Image and @Video1 language for O3 reference and V2V workflows; use start-frame wording when the shot belongs on Kling 3.',
    strengthsLimits:
      'O3 is better when references guide style, identity, storyboard structure, or source-video motion without opening the clip. Kling 3 is better when a source image must appear as the first frame and the prompt should animate from that image.',
    pricingNotes:
      'Keep duration, aspect ratio, audio, and resolution aligned when comparing Kling outputs. Use Standard for cheaper O3 tests, Pro for stronger reference/V2V passes, and 4K only after the direction is approved.',
    faq: [
      {
        question: 'How long can Kling AI videos be?',
        answer:
          'Kling 3.0 Omni Standard and Pro support 1080p reference-guided renders up to 15 seconds, including source-video V2V on Standard and Pro. The O3 4K route is for native 4K reference-guided delivery, while Kling 3 remains the start-frame image-to-video route.',
      },
      {
        question: 'How long does Kling AI take to make a video?',
        answer:
          'Render time depends on the Kling model, duration, media inputs, audio, resolution, and queue load. Shorter Standard tests are usually the fastest way to validate a prompt, while O3 V2V, audio-on, and native 4K renders take longer.',
      },
      {
        question: 'Which Kling AI model should I use for prompts and examples?',
        answer:
          'Use Kling 3.0 Omni Standard or Pro when references, storyboard images, or @Video1 should guide the render without becoming the opening frame. Use Kling 3 Standard or Pro when the uploaded image should be the visible start frame.',
      },
      {
        question: 'How should I use Kling AI for image-to-video prompt testing?',
        answer:
          'For O3, describe each reference role with @Image1, @Image2, or @Video1. For Kling 3, start from one clear source image, one motion instruction, and one camera goal because the image is expected to open the clip.',
      },
      {
        question: 'How should I adapt Kling AI prompts for Kling 3 Pro vs Kling 3 Standard?',
        answer:
          'Keep the same subject, action, camera direction, and duration when comparing tiers. Change only the route intent: O3 for reference/storyboard/V2V guidance, Kling 3 for start-frame animation, and 4K only for approved delivery renders.',
      },
    ],
  },
  seedance: {
    metaTitle: 'Seedance 2.5 Video Examples, Prompts & Settings | MaxVideoAI',
    metaDescription:
      'Explore Seedance 2.5 video examples and prompt patterns, then compare current Seedance 2.0, Fast, Mini and supported 1.5 Pro workflows.',
    heroTitle: 'Seedance 2.5 AI Video Examples, Prompts & Settings',
    subtitle:
      'Seedance examples, prompts and settings led by Seedance 2.5, with current and supported workflows kept in context.',
    intro:
      'Start with Seedance 2.5 for current 4–30 second, up-to-1080p, audio-enabled and reference-guided workflows, then compare Seedance 2.0, Fast and Mini examples without treating older renders as Seedance 2.5 output. Open a video first for its prompt and settings; use the model and comparison links below the gallery when you need the right route.',
    summary:
      'Seedance 2.5 is the flagship route for longer workflows up to 1080p, generated audio, references, editing and extension. Seedance 2.0 remains available for 4K intent, Fast and Mini cover draft or batch workflows, and Seedance 1.5 Pro remains supported as an older reference.',
    promptPatterns:
      'For Seedance 2.5, define one core action, camera direction and reference role before adding scene detail. Keep the same prompt structure when comparing 2.5 with Seedance 2.0, Fast or Mini.',
    strengthsLimits:
      'Use Seedance 2.5 when longer duration, generated audio, mixed references, editing or extension matter. Its public MaxVideoAI route supports landscape, square and vertical output at 480p, 720p or 1080p; keep Seedance 2.0 when 4K delivery is required.',
    pricingNotes:
      'Duration, audio and the type of media used influence the price. The generator shows the current price before you launch.',
    faq: [
      {
        question: 'Are all Seedance examples on this page generated with Seedance 2.5?',
        answer:
          'No. The gallery keeps factual labels for Seedance 2.5, Seedance 2.0, Fast, Mini and supported 1.5 Pro renders so you can compare the actual route used.',
      },
      {
        question: 'Which Seedance model should I start with for examples and prompt testing?',
        answer:
          'Start with Seedance 2.5 for the current flagship workflow up to 1080p. Use Seedance 2.0 for 4K intent, Fast for quicker drafts, and Mini for repeatable batch variants.',
      },
      {
        question: 'What settings affect Seedance video pricing most?',
        answer:
          'Duration, generated audio and the use of a source video have the greatest impact on the price. Keep those settings aligned when comparing routes.',
      },
    ],
  },
  ltx: {
    metaTitle: 'LTX Examples, Prompts, Settings & Outputs | MaxVideoAI',
    metaDescription:
      "Explore LTX 2.5 Pro and Fast video examples, prompts and settings, with clearly labelled LTX 2.3 and LTX 2 examples for older workflows.",
    heroTitle: 'LTX examples, prompts, settings and outputs',
    subtitle: 'Examples for current LTX 2.5 Pro and LTX 2.5 Fast workflows, plus supported older LTX setups.',
    intro:
      "Explore LTX 2.5 Pro and Fast prompts, settings and outputs. The gallery also keeps LTX 2.3 Pro/Fast and LTX 2 Pro/Fast examples for older workflows and migration comparisons. Each video identifies the model that actually generated it. Open its details for the prompt, settings and recorded price.",
    summary:
      "LTX 2.5 Pro and Fast lead this page. Older LTX 2.3 and LTX 2 examples keep their original model labels so you can compare generations without confusing their capabilities.",
    promptPatterns:
      'Start from reusable LTX 2.5 prompt structures for product shots, short cinematic clips, and consistent motion tests that turn into repeatable video outputs before adapting them to your own scene.',
    strengthsLimits:
      'Use LTX 2.5 with a clear source image, one main motion instruction, and one camera goal so outputs stay easier to compare across Pro and Fast.',
    pricingNotes:
      'Keep duration, aspect ratio, motion complexity, and output settings aligned when testing prompts so you can compare result quality, speed, and cost more cleanly.',
    faq: [
      {
        question: 'What are the best LTX 2.5 prompt examples to start from?',
        answer:
          'The best starting point is a simple structure: subject, action, camera direction, and style goal. The strongest examples keep that structure stable while changing only one variable at a time.',
      },
      {
        question: 'How should I structure an LTX 2.5 prompt?',
        answer:
          'Start with one clear subject, one main action, one camera instruction, and one visual style cue. LTX 2.5 prompts usually work better when the motion goal is explicit and the scene description stays tight.',
      },
      {
        question: 'What settings matter most for LTX 2.5 outputs?',
        answer:
          'The main settings to watch are duration, aspect ratio, source image choice for image-to-video, and how much motion complexity you ask for in a single prompt. Keeping those stable makes prompt testing much easier.',
      },
      {
        question: 'How should I prompt LTX 2.5 for image-to-video?',
        answer:
          'Start from a strong source image, then add one motion instruction, one camera movement, and one output goal. LTX 2.5 image-to-video works best when the prompt extends the source image instead of replacing it with a completely different scene.',
      },
      {
        question: 'Which LTX model should I use: LTX 2.5 Pro or LTX 2.5 Fast?',
        answer:
          'Compare LTX 2.5 Pro and Fast with the same prompt and settings. Use the examples to judge the output you need and the current pricing page to compare costs. Check each model page for supported modes and limits; older LTX examples describe the version shown on their label.',
      },
    ],
  },
  pika: {
    subtitle: 'Pika examples for short-form creative loops, stylized edits, and social-ready motion.',
    intro:
      'This Pika examples page is built for short-form, stylized output patterns. It helps creators and growth teams quickly clone proven motions, update prompt details, and publish social-ready variants without rebuilding settings from scratch. The content is intentionally focused on Pika behavior only.',
    promptPatterns:
      'Use style-first prompts with one clear action and concise camera direction. Pika examples usually improve when scene scope stays narrow.',
    strengthsLimits:
      'Pika is often effective for fast loops and stylized social visuals. Keep prompt structure simple to avoid unstable transitions.',
    pricingNotes:
      'Pricing is easiest to control with short durations and fixed output settings. Validate one successful template, then duplicate.',
    faq: [
      {
        question: 'What is the best way to reuse Pika examples?',
        answer: 'Clone a relevant example, keep the motion template, and swap only subject/style elements first.',
      },
      {
        question: 'Are Pika examples suitable for social ad variants?',
        answer: 'Yes. They are optimized for short, stylized, and iteration-friendly outputs.',
      },
      {
        question: 'How do I keep Pika costs predictable?',
        answer: 'Lock duration and resolution presets before running multiple variants.',
      },
    ],
  },
  hailuo: {
    subtitle: 'Hailuo examples for budget-friendly tests, motion tests, and reference-based iteration.',
    intro:
      'This Hailuo examples page focuses on draft quality, motion validation, and practical prompt iteration. It is useful when you want low-cost exploration before rebuilding winners in premium engines. The guidance remains specific to Hailuo behavior to prevent hub-level duplication.',
    promptPatterns:
      'Use short prompts that define subject motion and camera intent first. Hailuo examples are more stable when prompts avoid overloaded style instructions.',
    strengthsLimits:
      'Hailuo is typically strong for early-stage motion tests and inexpensive concept passes. Validate complex shots in small steps for better consistency.',
    pricingNotes:
      'Treat Hailuo as a draft baseline: test cheaply, keep winners, then upscale or reroute as needed.',
    faq: [
      {
        question: 'Why use Hailuo examples before premium engines?',
        answer: 'They help validate motion ideas at lower cost before committing budget to higher-tier generation.',
      },
      {
        question: 'How should I structure Hailuo prompts?',
        answer: 'Keep prompts short and action-focused, with one clear camera directive.',
      },
      {
        question: 'What is the best pricing workflow for Hailuo?',
        answer: 'Run short draft tests first, then expand only the variants that meet your quality bar.',
      },
    ],
  },
  grok: {
    subtitle: 'Grok Imagine Video 1.5 examples for text-to-video, opening-image animation, and reference-guided clips.',
    intro:
      'Use this family page to study Grok Imagine Video 1.5 through MaxVideoAI’s Fal route. It covers text-to-video, image-to-video from one opening image, and reference-to-video workflows using one to seven reference images; availability on MaxVideoAI does not imply a direct xAI integration. Treat the gallery as evidence for choosing an input strategy, not as a promise that one prompt works for every mode. Text starts are useful when composition can be invented from the brief. An opening image is better when the first composition, subject placement, wardrobe, product, or palette already exists. A reference set is appropriate when several permitted images have separate jobs, such as identity, object design, environment, or lighting. Review prompt, mode, duration, resolution, framing, and accepted output together. A visually attractive result does not by itself prove reference fidelity, readable incidental text, stable hands, or continuity through the final beat. Compare examples with the same acceptance criteria and keep likeness consent, source rights, and brand safety in the production review.',
    promptPatterns:
      'For text-to-video, state the subject, action, camera, and light, then describe the ending that should still be visible when the clip stops. Keep one main action and one camera intention so motion failures are diagnosable. For an opening image, describe only the motion that should develop: what remains fixed, what moves, how the camera reacts, and which visual details must survive. Do not ask the prompt to redesign the source and preserve it at the same time. For reference work, assign a clear role to each reference instead of repeating visual detail. Name the images in order, identify which one controls the person, garment, object, location, or palette, and explain how those roles meet in a single shot. One or two precise references can be clearer than seven conflicting sources. Put negative constraints after the positive shot direction and reserve them for visible failure risks such as unwanted logos, duplicate subjects, extra limbs, accidental captions, or a camera cut. When comparing two prompts, change one variable and keep source images, duration, resolution, and framing stable.',
    strengthsLimits:
      'Grok supports flexible text, opening-image, and multi-reference starting points. Text and image workflows can use the higher output tier shown by the model route, while reference mode is limited to its displayed 480p or 720p choices. The opening image owns framing in image-to-video, so a separate aspect-ratio promise should not be inferred. Reference mode accepts images, not a source video, audio track, or generic document. More references increase direction complexity and should not be treated as automatic consistency. Evaluate opening readability, subject identity, motion, anatomy and geometry, unwanted text or watermarks, and the final beat separately. The family page does not claim native audio, direct xAI execution, guaranteed lip sync, perfect typography, or controls absent from the selected mode. Queue behavior, availability, and exact pricing can change without changing the creative contract, so use the live model details and pre-render quote. For a high-stakes likeness or product, run a short diagnostic first, inspect every frame, and keep a human approval step before publication.',
    pricingNotes:
      'Use the quote shown before generation; this copy owns no provider rate or finished total. Start with a short 480p or 720p reference diagnostic, or a 720p text or image test, before moving an approved direction to the higher settings offered by that mode. The reference quote must receive the actual number of images rather than a generic text-video assumption. Compare cost only when mode, duration, resolution, and reference count match. Keep rejected attempts in the production record so speed and stability are not judged only from successful examples.',
    faq: [
      { question: 'Can Grok start from an image?', answer: 'Yes. Image-to-video uses one opening image and asks the prompt to direct motion from that composition. Reference-to-video accepts a set of images with named roles. Choose the opening-image route for one authoritative frame and the reference route when identity, object, setting, or palette must come from separate permitted sources.' },
      { question: 'How many references can I use?', answer: 'The reference workflow accepts one to seven images. Capacity is not a target: use only the sources needed for the brief, give each one a distinct purpose, and remove redundant or contradictory material. Keep the image order stable while testing prompts so fidelity changes can be attributed to the instruction rather than a reordered set.' },
      { question: 'Is this a direct xAI route?', answer: 'No. xAI owns the Grok model family, while MaxVideoAI currently distributes this model through Fal. The examples describe the capability exposed by that route and should not be read as a claim of direct xAI API access, identical queue behavior, or features not visible in the current model details.' },
      { question: 'How should I review a Grok example?', answer: 'Check whether the opening composition or named references remain recognizable, then score motion, camera, anatomy, geometry, unwanted text, watermarking, and the final beat. Review the whole clip rather than one thumbnail, and treat any requested but missing behavior as evidence rather than explaining it away after generation.' },
    ],
  },
  flux: {
    subtitle: 'FLUX 3 and FLUX 3 Draft examples for text-to-video, image animation, start/end frames, and Extend.',
    intro:
      'This page compares the standard FLUX 3 route with FLUX 3 Draft through MaxVideoAI’s Fal distribution. Use it for text-to-video, image-to-video from an opening frame, first-and-last-frame transitions, and the separate Extend workflow for continuing an existing clip. The family view helps decide both model tier and input workflow. Draft is for controlled 720p exploration when the team still needs to validate action, camera, source compatibility, or transition logic. Standard FLUX 3 is the production-oriented sibling and exposes the higher resolution option shown on its model page. Neither label removes the need to review the output. A useful example records the source role, prompt, mode, duration, resolution, and visual acceptance question. Compare like with like: a frame bridge should be judged on the path between anchors, an extension on continuity with the source clip, and a text start on the shot invented from the brief. Black Forest Labs owns FLUX; the route described here is Fal-distributed rather than a claim of direct provider execution.',
    promptPatterns:
      'Describe one shot, a specific camera move, a measurable subject action, the physical environment, and an ending that can be reviewed. Avoid combining several unrelated beats in one diagnostic render. For image-to-video, say what must remain from the opening composition before adding motion. When using first and last frames, supply both required anchors and write the transition between them: how pose, object position, material, camera, and light evolve without an impossible jump. Compatible perspective and identity make the bridge easier to assess. For Extend, describe what should happen after the source clip rather than restating it. Continue the final camera vector, subject trajectory, lighting, rhythm, and scene state before introducing anything new. A hidden cut, reset pose, or replacement subject is a continuity failure even if the last frame looks polished. Use Draft to compare one variable at a time and keep the winning source files, prompt structure, and acceptance criteria unchanged when testing standard FLUX 3.',
    strengthsLimits:
      'FLUX 3 is the standard-quality route and Draft is intended for quicker iteration at its fixed 720p tier. Both siblings expose distinct text, opening-image, first-and-last-frame, and extension contracts; required inputs do not become optional on Draft. Extend is a separate video continuation mode with an eligible source clip and its own canonical pricing facts. A start/end workflow is not the same as a loose image-reference set, and an opening-image workflow should not imply a separately selectable aspect ratio when the source controls framing. Do not infer native audio, lip sync, reference-video transformation beyond Extend, or controls that are not shown in the selected mode. Review source preservation, camera continuity, subject identity, anatomy, geometry, accidental text, watermarking, and the final beat. Draft output is evidence for a creative decision, not a guarantee that standard will reproduce every pixel. For delivery, rerun the selected direction on the intended sibling and review that result independently.',
    pricingNotes:
      'Draft is useful for validating direction before a standard FLUX 3 pass. Confirm the pre-render quote because duration, resolution, tier, and mode affect cost, and Extend must never inherit a normal-generation rate by omission. This family copy contains no fixed amount. Compare costs with the same source and settings, record failed or rejected attempts, and upgrade only the directions that meet the written visual criterion. A cheaper draft is valuable when it removes uncertainty; repeated uncontrolled drafts are not automatically an efficient workflow.',
    faq: [
      { question: 'When should I use FLUX 3 Draft?', answer: 'Use Draft when a 720p test can answer one concrete question about prompt direction, motion, opening-image preservation, frame compatibility, or extension continuity. Keep the approved prompt and source files for the standard pass. Do not present Draft as final-production equivalence or assume that an attractive thumbnail proves the transition works.' },
      { question: 'Can FLUX 3 continue a video?', answer: 'Yes. Choose the separate Extend mode, supply an eligible source clip, and describe the continuation after its visible final state. Preserve camera direction, subject position, light, and rhythm before introducing a new action. Extension pricing and validation remain mode-specific rather than borrowing the normal generation contract.' },
      { question: 'How do first and last frames differ from image-to-video?', answer: 'Image-to-video animates one opening composition. First-and-last-frame mode requires two anchors and must construct a plausible path between them. Use two compatible images, state what transforms and what stays stable, and judge the complete bridge rather than only its endpoints.' },
      { question: 'Does FLUX 3 include native audio?', answer: 'No audio capability is claimed on this family page. Use only the inputs and controls displayed for the selected FLUX mode, and plan voice, music, or sound design as a separate production step unless the live model details explicitly change.' },
    ],
  },
};
