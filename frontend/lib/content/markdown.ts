import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import remarkGfm from 'remark-gfm';

export interface ContentFrontMatter {
  title: string;
  description: string;
  date: string;
  image?: string;
  keywords?: string[];
  slug: string;
  excerpt?: string;
  lang?: string;
  canonical?: string;
  canonicalSlug?: string;
}

export interface ContentEntry extends ContentFrontMatter {
  content: string;
  excerpt: string;
  structuredData?: string[];
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

async function parseMarkdownFile(filePath: string): Promise<ContentEntry> {
  const file = await fs.readFile(filePath, 'utf8');
  const { data, content } = matter(file);
  const frontMatter = data as ContentFrontMatter;
  if (!frontMatter.slug) {
    frontMatter.slug = path.basename(filePath).replace(/\.(md|mdx)$/i, '');
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
  };
}

export async function getContentEntries(root: string): Promise<ContentEntry[]> {
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

  const entries = await Promise.all(files.map((file) => parseMarkdownFile(path.join(baseDir as string, file))));
  return entries.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

export async function getEntryBySlug(root: string, slug: string): Promise<ContentEntry | null> {
  const entries = await getContentEntries(root);
  return entries.find((entry) => entry.slug === slug) ?? null;
}
