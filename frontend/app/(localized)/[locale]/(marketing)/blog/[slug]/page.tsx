import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { resolveDictionary } from '@/lib/i18n/server';
import { locales } from '@/i18n/locales';
import { BlogPostView } from './_components/blog-post-view';
import {
  buildLocalizedBlogPostPath,
  demoteArticleHeadingContent,
  findLocalizedSlugs,
  formatBlogPostDate,
  getBlogPosts,
  getCanonicalBlogSlug,
  getNextStepCopy,
  getPost,
  toIsoDate,
  type BlogArticleCopy,
  type BlogPostParams,
} from './_lib/blog-post-data';
import {
  buildBlogPostJsonLd,
  buildBlogPostLocalization,
  buildBlogPostMetadata,
} from './_lib/blog-post-seo';

export const dynamicParams = false;

const DEFAULT_ARTICLE_COPY: BlogArticleCopy = {
  backLink: '← Back to blog',
  relatedTitle: 'Related reading',
  relatedBody: 'More workflow notes and engine breakdowns curated for you.',
  relatedCta: 'Read article',
};

export async function generateStaticParams(): Promise<BlogPostParams[]> {
  const params: BlogPostParams[] = [];
  for (const locale of locales) {
    const entries = await getBlogPosts(locale);
    entries.forEach((entry) => {
      params.push({ locale, slug: entry.slug });
    });
  }
  return params;
}

export async function generateMetadata(props: { params: Promise<BlogPostParams> }): Promise<Metadata> {
  const params = await props.params;
  const post = await getPost(params.locale, params.slug);
  if (!post) {
    return { title: 'Post not found — MaxVideo AI' };
  }

  const canonicalSlug = getCanonicalBlogSlug(post);
  const localizedSlugs = await findLocalizedSlugs(canonicalSlug);
  const localization = buildBlogPostLocalization({
    canonicalSlug,
    locale: params.locale,
    localizedSlugs,
  });

  return buildBlogPostMetadata({
    locale: params.locale,
    localization,
    post,
  });
}

export default async function BlogPostPage(props: { params: Promise<BlogPostParams> }) {
  const { locale, slug } = await props.params;
  const post = await getPost(locale, slug);
  if (!post) {
    notFound();
  }

  if (post.slug !== slug) {
    redirect(buildLocalizedBlogPostPath(locale, post.slug));
  }

  const { dictionary } = await resolveDictionary({ locale });
  const articleCopy = dictionary.blog.article ?? DEFAULT_ARTICLE_COPY;
  const canonicalSlug = getCanonicalBlogSlug(post);
  const localizedSlugs = await findLocalizedSlugs(canonicalSlug);
  const localization = buildBlogPostLocalization({
    canonicalSlug,
    locale,
    localizedSlugs,
  });
  const publishedIso = toIsoDate(post.date) ?? post.date;
  const modifiedIso = toIsoDate(post.updatedAt ?? post.date) ?? publishedIso;
  const { articleSchema, breadcrumbJsonLd } = buildBlogPostJsonLd({
    locale,
    localization,
    modifiedIso,
    post,
    publishedIso,
  });
  const relatedPosts = (await getBlogPosts(locale))
    .filter((entry) => getCanonicalBlogSlug(entry) !== canonicalSlug)
    .sort((a, b) => Date.parse(b.date ?? '') - Date.parse(a.date ?? ''))
    .slice(0, 3);

  return (
    <BlogPostView
      articleCopy={articleCopy}
      articleSchema={articleSchema}
      breadcrumbJsonLd={breadcrumbJsonLd}
      demotedContent={demoteArticleHeadingContent(post.content)}
      formattedDate={formatBlogPostDate(locale, post.date)}
      locale={locale}
      nextStep={getNextStepCopy(locale, canonicalSlug)}
      post={post}
      relatedPosts={relatedPosts}
    />
  );
}
