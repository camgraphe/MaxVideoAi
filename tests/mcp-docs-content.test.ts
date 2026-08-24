import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import mcpPublication from '../frontend/config/mcp-publication.json';
import { getEditorialProfile } from '../frontend/lib/editorial/profile';
import { getMcpPublicationState } from '../frontend/lib/mcp-publication';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { AgentAccountStatus, AgentModel } from '../frontend/src/server/agent-api/types';
import { MCP_PRODUCTION_RESOURCE_URL, type McpConfig } from '../frontend/src/server/mcp/config';
import { handleMcpHttpRequest } from '../frontend/src/server/mcp/http-handler';
import { resolveAgentPrincipal } from '../frontend/src/server/mcp/oauth-adapter';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const locales = ['en', 'fr', 'es'] as const;
type Locale = (typeof locales)[number];

const docPaths: Record<Locale, string> = {
  en: 'content/docs/mcp.mdx',
  fr: 'content/fr/docs/mcp.mdx',
  es: 'content/es/docs/mcp.mdx',
};

const docsIndexDataPath =
  'frontend/app/(localized)/[locale]/(marketing)/docs/_lib/docs-index-data.ts';
const docsArticlePagePath =
  'frontend/app/(localized)/[locale]/(marketing)/docs/[slug]/page.tsx';
const docsArticleJsonLdPath =
  'frontend/app/(localized)/[locale]/(marketing)/docs/_lib/docs-article-jsonld.ts';
const docsArticleAttributionPath =
  'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsArticleAttribution.tsx';
const docsSectionsPath =
  'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsSectionsGrid.tsx';
const compatibilityPath = 'docs/operations/mcp-host-compatibility-matrix.md';
const directorySubmissionsPath = 'docs/marketing/mcp-directory-submissions.md';
const publicClaimsPath = 'docs/marketing/mcp-public-claims-matrix.md';

function source(locale: Locale): string {
  const path = docPaths[locale];
  assert.equal(existsSync(path), true, `${path} should exist`);
  return readFileSync(path, 'utf8');
}

function body(locale: Locale): string {
  return source(locale).replace(/^---[\s\S]*?---\s*/, '');
}

function tableNames(markdown: string, pattern: RegExp): string[] {
  return markdown
    .split('\n')
    .map((line) => line.match(pattern)?.[1] ?? null)
    .filter((value): value is string => Boolean(value));
}

function section(markdown: string, start: RegExp, end: RegExp): string {
  const startMatch = markdown.match(start);
  assert.ok(startMatch?.index != null, `missing section ${start}`);
  const fromStart = markdown.slice(startMatch.index);
  const endMatch = fromStart.slice(startMatch[0].length).match(end);
  return endMatch?.index == null
    ? fromStart
    : fromStart.slice(0, startMatch[0].length + endMatch.index);
}

type ParsedToolRow = {
  name: string;
  useWhen: string;
  purpose: string;
  sideEffects: string;
  destructive: string;
  openWorld: string;
  idempotent: string;
  auth: string;
  confirmationAndNegativeCase: string;
};

function parsedToolRows(markdown: string): ParsedToolRow[] {
  return markdown
    .split('\n')
    .filter((line) => /^\|\s*`[a-z_]+`\s*\|/.test(line))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      assert.equal(cells.length, 9, `unexpected MCP tool-table shape: ${line}`);
      return {
        name: cells[0].replaceAll('`', ''),
        useWhen: cells[1],
        purpose: cells[2],
        sideEffects: cells[3],
        destructive: cells[4],
        openWorld: cells[5],
        idempotent: cells[6],
        auth: cells[7],
        confirmationAndNegativeCase: cells[8],
      };
    });
}

function parsedErrorRows(markdown: string, locale: Locale): Array<{ identifier: string; meaning: string; recovery: string }> {
  const errors = section(
    markdown,
    locale === 'fr'
      ? /^## Erreurs stables et récupération$/m
      : locale === 'es'
        ? /^## Errores estables y recuperación$/m
        : /^## Stable errors and recovery$/m,
    /^## /m
  );
  return errors
    .split('\n')
    .filter((line) => /^\|\s*`[^`]+`\s*\|/.test(line))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      assert.equal(cells.length, 3, `unexpected MCP error-table shape: ${line}`);
      return {
        identifier: cells[0].replaceAll('`', ''),
        meaning: cells[1],
        recovery: cells[2],
      };
    });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const principal: AgentPrincipal = {
  userId: 'docs-contract-user',
  clientId: 'docs-contract-client',
  emailVerified: true,
  authMethod: 'oauth',
};

const account: AgentAccountStatus = {
  accountId: principal.userId,
  clientId: principal.clientId,
  emailVerified: true,
  wallet: { amountCents: 0, currency: 'USD', pendingCents: 0 },
  trial: { status: 'disabled' },
  spendingLimits: {
    perGenerationCents: null,
    dailyCents: null,
    webApprovalAboveCents: null,
  },
  accountUrl: 'https://maxvideoai.com/account/connections',
};

const model: AgentModel = {
  id: 'public-model',
  label: 'Public model',
  surface: 'video',
  modes: ['t2v'],
  aspectRatios: ['16:9'],
  resolutions: ['1080p'],
  maxDurationSec: 10,
  audio: false,
  referenceImages: false,
  availability: 'available',
};

const services: MaxVideoAiMcpServices = {
  async getAccountStatus() {
    return account;
  },
  async listModels() {
    return [model];
  },
  async recommendModels() {
    return { recommendations: [], nextAction: 'clarify_requirements' };
  },
};

const httpConfig: McpConfig = {
  apiHost: 'api.maxvideoai.com',
  resourceUrl: MCP_PRODUCTION_RESOURCE_URL,
  protectedResourceMetadataUrl:
    'https://api.maxvideoai.com/.well-known/oauth-protected-resource/mcp',
  accountUrl: 'https://maxvideoai.com/account/connections',
};

function protocolRequestWithoutAuthorization(): Request {
  return new Request(MCP_PRODUCTION_RESOURCE_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      host: httpConfig.apiHost,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'docs-auth-contract', version: '1.0.0' },
      },
    }),
  });
}

async function observeReachableProductionErrors() {
  const unauthorized = await handleMcpHttpRequest(protocolRequestWithoutAuthorization(), {
    enabled: true,
    config: httpConfig,
    resolvePrincipal: resolveAgentPrincipal,
  });
  const unauthorizedPayload = await unauthorized.clone().json() as {
    error: { code: number; message: string };
  };

  const failingServer = createMaxVideoAiMcpServer(principal, {
    ...services,
    async listModels() {
      throw new Error('private upstream detail');
    },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await failingServer.connect(serverTransport);
  const client = new Client({ name: 'mcp-docs-error-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  let internalResult: Awaited<ReturnType<Client['callTool']>>;
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    internalResult = await client.callTool({ name: 'list_models', arguments: {} });
  } finally {
    console.error = originalConsoleError;
    await client.close();
    await failingServer.close();
  }
  const internal = internalResult.structuredContent as {
    error: { code: string; correlationId?: string };
  };

  return {
    unauthorized: {
      identifier: `HTTP ${unauthorized.status} / JSON-RPC ${unauthorizedPayload.error.code}`,
      message: unauthorizedPayload.error.message,
      challenge: unauthorized.headers.get('www-authenticate'),
    },
    internal: {
      identifier: internal.error.code,
      correlationId: internal.error.correlationId,
    },
  };
}

async function listPublishedTools() {
  const server = createMaxVideoAiMcpServer(principal, services);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'mcp-docs-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  try {
    return (await client.listTools()).tools;
  } finally {
    await client.close();
    await server.close();
  }
}

test('localized MCP documents expose authoritative metadata and a copyable production endpoint', () => {
  const endpointBlock = new RegExp(
    '```text\\n' + escapeRegExp(MCP_PRODUCTION_RESOURCE_URL) + '\\n```'
  );

  for (const locale of locales) {
    const markdown = source(locale);
    assert.match(markdown, /^title:\s*['"].+['"]$/m);
    assert.match(markdown, /^description:\s*['"].+['"]$/m);
    assert.match(markdown, /^date:\s*['"]2026-07-14['"]$/m);
    assert.match(markdown, /^updatedAt:\s*['"]2026-08-24['"]$/m);
    assert.match(markdown, /^authorId:\s*['"]adrien-millot['"]$/m);
    assert.match(markdown, /^slug:\s*['"]mcp['"]$/m);
    assert.match(markdown, endpointBlock, `${locale} should show the endpoint in a plain copy block`);
    assert.doesNotMatch(markdown, /(?:staging|localhost|127\.0\.0\.1)[^\s`]*\/mcp/i);
    assert.doesNotMatch(markdown, /Verified setup|Configuration vérifiée|Configuración verificada/i);
    assert.match(
      markdown,
      locale === 'fr'
        ? /^description:.*paquet.*local.*non vérifi/im
        : locale === 'es'
          ? /^description:.*paquete.*local.*sin verificar/im
          : /^description:.*local package.*unverified/im,
      `${locale} metadata should make the local, unverified status explicit`
    );
  }
});

test('localized MCP documents distinguish the local package from unverified host setup', () => {
  for (const locale of locales) {
    const markdown = body(locale);
    assert.match(markdown, /OAuth 2\.1/i);
    assert.match(markdown, /openid,email,profile/);
    assert.match(markdown, locale === 'fr' ? /paquet local/i : locale === 'es' ? /paquete local/i : /local package/i);
    assert.match(markdown, locale === 'fr' ? /non vérifi/i : locale === 'es' ? /sin verificar/i : /unverified/i);
    assert.match(markdown, /Claude/i);
    assert.match(markdown, /Codex/i);
    assert.doesNotMatch(markdown, /2026-07-12|host-compatibility proof|preuve de\s+compatibilité hébergée|prueba de\s+compatibilidad alojada/i);
    assert.match(
      markdown,
      locale === 'fr'
        ? /comportement prévu.*publication/i
        : locale === 'es'
          ? /comportamiento previsto.*publicación/i
          : /intended.*release-gated behavior/i,
      `${locale} should qualify OAuth account access as release-gated`
    );
    assert.doesNotMatch(markdown, /one[- ]click|deep link|Codex (?:app|library).*(?:supported|available)|directory approval/i);
    assert.doesNotMatch(markdown, /claude mcp add --transport http maxvideoai|codex mcp add maxvideoai --url|codex mcp login maxvideoai --scopes/i);
  }
});

test('each localized tool row semantically mirrors the live registry and authenticated handler boundary', async () => {
  const tools = await listPublishedTools();
  const expectedNames = tools.map((tool) => tool.name);
  const observedErrors = await observeReachableProductionErrors();
  assert.match(observedErrors.unauthorized.identifier, /^HTTP 401 \/ JSON-RPC -32001$/);

  assert.deepEqual(expectedNames, [
    'get_account_status',
    'list_models',
    'get_model_details',
    'recommend_models',
    'calculate_project_budget',
  ]);
  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.annotations?.openWorldHint, false);
    assert.match(tool.description ?? '', /Use this when/i);
    assert.match(tool.description ?? '', /Do not use/i);
  }

  const semantics: Record<Locale, {
    readOnly: RegExp;
    nonDestructive: RegExp;
    closedWorld: RegExp;
    idempotent: RegExp;
    oauthRequired: RegExp;
    noConfirmation: RegExp;
    negativeCase: RegExp;
  }> = {
    en: {
      readOnly: /none; read-only/i,
      nonDestructive: /^No\.?$/i,
      closedWorld: /closed world/i,
      idempotent: /yes.*no writ/i,
      oauthRequired: /OAuth required/i,
      noConfirmation: /No confirmation/i,
      negativeCase: /Negative case:/i,
    },
    fr: {
      readOnly: /aucun.*lecture seule/i,
      nonDestructive: /^Non\.?$/i,
      closedWorld: /monde fermé/i,
      idempotent: /oui.*aucune écriture/i,
      oauthRequired: /OAuth requis/i,
      noConfirmation: /Aucune confirmation/i,
      negativeCase: /Cas négatif\s*:/i,
    },
    es: {
      readOnly: /ninguno.*solo lectura/i,
      nonDestructive: /^No\.?$/i,
      closedWorld: /mundo cerrado/i,
      idempotent: /sí.*no escribe/i,
      oauthRequired: /OAuth obligatorio/i,
      noConfirmation: /Sin confirmación/i,
      negativeCase: /Caso negativo\s*:/i,
    },
  };

  for (const locale of locales) {
    const markdown = body(locale);
    const rows = parsedToolRows(markdown);
    assert.deepEqual(rows.map((row) => row.name), expectedNames, `${locale} should document only the live registry`);

    for (const [index, tool] of tools.entries()) {
      const row = rows[index];
      assert.equal(row.name, tool.name);
      assert.ok(row.useWhen.length > 20, `${locale}/${tool.name} should explain when to use the tool`);
      assert.ok(row.purpose.length > 20, `${locale}/${tool.name} should explain the tool purpose`);
      if (tool.annotations?.readOnlyHint) assert.match(row.sideEffects, semantics[locale].readOnly);
      if (tool.annotations?.destructiveHint === false) assert.match(row.destructive, semantics[locale].nonDestructive);
      if (tool.annotations?.openWorldHint === false) assert.match(row.openWorld, semantics[locale].closedWorld);
      if (tool.annotations?.readOnlyHint && tool.annotations?.destructiveHint === false) {
        assert.match(row.idempotent, semantics[locale].idempotent);
        assert.match(row.confirmationAndNegativeCase, semantics[locale].noConfirmation);
      }
      assert.match(row.auth, semantics[locale].oauthRequired);
      assert.match(row.confirmationAndNegativeCase, semantics[locale].negativeCase);
      assert.match(tool.description ?? '', /Use this when.*Do not use/is);
    }
  }
});

test('operations and acquisition records describe the five-tool local profile without host or publication claims', () => {
  const compatibilityMatrix = readFileSync(compatibilityPath, 'utf8');
  const directorySubmissions = readFileSync(directorySubmissionsPath, 'utf8');
  const publicClaims = readFileSync(publicClaimsPath, 'utf8');
  const discoveryTools = [
    'get_account_status',
    'list_models',
    'get_model_details',
    'recommend_models',
    'calculate_project_budget',
  ];

  for (const document of [compatibilityMatrix, directorySubmissions, publicClaims]) {
    for (const tool of discoveryTools) assert.match(document, new RegExp(`\\\`${tool}\\\``));
    assert.match(document, /local/i);
    assert.match(document, /not submitted|unpublished/i);
  }

  assert.match(compatibilityMatrix, /OAuth.*unverified/i);
  assert.match(compatibilityMatrix, /Codex.*unverified/i);
  assert.match(compatibilityMatrix, /Claude.*unverified/i);
  assert.match(directorySubmissions, /estimate.*not.*quote/i);
  assert.match(directorySubmissions, /prepare_generation.*confirm_generation/is);
  assert.match(publicClaims, /estimate.*not.*quote/i);
  assert.match(publicClaims, /host.*unverified/i);
});

test('unpublished generation capabilities are explicit non-live contracts rather than tool claims', () => {
  const expectations: Record<Locale, RegExp[]> = {
    en: [
      /read-only rollout/i,
      /not currently available/i,
      /displayed price before generation/i,
      /project estimate/i,
      /not a quote/i,
      /separate explicit confirmation/i,
      /no public quote fingerprint or expiry/i,
      /Jobs in\s+the MaxVideoAI web product/i,
    ],
    fr: [
      /déploiement en lecture seule/i,
      /pas disponibles actuellement/i,
      /prix affiché avant la génération/i,
      /estimation de projet/i,
      /n’est pas un devis/i,
      /confirmation explicite séparée/i,
      /aucune empreinte ni\s+expiration publique/i,
      /Jobs dans le produit web MaxVideoAI/i,
    ],
    es: [
      /despliegue de solo lectura/i,
      /no están disponibles actualmente/i,
      /precio mostrado antes de generar/i,
      /estimación de proyecto/i,
      /no es una cotización/i,
      /confirmación explícita\s+separada/i,
      /no hay una huella ni\s+un vencimiento públicos/i,
      /Trabajos del producto web de MaxVideoAI/i,
    ],
  };

  for (const locale of locales) {
    const markdown = body(locale);
    for (const pattern of expectations[locale]) assert.match(markdown, pattern);
    for (const unpublishedTool of [
      'prepare_generation',
      'confirm_generation',
      'get_generation_status',
      'list_recent_generations',
      'list_media',
      'create_reference_upload_link',
      'create_topup_link',
    ]) {
      assert.ok(markdown.includes(`\`${unpublishedTool}\``), `${locale} should name ${unpublishedTool} as unavailable`);
    }
  }
});

test('the gated trial contract is exact and cannot be mistaken for wallet money or live access', () => {
  assert.equal(getMcpPublicationState(mcpPublication).showTrialClaim, false);

  const localePatterns: Record<Locale, RegExp[]> = {
    en: [
      /not available/i,
      /eligible OAuth account/i,
      /verified email/i,
      /one.*per user/i,
      /account restriction/i,
      /risk checks/i,
      /Dreamina Seedance 2\.0 Mini/i,
      /text-to-video/i,
      /5 seconds/i,
      /480p/i,
      /16:9.*9:16.*1:1/s,
      /audio.*user-selectable/i,
      /one output/i,
      /promotional entitlement/i,
      /not wallet money/i,
    ],
    fr: [
      /pas disponible/i,
      /compte OAuth éligible/i,
      /adresse e-mail vérifiée/i,
      /une fois par utilisateur/i,
      /restriction du compte/i,
      /contrôles de risque/i,
      /Dreamina Seedance 2\.0 Mini/i,
      /texte vers vidéo/i,
      /5 secondes/i,
      /480p/i,
      /16:9.*9:16.*1:1/s,
      /audio.*au choix/i,
      /une sortie/i,
      /droit promotionnel/i,
      /pas de l’argent du portefeuille/i,
    ],
    es: [
      /no está disponible/i,
      /cuenta OAuth apta/i,
      /correo verificado/i,
      /una vez por usuario/i,
      /restricción de la cuenta/i,
      /controles de riesgo/i,
      /Dreamina Seedance 2\.0 Mini/i,
      /texto a video/i,
      /5 segundos/i,
      /480p/i,
      /16:9.*9:16.*1:1/s,
      /audio.*elección del usuario/i,
      /una salida/i,
      /derecho promocional/i,
      /no es dinero de la billetera/i,
    ],
  };

  for (const locale of locales) {
    const markdown = body(locale);
    for (const pattern of localePatterns[locale]) assert.match(markdown, pattern);
  }
});

test('prompt and reference guidance preserves host and persisted-asset boundaries', () => {
  const localePatterns: Record<Locale, RegExp[]> = {
    en: [
      /Claude or Codex clarifies the brief and writes the prompt/i,
      /host's own image capability/i,
      /create_reference_upload_link/i,
      /validates ownership and raster type/i,
      /quote keeps only the stable asset ID/i,
      /verified internal media URL is materialized\s+temporarily/i,
    ],
    fr: [
      /Claude ou Codex précise le brief et rédige le prompt/i,
      /propres capacités d’image/i,
      /create_reference_upload_link/i,
      /vérifie le propriétaire et le format raster/i,
      /devis immuable ne conserve que l’identifiant stable/i,
      /URL média interne vérifiée est matérialisée\s+temporairement/i,
    ],
    es: [
      /Claude o Codex aclara la idea y redacta el prompt/i,
      /propias capacidades de imagen/i,
      /create_reference_upload_link/i,
      /verifica el propietario y el formato ráster/i,
      /cotización inmutable conserva solo el ID estable/i,
      /URL\s+interna verificada se materializa temporalmente/i,
    ],
  };

  for (const locale of locales) {
    const markdown = body(locale);
    for (const pattern of localePatterns[locale]) assert.match(markdown, pattern);
    assert.match(markdown, /HTTPS/i);
    assert.match(markdown, /assetId/i);
    assert.doesNotMatch(markdown, /Claude (?:always )?(?:generates|creates) images|Codex (?:always )?(?:generates|creates) images/i);
  }
});

test('spending, revocation, privacy, troubleshooting, and reachable production errors match implemented behavior', async () => {
  const observedErrors = await observeReachableProductionErrors();
  assert.equal(observedErrors.unauthorized.message, 'Authentication required.');
  assert.equal(
    observedErrors.unauthorized.challenge,
    'Bearer resource_metadata="https://api.maxvideoai.com/.well-known/oauth-protected-resource/mcp"'
  );
  assert.match(observedErrors.internal.correlationId ?? '', /^[0-9a-f-]{36}$/i);
  const observedIdentifiers = [
    observedErrors.unauthorized.identifier,
    observedErrors.internal.identifier,
  ];

  for (const locale of locales) {
    const markdown = body(locale);
    assert.match(markdown, /perGenerationCents/);
    assert.match(markdown, /dailyCents/);
    assert.match(markdown, /webApprovalAboveCents/);
    assert.match(markdown, /null/);
    assert.match(markdown, /\/account\/connections/);
    assert.match(markdown, locale === 'fr' ? /révoqu/i : locale === 'es' ? /revoc/i : /revoke/i);
    assert.match(markdown, locale === 'fr' ? /e-mail.*omis/i : locale === 'es' ? /correo.*omite/i : /email.*omitted/i);
    assert.match(markdown, /prompt/i);
    assert.match(markdown, /token/i);
    assert.match(markdown, locale === 'fr' ? /paiement/i : locale === 'es' ? /pago/i : /payment/i);
    assert.match(markdown, /private, no-store/);
    assert.match(markdown, locale === 'fr' ? /Dépannage/ : locale === 'es' ? /Solución de problemas/ : /Troubleshooting/);

    const errorRows = parsedErrorRows(markdown, locale);
    assert.deepEqual(
      errorRows.map((row) => row.identifier),
      observedIdentifiers,
      `${locale} should document only errors reached through the real auth handler and live tool wrapper`
    );
    assert.ok(errorRows.every((row) => row.meaning.length > 20 && row.recovery.length > 20));
    assert.match(markdown, /WWW-Authenticate/);
    assert.match(markdown, /resource_metadata/);
    assert.match(markdown, /correlationId/);
    assert.doesNotMatch(markdown, /AUTH_REQUIRED|RATE_LIMITED|retryAfterSeconds/);
    assert.doesNotMatch(markdown, /fal\.ai|BytePlus|Vertex|provider routing|SQL statement|stack trace/i);
  }
});

test('every locale states current non-goals without static prices or unsupported distribution claims', () => {
  const nonGoals: Record<Locale, RegExp[]> = {
    en: [/general public REST API/i, /API credentials/i, /customer callback endpoints/i, /direct payment/i, /source-video/i, /audio-file/i, /Studio timeline/i],
    fr: [/API REST publique généraliste/i, /identifiants d’API/i, /points de rappel clients/i, /paiement direct/i, /vidéo source/i, /fichier audio/i, /timeline Studio/i],
    es: [/API REST pública de uso general/i, /credenciales de API/i, /endpoints de callback para clientes/i, /pago directo/i, /video fuente/i, /archivo de audio/i, /timeline de Studio/i],
  };

  for (const locale of locales) {
    const markdown = body(locale);
    for (const pattern of nonGoals[locale]) assert.match(markdown, pattern);
    assert.doesNotMatch(markdown, /(?:[$€£]\s*\d|(?:USD|EUR|GBP)\s*\d)/);
    assert.doesNotMatch(markdown, /one[- ]click|deep link|directory (?:listing|approval)|available in the Codex (?:app|library)/i);
  }

  assert.doesNotMatch(body('fr'), /soumis au gate|gate de publication|contrat fermé/i);
  assert.doesNotMatch(body('es'), /sujeto al gate|gate de publicación|contrato cerrado/i);
});

test('the actual docs route, metadata, and static params fail closed behind MCP publication gates', async () => {
  const routeModule = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/docs/[slug]/page.tsx'
  );
  const params = { locale: 'en' as const, slug: 'mcp' };
  const metadata = await routeModule.generateMetadata({ params: Promise.resolve(params) });
  const robots = metadata.robots as { index?: boolean; follow?: boolean };
  assert.equal(robots.index, false);
  assert.equal(robots.follow, false);
  await assert.rejects(
    () => routeModule.default({ params: Promise.resolve(params) }),
    (error: unknown) => {
      const digest = (error as { digest?: unknown })?.digest;
      return typeof digest === 'string' && digest.includes('404');
    }
  );
  const staticParams = await routeModule.generateStaticParams();
  assert.equal(
    staticParams.some((entry) => entry.slug === 'mcp'),
    false,
    'gated MCP docs must not enter the static build manifest'
  );
});

test('a renderable noindex preview gets a static route without entering docs discovery or schema', async () => {
  const indexModule = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/docs/_lib/docs-index-data.ts'
  );
  assert.equal(
    typeof indexModule.resolveDocsEntryPublication,
    'function',
    'docs routes need an explicit renderability/indexability state owner'
  );
  assert.equal(
    typeof indexModule.filterDocsEntriesForStaticParams,
    'function',
    'static params need a renderability-specific filter'
  );
  if (
    typeof indexModule.resolveDocsEntryPublication !== 'function' ||
    typeof indexModule.filterDocsEntriesForStaticParams !== 'function'
  ) return;

  const entries = [
    { slug: 'get-started', title: 'Get started' },
    { slug: 'mcp', title: 'MCP' },
  ];
  const allFalse = getMcpPublicationState(mcpPublication);
  const preview = { ...allFalse, renderPublicPage: true, indexable: false };

  assert.deepEqual(indexModule.resolveDocsEntryPublication('mcp', preview), {
    discoverable: false,
    renderable: true,
    robots: { index: false, follow: true },
  });
  assert.deepEqual(
    indexModule.filterDocsEntriesForStaticParams(entries, preview).map((entry: { slug: string }) => entry.slug),
    ['get-started', 'mcp']
  );
  assert.deepEqual(
    indexModule.filterDocsEntriesForPublication(entries, preview).map((entry: { slug: string }) => entry.slug),
    ['get-started'],
    'preview MCP docs must stay out of indexes and related-doc discovery'
  );

  const englishMessages = JSON.parse(readFileSync('frontend/messages/en.json', 'utf8')) as {
    docs: Record<string, unknown>;
  };
  assert.equal(indexModule.buildDocsIndexViewModel(englishMessages.docs, entries, preview).mcpGuide, null);

  const schemaModule = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/docs/_lib/docs-article-jsonld.ts'
  );
  assert.equal(
    schemaModule.buildDocsTechArticleJsonLd({
      author: { name: 'Adrien Millot', url: 'https://maxvideoai.com/about#adrien-millot' },
      canonicalUrl: 'https://maxvideoai.com/docs/mcp',
      description: 'Technical MCP reference',
      docsIndexUrl: 'https://maxvideoai.com/docs',
      inLanguage: 'en-US',
      isMcpDoc: true,
      modifiedIso: '2026-07-14T00:00:00.000Z',
      overviewLabel: 'Docs overview',
      publication: preview,
      publishedIso: '2026-07-14T00:00:00.000Z',
      title: 'MaxVideoAI MCP technical guide',
    }),
    null,
    'preview MCP docs must not emit TechArticle schema'
  );

  assert.deepEqual(indexModule.resolveDocsEntryPublication('mcp', allFalse), {
    discoverable: false,
    renderable: false,
    robots: { index: false, follow: false },
  });
  assert.deepEqual(
    indexModule.filterDocsEntriesForStaticParams(entries, allFalse).map((entry: { slug: string }) => entry.slug),
    ['get-started']
  );

  const pageSource = readFileSync(docsArticlePagePath, 'utf8');
  assert.match(pageSource, /filterDocsEntriesForStaticParams/);
  assert.match(pageSource, /resolveDocsEntryPublication/);
  assert.match(pageSource, /robots:\s*entryPublication\.robots/);
  assert.match(pageSource, /if \(!entryPublication\.renderable\)/);
  assert.match(pageSource, /const docs = filterDocsEntriesForPublication/);
});

test('verified MCP attribution is visible while legacy docs keep their prior anonymous behavior', async () => {
  assert.equal(
    existsSync(docsArticleAttributionPath),
    true,
    'docs attribution should have a focused, render-testable owner'
  );
  if (!existsSync(docsArticleAttributionPath)) return;

  const attributionModule = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsArticleAttribution.tsx'
  );
  const authorId = source('en').match(/^authorId:\s*["']([^"']+)["']$/m)?.[1];
  assert.equal(authorId, 'adrien-millot');
  const profile = getEditorialProfile('en', authorId);
  const runtimeGlobal = globalThis as typeof globalThis & { React?: typeof React };
  const previousReact = runtimeGlobal.React;
  runtimeGlobal.React = React;
  let mcpHtml: string;
  let legacyHtml: string;
  try {
    mcpHtml = renderToStaticMarkup(
      React.createElement(attributionModule.DocsArticleAttribution, {
        author: { name: profile.name, aboutHref: profile.aboutHref },
        date: '2026-07-14',
        locale: 'en',
        updatedAt: '2026-07-14',
      })
    );
    legacyHtml = renderToStaticMarkup(
      React.createElement(attributionModule.DocsArticleAttribution, {
        author: null,
        date: '2024-06-01',
        locale: 'en',
      })
    );
  } finally {
    runtimeGlobal.React = previousReact;
  }
  assert.match(mcpHtml, /By/);
  assert.match(mcpHtml, /Adrien Millot/);
  assert.match(mcpHtml, /Published/);
  assert.match(mcpHtml, /Updated/);
  assert.doesNotMatch(mcpHtml, /Founder &amp; Product Lead/);

  assert.doesNotMatch(legacyHtml, /Adrien Millot|\bBy\b|Published|Updated/);
  assert.match(legacyHtml, /Jun 1, 2024/);

  const routeModule = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/docs/[slug]/page.tsx'
  );
  runtimeGlobal.React = React;
  let legacyTree: React.ReactElement;
  try {
    legacyTree = await routeModule.default({
      params: Promise.resolve({ locale: 'en' as const, slug: 'get-started' }),
    });
  } finally {
    runtimeGlobal.React = previousReact;
  }
  function findAttribution(node: React.ReactNode): React.ReactElement | null {
    if (!React.isValidElement(node)) return null;
    if (node.type === attributionModule.DocsArticleAttribution) return node;
    const children = (node.props as { children?: React.ReactNode }).children;
    for (const child of React.Children.toArray(children)) {
      const match = findAttribution(child);
      if (match) return match;
    }
    return null;
  }
  const legacyAttribution = findAttribution(legacyTree);
  assert.ok(legacyAttribution, 'legacy docs route should use the shared attribution owner');
  assert.equal((legacyAttribution.props as { author?: unknown }).author, null);
});

test('the docs index and TechArticle schema fail closed and attribute only verified frontmatter authors', async () => {
  const indexSource = readFileSync(docsIndexDataPath, 'utf8');
  assert.match(indexSource, /getMcpPublicationState/);
  assert.match(indexSource, /filterDocsEntriesForPublication/);
  assert.match(indexSource, /mcpGuide/);

  const indexModule = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/docs/_lib/docs-index-data.ts'
  );
  assert.equal(typeof indexModule.filterDocsEntriesForPublication, 'function');
  const entries = [
    { slug: 'get-started', title: 'Get started' },
    { slug: 'mcp', title: 'MCP' },
  ];
  const gated = getMcpPublicationState(mcpPublication);
  assert.deepEqual(
    indexModule.filterDocsEntriesForPublication(entries, gated).map((entry: { slug: string }) => entry.slug),
    ['get-started']
  );
  assert.deepEqual(
    indexModule
      .filterDocsEntriesForPublication(entries, { ...gated, indexable: true })
      .map((entry: { slug: string }) => entry.slug),
    ['get-started', 'mcp']
  );

  for (const locale of locales) {
    const messages = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8')) as {
      docs: { mcpGuide?: { href?: string; title?: string; description?: string } };
    };
    assert.ok(messages.docs.mcpGuide?.title);
    assert.ok(messages.docs.mcpGuide?.description);
    assert.match(messages.docs.mcpGuide?.href ?? '', /\/docs\/mcp$/);
  }

  const englishMessages = JSON.parse(readFileSync('frontend/messages/en.json', 'utf8')) as {
    docs: Record<string, unknown>;
  };
  const gatedViewModel = indexModule.buildDocsIndexViewModel(
    englishMessages.docs,
    entries,
    gated
  );
  const liveViewModel = indexModule.buildDocsIndexViewModel(
    englishMessages.docs,
    entries,
    { ...gated, indexable: true }
  );
  assert.equal(gatedViewModel.mcpGuide, null);
  assert.deepEqual(liveViewModel.mcpGuide, englishMessages.docs.mcpGuide);
  const sectionsSource = readFileSync(docsSectionsPath, 'utf8');
  assert.match(sectionsSource, /mcpGuide\.title/);
  assert.match(sectionsSource, /mcpGuide\.description/);

  assert.equal(existsSync(docsArticleJsonLdPath), true, 'the TechArticle builder should have a focused owner');
  const schemaModule = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/docs/_lib/docs-article-jsonld.ts'
  );
  assert.equal(typeof schemaModule.buildDocsTechArticleJsonLd, 'function');
  const schemaInput = {
    canonicalUrl: 'https://maxvideoai.com/docs/mcp',
    description: 'Technical MCP reference',
    imageUrl: 'https://maxvideoai.com/og/price-before.png',
    inLanguage: 'en-US',
    isMcpDoc: true,
    keywords: ['MCP'],
    modifiedIso: '2026-07-14T00:00:00.000Z',
    overviewLabel: 'Docs overview',
    docsIndexUrl: 'https://maxvideoai.com/docs',
    publication: gated,
    publishedIso: '2026-07-14T00:00:00.000Z',
    title: 'MaxVideoAI MCP technical guide',
    author: {
      name: 'Adrien Millot',
      url: 'https://maxvideoai.com/about#adrien-millot',
    },
  };
  assert.equal(schemaModule.buildDocsTechArticleJsonLd(schemaInput), null);
  const liveSchema = schemaModule.buildDocsTechArticleJsonLd({
    ...schemaInput,
    publication: { ...gated, indexable: true },
  });
  assert.equal(liveSchema?.['@type'], 'TechArticle');
  assert.deepEqual(liveSchema?.author, {
    '@type': 'Person',
    name: 'Adrien Millot',
    url: 'https://maxvideoai.com/about#adrien-millot',
  });
  assert.equal(JSON.stringify(liveSchema).includes('jobTitle'), false);
  assert.equal(liveSchema?.datePublished, schemaInput.publishedIso);
  assert.equal(liveSchema?.dateModified, schemaInput.modifiedIso);

  let legacySchema: Record<string, unknown> | null = null;
  assert.doesNotThrow(() => {
    legacySchema = schemaModule.buildDocsTechArticleJsonLd({
      ...schemaInput,
      author: null,
      canonicalUrl: 'https://maxvideoai.com/docs/get-started',
      isMcpDoc: false,
      title: 'Getting started with MaxVideo AI',
    });
  });
  assert.ok(legacySchema);
  assert.equal(Object.prototype.hasOwnProperty.call(legacySchema, 'author'), false);

  const pageSource = readFileSync(docsArticlePagePath, 'utf8');
  assert.match(pageSource, /getEditorialProfile/);
  assert.match(pageSource, /buildDocsTechArticleJsonLd/);
  assert.match(pageSource, /resolveDocsEntryPublication/);
  assert.match(indexSource, /renderable:\s*publication\.renderPublicPage/);
  assert.match(indexSource, /discoverable:\s*publication\.indexable/);
});
