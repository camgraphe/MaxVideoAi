import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import compatibility from '../frontend/config/mcp-compatibility.json';
import mcpPublication from '../frontend/config/mcp-publication.json';
import { getMcpPublicationState } from '../frontend/lib/mcp-publication';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { AgentAccountStatus, AgentModel } from '../frontend/src/server/agent-api/types';
import { MCP_PRODUCTION_RESOURCE_URL } from '../frontend/src/server/mcp/config';
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
const docsSectionsPath =
  'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsSectionsGrid.tsx';

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
    assert.match(markdown, /^updatedAt:\s*['"]2026-07-14['"]$/m);
    assert.match(markdown, /^authorId:\s*['"]adrien-millot['"]$/m);
    assert.match(markdown, /^slug:\s*['"]mcp['"]$/m);
    assert.match(markdown, endpointBlock, `${locale} should show the endpoint in a plain copy block`);
    assert.doesNotMatch(markdown, /(?:staging|localhost|127\.0\.0\.1)[^\s`]*\/mcp/i);
  }
});

test('client setup is limited to the recorded hosts, versions, and OAuth paths', () => {
  for (const locale of locales) {
    const markdown = body(locale);
    for (const host of Object.values(compatibility.hosts)) {
      assert.ok(markdown.includes(host.hostLabel), `${locale} should name ${host.hostLabel}`);
      assert.ok(markdown.includes(host.version), `${locale} should name ${host.hostLabel} ${host.version}`);
    }
    assert.ok(markdown.includes(compatibility.lastVerified));
    assert.match(markdown, /OAuth 2\.1/i);
    assert.match(markdown, /openid,email,profile/);
    assert.match(markdown, /claude mcp add --transport http maxvideoai/);
    assert.match(markdown, /codex mcp add maxvideoai --url/);
    assert.match(markdown, /codex mcp login maxvideoai --scopes openid,email,profile/);
    assert.doesNotMatch(markdown, /one[- ]click|deep link|Codex (?:app|library).*(?:supported|available)|directory approval/i);
  }

  assert.match(body('en'), /Claude Desktop.*custom remote connector/is);
  assert.match(body('en'), /Claude Code.*hosted tool.*pending/is);
  assert.match(body('en'), /Codex CLI.*default.*blocked/is);
});

test('the tool table mirrors the complete live registry and its safety annotations', async () => {
  const tools = await listPublishedTools();
  const expectedNames = tools.map((tool) => tool.name);

  assert.deepEqual(expectedNames, ['get_account_status', 'list_models', 'recommend_models']);
  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.annotations?.openWorldHint, false);
    assert.match(tool.description ?? '', /Use this when/i);
    assert.match(tool.description ?? '', /Do not use/i);
  }

  for (const locale of locales) {
    const markdown = body(locale);
    const documentedNames = tableNames(markdown, /^\|\s*`([a-z_]+)`\s*\|/);
    assert.deepEqual(documentedNames, expectedNames, `${locale} should document only the live registry`);

    for (const name of expectedNames) {
      const row = markdown.split('\n').find((line) => line.startsWith(`| \`${name}\` |`));
      assert.ok(row, `${locale} should include the ${name} row`);
      assert.equal(row.split('|').length, 11, `${name} should include every safety column`);
    }

    assert.match(markdown, locale === 'fr' ? /Lecture seule/ : locale === 'es' ? /Solo lectura/ : /Read-only/);
    assert.match(markdown, locale === 'fr' ? /Monde fermé/ : locale === 'es' ? /Mundo cerrado/ : /Closed world/);
    assert.match(markdown, locale === 'fr' ? /Idempotent/ : locale === 'es' ? /Idempotente/ : /Idempotent/);
    assert.match(markdown, locale === 'fr' ? /Cas négatif/ : locale === 'es' ? /Caso negativo/ : /Negative case/);
  }
});

test('unpublished generation capabilities are explicit non-live contracts rather than tool claims', () => {
  const expectations: Record<Locale, RegExp[]> = {
    en: [
      /read-only rollout/i,
      /not currently available/i,
      /displayed price before generation/i,
      /separate explicit confirmation/i,
      /no public quote fingerprint or expiry/i,
      /Jobs in the MaxVideoAI web product/i,
    ],
    fr: [
      /déploiement en lecture seule/i,
      /pas disponibles actuellement/i,
      /prix affiché avant la génération/i,
      /confirmation explicite séparée/i,
      /aucune empreinte ni expiration publique/i,
      /Jobs dans le produit web MaxVideoAI/i,
    ],
    es: [
      /despliegue de solo lectura/i,
      /no están disponibles actualmente/i,
      /precio mostrado antes de generar/i,
      /confirmación explícita separada/i,
      /no hay una huella ni un vencimiento públicos/i,
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
      /host's own image tool/i,
      /verified MaxVideoAI image-model flow/i,
      /only a persisted MaxVideoAI asset ID reaches video generation/i,
    ],
    fr: [
      /Claude ou Codex précise le brief et rédige le prompt/i,
      /outil d’image du client/i,
      /parcours vérifié d’un modèle d’image MaxVideoAI/i,
      /seul l’identifiant d’un asset conservé par MaxVideoAI atteint la génération vidéo/i,
    ],
    es: [
      /Claude o Codex aclara la idea y redacta el prompt/i,
      /herramienta de imagen del cliente/i,
      /flujo verificado de un modelo de imagen de MaxVideoAI/i,
      /solo el ID de un activo guardado en MaxVideoAI llega a la generación de video/i,
    ],
  };

  for (const locale of locales) {
    const markdown = body(locale);
    for (const pattern of localePatterns[locale]) assert.match(markdown, pattern);
    assert.doesNotMatch(markdown, /Claude (?:always )?(?:generates|creates) images|Codex (?:always )?(?:generates|creates) images/i);
  }
});

test('spending, revocation, privacy, troubleshooting, and live errors match implemented behavior', () => {
  const expectedErrorCodes = ['AUTH_REQUIRED', 'RATE_LIMITED', 'INTERNAL_ERROR'];

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

    const errorCodes = tableNames(markdown, /^\|\s*`([A-Z_]+)`\s*\|/);
    assert.deepEqual(errorCodes, expectedErrorCodes, `${locale} should document only surfaced stable errors`);
    assert.match(markdown, /retryAfterSeconds/);
    assert.match(markdown, /correlationId/);
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
});

test('the docs index and TechArticle schema fail closed behind MCP publication gates', async () => {
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
      jobTitle: 'Founder & Product Lead',
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
    jobTitle: 'Founder & Product Lead',
    url: 'https://maxvideoai.com/about#adrien-millot',
  });
  assert.equal(liveSchema?.datePublished, schemaInput.publishedIso);
  assert.equal(liveSchema?.dateModified, schemaInput.modifiedIso);

  const pageSource = readFileSync(docsArticlePagePath, 'utf8');
  assert.match(pageSource, /getEditorialProfile/);
  assert.match(pageSource, /buildDocsTechArticleJsonLd/);
  assert.match(pageSource, /publication\.renderPublicPage/);
  assert.match(pageSource, /publication\.indexable/);
});
