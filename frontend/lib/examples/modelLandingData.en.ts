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
      'Pricing depends on duration, resolution, and add-ons. Use the visible per-clip pricing to compare Sora runs against other engines before batch generation.',
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
      'Browse Veo 3.1 examples, prompts, settings, image-to-video patterns, and per-clip pricing for Veo 3.1, Veo 3.1 Fast, and Veo 3.1 Lite on MaxVideoAI.',
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
      'Per-clip price changes with duration, resolution, and audio behavior. Keep a stable preset to compare Veo outputs across multiple briefs.',
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
    metaTitle: 'Seedance AI Video Examples, Prompts & Use Cases | MaxVideoAI',
    metaDescription:
      'Explore real Seedance video outputs, copy prompt ideas, compare model settings, and see when to use Seedance 2.0, Fast, Mini, or 1.5 Pro.',
    heroTitle: 'Seedance AI Video Examples, Prompts & Settings',
    subtitle: 'Seedance AI video examples, prompts, settings, and outputs for current Seedance workflows and supported older runs.',
    intro:
      'Explore real Seedance video outputs for Seedance 2.0, Seedance 2.0 Fast, and Seedance 2.0 Mini. Use Mini as the lower-cost batch/value route for ecommerce variants, UGC hooks, and reference-guided iteration, then use Seedance 1.5 Pro examples as legacy references for shorter clip patterns. Compare prompt structure, model settings, duration, and output patterns before opening the matching Seedance model page.',
    summary:
      'Seedance 2.0 remains the final, polished, high-ceiling route; Seedance 2.0 Fast is the faster draft route; Seedance 2.0 Mini adds a lower-cost batch value path for repeatable variants. Seedance 1.5 Pro stays available as a legacy reference for shorter, repeatable clips.',
    promptPatterns:
      'Lead with one core action, then define camera and environment constraints. Use Mini for batches of ecommerce variants, UGC hooks, or reference-guided iterations where compact prompt sequences keep outputs comparable.',
    strengthsLimits:
      'Seedance tends to work well for controlled movement and steady framing. Keep scene complexity moderate to maintain consistency across variants, and reserve Seedance 2.0 for final shots that need the highest ceiling.',
    pricingNotes:
      'Evaluate Seedance on equivalent presets before scaling. Mini is the lower-cost batch route, Fast keeps draft cycles quick, and Seedance 2.0 is the better fit for polished final renders.',
    faq: [
      {
        question: 'Are these Seedance AI video examples tuned for stable camera motion?',
        answer: 'Yes. Most Seedance AI video examples on this page prioritize camera clarity and low-drift movement patterns.',
      },
      {
        question: 'Which Seedance AI video model should I start with for examples and prompt testing?',
        answer:
          'Start with Seedance 2.0 Fast when you want faster draft passes, use Seedance 2.0 Mini for lower-cost ecommerce variants, UGC hooks, and reference-guided batches, then move to Seedance 2.0 for stronger multi-shot quality, native audio, and more production-ready outputs.',
      },
      {
        question: 'What settings affect Seedance video pricing most?',
        answer:
          'Duration and resolution are the primary price drivers across Seedance video workflows, followed by optional mode-specific add-ons.',
      },
    ],
  },
  ltx: {
    metaTitle: 'LTX Examples, Prompts, Settings & Outputs | MaxVideoAI',
    metaDescription:
      'Browse LTX 2.3 Pro and LTX 2.3 Fast prompt examples, settings, outputs, and image-to-video patterns, then review supported LTX 2 workflows on MaxVideoAI.',
    heroTitle: 'LTX examples, prompts, settings and outputs',
    subtitle: 'Examples for current LTX 2.3 Pro and LTX 2.3 Fast workflows, plus supported older LTX setups.',
    intro:
      'Browse LTX 2.3 Pro and LTX 2.3 Fast prompt examples, reusable settings, and output patterns, then review supported LTX 2 and LTX 2 Fast setups for older workflows, historical prompt baselines, and migration context. Use this page to study prompt structure, image-to-video AI patterns, and model-specific settings before opening the matching LTX model page.',
    summary:
      'LTX 2.3 Pro and LTX 2.3 Fast lead this page for prompt examples, reusable settings, outputs, and image-to-video patterns, with LTX 2 and LTX 2 Fast kept below for supported older workflows and migration context.',
    promptPatterns:
      'Start from reusable LTX 2.3 prompt structures for product shots, short cinematic clips, and consistent motion tests that turn into repeatable video outputs before adapting them to your own scene.',
    strengthsLimits:
      'Use LTX 2.3 with a clear source image, one main motion instruction, and one camera goal so outputs stay easier to compare across Pro and Fast.',
    pricingNotes:
      'Keep duration, aspect ratio, motion complexity, and output settings aligned when testing prompts so you can compare result quality, speed, and cost more cleanly.',
    faq: [
      {
        question: 'What are the best LTX 2.3 prompt examples to start from?',
        answer:
          'The best starting point is a simple structure: subject, action, camera direction, and style goal. The strongest examples keep that structure stable while changing only one variable at a time.',
      },
      {
        question: 'How should I structure an LTX 2.3 prompt?',
        answer:
          'Start with one clear subject, one main action, one camera instruction, and one visual style cue. LTX 2.3 prompts usually work better when the motion goal is explicit and the scene description stays tight.',
      },
      {
        question: 'What settings matter most for LTX 2.3 outputs?',
        answer:
          'The main settings to watch are duration, aspect ratio, source image choice for image-to-video, and how much motion complexity you ask for in a single prompt. Keeping those stable makes prompt testing much easier.',
      },
      {
        question: 'How should I prompt LTX 2.3 for image-to-video?',
        answer:
          'Start from a strong source image, then add one motion instruction, one camera movement, and one output goal. LTX 2.3 image-to-video works best when the prompt extends the source image instead of replacing it with a completely different scene.',
      },
      {
        question: 'Which LTX model should I use: LTX 2.3 Pro or LTX 2.3 Fast?',
        answer:
          'Use LTX 2.3 Pro when you want the strongest current LTX output quality and more advanced workflows like audio, Extend, and Retake. Use LTX 2.3 Fast when you want quicker, lower-cost prompt testing and longer draft iteration loops.',
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
};
