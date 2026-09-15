import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { CreativeFilm } from '@/components/marketing/CreativeFilm.client';
import { HomeModelDiscovery } from './HomeModelDiscovery';
import { HOME_USE_CASE_FILMS } from './home-use-case-films';
import type { HomeExampleCard, ProviderItem, SectionCopy, ShotTypeCard } from './home-redesign-types';

const COPY = {
  en: { eyebrow: 'AI video examples', title: 'Make something worth watching.', body: 'Set a scene, animate an image, explore an idea or showcase a product. Start with what you want to create.', all: 'Browse all examples', guides: 'All use cases', play: 'Watch the video', loading: 'Loading…', error: 'Try again', cta: 'Find the right models', labels: ['Cinematic realism', 'Image-to-video', 'Fast drafts', 'Product ads'], titles: ['Give your scene a cinematic feel.', 'Bring a still image to life.', 'Try an idea. See where it goes.', 'Put your product in the spotlight.'], descriptions: ['Explore light, camera movement and atmosphere.', 'From a starting frame to a scene in motion.', 'Explore a visual direction before refining the details.', 'Create a product story, from close-up to final shot.'] },
  fr: { eyebrow: 'Exemples de vidéos IA', title: 'Créez ce qu’on a envie de regarder.', body: 'Mettez en scène une idée, animez une image, explorez un univers ou présentez un produit. Partez de ce que vous voulez créer.', all: 'Voir tous les exemples', guides: 'Tous les usages', play: 'Voir la vidéo', loading: 'Chargement…', error: 'Réessayer', cta: 'Trouver les modèles adaptés', labels: ['Rendu cinématographique', 'Animer une image', 'Premiers essais', 'Publicité produit'], titles: ['Donnez à votre scène une allure de cinéma.', 'Donnez vie à une image.', 'Essayez une idée. Voyez ce qu’elle donne.', 'Mettez votre produit en scène.'], descriptions: ['Explorez la lumière, les mouvements de caméra et les ambiances.', 'Une image de départ devient une scène en mouvement.', 'Explorez une piste visuelle avant d’affiner les détails.', 'Du gros plan au plan final, racontez votre produit.'] },
  es: { eyebrow: 'Ejemplos de videos con IA', title: 'Crea algo que den ganas de ver.', body: 'Crea una escena, anima una imagen, explora una idea o presenta un producto. Empieza por lo que quieres crear.', all: 'Ver todos los ejemplos', guides: 'Todos los usos', play: 'Ver el video', loading: 'Cargando…', error: 'Reintentar', cta: 'Encontrar modelos para este uso', labels: ['Realismo cinematográfico', 'De imagen a video', 'Primeras pruebas', 'Anuncios de productos'], titles: ['Dale un estilo de cine a tu escena.', 'Dale vida a una imagen.', 'Prueba una idea. Descubre qué sale.', 'Pon tu producto en escena.'], descriptions: ['Explora la luz, los movimientos de cámara y la atmósfera.', 'Una imagen inicial se convierte en una escena en movimiento.', 'Explora una dirección visual antes de pulir los detalles.', 'Cuenta la historia de tu producto, del detalle a la toma final.'] },
};

export function HomeCreativeWorlds({ locale, cards, examples, providers, examplesCopy }: {
  locale: AppLocale; cards: ShotTypeCard[]; examples: HomeExampleCard[]; providers: ProviderItem[];
  examplesCopy: SectionCopy & { featuredModelCta: string };
}) {
  const c = COPY[locale];
  return <section id="creations" className="creative-worlds home-use-case-gallery section"><div className="container-page">
    <header className="chapter-heading"><div><p className="editorial-eyebrow">{c.eyebrow}</p><h2>{c.title}</h2></div><div><p>{c.body}</p><Link href="/examples" className="text-link">{c.all}<span aria-hidden>↗</span></Link></div></header>
    <div id="choose" className="creative-worlds-grid">{HOME_USE_CASE_FILMS.map((film, i) => {
      const card = cards.find(item => item.slug === film.slug);
      return <figure key={film.slug}>
        <CreativeFilm {...film} title={c.titles[i]} playLabel={c.play} loadingLabel={c.loading} errorLabel={c.error}/>
        <figcaption><span><small>{c.labels[i]}</small><strong>{c.titles[i]}</strong></span><Link href={{ pathname: '/models/[slug]', params: { slug: film.modelSlug } }}>{film.model}<span aria-hidden> ↗</span></Link></figcaption>
        <p className="use-case-description">{c.descriptions[i]}</p>
        {card ? <Link href={card.href} className="use-case-link" data-analytics-event="shot_type_card_click" data-analytics-cta-name={card.slug} data-analytics-cta-location="shot_type_card" data-analytics-target-family="best-for">{c.cta}<span className="sr-only"> — {c.labels[i]}</span><span aria-hidden> ↗</span></Link> : null}
      </figure>;
    })}</div>
    <div className="use-case-all"><Link href="/ai-video-engines/best-for">{c.guides} <span aria-hidden>↗</span></Link></div>
    <HomeModelDiscovery locale={locale} examples={examples} providers={providers} copy={examplesCopy}/>
  </div></section>;
}
