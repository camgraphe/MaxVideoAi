import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { unstable_cache } from 'next/cache';
import { remark } from 'remark';
import html from 'remark-html';
import remarkGfm from 'remark-gfm';
import { editorialArtifactFilename, publicEditorialArticleSchema, type PublicEditorialArticle } from '@/lib/editorial/public-article';

export interface ContentFrontMatter {
  title: string;
  description: string;
  date: string;
  updatedAt?: string;
  image?: string;
  imagePosition?: string;
  keywords?: string[];
  slug: string;
  excerpt?: string;
  lang?: string;
  canonical?: string;
  canonicalSlug?: string;
  authorId?: string;
  editorialArtifact?: string;
}

export interface ContentEntry extends ContentFrontMatter {
  content: string;
  excerpt: string;
  structuredData?: string[];
  sourcePath?: string;
  editorial?: PublicEditorialArticle;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

async function readDirectorySafe(directory: string): Promise<string[]> {
  try {
    return await fs.readdir(directory);
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

type MarkdownSource = { filePath: string; file: string; artifact?: string };

async function readMarkdownSource(filePath: string): Promise<MarkdownSource> {
  const file = await fs.readFile(filePath, 'utf8');
  const { data } = matter(file, {});
  if (data.editorialArtifact === undefined) return { filePath, file };
  const slug = data.slug || path.basename(filePath).replace(/\.(md|mdx)$/i, '');
  const filename = editorialArtifactFilename(data.editorialArtifact, slug);
  return { filePath, file, artifact: await fs.readFile(path.join(path.dirname(filePath), filename), 'utf8') };
}

export async function parseMarkdownFile(filePath: string): Promise<ContentEntry> {
  return parseMarkdownSource(await readMarkdownSource(filePath));
}

async function parseMarkdownSource({ filePath, file, artifact }: MarkdownSource): Promise<ContentEntry> {
  // Next owns parsed-result caching. Options disable gray-matter's unbounded
  // raw-string cache, whose shared front matter also retained inferred slugs on rename.
  const { data, content } = matter(file, {});
  const frontMatter = data as ContentFrontMatter;
  if (!frontMatter.slug) {
    frontMatter.slug = path.basename(filePath).replace(/\.(md|mdx)$/i, '');
  }
  if (frontMatter.editorialArtifact !== undefined) {
    editorialArtifactFilename(frontMatter.editorialArtifact, frontMatter.slug);
    const editorial = publicEditorialArticleSchema.parse(JSON.parse(artifact ?? 'null'));
    const a = editorial.article;
    if (a.slug !== frontMatter.slug || a.locale !== frontMatter.lang || a.title !== frontMatter.title || a.description !== frontMatter.description || editorial.canonicalSlug !== frontMatter.canonicalSlug || editorial.publication.publishedAt !== frontMatter.date) throw Error('Editorial artifact metadata mismatch');
    return { ...frontMatter, content: '', excerpt: a.description, sourcePath: filePath, editorial };
  }
  const processed = await remark().use(remarkGfm).use(html).process(content);
  let htmlContent = processed.toString();
  const structuredData: string[] = [];

  const scriptRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  htmlContent = htmlContent.replace(scriptRegex, (_match, json) => {
    const trimmed = typeof json === 'string' ? json.trim() : '';
    if (trimmed) {
      structuredData.push(trimmed);
    }
    return '';
  });
  const excerpt = content
    .split('\n')
    .find((line) => line.trim().length > 0 && !line.startsWith('#'))
    ?.trim()
    ?? '';
  return {
    ...frontMatter,
    content: htmlContent,
    excerpt,
    structuredData: structuredData.length ? structuredData : undefined,
    sourcePath: filePath,
  };
}

const MARKDOWN_CACHE_REVALIDATE_SECONDS = 60 * 60; // 1 hour

async function readMarkdownSources(root: string): Promise<MarkdownSource[]> {
  const candidateDirs = Array.from(
    new Set([
      path.join(process.cwd(), root),
      path.join(process.cwd(), '..', root),
      path.join(process.cwd(), '..', '..', root),
      path.join(__dirname, '..', '..', '..', root),
    ])
  );

  let files: string[] = [];
  let baseDir: string | null = null;

  for (const dir of candidateDirs) {
    const dirFiles = (await readDirectorySafe(dir)).filter((file) => file.endsWith('.md') || file.endsWith('.mdx'));
    if (dirFiles.length > 0) {
      baseDir = dir;
      files = dirFiles;
      break;
    }
  }

  if (!baseDir) {
    return [];
  }

  const sourceDirectory = baseDir;
  return Promise.all(files.sort().map(async (name) => {
    const filePath = path.join(sourceDirectory, name);
    return readMarkdownSource(filePath);
  }));
}

async function parseMarkdownSources(sources: MarkdownSource[]): Promise<ContentEntry[]> {
  const entries = await Promise.all(sources.map(parseMarkdownSource));
  return entries.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

export async function getContentEntries(root: string): Promise<ContentEntry[]> {
  const sources = await readMarkdownSources(root);
  if (sources.length === 0) return [];
  if (process.env.NODE_ENV !== 'production') {
    return parseMarkdownSources(sources);
  }

  // Data Cache survives builds. Hash the exact source snapshot, including filenames
  // for inferred slugs, so edits cannot be baked into static pages from an older cache.
  // Parse this same snapshot only on a miss; do not reread files inside the callback.
  const hash = createHash('sha256');
  for (const { filePath, file, artifact } of sources) hash.update(JSON.stringify([filePath, file, artifact]));
  const cached = unstable_cache(async () => parseMarkdownSources(sources), ['contentEntries', root, hash.digest('hex')], {
    revalidate: MARKDOWN_CACHE_REVALIDATE_SECONDS,
  });
  return cached();
}

export async function getEntryBySlug(root: string, slug: string): Promise<ContentEntry | null> {
  const entries = await getContentEntries(root);
  return entries.find((entry) => entry.slug === slug) ?? null;
}
