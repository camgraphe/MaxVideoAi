import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const DOCS = {
  en: 'content/docs/mcp.mdx',
  fr: 'content/fr/docs/mcp.mdx',
  es: 'content/es/docs/mcp.mdx',
} as const;

const TOOLS = [
  'get_account_status',
  'list_models',
  'get_model_details',
  'recommend_models',
  'calculate_project_budget',
  'list_media',
  'create_reference_upload_link',
  'prepare_generation',
  'confirm_generation',
  'get_generation_status',
  'list_recent_generations',
  'create_topup_link',
] as const;

function source(path: string): string {
  assert.equal(existsSync(path), true, `${path} should exist`);
  return readFileSync(path, 'utf8');
}

test('localized guides expose current metadata, OAuth, and the copyable production endpoint', () => {
  for (const [locale, path] of Object.entries(DOCS)) {
    const markdown = source(path);
    assert.match(markdown, /^title:\s*['"].+['"]$/m);
    assert.match(markdown, /^description:\s*['"].+['"]$/m);
    assert.match(markdown, /^date:\s*['"]2026-07-14['"]$/m);
    assert.match(markdown, /^updatedAt:\s*['"]2026-08-26['"]$/m);
    assert.match(markdown, /^authorId:\s*['"]adrien-millot['"]$/m);
    assert.match(markdown, /^slug:\s*['"]mcp['"]$/m);
    assert.match(markdown, /```text\s+https:\/\/api\.maxvideoai\.com\/mcp\s+```/);
    assert.match(markdown, /OAuth 2\.1/i);
    assert.match(markdown, /openid,email,profile/);
    assert.match(markdown, /ChatGPT/i);
    assert.match(markdown, /Claude/i);
    assert.match(markdown, /Codex/i);
    assert.doesNotMatch(markdown, /localhost|staging[^\n]*\/mcp/i, `${locale} must not publish a non-production endpoint`);
  }
});

test('all twelve tools and their safety boundaries are documented in every locale', () => {
  for (const path of Object.values(DOCS)) {
    const markdown = source(path);
    for (const tool of TOOLS) assert.match(markdown, new RegExp('`' + tool + '`'));
    assert.match(markdown, /tools\/list/);
    assert.match(markdown, /estimate|estimation|estimación/i);
    assert.match(markdown, /quote|devis|cotización|precio exacto/i);
    assert.match(markdown, /explicit|explicite|explícita/i);
    assert.match(markdown, /idempotent/i);
    assert.match(markdown, /recover|récupér|recuper/i);
    assert.match(markdown, /refund|rembours|reembols/i);
  }
});

test('references cover image, video, audio, account ownership, and the precise LAS boundary', () => {
  const patterns = {
    en: [/images?, video, and audio/i, /MaxVideoAI library/i, /assetId/i],
    fr: [/références image, vidéo et audio/i, /galerie MaxVideoAI/i, /assetId/i],
    es: [/referencias de imagen, vídeo y audio/i, /biblioteca MaxVideoAI/i, /assetId/i],
  } as const;
  for (const locale of Object.keys(DOCS) as Array<keyof typeof DOCS>) {
    const markdown = source(DOCS[locale]);
    for (const pattern of patterns[locale]) assert.match(markdown, pattern);
    assert.match(markdown, /Seedance 2\.5/i);
    assert.match(markdown, /ModelArk/i);
    assert.match(markdown, /BytePlus LAS/i);
    assert.match(markdown, /text-to-video|texte vers vidéo|texto a vídeo/i);
    assert.match(markdown, /image-to-video|image vers vidéo|imagen a vídeo/i);
    assert.match(markdown, /extension|extensi[oó]n/i);
    assert.match(markdown, /HTTPS/i);
  }
});

test('credits, top-up, fresh quote, and gallery continuity are unambiguous', () => {
  const expectations = {
    en: [/same user wallet/i, /pay-as-you-go/i, /previous quote is no longer valid/i, /same private MaxVideoAI account library/i],
    fr: [/même portefeuille utilisateur/i, /pay-as-you-go/i, /ancien devis n’est plus valide/i, /même galerie privée MaxVideoAI/i],
    es: [/misma billetera de usuario/i, /pay-as-you-go/i, /cotización anterior ya no es válida/i, /misma biblioteca privada MaxVideoAI/i],
  } as const;
  for (const locale of Object.keys(DOCS) as Array<keyof typeof DOCS>) {
    const markdown = source(DOCS[locale]);
    for (const pattern of expectations[locale]) assert.match(markdown, pattern);
    assert.match(markdown, /create_topup_link/);
    assert.match(markdown, /get_account_status/);
    assert.match(markdown, /prepare_generation/);
  }
});

test('the introductory credit is optional, account-checked, and never presented as wallet money', () => {
  for (const path of Object.values(DOCS)) {
    const markdown = source(path);
    assert.match(markdown, /Seedance 2 Mini/i);
    assert.match(markdown, /eligible|éligible|elegible/i);
    assert.match(markdown, /verified|vérifié|verificada/i);
    assert.match(markdown, /get_account_status/);
    assert.match(markdown, /one-time|unique|único/i);
    assert.match(markdown, /not reusable wallet money|pas de l’argent réutilisable|no dinero reutilizable/i);
    assert.match(markdown, /audio/i);
  }
});

test('privacy, revocation, callback recovery, and reachable errors stay documented', () => {
  for (const [locale, path] of Object.entries(DOCS)) {
    const markdown = source(path);
    assert.match(markdown, /\/account\/connections/);
    assert.match(markdown, /127\.0\.0\.1/);
    assert.match(markdown, /private, no-store/);
    assert.match(markdown, /HTTP 401 \/ JSON-RPC -32001/);
    assert.match(markdown, /WWW-Authenticate/);
    assert.match(markdown, /resource_metadata/);
    assert.match(markdown, /INTERNAL_ERROR/);
    assert.match(markdown, /correlationId/);
    assert.match(markdown, /prompt/i);
    assert.match(markdown, /token/i);
    assert.match(markdown, locale === 'fr' ? /paiement/i : locale === 'es' ? /pago/i : /payment/i);
  }
});

test('docs routes remain owned by the shared publication gate and technical schema', () => {
  const page = source('frontend/app/(localized)/[locale]/(marketing)/docs/[slug]/page.tsx');
  const index = source('frontend/app/(localized)/[locale]/(marketing)/docs/_lib/docs-index-data.ts');
  assert.match(page, /filterDocsEntriesForStaticParams/);
  assert.match(page, /resolveDocsEntryPublication/);
  assert.match(page, /robots:\s*entryPublication\.robots/);
  assert.match(page, /if \(!entryPublication\.renderable\)/);
  assert.match(page, /buildDocsTechArticleJsonLd/);
  assert.match(index, /getMcpPublicationState/);
  assert.match(index, /renderable:\s*publication\.renderPublicPage/);
  assert.match(index, /discoverable:\s*publication\.indexable/);
});

test('guides avoid static prices, directory approval, and general API-key claims', () => {
  for (const path of Object.values(DOCS)) {
    const markdown = source(path);
    assert.doesNotMatch(markdown, /(?:[$€£]\s*\d|(?:USD|EUR|GBP)\s*\d)/);
    assert.doesNotMatch(markdown, /directory approval|directory listing|one[- ]click/i);
    assert.match(markdown, /not a general-purpose REST API|n’est pas une API REST généraliste|No es una API REST de uso general/i);
    assert.match(markdown, /API (?:keys?|key)|clé API|claves API/i);
  }
});
