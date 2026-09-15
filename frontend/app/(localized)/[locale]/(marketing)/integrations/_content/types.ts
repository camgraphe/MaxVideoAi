import type { McpClientId, McpCompatibilityHostId } from '../../mcp/_lib/mcp-page-types';

export type IntegrationSetupValue = { label: string; value: string };

export type IntegrationStepProof = {
  src: string;
  alt: string;
  caption: string;
};
export type IntegrationHostGuide = {
  hostId: McpCompatibilityHostId;
  title: string;
  intro: string;
  installInstruction: string;
  steps: Array<{ title: string; body: string; proof?: IntegrationStepProof }>;
  commandLabel?: string;
  commands: string[];
  setupValues: IntegrationSetupValue[];
  authTrigger?: string;
  limitation: string;
};

export type IntegrationPageCopy = {
  client: McpClientId;
  clientLabel: string;
  meta: { title: string; description: string };
  hero: {
    eyebrow: string;
    title: string;
    intro: string;
    unavailable: string;
    liveStatus: string;
    accountStatus: string;
    setupLabel: string;
    backLabel: string;
    backHref: string;
  };
  compatibility: {
    checkpointLabel: string;
    machineStatusLabel: string;
    statuses: Partial<Record<McpCompatibilityHostId, string>>;
  };
  setup: {
    eyebrow: string;
    title: string;
    intro: string;
    installAction: {
      eyebrow: string;
      title: string;
      body: string;
      copyInstructionEnabled: boolean;
      showInstruction: string;
      copyInstruction: string;
      copiedInstruction: string;
      copyEndpoint: string;
      copiedEndpoint: string;
      copyError: string;
      detailEyebrow: string;
      detailTitle: string;
    };
    hostGuides: IntegrationHostGuide[];
    oauthTitle: string;
    oauthBody: string;
    oauthSteps: string[];
  };
  workflow: {
    eyebrow: string;
    title: string;
    intro: string;
    previewSteps: Array<{ title: string; body: string }>;
    liveSteps: Array<{ title: string; body: string }>;
  };
  references: {
    title: string;
    planningBody: string;
    liveBody: string;
    gatedBody: string;
  };
  troubleshooting: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<{ question: string; answer: string }>;
  };
  disconnect: { title: string; body: string; steps: string[] };
  support: { label: string; href: string };
};

export type IntegrationText = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  heroTitle: string;
  heroIntro: string;
  unavailable: string;
  setupLabel: string;
  backLabel: string;
  checkpointLabel: string;
  machineStatusLabel: string;
  statuses: Partial<Record<McpCompatibilityHostId, string>>;
  setupEyebrow: string;
  setupTitle: string;
  setupIntro: string;
  guides: IntegrationHostGuide[];
  oauthTitle: string;
  oauthBody: string;
  oauthSteps: string[];
  workflowEyebrow: string;
  workflowTitle: string;
  workflowIntro: string;
  workflowSteps: Array<{ title: string; body: string }>;
  referencesTitle: string;
  referencesPlanning: string;
  referencesGated: string;
  helpEyebrow: string;
  helpTitle: string;
  helpIntro: string;
  helpItems: Array<{ question: string; answer: string }>;
  disconnectTitle: string;
  disconnectBody: string;
  disconnectSteps: string[];
  supportLabel: string;
};
