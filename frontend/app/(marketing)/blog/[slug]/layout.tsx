import type { ReactNode } from 'react';
import BlogFooter from '@/components/blog/BlogFooter';

export default function BlogPostLayout({ children }: { children: ReactNode }) {
  return (
    <div className="blog-article-wrapper">
      <article className="blog-prose">{children}</article>
      <BlogFooter />
    </div>
  );
}
