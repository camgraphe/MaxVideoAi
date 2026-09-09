'use client';
import { AppGlyph } from '@/components/app/AppGlyph';
import { useI18n } from '@/lib/i18n/I18nProvider';
export function WorkspaceEmptyPreview({ media }: { media: 'video' | 'image' | 'audio' }) {
  const { locale } = useI18n();
  const labels = locale === 'fr' ? { video: 'Votre vidéo apparaîtra ici', image: 'Votre image apparaîtra ici', audio: 'Votre audio apparaîtra ici' } : locale === 'es' ? { video: 'Tu vídeo aparecerá aquí', image: 'Tu imagen aparecerá aquí', audio: 'Tu audio aparecerá aquí' } : { video: 'Your video will appear here', image: 'Your image will appear here', audio: 'Your audio will appear here' };
  return <div className="app-empty-preview" data-preview-media={media}><span className="app-empty-preview-frame"><AppGlyph name={media} /></span><p>{labels[media]}</p></div>;
}
