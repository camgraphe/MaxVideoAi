'use client';
import { AppGlyph } from '@/components/app/AppGlyph';
import { useI18n } from '@/lib/i18n/I18nProvider';
export function WorkspaceEmptyPreview({ media }: { media: 'video' | 'image' | 'audio' }) {
  const { locale } = useI18n();
  const labels = locale === 'fr' ? { video: 'Votre vidéo apparaîtra ici', image: 'Votre image apparaîtra ici', audio: 'Votre audio apparaîtra ici' } : locale === 'es' ? { video: 'Tu vídeo aparecerá aquí', image: 'Tu imagen aparecerá aquí', audio: 'Tu audio aparecerá aquí' } : { video: 'Your video will appear here', image: 'Your image will appear here', audio: 'Your audio will appear here' };
  const hints = locale === 'fr' ? {
    video: 'Décrivez votre vidéo, ajoutez les références demandées par le modèle, puis cliquez sur Générer.',
    image: 'Décrivez votre image, ajoutez une référence si nécessaire, puis cliquez sur Générer.',
    audio: 'Préparez votre texte et vos réglages, puis lancez la génération.',
  } : locale === 'es' ? {
    video: 'Describe tu vídeo, añade las referencias que requiera el modelo y pulsa Generar.',
    image: 'Describe tu imagen, añade una referencia si es necesaria y pulsa Generar.',
    audio: 'Prepara tu texto y los ajustes, y empieza a generar.',
  } : {
    video: 'Describe your video, add any references required by the model, then select Generate.',
    image: 'Describe your image, add a reference if needed, then select Generate.',
    audio: 'Prepare your text and settings, then start generating.',
  };
  return <div className="app-empty-preview" data-preview-media={media}>
    <span className="app-empty-preview-frame" aria-hidden="true"><AppGlyph name={media} /></span>
    <div className="app-empty-preview-copy"><p>{labels[media]}</p><p className="app-empty-preview-hint">{hints[media]}</p></div>
  </div>;
}
