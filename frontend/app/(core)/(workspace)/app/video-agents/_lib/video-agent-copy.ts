export const VIDEO_AGENT_COPY = {
  title: 'Commercial Video Agent',
  subtitle: 'Create one Seedance commercial video up to 15 seconds.',
  settings: {
    modelLabel: 'Model',
    durationLabel: 'Duration',
    formatLabel: 'Format',
    resolutionLabel: 'Resolution',
    audioLabel: 'Audio',
    estimateLabel: 'Est.',
  },
  chat: {
    header: 'Commercial Video Agent',
    badge: 'AI',
    firstMessage: 'Hi, ready to make a commercial video? What do you have in mind?',
    productImage: 'Add product image',
    inputPlaceholder: 'Product, place, style, audience, CTA...',
    quickPrompts: ['Premium product reveal', 'UGC style', 'Restaurant ad', 'App promo'],
    followUp:
      'Great. Where should the scene take place, and is there anything the video must include or avoid?',
    compatibility:
      'I can help with that. I will keep the request within Seedance 2.0 limits and avoid unsupported content.',
  },
  preview: {
    header: 'Preview',
    emptyTitle: 'Your Seedance video will appear here',
    statusPrefix: '1 video',
    reservedNote: 'Credits reserved from chat confirmation',
    actions: {
      regenerate: 'Regenerate',
      premium: 'Make more premium',
      download: 'Download',
      save: 'Save',
    },
  },
} as const;
