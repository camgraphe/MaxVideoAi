import type { OpenArtCopy } from './types';

export const en = {
  meta: {
    title: 'OpenArt alternative with no subscription — MaxVideoAI',
    description: 'Create video shots on MaxVideoAI without a subscription. See the price before rendering, keep unused purchased credits and compare with OpenArt Director.',
  },
  hero: {
    title: 'An OpenArt alternative.\nPay as you go.',
    lead: 'With MaxVideoAI, choose the model, duration and sound for your clip. See the price before each render. Unused media credits you buy stay in your wallet for future projects.',
    action: 'Price a shot',
    compare: 'Compare both workflows',
    note: 'Media top-ups start at US$10, with no MaxVideoAI subscription.',
    imageAlt: 'Six storyboard panels of a runner crossing a rainy city at night',
    imageCaption: 'Storyboard artwork from MaxVideoAI Studio',
  },
  decision: {
    label: 'The deliverable comes first',
    title: 'Stay in control of every shot.',
    options: [
      {
        title: 'Generate shots for your own edit',
        text: 'Shape your idea with Milo in Studio. Pick the model, duration and sound, then download the clip for your edit.',
        steps: ['Plan the shot', 'Review the quote', 'Download the clip'],
      },
      {
        title: 'An assembled video from a brief',
        text: 'OpenArt Director builds the storyboard and scenes, then assembles a video with sound.',
        steps: ['Film brief', 'Storyboard and scenes', 'Assembled video'],
      },
    ],
  },
  matrix: {
    title: 'Compare access, credits and delivery',
    caption: 'MaxVideoAI and OpenArt offer comparison',
    criterion: 'What matters',
    note: 'At the time of review, OpenArt listed Starter at US$14 per seat per month before discounts. Check the billing term and the price available to your account.',
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
      max: 'Plan shots with Milo Lite for free within usage and availability limits. Advanced assistance and media generation have separate credits.',
      openart: 'Chat Mode is free for conversation. Generations and edits spend credits. Ask First shows the model, settings and cost for review before running.',
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
    title: 'Budget for your shots and retakes.',
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
    text: 'Choose your settings and see the price before signing in.',
    action: 'Price a shot',
    guide: 'Compare AI video platforms',
  },
  faq: {
    title: 'Questions about MaxVideoAI and OpenArt',
    items: [
      {
        question: 'Can I buy extra OpenArt credits without a subscription?',
        answer: 'OpenArt offers extra credit packs with an active Plus, Pro or Wonder subscription. The packs renew automatically each month until canceled. New accounts get 40 trial credits for seven days. MaxVideoAI sells media top-ups from US$10 without a subscription.',
      },
      {
        question: 'Do unused OpenArt credits carry over?',
        answer: 'On MaxVideoAI, purchased media credits stay available between projects without a subscription. OpenArt’s monthly plan allowance resets each billing cycle. Unused add-on credits carry forward while the subscription is active.',
      },
      {
        question: 'Are OpenArt Chat Mode and MCP free?',
        answer: 'Chat Mode conversation is free. Media generations and edits spend credits. MCP has no extra OpenArt fee and is included from Starter. The Claude and ChatGPT guides also advertise the trial for new accounts. The assistant host may have its own access rules and fees.',
      },
      {
        question: 'What’s the difference between MaxVideoAI and OpenArt Director?',
        answer: 'MaxVideoAI helps you plan a shot with Milo, check its price and generate a clip for your edit. OpenArt Director builds a storyboard and assembles several scenes with sound. OpenArt advertises videos of up to five minutes.',
      },
      {
        question: 'How do I compare clip costs on MaxVideoAI and OpenArt?',
        answer: 'MaxVideoAI media top-ups start at US$10 without a subscription, and you see the price before each render. With matching settings, compare the first payment, completed attempts, remaining balance and how much of any plan allowance you use. Budget separately for an individual clip and a film assembled with Director.',
      },
    ],
  },
  evidence: {
    title: 'Sources and scope',
    date: 'November 10, 2026',
    note: 'Published by MaxVideoAI. The official public sources document the features and credit terms shown here.',
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
