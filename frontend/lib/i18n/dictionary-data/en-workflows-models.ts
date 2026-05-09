import type { Dictionary } from '../dictionary-types';

export const workflows: Dictionary['workflows'] = {
    hero: {
      title: 'Express vs Workflows.',
      subtitle:
        'Express handles rapid experimentation. Workflows keeps the live “Price before you generate” chip today, with additional delivery integrations rolling out gradually.',
    },
    express: {
      badge: 'Express',
      title: 'Spin up publish-ready clips in minutes.',
      features: [
        'Template library with prompt scaffolds and guardrails',
        'Caption burn-in and optional voiceover generation',
        'Auto ratio exports for 16:9, 1:1, 9:16, 4:5',
      ],
    },
    workflows: {
      badge: 'Workflows',
      title: 'Full hand-off for brand and post teams.',
      features: [
        'Price before you generate chip (live)',
        'Delivery via Google Drive, OneDrive, Dropbox (coming soon)',
        'Nano Banana image (coming soon)',
      ],
    },
  };

export const models: Dictionary['models'] = {
    hero: {
      title: 'One workspace, every video engine that matters.',
      subtitle:
        'New provider endpoints land weekly — we pull them in automatically so your pricing and model catalog stay fresh across Sora, Veo, Pika, MiniMax, Kling, Wan, and Nano Banana.',
    },
    availabilityLabels: {
      available: 'Available',
      limited: 'Limited access',
      waitlist: 'Waitlist',
      paused: 'Paused',
    },
    meta: {
      'sora-2': {
        displayName: 'OpenAI Sora 2',
        description: 'Text-to-video and remix with native audio via managed routing.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: 'v2',
      },
      'sora-2-pro': {
        displayName: 'OpenAI Sora 2 Pro',
        description: 'Cinematic lip-sync with 1792×1024 output and image-to-video control for premium teams.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: 'Pro',
      },
      'veo-3-1': {
        displayName: 'Google Veo 3.1',
        description: 'Text, image, reference, first/last, and extend workflows in one Veo workspace.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: 'Veo 3.1',
      },
      'veo-3-1-fast': {
        displayName: 'Google Veo 3.1 Fast',
        description: 'Fast text, image, first/last, and extend workflows with optional audio.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: 'Veo 3.1 Fast',
      },
      'veo-3-1-lite': {
        displayName: 'Google Veo 3.1 Lite',
        description: 'Lower-cost Veo passes for text prompts, start-image animation, and last-frame control with audio always on.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: 'Veo 3.1 Lite',
      },
      'pika-text-to-video': {
        displayName: 'Pika 2.2 · Text & Image to Video',
        description: 'Social-first loops from prompts or uploaded stills with fast iteration.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: '2.2',
      },
      'minimax-hailuo-02-text': {
        displayName: 'MiniMax Hailuo 02 Standard · Text & Image to Video',
        description: 'Prompt optimiser-enabled drafts or reference-driven animation in one engine.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: 'Standard',
      },
    },
    note: '',
  };
