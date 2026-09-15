import { BenchmarkMethodologyLink } from '@/components/marketing/BenchmarkMethodologyLink';
import type { AppLocale } from '@/i18n/locales';
import type { HomeComparisonData } from './home-comparison-types';
import { HomeComparisonCarousel } from './HomeComparisonCarousel.client';

const COPY = {
 en: { eyebrow:'Compare models',title:'Compare before you create.',body:'One model, several matchups. Compare overall scores, explore the criteria, then open the full comparison for capabilities and pricing.',cta:'Explore the comparison',method:'Editorial ratings · /10',labels:['Prompt adherence','Visual quality','Motion realism'],tips:['How closely the result follows the instructions.','Overall image quality and visual detail.','How natural and coherent the movement looks.'] },
 fr: { eyebrow:'Comparer les modèles',title:'Comparez avant de créer.',body:'Un modèle, plusieurs face-à-face. Comparez les notes globales, explorez les critères, puis consultez les fonctionnalités et les tarifs.',cta:'Voir le comparatif',method:'Évaluations éditoriales · /10',labels:['Respect des instructions','Qualité d’image','Réalisme du mouvement'],tips:['La fidélité du résultat aux instructions données.','La qualité d’ensemble et la finesse des détails.','Le naturel et la cohérence des mouvements.'] },
 es: { eyebrow:'Compara modelos',title:'Compara antes de crear.',body:'Un modelo, varias comparaciones. Revisa las notas globales y los criterios, y consulta las funciones y los precios en cada comparación.',cta:'Ver la comparación',method:'Evaluaciones editoriales · /10',labels:['Seguimiento de instrucciones','Calidad de imagen','Realismo del movimiento'],tips:['Qué tanto respeta el resultado las instrucciones.','La calidad general de la imagen y sus detalles.','Qué tan natural y coherente se ve el movimiento.'] },
};
export function HomeComparisonSection({ locale, scores }: { locale: AppLocale; scores: HomeComparisonData }) {
 const copy = COPY[locale];
 return <article id="compare" className="choice-comparison comparison-feature">
  <div><p className="editorial-eyebrow">{copy.eyebrow}</p><h2>{copy.title}</h2><p>{copy.body}</p><p className="comparison-editorial-label">{copy.method}</p></div>
  <HomeComparisonCarousel locale={locale} data={scores} methodology={<BenchmarkMethodologyLink locale={locale}/>}/>
 </article>;
}
