import type { Dictionary } from '@/lib/i18n/types';
import { BackgroundRemovalLandingView } from './background-removal/landing/BackgroundRemovalLandingView';

type BackgroundRemovalLandingContent = Dictionary['toolMarketing']['backgroundRemoval'];

export function BackgroundRemovalLandingPage({ content }: { content: BackgroundRemovalLandingContent }) {
  return <BackgroundRemovalLandingView content={content} />;
}
