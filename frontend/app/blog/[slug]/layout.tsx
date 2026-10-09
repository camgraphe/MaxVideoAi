import type { ReactNode } from 'react';
import BlogArticleLayout from '../../(localized)/[locale]/(marketing)/blog/[slug]/layout';

export default function BlogArticleDefaultLayout({ children }: { children: ReactNode }) {
  return <BlogArticleLayout>{children}</BlogArticleLayout>;
}
