import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

export interface ContentFrontMatter {
  title: string;
  description: string;
  date: string;
  image?: string;
  keywords?: string[];
  slug: string;
}

export interface ContentEntry extends ContentFrontMatter {
  content: string;
  excerpt: string;
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
  const processed = await remark().use(html).process(content);
  const htmlContent = processed.toString();
  const excerpt = content
    .split('\n')
    .find((line) => line.trim().length > 0 && !line.startsWith('#'))
    ?.trim()
    ?? '';
  return {
    ...frontMatter,
    content: htmlContent,
    excerpt,
  };
}

export async function getContentEntries(root: string): Promise<ContentEntry[]> {
  const baseDir = path.join(process.cwd(), root);
  const files = (await readDirectorySafe(baseDir)).filter((file) => file.endsWith('.md') || file.endsWith('.mdx'));
  const entries = await Promise.all(files.map((file) => parseMarkdownFile(path.join(baseDir, file))));
  return entries.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

export async function getEntryBySlug(root: string, slug: string): Promise<ContentEntry | null> {
  const entries = await getContentEntries(root);
  return entries.find((entry) => entry.slug === slug) ?? null;
}
