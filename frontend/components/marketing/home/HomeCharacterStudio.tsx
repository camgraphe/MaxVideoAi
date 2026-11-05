import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { PublicVideoPlayer } from '@/components/media/PublicVideoPlayer.client';
import type { AppLocale } from '@/i18n/locales';
import { CHARACTER_STUDIO_ART as art, type CharacterStudioMarketingFilm } from '@/components/tools/character-builder/landing/character-studio-marketing-assets';
import styles from './HomeCharacterStudio.module.css';

const COPY = {
  en: { title: 'One character.\nA world of possibilities.', body: 'Create a character, save their identity and explore new looks. Then give them a performance with Recast.', create: 'Create your character', recast: 'Open Recast', explore: 'Explore the videos', reference: 'Character reference', still: 'Still from the generated video', note: 'Actual Recast results. Identity and motion can vary between generations.', films: [{name:'Dixie',use:'Dance & social video',description:'A new pink-and-white look, brought into a choreography.'},{name:'Vesper',use:'Mascots & character stories',description:'An insect stylist makes an entrance beside a sports car.'}] },
  fr: { title: 'Un personnage.\nTout un univers.', body: 'Créez un personnage, sauvegardez son identité et imaginez ses prochains looks. Puis donnez-lui un mouvement avec Recast.', create: 'Créer mon personnage', recast: 'Ouvrir Recast', explore: 'Explorer les vidéos', reference: 'Référence personnage', still: 'Image extraite de la vidéo générée', note: 'De vrais résultats Recast. L’identité et le mouvement peuvent varier entre les générations.', films: [{name:'Dixie',use:'Danse & réseaux sociaux',description:'Un nouveau look rose et blanc, repris dans une chorégraphie.'},{name:'Vesper',use:'Mascottes & histoires',description:'Une styliste insecte fait son entrée près d’une voiture de sport.'}] },
  es: { title: 'Un personaje.\nTodo un universo.', body: 'Crea un personaje, guarda su identidad y explora nuevos looks. Después dale movimiento con Recast.', create: 'Crear mi personaje', recast: 'Abrir Recast', explore: 'Explorar los vídeos', reference: 'Referencia de personaje', still: 'Fotograma del vídeo generado', note: 'Resultados reales de Recast. La identidad y el movimiento pueden variar entre generaciones.', films: [{name:'Dixie',use:'Baile y redes sociales',description:'Un nuevo look rosa y blanco, llevado a una coreografía.'},{name:'Vesper',use:'Mascotas e historias',description:'Una estilista insecto hace su entrada junto a un coche deportivo.'}] },
};

/** Below-fold proof. Only the public catalog supplies playable media. */
export function HomeCharacterStudio({ locale, films = [] }: { locale: AppLocale; films?: CharacterStudioMarketingFilm[] }) {
  const c = COPY[locale];
  return <section id="character-studio" className={styles.section} aria-labelledby="home-character-title">
    <div className={`container-page ${styles.layout}`}>
      <div className={styles.intro}>
        <p className="editorial-eyebrow">Character Studio / Recast</p>
        <h2 id="home-character-title">{c.title}</h2><p>{c.body}</p>
        <div className={styles.actions}>
          <Link currentLocale={locale} href="/tools/character-builder" className={styles.primary} data-analytics-event="tool_cta_click" data-analytics-tool-name="character_builder" data-analytics-tool-surface="public" data-analytics-cta-location="home_character_studio">{c.create}<ArrowUpRight size={18} aria-hidden="true" /></Link>
          <Link href="/app/tools/character-builder?mode=recast" prefetch={false} className={styles.secondary}>{c.recast}<ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
        <Link currentLocale={locale} href={{ pathname: '/examples', hash: 'character-studio' }} className={styles.explore}>{c.explore}<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
      <div>
        <div className={styles.films}>{(['dixie','vesper'] as const).map((key,i) => {
          const film = films.find(f => f.key === key);
          return <figure className={styles.card} key={key}>
            <div className={styles.frame}>{film ? <PublicVideoPlayer src={film.video} poster={film.poster} title={`${c.films[i].name} · ${c.films[i].use}`} locale={locale} deferPoster className={styles.video} /> : <><Image src={key === 'dixie' ? art.dixieRecast : art.vesperRecast} alt={c.films[i].description} fill sizes="(max-width: 700px) 44vw, 24vw" loading="lazy" className={styles.video} /><span className={styles.still}>{c.still}</span></>}</div>
            <figcaption className={styles.caption}>
              <Image src={key === 'dixie' ? art.dixiePop : art.vesper} alt={`${c.reference} · ${c.films[i].name}`} width={48} height={64} loading="lazy" className={styles.portrait} />
              <div><p>{c.films[i].use}</p><h3>{c.films[i].name}</h3><span>{c.films[i].description}</span></div>
            </figcaption>
          </figure>;
        })}</div>
        <p className={styles.note}>{c.note}</p>
      </div>
    </div>
  </section>;
}
