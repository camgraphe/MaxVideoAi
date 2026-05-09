import type { Dictionary } from '../dictionary-types';

export const examples: Dictionary['examples'] = {
    hero: {
      title: 'Engine showcases.',
      subtitle: 'Hover to loop, click to expand. Each clip previews the motion and style you can route in MaxVideo AI.',
    },
    items: [
      {
        title: 'Sora 2 cinematic',
        engine: 'Sora 2 · Text-to-video · 16:9',
        description: 'Cinematic motion pass capturing atmospheric lighting and parallax.',
        alt: 'Sora 2 example clip.',
        meta: {
          slug: 'sora-2',
          pricing: { engineId: 'sora-2', durationSec: 10, resolution: '1080p', memberTier: 'member' },
        },
        media: {
          videoSrc: '/hero/sora2.mp4',
          aspectRatio: '16:9',
        },
      },
      {
        title: 'Veo 3 branded flythrough',
        engine: 'Veo 3.1 · Image-to-video · 16:9',
        description: 'Depth-rich branded flythrough emphasising camera control.',
        alt: 'Veo 3 example clip.',
        meta: {
          slug: 'veo-3-1',
          pricing: { engineId: 'veo-3-1', durationSec: 8, resolution: '1080p', memberTier: 'member' },
        },
        media: {
          videoSrc: '/hero/veo3.mp4',
          aspectRatio: '16:9',
        },
      },
      {
        title: 'Veo 3.1 Fast storyboard pass',
        engine: 'Veo 3.1 Fast · Text-to-video · 16:9',
        description: 'Fast queue render with optional ambient audio to validate motion before the hero clip.',
        alt: 'Veo 3.1 Fast example clip.',
        meta: {
          slug: 'veo-3-1-fast',
          pricing: { engineId: 'veo-3-1-fast', durationSec: 8, resolution: '720p', memberTier: 'member' },
        },
        media: {
          videoSrc: '/hero/veo3.mp4',
          aspectRatio: '16:9',
        },
      },
      {
        title: 'Pika 2.2 social loop',
        engine: 'Pika 2.2 · Text-to-video · 16:9',
        description: 'Fast-paced social loop with stylised motion accents.',
        alt: 'Pika 2.2 example clip.',
        meta: {
          slug: 'pika-text-to-video',
          pricing: { engineId: 'pika-text-to-video', durationSec: 8, resolution: '1080p', memberTier: 'member' },
        },
        media: {
          videoSrc: '/hero/pika-22.mp4',
          aspectRatio: '16:9',
        },
      },
      {
        title: 'MiniMax Hailuo concept pass',
        engine: 'MiniMax Hailuo 02 · Text/Image-to-video · 16:9',
        description: 'Animated concept art pass driven by a single reference frame.',
        alt: 'MiniMax Hailuo Standard example clip.',
        meta: {
          slug: 'minimax-hailuo-02-text',
          pricing: { engineId: 'minimax-hailuo-02-text', durationSec: 10, resolution: '768P', memberTier: 'member' },
        },
        media: {
          videoSrc: '/hero/minimax-video01.mp4',
          aspectRatio: '16:9',
        },
      },
    ],
    cta: 'Generate similar video',
  };

export const docs: Dictionary['docs'] = {
    hero: {
      title: 'Documentation',
      subtitle:
        'Start here for onboarding, brand safety, works-with notices, and refund policies. Deeper integration guides live in the authenticated workspace.',
    },
    sections: [
      {
        title: 'Brief',
        items: [
          'Fill the brand brief once so saved defaults and routing hints work for everyone.',
          'Share tone, context, and deliverables so each teammate can render without extra back-and-forth.',
        ],
      },
      {
        title: 'Price system',
        items: [
          'Preview the exact price before you render. The price chip updates with duration, resolution, and automatic discounts.',
          'Starter Credits ($10) and rolling Member status (Member / Plus / Pro) update daily.',
        ],
      },
      {
        title: 'Refunds',
        items: [
          'If a render fails, your wallet is automatically refunded within minutes and the job includes a short incident note.',
          'Itemised receipts list engine, duration, resolution, and a job ID—easy hand-off to finance.',
          {
            type: 'link',
            before: 'For legal detail, see ',
            terms: 'Terms',
            and: ' and ',
            privacy: 'Privacy',
            after: '.',
          },
        ],
      },
      {
        title: 'Brand-safe filters',
        items: [
          'We block risky prompts, uploads, and outputs by default—so teams stay within policy without extra babysitting.',
          'Sensitive cases route to human review with an audit trail and simple escalation options when needed.',
          'Admins can request custom allowlists or restricted keywords per workspace.',
        ],
      },
      {
        title: 'API references',
        items: [
          'Webhook callbacks for renders, refunds, and queue updates.',
          'REST and GraphQL references live inside the authenticated docs.',
          'SDK examples cover Node.js, Python, and direct webhook verification.',
        ],
      },
    ],
    empty: 'Documentation coming soon.',
    libraryHeading: 'Library',
  };

export const blog: Dictionary['blog'] = {
    hero: {
      title: 'The MaxVideo AI blog.',
      subtitle:
        'News on engines, customer stories, prompt guides, and price-before best practices. Subscribe in-app to get updates in your queue digest.',
    },
    empty: 'Blog posts coming soon.',
    cta: 'Read more',
  };

export const about: Dictionary['about'] = {
    hero: {
      title: 'Quiet confidence for AI video teams.',
      subtitle:
        'MaxVideo AI is the independent hub for AI video production. We route to the right engine for every shot, price before you generate, and keep your team in control without vendor lock-in.',
    },
    paragraphs: [
      'We believe professional teams deserve clarity before they hit render. That means price transparency, reliable routing, and shared context between creatives, producers, and stakeholders.',
      'Independence matters: we stay neutral across engines, integrate with Sora 2, Veo 3.1, Veo 3 Fast, Pika 2.2, MiniMax Hailuo 02, Hunyuan Image, and rotating betas, and list trademarks only to describe compatibility.',
      'The product is engineered for teams that need precision without noise. Quiet UI, premium defaults, precise controls, and price-before chips that keep finance in the loop.',
    ],
    note:
      'Trademarks and service marks are property of their respective owners. MaxVideo AI stays independent so you can stay current without switching platforms.',
  };

export const contact: Dictionary['contact'] = {
    hero: {
      title: 'Contact the team.',
      subtitle: 'Need support, enterprise onboarding, or press information? Send a note and we’ll reply within one business day.',
    },
    form: {
      name: 'Name',
      email: 'Email',
      topic: 'Topic',
      selectPlaceholder: 'Select a topic',
      topics: [
        { value: 'support', label: 'Support' },
        { value: 'sales', label: 'Sales' },
        { value: 'partnerships', label: 'Partnerships' },
        { value: 'press', label: 'Press' },
      ],
      message: 'Message',
      submit: 'Send message',
      alt: 'Prefer email? Write to {email}.',
    },
  };
