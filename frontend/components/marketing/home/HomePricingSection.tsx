import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { SectionCopy } from './home-redesign-types';
import type { HomePriceModel } from './home-price-demo-types';
import { HomePriceDemo } from './HomePriceDemo.client';

const COPY = {
 en:{eyebrow:'Made to fit your idea',title:'Pay for the video you need.',body:'Model, duration, resolution: choose what you need. See the price before you generate, with no subscription.'},
 fr:{eyebrow:'Juste ce qu’il vous faut',title:'Payez pour la vidéo dont vous avez besoin.',body:'Modèle, durée, résolution : choisissez ce qu’il vous faut. Le prix s’affiche avant de lancer, sans abonnement.'},
 es:{eyebrow:'Solo lo que necesitas',title:'Paga por el video que necesitas.',body:'Modelo, duración, resolución: elige lo que necesitas. Conoce el precio antes de generar, sin suscripción.'},
};
export function HomePricingSection({locale,models,copy}:{locale:AppLocale;models:HomePriceModel[];copy:SectionCopy}) {
 const c = COPY[locale];
 return <section id="your-price" className="home-price-lab section"><div className="container-page">
  <header className="chapter-heading"><div><p className="editorial-eyebrow">{c.eyebrow}</p><h2>{c.title}</h2></div><p>{c.body}</p></header>
  <HomePriceDemo locale={locale} models={models}/>
  <nav className="price-demo-related" aria-label={copy.title}><Link href="/models">{copy.modelsLink}</Link><Link href="/examples">{copy.examplesLink}</Link><Link href="/ai-video-engines">{copy.compareLink}</Link></nav>
 </div></section>;
}
