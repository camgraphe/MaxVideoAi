import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import styles from './AngleLanding.module.css';

export function AngleSectionIntro({
  eyebrow,
  title,
  body,
  titleId,
}: {
  eyebrow: string;
  title: string;
  body: ReactNode;
  titleId?: string;
}) {
  return (
    <header className={styles.sectionIntro}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id={titleId}>{title}</h2>
      <div className={styles.sectionIntroBody}>{body}</div>
    </header>
  );
}

export function AngleTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.textLink}>
      <span>{children}</span>
      <ArrowUpRight aria-hidden="true" />
    </Link>
  );
}
