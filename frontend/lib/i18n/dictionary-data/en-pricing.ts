import type { Dictionary } from '../dictionary-types';

export const pricing: Dictionary['pricing'] = {
    hero: {
      title: 'Price before you generate. Pay only for what you run. Start with Starter Credits ($10). No subscription. No lock-in.',
      subtitle: 'Every estimate updates live as you adjust engines, durations, and outputs. Wallet balances sync across teams with daily status checks.',
    },
    estimator: {
      title: 'Cost Estimator',
      subtitle: 'Choose the engine, duration, and resolution to see pricing before you queue the render. Charged only if it succeeds.',
      walletLink: 'Want a public version for clients?',
      walletLinkCta: 'Open the calculator',
      chargedNote: 'Charged only if render succeeds.',
      fields: {
        engine: 'Engine',
        resolution: 'Resolution',
        duration: 'Duration (seconds)',
        memberStatus: 'Member status',
      },
      estimateLabels: {
        heading: 'Estimate',
        base: 'Base',
        discount: 'Discount',
        memberChipPrefix: 'Member price — You save',
      },
      descriptions: {
        'sora-2': 'Text/image remix with native audio.',
        'veo-3-1': 'Swap between text-to-video prompts or multi-image reference control.',
        'veo-3-1-fast': 'Use Veo 3.1 Fast for quick text, start-image, last-frame, and extend passes.',
        'veo-3-1-lite': 'Use Veo 3.1 Lite for lower-cost text, start-image, and last-frame passes with audio always on.',
        'pika-text-to-video': 'Quick social loops with captions and remix-friendly settings.',
        'minimax-hailuo-02-text': 'Prompt-optimised drafts before the hero render.',
      },
      engineRateLabel: 'Engine rate',
      durationLabel: 'Duration',
      resolutionLabel: 'Resolution',
    },
    wallet: {
      title: 'Wallet',
      description: 'Fund your wallet with Starter Credits ($10) or add $10 / $25 / $50 at a time. Optional auto top-up keeps renders moving.',
      points: [
        'Starter Credits ($10) to get rolling instantly.',
        'Add funds in $10, $25, or $50 increments when you need them.',
        'Optional auto top-up with alerts when balance drops below your threshold.',
      ],
      balanceLabel: 'Wallet balance',
      balanceHelper: 'Starter Credits begin at $10. Shared wallets sync automatically.',
      autoTopUpLabel: 'Auto top-up when balance dips below $10',
      autoTopUpHint: 'Daily status emails keep finance in the loop.',
      addLabel: 'Add ${amount}',
    },
    teams: {
      title: 'Teams',
      description: 'Role-based approvals, shared wallets, and delivery hand-offs roll out next. Join the beta to test team controls early.',
      comingSoonNote: 'Teams features are in private beta. Contact support@maxvideoai.com to join the rollout.',
      points: [
        'Role-based shared wallets with approvals across finance, producers, and stakeholders.',
        'Automated daily summaries covering spend, refunds, and queue health.',
        'Delivery hand-offs to Google Drive, OneDrive, and Dropbox.',
      ],
    },
    member: {
      title: 'Member status',
      subtitle: 'Discounts update instantly when admins edit thresholds in Settings → Billing → Member tiers.',
      tiers: [
        {
          name: 'Member',
          requirement: 'Default status',
          benefit: 'Standard pricing. Chip reads “Member price”.',
        },
        {
          name: 'Plus',
          requirement: 'Admin-defined threshold',
          benefit: 'Workspace discount set in Billing.',
        },
        {
          name: 'Pro',
          requirement: 'Admin-defined threshold',
          benefit: 'Workspace discount set in Billing.',
        },
      ],
      chipBase: 'Member price — You save',
      tooltip: 'Status updates daily on your last 30 days of spend.',
    },
    refunds: {
      title: 'Refunds & protections',
      points: [
        'Automatic refunds when renders fail or providers miss SLAs.',
        'Itemised receipts with engine, duration, resolution, and add-ons.',
        'Wallet protections with optional multi-approver top-ups.',
        'Application fee is recognised immediately; vendor share settles on payout.',
        'Every render attempt carries an idempotency key to prevent duplicate charges.',
      ],
    },
    faq: {
      title: 'Micro-FAQ',
      entries: [
        {
          question: 'How do credits work?',
          answer: 'Starter Credits load $10 into your wallet. Spend them like cash and top up whenever you need more runs.',
        },
        {
          question: 'Do they expire?',
          answer: 'No expiry. Balances roll forward month to month and sync across every teammate with access.',
        },
        {
          question: 'What if a generation fails?',
          answer: 'Failed renders auto-refund within minutes. You only pay when the job completes successfully.',
        },
        {
          question: 'What are member discounts?',
          answer: 'Spend $50 in 30 days to save 5%, $200 to save 10%. Savings apply automatically to every eligible run.',
        },
      ],
    },
    priceChipSuffix: 'Price before you generate.',
    priceChipPrefix: 'This render',
  };

export const calculator: Dictionary['calculator'] = {
    hero: {
      title: 'Estimate your AI video cost before you generate.',
      subtitle: 'This public calculator mirrors the estimator inside MaxVideo AI. Pick an engine, duration, and resolution to preview the cost chip with no login required.',
    },
    lite: {
      title: 'Lite calculator',
      subtitle: 'Great for stakeholders who need a quick estimate before sharing prompts or assets.',
      footer: 'Ready to run the job? {link} to fund your wallet and generate inside the workspace.',
      footerLinkText: 'Head to Pricing',
    },
  };
