import type { ReactNode } from 'react';
import DocsTocActive from '../components/DocsTocActive';
import type { DocsTocLink } from '../_lib/docs-index-data';

type DocsTocNavProps = {
  children: ReactNode;
  title?: string;
  tocLinks: DocsTocLink[];
};

export function DocsTocNav({ children, title, tocLinks }: DocsTocNavProps) {
  return (
    <nav aria-label="On-page navigation">
      <div className="rounded-xl border border-hairline bg-surface p-3 text-sm text-text-secondary sm:hidden">
        <div className="flex flex-wrap gap-2 text-muted-foreground">
          {tocLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="underline underline-offset-2 text-muted-foreground transition-colors hover:text-text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <div className="mt-4 sm:grid sm:grid-cols-[220px_1fr] sm:gap-6">
        <aside className="hidden sm:block sm:sticky sm:top-24 sm:h-max sm:self-start sm:rounded-xl sm:border sm:border-hairline sm:bg-surface sm:p-4 sm:text-sm sm:text-text-secondary">
          <div className="mb-2 text-sm font-semibold text-text-primary">{title ?? 'On this page'}</div>
          <ul className="space-y-1">
            {tocLinks.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  className="text-muted-foreground transition-colors hover:underline hover:text-text-primary"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>
        <div className="stack-gap-lg">
          <DocsTocActive />
          {children}
        </div>
      </div>
    </nav>
  );
}
