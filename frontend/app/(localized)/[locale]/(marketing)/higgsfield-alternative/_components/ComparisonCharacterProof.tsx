import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { CHARACTER_STUDIO_ART } from '@/components/tools/character-builder/landing/character-studio-marketing-assets';
import { getExperienceCopy } from '../_content/experience';
import styles from './comparison.module.css';

const imageSizes = '(max-width: 460px) calc(50vw - 39px), 205px';

export function ComparisonCharacterProof({ locale }: { locale: AppLocale }) {
  const copy = getExperienceCopy(locale).characterProof;
  const href = `${localizePathFromEnglish(locale, '/tools/character-builder')}#looks`;

  return (
    <section className={styles.characterProof} id="character-studio" aria-labelledby="character-title">
      <div className={styles.characterCopy}>
        <span className={styles.characterLabel}>Character Studio</span>
        <h2 id="character-title">{copy.title}</h2>
        <p>{copy.description}</p>
        <Link
          className={styles.budgetLink}
          href={href}
          prefetch={false}
          data-analytics-event="cta_click"
          data-analytics-cta-name="higgsfield_character_studio"
          data-analytics-cta-location="comparison_character_proof"
          data-analytics-target-family="tools"
        >
          {copy.link}<ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.characterPair}>
        <figure>
          <div className={styles.characterImage}>
            <Image src={CHARACTER_STUDIO_ART.dixie} alt={copy.portraitAlt} fill sizes={imageSizes} loading="lazy" />
          </div>
          <figcaption>{copy.portraitCaption}</figcaption>
        </figure>
        <ArrowRight size={18} aria-hidden="true" />
        <figure>
          <div className={styles.characterImage}>
            <Image src={CHARACTER_STUDIO_ART.dixiePop} alt={copy.lookAlt} fill sizes={imageSizes} loading="lazy" />
          </div>
          <figcaption>{copy.lookCaption}</figcaption>
        </figure>
      </div>
    </section>
  );
}
