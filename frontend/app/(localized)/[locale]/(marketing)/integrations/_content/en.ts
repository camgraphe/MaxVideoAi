import {
  MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND,
  MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND,
  MAXVIDEOAI_PUBLIC_PLUGIN_VERSION,
} from '@/config/maxvideoai-plugin-release';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import type { McpClientId } from '../../mcp/_lib/mcp-page-types';
import {
  getIntegrationInstallAction,
  getIntegrationInstallInstruction,
  getIntegrationLabel,
} from './shared';
import { buildN8nIntegrationCopy } from './n8n';
import { buildOpenClawIntegrationCopy } from './openclaw';
import type { IntegrationHostGuide, IntegrationPageCopy } from './types';

function buildEnglishGuides(client: McpClientId): IntegrationHostGuide[] {
  if (client === 'claude') {
    return [
      {
        hostId: 'claudeDesktop',
        title: 'Connect MaxVideoAI to Claude',
        intro: 'Add MaxVideoAI as a custom remote connector, then authorize your account in the browser.',
        installInstruction: getIntegrationInstallInstruction('en', 'claudeDesktop'),
        steps: [
          { title: 'Open connector settings', body: "Open Customize → Connectors → + → Add custom connector. In Team or Enterprise, an organization owner first adds it in Organization settings → Connectors." },
          { title: 'Add MaxVideoAI', body: "Use the production server below and the name MaxVideoAI. Choose Add, then Connect. Never paste an API key or account password." },
          { title: 'Approve the connection', body: "Sign in with your existing MaxVideoAI account, review access and return to Claude. Enable the connector in the conversation’s + → Connectors menu." },
        ],
        commands: [],
        setupValues: [{ label: 'MaxVideoAI server', value: MCP_PRODUCTION_RESOURCE_URL }],
        limitation: 'Your credits, private references and completed videos stay attached to the same MaxVideoAI account used on the website.',
      },
      {
        hostId: 'claudeCode',
        title: 'Use the same connector in Claude Code',
        intro: 'Register the remote server, then authenticate from Claude Code’s MCP panel.',
        installInstruction: getIntegrationInstallInstruction('en', 'claudeCode'),
        steps: [
          { title: 'Add the server', body: 'Run the command below once from the project or user scope you prefer.' },
          { title: 'Open the MCP panel', body: 'Open /mcp and select MaxVideoAI to start browser authorization.' },
          { title: 'Start with discovery', body: 'Ask for account status or current video models before preparing a paid generation.' },
        ],
        commandLabel: 'Claude Code commands',
        commands: [`claude mcp add --transport http maxvideoai ${MCP_PRODUCTION_RESOURCE_URL}`, 'claude mcp get maxvideoai'],
        setupValues: [],
        authTrigger: 'After adding the server, open /mcp in Claude Code to authenticate.',
        limitation: 'Claude Code uses the same MaxVideoAI account, current model catalog, exact quotes and confirmation boundary.',
      },
    ];
  }

  if (client === 'chatgpt') {
    return [
      {
        "hostId": "chatgptWeb",
        "title": "Connect MaxVideoAI in ChatGPT",
        "intro": "Add the production MCP connection in ChatGPT, sign in to your existing MaxVideoAI account, then return to a new conversation. MaxVideoAI is not submitted to the OpenAI directory; use this direct setup path.",
        installInstruction: getIntegrationInstallInstruction('en', 'chatgptWeb'),
        "steps": [
          {
            "title": "Open custom MCP setup",
            "body": "If required, enable Developer mode in Settings → Security and login. Open Plugins and choose the add button, then create a custom MCP app. Labels can vary by account and workspace permissions."
          },
          {
            "title": "Create MaxVideoAI and connect",
            "body": "Use the name MaxVideoAI, the production server below and OAuth. Create the connection, choose Connect, then sign in on maxvideoai.com and review access. If you see MaxVideoAI Staging, stop and check the configured server."
          },
          {
            "title": "Try it in a new chat",
            "body": "Choose Try in chat or select MaxVideoAI from the tools menu in a new conversation. First ask for your account status and available models, without starting a generation."
          }
        ],
        "commands": [],
        "setupValues": [
          {
            "label": "Production MCP server",
            "value": MCP_PRODUCTION_RESOURCE_URL
          }
        ],
        "authTrigger": "OAuth can start during creation when you choose Connect. Sign in with your existing MaxVideoAI account. Create an account only if you do not already have one.",
        "limitation": "Direct custom MCP setup depends on your ChatGPT plan, workspace permissions and available interface. It does not require a public directory listing. Installation and read-only account/model discovery were checked on 2026-10-01; paid generation and the full connection lifecycle were not tested in that checkpoint."
      }
    ];
  }

  return [
    {
      hostId: 'codexCli',
      title: 'Install the MaxVideoAI plugin in Codex',
      intro: 'Add the tagged MaxVideoAI marketplace, install the plugin, then authorize your account from a new Codex conversation.',
      installInstruction: getIntegrationInstallInstruction('en', 'codexCli'),
      steps: [
        { title: 'Add the marketplace', body: `Register the public MaxVideoAI repository at the reviewed ${MAXVIDEOAI_PUBLIC_PLUGIN_VERSION} release tag.` },
        { title: 'Install the plugin', body: 'Install MaxVideoAI once to get the plan and generate skills plus the production MCP connection.' },
        { title: 'Start a new task', body: 'Open a new Codex conversation, use $maxvideoai:plan or $maxvideoai:generate, and complete OAuth when prompted.' },
      ],
      commandLabel: 'Codex plugin commands',
      commands: [
        MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND,
        MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND,
      ],
      setupValues: [],
      authTrigger: 'OAuth starts when the new conversation first uses MaxVideoAI. Sign in or create the MaxVideoAI account you want to connect.',
      limitation: 'The tagged GitHub package includes both plan and generate skills and the production MCP connection. Generation still waits for an exact quote and explicit approval.',
    },
  ];
}

export function buildEnglishIntegrationCopy(client: McpClientId): IntegrationPageCopy {
  if (client === 'openclaw') return buildOpenClawIntegrationCopy('en');
  if (client === 'n8n') return buildN8nIntegrationCopy('en');
  const clientLabel = getIntegrationLabel(client);
  const productTerm = client === 'chatgpt'
    ? 'MaxVideoAI App'
    : client === 'claude'
      ? 'MaxVideoAI Connector'
      : 'MaxVideoAI Plugin';
  const setupDescription = client === 'chatgpt'
    ? "Connect MaxVideoAI to ChatGPT through a custom production MCP app and OAuth; compare models, review exact prices and recover results."
    : client === 'claude'
      ? 'Set up the remote connector in Claude to plan prompts and references, compare AI video models, review the exact quote, and approve generation with MaxVideoAI.'
      : 'Install the Codex plugin to plan prompts and references, compare current AI video models, review the exact quote, and approve generation with MaxVideoAI.';
  const setupIntro = client === 'chatgpt'
    ? "Connect the production MaxVideoAI MCP in ChatGPT and authorize the account you already use on maxvideoai.com. Then open a new chat with MaxVideoAI selected. Direct setup is available separately from public directory submission."
    : client === 'claude'
      ? 'This Claude route covers the remote connector setup and the complete creative handoff: develop the brief, compare current models and budgets, validate references, then approve an exact MaxVideoAI quote when the request is ready.'
      : 'This Codex route covers plugin installation and the complete creative handoff: develop the brief, compare current models and budgets, validate references, then approve an exact MaxVideoAI quote when the request is ready.';
  return {
    client,
    clientLabel,
    meta: {
      title: `${productTerm.replace(/^./, (value) => value.toUpperCase())} for ${clientLabel} | MaxVideoAI`,
      description: setupDescription,
    },
    hero: {
      eyebrow: client === 'chatgpt' ? 'MAXVIDEOAI APP' : client === 'claude' ? 'MAXVIDEOAI CONNECTOR' : 'MAXVIDEOAI PLUGIN',
      title: `Create AI video with MaxVideoAI in ${clientLabel}`,
      intro: setupIntro,
      unavailable: 'Plan prompts and references, compare current models, budget the project and review the exact MaxVideoAI production workflow.',
      liveStatus: client === 'chatgpt'
        ? "MaxVideoAI is free to connect through custom MCP. Sign in to your existing account on maxvideoai.com; approved generations use MaxVideoAI credits. There is no public OpenAI directory listing."
        : 'MaxVideoAI is free to connect, with no separate subscription. Sign in or create an account; advice and project estimates are free, and only an approved generation uses pay-as-you-go credits.',
      accountStatus: 'A MaxVideoAI account is required and free to create. Connect with no separate subscription; only approved generations use pay-as-you-go credits.',
      setupLabel: client === 'chatgpt' ? 'Connect MaxVideoAI in ChatGPT' : `Set up MaxVideoAI in ${clientLabel}`,
      backLabel: 'See the complete AI assistant workflow',
      backHref: '/mcp',
    },
    compatibility: {
      checkpointLabel: client === 'chatgpt' ? 'Flow documented' : 'Compatibility checked',
      machineStatusLabel: 'Host evidence state',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 completed OAuth, model discovery, budgeting, exact quote, media, recovery, upload-handoff and top-up-handoff checks on controlled staging.',
        claudeCode: 'The shared connector configuration is ready, but a direct Claude Code production check has not yet been recorded.',
        chatgptWeb: "Production installation, browser OAuth, return to ChatGPT and read-only account/model discovery were checked on 2026-10-01. Paid generation, refresh, revocation and reconnect remain unverified in ChatGPT.",
        codexCli: 'Codex CLI 0.150.0-alpha.8 completed production installation, OAuth, account, catalog, recommendation, budgeting, exact-quote, paid-generation, recovery and inline-player contract checks.',
      },
    },
    setup: {
      eyebrow: 'CONNECT YOUR ACCOUNT',
      title: `Set up MaxVideoAI in ${clientLabel}`,
      intro: 'Sign in or create your MaxVideoAI account during setup. One secure OAuth connection links the assistant to your pay-as-you-go credits, private media and completed generations in MaxVideoAI Library.',
      installAction: getIntegrationInstallAction('en', clientLabel),
      hostGuides: buildEnglishGuides(client),
      oauthTitle: 'What happens when you connect',
      oauthBody: 'The browser opens MaxVideoAI sign-in and consent. Approval identifies the connected account; the assistant never receives your password, payment details or direct database access.',
      oauthSteps: ["Sign in with the same MaxVideoAI account you use on the website; create one only if needed", "Review and approve access on MaxVideoAI; confirm your email if you just created an account", `Return to ${clientLabel} and check account status and models without generating`],
    },
    workflow: {
      eyebrow: 'FROM IDEA TO RESULT',
      title: `Create with ${clientLabel}; generate with MaxVideoAI`,
      intro: 'Keep the creative conversation in your assistant. MaxVideoAI handles the changing product facts and the paid execution boundary.',
      previewSteps: [
        { title: 'Develop the creative brief', body: `${clientLabel} can ask only for the missing decisions, write the shot plan and prepare prompts.` },
        { title: 'Compare real options', body: 'MaxVideoAI returns current capabilities and project estimates so you can choose quality, budget or a deliberate model mix.' },
        { title: 'Review the exact quote', body: 'The selected model, settings, references and price are validated together before any spend.' },
        { title: 'Approve, track and recover', body: 'Generation starts only after clear approval; completed media stays in the connected MaxVideoAI Library.' },
      ],
      liveSteps: [
        { title: 'Develop the creative brief', body: `${clientLabel} asks for the missing creative, format, quality and budget choices.` },
        { title: 'Compare current models', body: 'MaxVideoAI returns a best-fit recommendation plus credible alternatives with concrete trade-offs.' },
        { title: 'Review the exact quote', body: 'Check prompt, settings, references, price and account effect before approving.' },
        { title: 'Generate and follow the job', body: 'Approve once, recover status safely, and find the result in your MaxVideoAI Library.' },
      ],
    },
    references: {
      title: 'Use image, video or audio references when the model supports them',
      planningBody: `${clientLabel} can help create or improve reference ideas and choose the right asset for each shot.`,
      liveBody: 'Select an existing private image, video or audio asset from your MaxVideoAI Library, or open a secure upload handoff. Supported kinds and limits come from the selected model’s live details.',
      gatedBody: 'Plan references in the conversation, then keep private uploads, generation and completed media together in your MaxVideoAI account.',
    },
    troubleshooting: {
      eyebrow: 'HELP',
      title: `${clientLabel} connection help`,
      intro: 'The assistant can explain the next safe step without guessing your balance, job state or account destination.',
      items: [
        { question: "I see MaxVideoAI Staging or my website password is refused", answer: "Staging is a separate test environment with separate accounts. Check the connection’s server: use https://api.maxvideoai.com/mcp and the production login on maxvideoai.com. Do not create a test account to recover your website account. If the production login fails, use your usual Google sign-in or password reset." },
        { question: "Can the assistant install MaxVideoAI for me?", answer: client === 'chatgpt' ? "ChatGPT can explain the custom MCP setup; a chat request does not itself add the connection. You still use the setup controls and sign in to MaxVideoAI in the browser. After installation, select MaxVideoAI in a new conversation." : client === 'claude' ? "Claude chat guides you through Connectors. Claude Code can run the server configuration command when it has permission to use your terminal. In both cases, you approve your account connection in the browser." : "Codex can run the documented plugin commands when it has terminal access and your permission. You still sign in and approve access in the browser; a new task then loads the plugin." },
        { question: 'The assistant asks me to sign in again', answer: 'Complete OAuth in the browser, then return to the conversation. Never paste your MaxVideoAI password or API credentials into chat.' },
        { question: 'My balance is too low', answer: 'Ask for a secure top-up link. Payment stays on MaxVideoAI; after funding, check the balance and prepare a fresh quote before approving.' },
        { question: 'I cannot find a completed result', answer: 'Ask the assistant to list recent generations or open MaxVideoAI Library. Do not submit a duplicate paid job.' },
      ],
    },
    disconnect: {
      title: `Disconnect ${clientLabel}`,
      body: 'Remove the connection in the assistant and revoke the saved grant in MaxVideoAI account settings. Both steps prevent an old client entry from retaining access.',
      steps: [`Remove MaxVideoAI from ${clientLabel}`, 'Open MaxVideoAI account connections and revoke the grant', 'Reconnect later through a new browser approval if needed'],
    },
    support: { label: 'Contact MaxVideoAI support', href: '/contact' },
  };
}
