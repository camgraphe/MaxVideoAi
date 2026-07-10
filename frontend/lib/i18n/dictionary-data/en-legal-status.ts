import type { Dictionary } from '../dictionary-types';

export const legal: Dictionary['legal'] = {
    terms: {
      title: 'Terms of service',
      intro: 'These terms constitute the current valid User Agreement.',
      sections: [
        {
          heading: '1. Overview',
          body: 'These Terms govern your use of MaxVideo AI. By accessing the service you agree to the obligations below.',
        },
        {
          heading: '2. Accounts',
          body: 'You are responsible for maintaining account security and ensuring teammates comply with these Terms.',
        },
        {
          heading: '3. Usage & Compliance',
          body:
            'Use MaxVideo AI only in compliance with applicable laws, respect licensing limits, never upload illegal or infringing assets, and do not attempt to generate prohibited or unsafe content. We may review, block, or remove renders and suspend access when videos violate these Terms or our policies.',
        },
        {
          heading: '4. User Content & Generated Media',
          body:
            'User uploads (photos, logos, reference footage, prompts) remain your property. We may store, process, and display uploaded assets solely to produce the requested text-to-video or image-to-video render and to deliver the workspace features you enable. For every piece of generated media, you grant MaxVideoAI a worldwide, non-exclusive, royalty-free, transferable, and sublicensable license to host, reproduce, index, display, and otherwise use the videos to operate the service, improve routing and models, run safety reviews, and showcase Examples galleries, template pages, or other marketing placements. You may mark renders as private inside your workspace or request delisting by contacting support if a privacy toggle is unavailable, and we will honor the request.',
        },
        {
          heading: '5. Billing',
          body: 'Wallet charges apply only to successful renders. Refunds are issued automatically for failed jobs.',
        },
        {
          heading: '6. Liability',
          body: 'MaxVideo AI is provided as-is. We limit liability to the maximum extent permitted by law.',
        },
      ],
    },
    privacy: {
      title: 'Privacy policy',
      intro: 'Highlights of our privacy practices. Final legal copy will live here.',
      sections: [
        { heading: '1. Data we collect', body: 'Workspace details, usage metrics, and billing information needed to deliver the service.' },
        { heading: '2. How we use data', body: 'Operate routing, improve product quality, and communicate critical updates.' },
        { heading: '3. Storage & security', body: 'We store data in encrypted systems with least-privilege access. Render assets auto-expire per workspace policy.' },
        { heading: '4. Sharing', body: 'We only share data with underlying engine providers when routing renders. We never sell customer data.' },
        { heading: '5. Your choices', body: 'Request export or deletion any time via support@maxvideoai.com. Admins control retention windows.' },
      ],
    },
  };

export const changelog: Dictionary['changelog'] = {
    hero: {
      title: 'Changelog',
      subtitle: 'Every engine update, workflow improvement, and pricing tweak — published weekly. Subscribe inside the app for alerts.',
    },
    entries: [
      {
        date: '2024-06-12',
        title: 'Veo templates + queue transparency',
        body: 'Added Veo V2 routing, queue length indicator on Price-Before chip, and shared wallet notifications.',
      },
      {
        date: '2024-06-05',
        title: 'Refund automation',
        body: 'Automatic refunds now trigger within 90 seconds when renders fail or providers error out.',
      },
      {
        date: '2024-05-29',
        title: 'Brand kit hand-off',
        body: 'Workflows export brand kits into FCPXML and AE JSON for post teams.',
      },
    ],
  };

export const status: Dictionary['status'] = {
  hero: {
    title: 'Service status',
    subtitle: 'Current service notices published by the MaxVideoAI team.',
  },
  currentNotice: {
    title: 'Current notice',
    activeLabel: 'Active service notice',
    clearLabel: 'No active service notice',
    clearBody: 'There is no administrator-published service notice at this time.',
  },
  affected: {
    title: 'If a generation is affected',
    body: 'Failed generations follow the existing refund policy. If a job is delayed, avoid submitting duplicates and keep its job ID available.',
  },
  support: {
    title: 'Need help?',
    prefix: 'Contact',
    suffix: 'and include the job ID and engine name so the team can investigate.',
  },
};

export const systemMessages: Dictionary['systemMessages'] = {
    refundInitiated: 'Your payment is being refunded. It can take 5–10 business days to appear on your statement.',
    partialRefund: 'We’ve issued a partial refund of {refundedAmount}. The remaining {remainingAmount} will stay on your statement.',
    paymentRetried: 'We’ve safely retried your payment; you will not be double-charged.',
  };
