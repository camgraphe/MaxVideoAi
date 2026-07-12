import Image from 'next/image';
import Script from 'next/script';
import { Link } from '@/i18n/navigation';
import { TextLink } from '@/components/ui/TextLink';
import type { ContentEntry } from '@/lib/content/markdown';
import type { AppLocale } from '@/i18n/locales';
import type { ResolvedEditorialProfile } from '@/lib/editorial/profile';
import {
  getBlogLinkProps,
  getCanonicalBlogSlug,
  localeDateMap,
  type ArticleNextStep,
  type BlogArticleCopy,
} from '../_lib/blog-post-data';
import type { BlogEditorialCopy } from '../_lib/blog-editorial-copy';
import { BlogAuthorByline, BlogAuthorCard } from './blog-author-byline';

type BlogPostViewProps = {
  articleCopy: BlogArticleCopy;
  articleSchema: unknown;
  breadcrumbJsonLd: unknown;
  demotedContent: string;
  editorialCopy: BlogEditorialCopy;
  editorialProfile: ResolvedEditorialProfile;
  locale: AppLocale;
  modifiedLabel: string | null;
  nextStep: ArticleNextStep | null;
  post: ContentEntry;
  publishedLabel: string;
  relatedPosts: ContentEntry[];
};

export function BlogPostView({
  articleCopy,
  articleSchema,
  breadcrumbJsonLd,
  demotedContent,
  editorialCopy,
  editorialProfile,
  locale,
  modifiedLabel,
  nextStep,
  post,
  publishedLabel,
  relatedPosts,
}: BlogPostViewProps) {
  return (
    <div className="container-page max-w-5xl section">
      <div className="stack-gap-lg">
        <TextLink href="/blog" className="text-sm" linkComponent={Link}>
          {articleCopy.backLink}
        </TextLink>

        <article className="overflow-hidden rounded-[28px] border border-hairline bg-surface/90 shadow-card backdrop-blur">
          <header className="relative border-b border-hairline bg-gradient-to-br from-surface to-bg/60">
            {post.image ? (
              <div className="relative h-64 w-full overflow-hidden bg-bg sm:h-80">
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  priority
                  fetchPriority="high"
                  sizes="(min-width: 1024px) 960px, 100vw"
                  className="object-cover"
                  style={{ objectPosition: post.imagePosition ?? 'center' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/90 via-60% to-surface/10" />
              </div>
            ) : (
              <div className="h-24 w-full bg-gradient-to-r from-surface-2 via-surface-3 to-surface-2 sm:h-28" />
            )}
            <div className="relative z-10 stack-gap-lg px-6 pb-10 pt-8 sm:px-10">
              <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-micro text-text-muted">
                <div className="flex flex-wrap gap-2">
                  {post.keywords?.map((keyword) => (
                    <span key={keyword} className="rounded-pill bg-surface-2 px-3 py-1 font-semibold text-brand">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
              <div className="max-w-3xl stack-gap-sm">
                <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-5xl">{post.title}</h1>
                <p className="text-base leading-relaxed text-text-secondary sm:text-lg">{post.description}</p>
                <BlogAuthorByline
                  copy={editorialCopy}
                  locale={locale}
                  modifiedLabel={modifiedLabel}
                  profile={editorialProfile}
                  publishedLabel={publishedLabel}
                />
              </div>
            </div>
          </header>

          <div className="blog-prose px-6 py-10 sm:px-10" dangerouslySetInnerHTML={{ __html: demotedContent }} />
        </article>

        <BlogAuthorCard copy={editorialCopy} locale={locale} profile={editorialProfile} />

        {nextStep ? <ArticleNextStepSection nextStep={nextStep} /> : null}

        {relatedPosts.length ? (
          <RelatedPostsSection articleCopy={articleCopy} locale={locale} relatedPosts={relatedPosts} />
        ) : null}
      </div>

      <Script
        id={`breadcrumb-${locale}-${post.slug}-jsonld`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <Script
        id={`article-${locale}-${post.slug}-jsonld`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {post.structuredData?.map((json, index) => (
        <Script
          key={`faq-jsonld-${post.slug}-${index}`}
          id={`faq-jsonld-${post.slug}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: json }}
        />
      ))}
    </div>
  );
}

function ArticleNextStepSection({ nextStep }: { nextStep: ArticleNextStep }) {
  return (
    <section className="rounded-[28px] border border-hairline bg-surface/90 p-6 shadow-card sm:p-8">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{nextStep.eyebrow}</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">{nextStep.title}</h2>
        <p className="mt-3 text-sm leading-7 text-text-secondary sm:text-base">{nextStep.body}</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {nextStep.links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex items-center rounded-full border border-hairline bg-bg px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-border-hover hover:bg-surface-hover"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function RelatedPostsSection({
  articleCopy,
  locale,
  relatedPosts,
}: {
  articleCopy: BlogArticleCopy;
  locale: AppLocale;
  relatedPosts: ContentEntry[];
}) {
  return (
    <section className="stack-gap">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{articleCopy.relatedTitle}</h2>
        <p className="text-sm text-text-secondary">{articleCopy.relatedBody}</p>
      </div>
      <div className="grid grid-gap-sm md:grid-cols-3">
        {relatedPosts.map((related) => {
          const relatedLinkProps = getBlogLinkProps(locale, related);
          return (
            <article
              key={getCanonicalBlogSlug(related)}
              className="rounded-2xl border border-hairline bg-surface/90 p-5 shadow-card"
            >
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                {new Date(related.date).toLocaleDateString(localeDateMap[locale], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <h3 className="mt-2 text-base font-semibold text-text-primary">{related.title}</h3>
              <p className="mt-2 text-sm text-text-secondary">{related.description}</p>
              <Link
                {...relatedLinkProps}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-link transition hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {articleCopy.relatedCta} <span aria-hidden>→</span>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
