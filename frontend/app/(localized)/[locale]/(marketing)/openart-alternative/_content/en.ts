import type { OpenArtCopy } from './types';

export const en = {
  meta: {
    title: 'OpenArt alternative for a few shots — MaxVideoAI',
    description: 'Compare MaxVideoAI and OpenArt Director for individual video shots or a finished film. See how subscriptions, credits, free chat and MCP work.',
  },
  hero: {
    title: 'An OpenArt alternative\nfor the shots you need.',
    lead: 'Generate the clips you want to cut yourself. See the price before each render, and fund your project without a MaxVideoAI subscription.',
    action: 'Price a shot',
    compare: 'Compare both workflows',
    note: 'Media top-ups start at US$10. Each approved generation uses your wallet balance.',
    imageAlt: 'Six storyboard panels of a runner crossing a rainy city at night',
    imageCaption: 'Storyboard artwork from MaxVideoAI Studio',
  },
  decision: {
    label: 'The deliverable comes first',
    title: 'A few clips or an assembled film?',
    options: [
      {
        title: 'Generate shots for your own edit',
        text: 'Choose MaxVideoAI when you have a shot list and want to set the model, duration and budget for each clip.',
        steps: ['Choose a shot', 'Review the quote', 'Download the clip'],
      },
      {
        title: 'Start from a brief and get a film',
        text: 'Choose OpenArt Director when you want one workflow to build the storyboard, scenes and sound and deliver an assembled video.',
        steps: ['Describe the film', 'Direct the scenes', 'Get the assembled video'],
      },
    ],
  },
  matrix: {
    title: 'Compare access, credits and delivery',
    caption: 'MaxVideoAI and OpenArt offer comparison',
    criterion: 'What matters',
    note: 'The prices shown are in US dollars. OpenArt lists US$14 per seat per month for Starter before the discount displayed at the time of review. Check the billing term, current price and eligibility before buying.',
    sources: 'Read the official sources',
  },
  rows: {
    entry: {
      label: 'Before the first payment',
      max: 'Browse prices and see a live quote for your chosen video settings before funding your wallet.',
      openart: 'New accounts get 40 trial credits for 7 days, with no card required. Starter lists 4,000 monthly credits.',
    },
    funding: {
      label: 'Fund a project',
      max: 'Add media credits from US$10 when you need them. Each render has a price to review before you launch it.',
      openart: 'Paid plans include a monthly credit allowance. With Plus, Pro or Wonder, extra credit packs renew automatically each month until canceled.',
    },
    balance: {
      label: 'Between projects',
      max: 'Purchased media credits stay available in your wallet for future projects.',
      openart: 'Monthly plan credits reset each billing cycle. Unused add-on credits can roll over while the subscription is active.',
    },
    chat: {
      label: 'Native assistant',
      max: 'Use Milo Lite for planning at no extra assistance cost, within request and availability limits. Advanced assistance and media generation have separate credits.',
      openart: 'Chat Mode is free for conversation. Generations and edits spend credits. Turn on Ask First to review the model, settings and cost before running.',
    },
    mcp: {
      label: 'External assistants',
      max: 'Plan at no MaxVideoAI charge over MCP with a compatible host. Review and approve the media quote before paying from your wallet. The host may have its own fees and limits.',
      openart: 'MCP has no separate OpenArt fee and is included from Starter. Web, MCP and CLI share OpenArt credits. The Claude and ChatGPT guides also advertise the new-account trial. Access depends on the host.',
    },
    delivery: {
      label: 'What you take away',
      max: 'Create and download individual clips for your own edit. Use Studio to plan shots and approve each media quote.',
      openart: 'Director plans scenes, builds a storyboard and assembles a video with sound. OpenArt advertises films up to five minutes.',
    },
  },
  workflow: {
    label: 'The MaxVideoAI workflow',
    title: 'Take one shot from brief to edit.',
    text: 'Plan in Studio with Milo, or bring a brief from a compatible assistant over MCP. Move from a shot idea to a decision with a real price attached.',
    steps: [
      { title: 'Describe the shot', text: 'Define what happens in frame and bring a reference if it helps the model.' },
      { title: 'Set the scope', text: 'Pick the model, duration, resolution and sound. Review the live quote for those settings.' },
      { title: 'Approve and download', text: 'Approve the price, then download the finished clip and take it into your edit.' },
    ],
    studio: 'Explore Studio and Milo',
    mcp: 'See compatible assistants',
  },
  budget: {
    title: 'Budget for the shots you will keep.',
    intro: 'Use the same shot brief, model version, duration, resolution and sound setting when comparing prices. Price the delivery you need on each platform.',
    items: [
      { title: 'Cash to start', text: 'Check the first top-up or subscription payment and the term you are buying.' },
      { title: 'Paid attempts', text: 'Include completed renders you may discard. A new attempt has a fresh quote.' },
      { title: 'Credits left', text: 'Check when the unused balance resets and what you can use for your next project.' },
    ],
    guide: 'Estimate the cost of a project',
    calculator: 'See live pricing',
  },
  closing: {
    title: 'Bring one shot. See what it costs.',
    text: 'Try your actual settings and review the quote before you decide whether to render.',
    action: 'Price a shot',
    guide: 'Compare AI video platforms',
  },
  faq: {
    title: 'Questions about OpenArt and MaxVideoAI',
    items: [
      {
        question: 'Can I buy extra OpenArt credits without a subscription?',
        answer: 'OpenArt offers extra credit packs with an active Plus, Pro or Wonder subscription. The packs renew automatically each month until canceled. New accounts get 40 trial credits for seven days. MaxVideoAI sells media top-ups from US$10 without a subscription.',
      },
      {
        question: 'Do unused OpenArt credits carry over?',
        answer: 'Monthly plan credits reset every billing cycle. OpenArt says unused add-on credits carry forward while the subscription is active. Check the billing terms and credit type before buying.',
      },
      {
        question: 'Are OpenArt Chat Mode and MCP free?',
        answer: 'Chat Mode conversation is free. Media generations and edits spend credits. MCP has no extra OpenArt fee and is included from Starter. The Claude and ChatGPT guides also advertise the trial for new accounts. Check your assistant host’s access rules and fees separately.',
      },
      {
        question: 'When should I choose OpenArt Director?',
        answer: 'Director is designed for a multi-scene video assembled with a storyboard and sound. OpenArt lists up to five minutes. Choose MaxVideoAI if you want to plan, price and generate individual clips to assemble in your own edit.',
      },
      {
        question: 'Is MaxVideoAI always cheaper than OpenArt?',
        answer: 'The total depends on your model settings, number of paid attempts and use of a subscription allowance. Compare the first payment, media cost and remaining balance separately. OpenArt Director and individual clips are different deliverables.',
      },
    ],
  },
  evidence: {
    title: 'Sources and scope',
    date: 'November 10, 2026',
    note: 'Published by MaxVideoAI. We reviewed the official public pages. Prices, plan eligibility and host access can change. The comparison covers documented features and credit terms.',
  },
  sourceLabels: {
    'openart-pricing': 'Plans and Starter allowance',
    'openart-trial': 'Trial credits and expiry',
    'openart-credits': 'Monthly credits and add-ons',
    'openart-chat': 'Chat Mode and Ask First',
    'openart-director': 'Director and film assembly',
    'openart-mcp': 'MCP, CLI and the shared balance',
    'openart-claude': 'Claude access and trial',
    'openart-chatgpt': 'ChatGPT access and trial',
    'max-pricing': 'Media top-ups and live quotes',
    'max-wallet': 'Media wallet and balance',
    'max-studio': 'Studio, Milo and media approval',
    'max-mcp': 'Assistant access and generation pricing',
  },
} satisfies OpenArtCopy;
