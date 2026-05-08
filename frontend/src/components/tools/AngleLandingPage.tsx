import type { Dictionary } from '@/lib/i18n/types';
import { AngleLandingView } from './angle/landing/AngleLandingView';

type AngleLandingContent = Dictionary['toolMarketing']['angle'];

export function AngleLandingPage({ content }: { content: AngleLandingContent }) {
  return <AngleLandingView content={content} />;
}
