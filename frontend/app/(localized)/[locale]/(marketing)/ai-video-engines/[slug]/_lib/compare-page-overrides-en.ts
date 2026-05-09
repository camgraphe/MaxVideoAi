import type { ComparePageOverridesBySlug } from './compare-page-overrides-types';

export const EN_COMPARE_PAGE_OVERRIDES = {
    'seedance-1-5-pro-vs-seedance-2-0': {
      meta: {
        title: 'Seedance 1.5 Pro vs Seedance 2.0 | What Changed, Upgrade Path & Best Use Cases | MaxVideoAI',
        description:
          'Compare Seedance 1.5 Pro vs Seedance 2.0 on MaxVideoAI to see what changed in audio, multi-shot continuity, references, pricing, and when upgrading makes sense.',
      },
      heroIntro:
        'Compare Seedance 1.5 Pro and Seedance 2.0 to see what changed between the older Seedance Pro workflow and the current Seedance AI video model in native audio, multi-shot continuity, and reference workflows. Use this page to understand the trade-offs quickly before moving to the current Seedance model, the Seedance AI video examples page, or the exact Seedance video workflow that fits your use case.',
      topCards: [
        {
          title: 'What changed',
          body:
            'Seedance 2.0 is the newer Seedance AI video workflow with stronger multi-shot continuity, broader reference inputs, and a more current audio-first production path than Seedance 1.5 Pro.',
        },
        {
          title: 'When to stay on Seedance 1.5 Pro',
          body:
            'Stay on Seedance 1.5 Pro when you mainly need short, repeatable clips, simpler camera setups, and an older workflow that is already validated in production.',
        },
        {
          title: 'When to upgrade to Seedance 2.0',
          body:
            'Upgrade when you need better shot-to-shot continuity, richer native audio workflows, or a more flexible current model for higher-value creative work.',
        },
        {
          title: 'Best use cases',
          body:
            'Use this page to decide between a supported older Seedance workflow for short controlled clips and the current Seedance 2.0 workflow for multi-shot ads, launches, and more ambitious reference-driven sequences.',
        },
      ],
      primaryLinksTitle: 'Recommended next steps',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Open Seedance 2.0 model page',
        },
        {
          href: '/examples/seedance',
          label: 'View Seedance AI video examples',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Open Seedance 2.0 Fast model page',
        },
        {
          href: '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
          label: 'Compare Seedance 2.0 vs Seedance 2.0 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Short answers to help you decide whether to stay on Seedance 1.5 Pro or move to Seedance 2.0.',
        items: [
          {
            question: 'What changed between Seedance 1.5 Pro and Seedance 2.0?',
            answer:
              'Seedance 2.0 is the newer model with stronger multi-shot continuity, broader reference workflows, and the current Seedance path for production work. Seedance 1.5 Pro remains useful for shorter, simpler, repeatable clips.',
          },
          {
            question: 'Is Seedance 2.0 better than Seedance 1.5 Pro?',
            answer:
              'For most current workflows, yes. Seedance 2.0 is the better default if you want the current Seedance AI video model for continuity, flexibility, and broader production use, while Seedance 1.5 Pro remains useful as an older Seedance Pro setup for shorter clips.',
          },
          {
            question: 'When should I upgrade from Seedance 1.5 Pro to Seedance 2.0?',
            answer:
              'Upgrade when you need better multi-shot behavior, richer native audio workflows, or more headroom for current prompt and reference-driven production. If your existing 1.5 Pro workflow is already stable for short clips, you do not need to move every job immediately.',
          },
          {
            question: 'Is Seedance 1.5 Pro still good enough for some workflows?',
            answer:
              'Yes. It still fits short, repeatable cinematic clips and teams that already have validated prompt patterns on 1.5 Pro and do not need the broader 2.0 workflow yet.',
          },
          {
            question: 'Which model is better for multi-shot and native audio?',
            answer:
              'Seedance 2.0 is the better choice for multi-shot continuity and the more current native-audio workflow. Seedance 1.5 Pro is better treated as a simpler older option for shorter clips.',
          },
        ],
      },
    },
    'seedance-2-0-vs-seedance-2-0-fast': {
      heroIntro:
        'Compare Seedance 2.0 and Seedance 2.0 Fast to choose the right current Seedance AI video workflow for final multi-shot work, native audio, and workflow comparison. Use this page to see when standard Seedance is better for polished Seedance video output and when Fast is better for testing, timing checks, and cheaper iteration.',
      primaryLinksTitle: 'Recommended next steps',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Open Seedance 2.0 model page',
        },
        {
          href: '/examples/seedance',
          label: 'View Seedance AI video examples',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Open Seedance 2.0 Fast model page',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Short answers to help you choose the right current Seedance workflow.',
        items: [
          {
            question: 'Which Seedance AI video model should I use for draft work?',
            answer:
              'Use Seedance 2.0 Fast for cheaper draft passes, faster testing, and workflow comparisons. Use Seedance 2.0 when you want stronger final-quality multi-shot output, native audio, and a more production-ready workflow.',
          },
          {
            question: 'How is Seedance 2.0 different from Seedance 2.0 Fast?',
            answer:
              'Seedance 2.0 is the stronger current choice for polished multi-shot work, native audio, and more demanding reference-driven outputs, while Seedance 2.0 Fast is better for cheaper tests, timing checks, and early iteration.',
          },
          {
            question: 'Is Seedance 2.0 better for polished Seedance video output?',
            answer:
              'Yes. Seedance 2.0 is the better fit when the goal is polished Seedance video output, while Fast is the better fit when the goal is to test ideas and compare workflows quickly.',
          },
        ],
      },
    },
    'veo-3-1-vs-veo-3-1-fast': {
      heroIntro:
        'Compare Veo 3.1 and Veo 3.1 Fast to choose the right current Veo 3 AI workflow for polished text-to-video, image-to-video, faster draft passes, and native-audio control.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Short answers to help you choose the right current Veo workflow.',
        items: [
          {
            question: 'How should I use Veo 3 for text-to-video and draft testing?',
            answer:
              'Use Veo 3.1 Fast for cheaper draft passes, text-to-video prompt comparison, and quicker iteration. Use Veo 3.1 when you want stronger final-quality output, richer reference-guided control, and more polished image-to-video results.',
          },
          {
            question: 'Can I use both Veo 3.1 and Veo 3.1 Fast for image-to-video?',
            answer:
              'Yes. Both can handle image-to-video workflows, but Veo 3.1 is the better fit for more polished results while Veo 3.1 Fast is the better fit for cheaper prompt and framing tests.',
          },
          {
            question: 'When should I choose Veo 3.1 instead of Veo 3.1 Fast?',
            answer:
              'Choose Veo 3.1 when final quality, native audio polish, and stronger reference-guided control matter more than draft speed. Choose Fast when the goal is cheaper iteration and quicker workflow validation.',
          },
        ],
      },
    },
    'veo-3-1-fast-vs-veo-3-1-lite': {
      heroIntro:
        'Compare Veo 3.1 Fast and Veo 3.1 Lite to choose the right current Veo 3 AI workflow for cheaper text-to-video tests, image-to-video tests, native-audio behavior, and faster iteration.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Short answers to help you choose between the current Fast and Lite Veo tiers.',
        items: [
          {
            question: 'Which Veo 3 model is better for image-to-video tests?',
            answer:
              'Both can work, but Veo 3.1 Lite is better for the cheapest audio-ready image-to-video tests, while Veo 3.1 Fast is better when you want broader flexibility and a smoother upgrade path into full Veo 3.1.',
          },
          {
            question: 'Is Veo 3.1 Lite or Veo 3.1 Fast better for text-to-video drafts?',
            answer:
              'Veo 3.1 Lite is better when you want the lowest-cost audio-ready tests. Veo 3.1 Fast is better when you want more output flexibility, optional audio, and a cleaner bridge into the main Veo 3.1 workflow.',
          },
          {
            question: 'When should I choose Veo 3.1 Fast instead of Veo 3.1 Lite?',
            answer:
              'Choose Fast when you want broader workflow flexibility, optional audio control, and an easier upgrade path into Veo 3.1. Choose Lite when your priority is the cheapest current Veo testing with audio always on.',
          },
        ],
      },
    },
    'kling-3-pro-vs-kling-3-standard': {
      heroIntro:
        'Compare Kling 3 Pro and Kling 3 Standard to choose the right current Kling AI model for multi-shot video, Kling image-to-video workflows, reusable Kling Elements, and native-audio output quality.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Short answers to help you choose between the current Kling Pro and Standard tiers.',
        items: [
          {
            question: 'Which current Kling AI model is better for image-to-video and prompt testing?',
            answer:
              'Kling 3 Standard is better for lower-cost prompt testing and repeatable image-to-video tests, while Kling 3 Pro is better when you need tighter scene control and higher-priority final outputs.',
          },
          {
            question: 'Do Kling 3 Pro and Kling 3 Standard both support Kling Elements?',
            answer:
              'Yes. Both current Kling models support Kling Elements for character and prop continuity, but Kling 3 Pro is the stronger choice when the sequence is more demanding or continuity matters more.',
          },
          {
            question: 'When should I choose Kling 3 Pro instead of Kling 3 Standard?',
            answer:
              'Choose Kling 3 Pro when you need stronger scene control, more demanding multi-shot continuity, and higher-priority final output. Choose Kling 3 Standard when cost control and repeatable draft testing matter more.',
          },
        ],
      },
    },
  } satisfies ComparePageOverridesBySlug;
