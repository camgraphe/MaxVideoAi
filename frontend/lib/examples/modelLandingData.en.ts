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
    metaTitle: 'Luma Ray 2 and Ray 2 Flash Examples (Prompts + Settings) | MaxVideoAI',
    metaDescription:
      'Browse Luma Ray 2 and Ray 2 Flash examples with reusable prompts, modify and reframe patterns, and price-per-clip guidance before choosing the premium or fast tier in MaxVideoAI.',
    subtitle: 'Luma Ray examples across Ray 2 and Ray 2 Flash, with reusable prompts, modify/reframe patterns, and pricing signals.',
    intro:
      'This page is the family view for Luma Ray inside MaxVideoAI. Use it to compare Ray 2 and Ray 2 Flash examples side by side before deciding whether the job belongs on the premium tier or the faster draft tier. The model pages handle detailed specs; this gallery is for prompt patterns, workflow examples, and cost tradeoffs across the two public Luma models.',
    promptPatterns:
      'Luma examples work best when prompts stay shot-level and workflow-specific: net-new generate, still-led animation, source-video modify, or reframe for delivery. Keep the brief compact and describe what must stay versus what can change.',
    strengthsLimits:
      'Ray 2 is the stronger fit for premium cinematic finals and higher-confidence polish. Ray 2 Flash is the cheaper throughput layer for concept validation, faster modify passes, and square or vertical delivery prep. Neither model generates native audio, so judge them on motion, framing, and source-video control rather than lip sync.',
    pricingNotes:
      'Use matching durations and resolutions when comparing the two Luma tiers. Ray 2 usually earns the higher spend on final-quality shots, while Ray 2 Flash is the better baseline for draft exploration, source-video experimentation, and lower-cost delivery variants.',
    faq: [
      {
        question: 'When should I start from the Luma examples page?',
        answer: 'Start here when you want to compare Ray 2 and Ray 2 Flash quickly before choosing the premium or fast tier for a real job.',
      },
      {
        question: 'What is the clearest difference between Ray 2 and Ray 2 Flash in examples?',
        answer: 'Ray 2 is the premium finaling tier, while Ray 2 Flash is the faster draft tier. The workflows stay aligned, but the role in production is different.',
      },
      {
        question: 'Can I compare modify and reframe use cases from this page?',
        answer: 'Yes. The gallery is meant to surface both net-new generation and source-video edit patterns before you open the model pages for full workflow controls.',
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
    metaTitle: 'Kling AI Video Examples, Prompts & Settings | MaxVideoAI',
    metaDescription:
      'Browse Kling AI video examples, prompts, settings, and image-to-video patterns for Kling 3 Pro, Kling 3 Standard, and native Kling 3 4K delivery renders, then compare supported older Kling workflows on MaxVideoAI.',
    heroTitle: 'Kling AI Video Examples, Prompts & Settings',
    subtitle:
      'Kling AI video examples, prompts, settings, image-to-video patterns, and model guidance for current Kling workflows and supported older versions.',
    intro:
      'Browse Kling AI video examples, prompts, reusable settings, and image-to-video patterns for Kling 3 Pro, Kling 3 Standard, and native Kling 3 4K final renders, then explore supported older Kling setups for earlier workflows, short audio-ready clips, and fast draft passes. Use this page to compare Kling AI prompts, motion control patterns, and model-specific settings before opening the matching Kling model page.',
    summary:
      'Kling 3 Pro and Kling 3 Standard lead this page for everyday Kling AI video examples, while Kling 3 4K is the native 4K delivery option for approved final renders. Kling 2.6 Pro and Kling 2.5 Turbo remain available below as supported older Kling setups.',
    promptPatterns:
      'Start with one clear action, one camera instruction, and one style goal. Kling AI prompts are easiest to compare when the prompt structure stays stable and only the model or setting changes.',
    strengthsLimits:
      'Use a strong source image, one motion instruction, and one camera goal so Kling AI image-to-video outputs stay easier to compare across Pro and Standard.',
    pricingNotes:
      'Keep duration, aspect ratio, and output settings aligned when comparing Kling AI video results. That makes it easier to evaluate prompt behavior, model fit, and per-clip cost before opening a model page.',
    faq: [
      {
        question: 'How long can Kling AI videos be?',
        answer:
          'Kling 3 Pro and Kling 3 Standard support 3 to 15 second renders at 1080p. Kling 2.6 Pro is better suited to shorter 5 to 10 second audio-ready clips, and Kling 2.5 Turbo is mainly for fast 5 or 10 second silent tests.',
      },
      {
        question: 'How long does Kling AI take to make a video?',
        answer:
          'Render time depends on the Kling model, clip length, settings, and queue load. Shorter draft runs on Kling 3 Standard or Kling 2.5 Turbo are usually the fastest way to test prompts, while longer multi-shot or audio-on renders generally take more time than short silent tests.',
      },
      {
        question: 'Which Kling AI model should I use for prompts and examples?',
        answer:
          'Start with Kling 3 Standard when you want lower-cost prompt testing, repeatable draft passes, and current Kling 3 behavior. Move to Kling 3 Pro when you want stronger scene control, then use Kling 3 4K only for approved native 4K delivery renders.',
      },
      {
        question: 'How should I use Kling AI for image-to-video prompt testing?',
        answer:
          'Start with one clear source image, one motion instruction, and one camera goal. Kling AI image-to-video tests are easiest to compare when the prompt structure stays stable and only the model or setting changes.',
      },
      {
        question: 'How should I adapt Kling AI prompts for Kling 3 Pro vs Kling 3 Standard?',
        answer:
          'Keep the same core prompt structure on both models: one clear subject, one action per shot, and explicit camera direction. Kling 3 Pro can support denser multi-shot direction and more demanding continuity, while Kling 3 Standard works best when the shot structure stays tighter and easier to execute.',
      },
    ],
  },
  seedance: {
    metaTitle: 'Seedance AI Video Examples, Prompts & Settings | MaxVideoAI',
    metaDescription:
      'Browse Seedance AI video examples, prompts, settings, and per-clip pricing for Seedance 2.0, Seedance 2.0 Fast, and the supported Seedance 1.5 Pro workflow on MaxVideoAI.',
    heroTitle: 'Seedance AI Video Examples, Prompts & Settings',
    subtitle: 'Seedance AI video examples, prompts, settings, and outputs for current Seedance workflows and supported older runs.',
    intro:
      'Browse Seedance AI video examples, prompts, and reusable settings for Seedance 2.0 and Seedance 2.0 Fast, then explore the supported Seedance 1.5 Pro setup for older workflows and shorter clip patterns. Use this page to compare Seedance video workflows, prompt structures, and output patterns before opening the matching Seedance model page.',
    summary:
      'Seedance 2.0 and Seedance 2.0 Fast lead this Seedance AI video examples page, while Seedance 1.5 Pro stays available below as a supported older setup for shorter, repeatable clips.',
    promptPatterns:
      'Lead with one core action, then define camera and environment constraints. Seedance AI video runs respond best when the prompt sequence stays compact.',
    strengthsLimits:
      'Seedance tends to work well for controlled movement and steady framing. Keep scene complexity moderate to maintain consistency across variants.',
    pricingNotes:
      'Evaluate Seedance on equivalent presets before scaling. The clearest cost signal comes from matching duration, resolution, and audio conditions.',
    faq: [
      {
        question: 'Are these Seedance AI video examples tuned for stable camera motion?',
        answer: 'Yes. Most Seedance AI video examples on this page prioritize camera clarity and low-drift movement patterns.',
      },
      {
        question: 'Which Seedance AI video model should I start with for examples and prompt testing?',
        answer:
          'Start with Seedance 2.0 Fast when you want cheaper draft passes and quicker prompt testing, then move to Seedance 2.0 for stronger multi-shot quality, native audio, and more production-ready outputs.',
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
