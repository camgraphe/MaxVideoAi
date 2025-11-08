/* eslint-disable no-console */
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import fg from 'fast-glob';
import matter from 'gray-matter';
import slugify from 'slugify';
import OpenAI from 'openai';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import pLimit from 'p-limit';
import { localizedSlugs } from '../lib/i18nSlugs';
import { localePathnames } from '../i18n/locales';
import type { AppLocale } from '../i18n/locales';

type TargetLocale = 'fr' | 'es';
type Segment = { id: string; value: string; apply: (value: string) => void };
type BlogSlugMap = Record<TargetLocale, Record<string, string>>;
type BlogLocale = AppLocale;

const FRONTEND_DIR = process.cwd();
const REPO_ROOT = path.resolve(FRONTEND_DIR, '..');
const CONTENT_ROOT = path.join(REPO_ROOT, 'content');
const EN_BLOG_DIR = path.join(CONTENT_ROOT, 'en', 'blog');
const OUTPUT_DIRS: Record<TargetLocale, string> = {
  fr: path.join(CONTENT_ROOT, 'fr', 'blog'),
  es: path.join(CONTENT_ROOT, 'es', 'blog'),
};

const TARGET_LOCALES: TargetLocale[] = ['fr', 'es'];
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
const SITE_ORIGIN = 'https://maxvideoai.com';
const BRAND_REGEX = /\b(MaxVideoAI|Sora ?2(?:\.0)?|Sora|Veo ?3(?:\.1)?|Veo|Pika ?2\.2|Pika|MiniMax Hailuo 02)\b/gi;
const PLACEHOLDER_REGEX = /\{[^}]+\}/g;
const INTERNAL_DOMAIN_REGEX = /^https?:\/\/([^/]+)?maxvideoai\.com/i;
const localeLimit = pLimit(2);

dotenv.config({ path: path.join(FRONTEND_DIR, '.env.local'), override: true });
dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required for blog translation.');
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const parser = unified().use(remarkParse).use(remarkGfm);
function getLocalePrefix(locale: BlogLocale) {
  const prefix = localePathnames[locale];
  return prefix ? `/${prefix}` : '';
}

function buildBlogPath(locale: BlogLocale, slug: string) {
  const prefix = getLocalePrefix(locale);
  return `${prefix}/blog/${slug}`.replace(/\/{2,}/g, '/');
}

function buildBlogUrl(locale: BlogLocale, slug: string) {
  return `${SITE_ORIGIN}${buildBlogPath(locale, slug)}`;
}

function protect(text: string): string {
  return text
    .replace(PLACEHOLDER_REGEX, (match) => `«${match}»`)
    .replace(BRAND_REGEX, (match) => `‹${match}›`);
}

function restore(text: string): string {
  return text.replace(/«(\{[^}]+\})»/g, '$1').replace(/‹(.*?)›/g, '$1');
}

function toSlug(locale: TargetLocale, text: string) {
  return slugify(text, {
    lower: true,
    strict: true,
    locale,
  });
}

function sanitizeFrontMatter(data: Record<string, unknown>) {
  Object.keys(data).forEach((key) => {
    if (data[key] === undefined) {
      delete data[key];
    }
  });
}

function chunkSegments(segments: Segment[], chunkSize = 60): Segment[][] {
  const chunks: Segment[][] = [];
  for (let i = 0; i < segments.length; i += chunkSize) {
    chunks.push(segments.slice(i, i + chunkSize));
  }
  return chunks;
}

function rewriteInternalUrl(
  url: string,
  locale: TargetLocale,
  blogSlugMap: BlogSlugMap,
  canonicalSlug: string
): string {
  if (!url) {
    return url;
  }
  if (url.startsWith('#')) {
    return url;
  }

  let working = url;
  if (INTERNAL_DOMAIN_REGEX.test(url)) {
    try {
      const parsed = new URL(url);
      working = parsed.pathname + parsed.search + parsed.hash;
    } catch {
      return url;
    }
  } else if (!url.startsWith('/')) {
    return url;
  }

  const parsedUrl = new URL(working, SITE_ORIGIN);
  let pathname = parsedUrl.pathname;

  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] && ['en', 'fr', 'es'].includes(segments[0])) {
    segments.shift();
    pathname = `/${segments.join('/')}`;
  }

  const prefixed = (localizedPath: string) => {
    const prefix = getLocalePrefix(locale);
    const suffix = localizedPath === '/' ? '' : localizedPath;
    const combined = `${prefix}${suffix}` || '/';
    return combined.startsWith('/') ? combined : `/${combined}`;
  };

  // Blog listings
  if (pathname === '/blog' || pathname === '/blog/') {
    return prefixed('/blog');
  }

  if (pathname.startsWith('/blog/')) {
    const [, slug] = pathname.split('/blog/');
    if (slug) {
      const localizedSlug = blogSlugMap[locale][slug] ?? (slug === canonicalSlug ? blogSlugMap[locale][slug] : null);
      const safeSlug = localizedSlug ?? slug;
      return prefixed(`/blog/${safeSlug}`);
    }
    return prefixed('/blog');
  }

  // Marketing slugs
  const marketingKeys = ['models', 'pricing', 'gallery', 'compare', 'blog'] as const;
  for (const key of marketingKeys) {
    const base = `/${localizedSlugs.en[key]}`;
    if (pathname === base || pathname.startsWith(`${base}/`)) {
      const localizedBase = `/${localizedSlugs[locale][key]}`;
      const suffix = pathname.slice(base.length);
      return prefixed(`${localizedBase}${suffix}`);
    }
  }

  return prefixed(pathname);
}

async function translateMap(locale: TargetLocale, entries: Record<string, string>): Promise<Record<string, string>> {
  if (Object.keys(entries).length === 0) {
    return {};
  }

  const guarded = Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, protect(value)])
  );

  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          `Translate the JSON object values to ${locale === 'fr' ? 'French (France)' : 'Spanish (Spain)'}.`,
          'Keep keys unchanged.',
          'Do NOT translate placeholders wrapped in « » and restore them afterwards.',
          'Do NOT translate words wrapped in ‹ ›.',
          'Preserve Markdown/MDX formatting and spacing.',
          'Return valid JSON.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify(guarded),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as Record<string, string>;
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, restore(String(value))]));
}

async function translateSegments(locale: TargetLocale, segments: Segment[]) {
  const chunks = chunkSegments(segments);
  for (const chunk of chunks) {
    const mapping = Object.fromEntries(chunk.map((segment) => [segment.id, segment.value]));
    const translated = await translateMap(locale, mapping);
    for (const segment of chunk) {
      const value = translated[segment.id];
      if (value) {
        segment.apply(value);
      }
    }
  }
}

function collectSegments(tree: unknown, segments: Segment[]) {
  visit(tree as any, (node: any, _index?: number, parent?: any) => {
    if (!node) {
      return;
    }
    if (node.type === 'code' || node.type === 'inlineCode') {
      return;
    }
    if (node.type === 'text') {
      const original = String(node.value ?? '');
      if (!original.trim()) {
        return;
      }
      const leading = original.match(/^\s*/)?.[0] ?? '';
      const trailing = original.match(/\s*$/)?.[0] ?? '';
      const core = original.trim();
      const id = `seg_${segments.length}`;
      segments.push({
        id,
        value: core,
        apply: (value) => {
          node.value = `${leading}${value.trim()}${trailing}`;
        },
      });
      return;
    }
    if (node.type === 'image' && typeof node.alt === 'string' && node.alt.trim()) {
      const id = `seg_${segments.length}`;
      segments.push({
        id,
        value: node.alt,
        apply: (value) => {
          node.alt = value;
        },
      });
    }
  });
}

async function translateBody(
  locale: TargetLocale,
  markdown: string,
  blogSlugMap: BlogSlugMap,
  canonicalSlug: string
): Promise<string> {
  const tree = parser.parse(markdown);
  visit(tree as any, 'link', (node: any) => {
    if (typeof node.url === 'string') {
      node.url = rewriteInternalUrl(node.url, locale, blogSlugMap, canonicalSlug);
    }
  });

  const segments: Segment[] = [];
  collectSegments(tree, segments);
  await translateSegments(locale, segments);

  const stringifyProcessor = unified()
    .use(remarkStringify, { bullet: '-', fences: true, listItemIndent: 'one' })
    .use(remarkGfm);

  return stringifyProcessor.stringify(tree);
}

async function ensureEnglishFrontmatter(filePath: string, data: Record<string, any>, content: string, slug: string) {
  let changed = false;
  const canonical = buildBlogUrl('en', slug);
  if (data.slug !== slug) {
    data.slug = slug;
    changed = true;
  }
  if (data.lang !== 'en') {
    data.lang = 'en';
    changed = true;
  }
  if (data.canonical !== canonical) {
    data.canonical = canonical;
    changed = true;
  }
  if (data.canonicalSlug !== slug) {
    data.canonicalSlug = slug;
    changed = true;
  }
  sanitizeFrontMatter(data);
  if (changed) {
    const updated = matter.stringify(content, data);
    fs.writeFileSync(filePath, `${updated}\n`);
    console.log(`Updated EN frontmatter: ${path.basename(filePath)}`);
  }
}

async function translatePost(filePath: string, blogSlugMap: BlogSlugMap): Promise<void> {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data ?? {};
  const enSlug = String(data.slug ?? path.basename(filePath, path.extname(filePath)));
  await ensureEnglishFrontmatter(filePath, data, parsed.content, enSlug);

  const tasks = TARGET_LOCALES.map((locale) =>
    localeLimit(async () => {
      const localeTitle = data.title ? await translateMap(locale, { title: data.title }) : { title: data.title };
      const translatedTitle = localeTitle.title ?? data.title;

      const localizedSlug = toSlug(locale, translatedTitle || enSlug);
      blogSlugMap[locale][enSlug] = localizedSlug;

      const fieldsToTranslate: Record<string, string> = {};
      if (data.description) {
        fieldsToTranslate.description = data.description;
      }
      if (data.excerpt) {
        fieldsToTranslate.excerpt = data.excerpt;
      }

      const translatedFields = await translateMap(locale, fieldsToTranslate);
      const body = await translateBody(locale, parsed.content, blogSlugMap, enSlug);

      const frontMatter = {
        ...data,
        title: translatedTitle,
        description: translatedFields.description ?? data.description,
        excerpt: translatedFields.excerpt ?? data.excerpt,
        slug: localizedSlug,
        lang: locale,
        canonical: buildBlogUrl(locale as BlogLocale, localizedSlug),
        canonicalSlug: enSlug,
      };
      sanitizeFrontMatter(frontMatter);

      const outputDir = OUTPUT_DIRS[locale];
      fs.mkdirSync(outputDir, { recursive: true });
      const outPath = path.join(outputDir, `${localizedSlug}.mdx`);
      const fileContents = matter.stringify(body, frontMatter);
      fs.writeFileSync(outPath, `${fileContents}\n`);
      console.log(`Translated ${path.basename(filePath)} → ${locale} (${localizedSlug})`);
    })
  );

  await Promise.all(tasks);
}

async function main() {
  for (const dir of Object.values(OUTPUT_DIRS)) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(EN_BLOG_DIR)) {
    throw new Error(`Missing EN blog directory at ${EN_BLOG_DIR}`);
  }

  const files = await fg('*.mdx', { cwd: EN_BLOG_DIR, absolute: true, dot: false });
  files.sort();

  const blogSlugMap: BlogSlugMap = {
    fr: {},
    es: {},
  };

  for (const filePath of files) {
    await translatePost(filePath, blogSlugMap);
  }
}

main().catch((error) => {
  console.error('[i18n:blog] failed', error);
  process.exit(1);
});
