import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './openart.module.css';

export function PriceShotLink({ children, location }: { children: ReactNode; location: 'openart_hero' | 'openart_footer' }) {
  return (
    <Link
      href="/app"
      prefetch={false}
      className={styles.button}
      data-analytics-event="cta_click"
      data-analytics-cta-name="openart_price_shot"
      data-analytics-cta-location={location}
      data-analytics-target-family="workspace"
    >
      {children}<ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
}
