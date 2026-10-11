import type {StudioPriceComparison} from '@/lib/studio/conversation-pricing-contract';
import type {ImageDraft} from '@/lib/studio/image-conversation-contract';
import {projectStudioReply} from '@/lib/studio/conversation-reply';

export function studioFilmComparisonReply(data:StudioPriceComparison,locale:'en'|'fr'|'es'='en'):ImageDraft {
  const fr=locale==='fr',es=locale==='es';
  const heading=fr?`Découpages pour le film complet de ${data.filmDurationSec} secondes`:
    es?`Opciones para la película completa de ${data.filmDurationSec} segundos`:`Cut plans for the complete ${data.filmDurationSec}-second film`;
  const lines=(data.filmPlans??[]).slice(0,3).map(plan=>{
    const duration=plan.clip.outputDurationSec;
    const cut=`${plan.fullClipCount} × ${duration} s${plan.tail?` + ${plan.tailUsedSec} s`:''}`;
    const trimmed=plan.generatedDurationSec>plan.totalDurationSec
      ? fr?` ; ${plan.generatedDurationSec} s générées et facturées, fin recoupée`:
        es?` ; ${plan.generatedDurationSec} s generados y facturados, final recortado`:`; ${plan.generatedDurationSec} s generated and priced, final clip trimmed`:'';
    const sound=plan.clip.audio==='always_generated'||plan.clip.settings.audio===true;
    const config=[plan.clip.settings.resolution,plan.clip.settings.aspectRatio,sound?(fr?'avec son':es?'con sonido':'with sound'):(fr?'sans son':es?'sin sonido':'without sound')].filter(Boolean).join(', ');
    return `- ${cut} — ${plan.clip.modelLabel.slice(0,80)}, ${config}: ${plan.price.formattedAmount} ${fr?'au total':es?'en total':'total'}${trimmed}.`;
  });
  const guidance=fr?'Les plans courts donnent davantage de rythme ; les plans longs favorisent la continuité. Choisissez le découpage adapté au sujet.':es?'Los planos cortos aportan ritmo; los largos favorecen la continuidad. Elige según el tema.':'Shorter shots give more pace; longer shots favor continuity. Choose what suits the subject.';
  const scope=fr?'Ces montants couvrent toutes les générations vidéo de chaque variante. Narration, musique ajoutée, retakes et export ne sont pas inclus dans cette estimation. Aucun devis ni génération créé : choisissez une variante, puis confirmez les devis exacts avant création.':es?'Los importes cubren todas las generaciones de vídeo de cada opción. Narración, música adicional, nuevas tomas y exportación no están incluidos. No se creó ningún presupuesto ni generación: elige una opción y confirma los presupuestos exactos antes de crear.':'These totals cover every video generation in each variant. Added narration/music, retakes and export are not included. No quote or generation was created: choose a variant, then confirm exact quotes before creation.';
  return {image:null,reply:projectStudioReply([heading+' ('+data.estimatedAt+').',...lines,guidance,scope].join('\n'))};
}
