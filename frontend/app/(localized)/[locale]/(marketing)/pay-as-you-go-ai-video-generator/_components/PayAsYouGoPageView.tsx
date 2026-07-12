import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  CreditCard,
  Eye,
  Film,
  Layers3,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { AppLocale } from '@/i18n/locales';
import { PayAsYouGoVideoShowcase } from './PayAsYouGoVideoShowcase';
import type { PayAsYouGoPageData } from '../_lib/payg-page-data';
import type { PayAsYouGoShowcaseVideo } from '../_lib/payg-video-showcase';

type PayAsYouGoPageViewProps = {
  locale: AppLocale;
  data: PayAsYouGoPageData;
  showcaseVideos: PayAsYouGoShowcaseVideo[];
};

type PayAsYouGoPageDataProps = {
  data: PayAsYouGoPageData;
  copy: PaygViewCopy;
};

type PaygCopyProps = { copy: PaygViewCopy };

function getPayAsYouGoViewCopy(locale: AppLocale) {
  return {
    text: (en: string, es: string, fr: string) => ({ en, es, fr })[locale],
  };
}

type PaygViewCopy = ReturnType<typeof getPayAsYouGoViewCopy>;

const containerClassName = 'container-page max-w-[1220px]';

const stepItems = (copy: PaygViewCopy) => [
  {
    title: copy.text('Choose a video engine', 'Elige un motor de video', 'Choisissez un moteur vidéo'),
    body: copy.text('Select the model that fits the brief instead of being locked into one subscription catalog.', 'Selecciona el modelo que mejor se adapte al proyecto, sin quedarte limitado a un solo catálogo de suscripción.', 'Sélectionnez le modèle adapté au projet sans rester limité à un seul catalogue par abonnement.'),
    icon: SlidersHorizontal,
  },
  {
    title: copy.text('Review the live quote', 'Revisa la cotización en tiempo real', 'Examinez le devis en direct'),
    body: copy.text('See price, duration, resolution, audio, and workflow choices before generation.', 'Consulta el precio, la duración, la resolución, el audio y el flujo de trabajo antes de generar.', 'Consultez le prix, la durée, la résolution, l’audio et le flux de travail avant la génération.'),
    icon: Eye,
  },
  {
    title: copy.text('Launch the generation', 'Inicia la generación', 'Lancez la génération'),
    body: copy.text('Run a text-to-video, image-to-video, or video workflow only after the cost is visible.', 'Inicia un flujo de texto a video, imagen a video o video solo después de ver el costo.', 'Lancez un flux texte vers vidéo, image vers vidéo ou vidéo après avoir vu le coût.'),
    icon: Film,
  },
  {
    title: copy.text('Spend on success', 'Paga solo los resultados', 'Payez uniquement les résultats'),
    body: copy.text('Completed renders consume credits. Provider failures are refunded or not charged when no usable result returns.', 'Los renders completados consumen créditos. Los fallos del proveedor se reembolsan o no se cobran si no hay resultado utilizable.', 'Les rendus terminés consomment des crédits. Les échecs du fournisseur sont remboursés ou non facturés sans résultat utilisable.'),
    icon: RotateCcw,
  },
] as const;

const comparisonRows = (copy: PaygViewCopy) => [
  {
    label: copy.text('Budget control', 'Control del presupuesto', 'Maîtrise du budget'),
    payg: copy.text('Add credits when you need videos and stop when the project is done.', 'Añade créditos cuando necesites videos y detente al terminar el proyecto.', 'Ajoutez des crédits lorsque vous avez besoin de vidéos et arrêtez à la fin du projet.'),
    subscription: copy.text('Pay a recurring plan even in months where you do not render.', 'Paga un plan recurrente incluso los meses sin renders.', 'Payez un forfait récurrent, même les mois sans rendu.'),
  },
  {
    label: copy.text('Model choice', 'Elección de modelo', 'Choix du modèle'),
    payg: copy.text('Compare Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX and other engines per job.', 'Compara Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX y otros motores según el proyecto.', 'Comparez Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX et d’autres moteurs selon le projet.'),
    subscription: copy.text('Often tied to one vendor, one model family, or one usage pool.', 'Suele limitarse a un proveedor, una familia de modelos o una bolsa de uso.', 'Souvent limité à un fournisseur, une famille de modèles ou un quota d’usage.'),
  },
  {
    label: copy.text('Price visibility', 'Visibilidad del precio', 'Visibilité du prix'),
    payg: copy.text('Review the quote before each generation starts.', 'Revisa la cotización antes de iniciar cada generación.', 'Examinez le devis avant chaque génération.'),
    subscription: copy.text('Included credits can hide the real cost of premium settings.', 'Los créditos incluidos pueden ocultar el costo real de las opciones premium.', 'Les crédits inclus peuvent masquer le coût réel des options premium.'),
  },
  {
    label: copy.text('Experimentation', 'Experimentación', 'Expérimentation'),
    payg: copy.text('Run small tests before scaling a campaign, client project, or production workflow.', 'Haz pruebas pequeñas antes de escalar una campaña, un proyecto de cliente o una producción.', 'Lancez de petits essais avant de déployer une campagne, un projet client ou une production.'),
    subscription: copy.text('A plan decision usually happens before you know which model fits.', 'La decisión del plan suele tomarse antes de saber qué modelo encaja mejor.', 'Le choix du forfait intervient souvent avant de savoir quel modèle convient.'),
  },
] as const;

const quoteFactors = (copy: PaygViewCopy) => [
  {
    title: copy.text('Model', 'Modelo', 'Modèle'),
    body: copy.text('Premium engines and fast variants can price differently.', 'Los motores premium y las variantes rápidas pueden tener precios distintos.', 'Les moteurs premium et les variantes rapides peuvent avoir des prix différents.'),
    icon: Layers3,
  },
  {
    title: copy.text('Duration', 'Duración', 'Durée'),
    body: copy.text('Longer clips consume more credits than short drafts.', 'Los clips más largos consumen más créditos que los borradores cortos.', 'Les clips plus longs consomment plus de crédits que les brouillons courts.'),
    icon: Film,
  },
  {
    title: copy.text('Resolution', 'Resolución', 'Résolution'),
    body: copy.text('1080p, 4K, and high-quality outputs change the quote.', 'La resolución 1080p, 4K y las salidas de alta calidad cambian la cotización.', 'La 1080p, la 4K et les sorties haute qualité modifient le devis.'),
    icon: Sparkles,
  },
  {
    title: copy.text('Audio and workflow', 'Audio y flujo de trabajo', 'Audio et flux de travail'),
    body: copy.text('Audio, image references, video inputs, and tool routes can affect cost.', 'El audio, las imágenes de referencia, las entradas de video y las herramientas pueden afectar el costo.', 'L’audio, les images de référence, les entrées vidéo et les outils peuvent influer sur le coût.'),
    icon: BadgeDollarSign,
  },
] as const;

const quickSummaryItems = (copy: PaygViewCopy) => [
  copy.text('Generate AI videos from text, images, or video.', 'Genera videos con IA desde texto, imágenes o video.', 'Générez des vidéos IA à partir de texte, d’images ou de vidéo.'),
  copy.text('Start with Seedance 2, then compare Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX and Wan.', 'Empieza con Seedance 2 y después compara Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX y Wan.', 'Commencez avec Seedance 2, puis comparez Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX et Wan.'),
  copy.text('See the estimated price before launching.', 'Consulta el precio estimado antes de iniciar.', 'Consultez le prix estimé avant de lancer.'),
  copy.text('Use credits only for completed renders.', 'Usa créditos solo para renders completados.', 'Utilisez des crédits uniquement pour les rendus terminés.'),
] as const;

const audienceFitCards = (copy: PaygViewCopy) => [
  {
    title: copy.text('Who uses pay-as-you-go AI video credits?', '¿Quién usa créditos de video con IA de pago por uso?', 'Qui utilise des crédits vidéo IA prépayés ?'),
    body: copy.text('Creators, agencies, SaaS teams, ecommerce brands, marketers, and studios use credits when AI video generation is project-based instead of monthly.', 'Creadores, agencias, equipos SaaS, marcas de ecommerce, especialistas en marketing y estudios usan créditos cuando la generación de video con IA depende de proyectos y no de una cuota mensual.', 'Créateurs, agences, équipes SaaS, marques e-commerce, spécialistes marketing et studios utilisent des crédits lorsque la génération vidéo IA dépend des projets plutôt que d’un forfait mensuel.'),
    bullets: [
      copy.text('Test prompts before a campaign', 'Prueba prompts antes de una campaña', 'Testez des prompts avant une campagne'),
      copy.text('Create product ads and client drafts', 'Crea anuncios de producto y borradores para clientes', 'Créez des publicités produit et des brouillons client'),
      copy.text('Turn approved images into short videos', 'Convierte imágenes aprobadas en videos cortos', 'Transformez des images approuvées en courtes vidéos'),
      copy.text('Compare whether a premium model is worth the cost', 'Compara si un modelo premium justifica el costo', 'Comparez si un modèle premium justifie son coût'),
    ],
  },
  {
    title: copy.text('When a subscription may fit better', 'Cuándo puede convenir más una suscripción', 'Quand un abonnement peut être plus adapté'),
    body: copy.text('A subscription can make sense if you generate large volumes every week on the same platform. Pay-as-you-go fits changing usage, model comparison, and avoiding idle monthly spend.', 'Una suscripción puede tener sentido si generas grandes volúmenes cada semana en la misma plataforma. El pago por uso se adapta mejor a una demanda variable, a la comparación de modelos y a evitar pagos durante meses sin uso.', 'Un abonnement peut être pertinent si vous générez de gros volumes chaque semaine sur la même plateforme. Le paiement à l’usage convient mieux à un usage variable, à la comparaison des modèles et à l’absence de dépenses mensuelles inutilisées.'),
    bullets: [
      copy.text('Project-by-project usage', 'Uso por proyecto', 'Usage projet par projet'),
      copy.text('Multiple model families in one workflow', 'Varias familias de modelos en un solo flujo', 'Plusieurs familles de modèles dans un même flux'),
      copy.text('Live quote before each render', 'Cotización en tiempo real antes de cada render', 'Devis en direct avant chaque rendu'),
      copy.text('No recurring commitment before testing quality', 'Sin compromiso recurrente antes de probar la calidad', 'Aucun engagement récurrent avant de tester la qualité'),
    ],
  },
] as const;

function SectionHeader({
  eyebrow,
  title,
  intro,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-micro text-brand">{eyebrow}</p> : null}
      <h2 className="mt-3 text-2xl font-semibold tracking-normal text-text-primary sm:text-3xl">{title}</h2>
      {intro ? <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">{intro}</p> : null}
    </div>
  );
}

function isVisiblePrice(value: string | undefined) {
  const normalized = value?.trim();
  return Boolean(normalized && normalized !== '-' && normalized !== '—' && !/live quote|cotización en tiempo real|devis en (?:direct|temps réel)/i.test(normalized));
}

function firstVisiblePrice(row: PayAsYouGoPageData['pricing']['rows'][number], copy: PaygViewCopy) {
  return row.priceCells.find((cell) => isVisiblePrice(cell.value))?.value ?? copy.text('Live quote', 'Cotización en tiempo real', 'Devis en temps réel');
}

function examplePriceLabel(value: string, copy: PaygViewCopy) {
  return isVisiblePrice(value) ? `${copy.text('Example', 'Ejemplo', 'Exemple')} : ${value}` : value;
}

function findModelForExampleCost(data: PayAsYouGoPageData) {
  const sampleCost = data.exampleCosts[0];
  if (!sampleCost) return data.pricing.rows[0];
  const costEngine = sampleCost.engine.toLowerCase();
  return (
    data.pricing.rows.find((row) => {
      const rowName = row.engineName.toLowerCase();
      return costEngine.includes(rowName) || rowName.includes(costEngine);
    }) ??
    data.pricing.rows.find((row) => row.priceCells.some((cell) => cell.value === sampleCost.price)) ??
    data.pricing.rows[0]
  );
}

function HeroQuoteCard({ data, copy }: PayAsYouGoPageDataProps) {
  const sampleCost = data.exampleCosts[0];
  const sampleModel = findModelForExampleCost(data);
  const previewRows = data.pricing.rows.slice(0, 4);

  return (
    <div className="relative overflow-hidden rounded-[8px] border border-hairline bg-surface shadow-card">
      <div className="h-1 bg-[linear-gradient(90deg,#14A46C,#1F5EFF)]" />
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.text('MaxVideoAI quote console', 'Cotizador de MaxVideoAI', 'Simulateur de devis MaxVideoAI')}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{copy.text('Price before generation', 'Precio antes de generar', 'Prix avant la génération')}</p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-bg text-[#14A46C]">
            <Sparkles className="h-5 w-5" strokeWidth={1.9} />
          </span>
        </div>

        <div className="mt-5 grid gap-2">
          {previewRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-hairline bg-bg px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <EngineIcon engine={row.engineIcon} imageAlt={`${row.engineName} ${copy.text('AI video model', 'modelo de video con IA', 'modèle de vidéo IA')}`} size={30} rounded="full" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{row.engineName}</p>
                  <p className="text-[11px] uppercase tracking-micro text-text-muted">{row.family}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-hairline bg-surface px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-text-primary">
                {firstVisiblePrice(row, copy)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-[8px] border border-hairline bg-bg p-3">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Prompt</p>
          <p className="mt-2 text-sm leading-6 text-text-primary">
            {copy.text('Cinematic product reveal, slow camera push, clean studio lighting.', 'Presentación cinematográfica de producto, acercamiento lento de cámara e iluminación limpia de estudio.', 'Présentation produit cinématographique, lent mouvement avant de caméra et éclairage studio épuré.')}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-[8px] border border-hairline bg-bg p-3">
            <span className="block text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.text('Model', 'Modelo', 'Modèle')}</span>
            <span className="mt-1 block truncate font-semibold text-text-primary">{sampleModel?.engineName ?? copy.text('Choose model', 'Elige un modelo', 'Choisissez un modèle')}</span>
          </div>
          <div className="rounded-[8px] border border-hairline bg-bg p-3">
            <span className="block text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.text('Example cost', 'Costo de ejemplo', 'Coût indicatif')}</span>
            <span className="mt-1 block font-mono font-semibold tabular-nums text-text-primary">
              {sampleCost?.price ?? copy.text('Live quote', 'Cotización en tiempo real', 'Devis en temps réel')}
            </span>
            {sampleCost?.context ? (
              <span className="mt-1 block text-xs font-semibold text-text-muted">{sampleCost.context}</span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-[8px] border border-[#14A46C]/25 bg-[#14A46C]/[0.08] px-3 py-2.5">
          <span className="text-sm font-semibold text-[#0F7A52]">{copy.text('Charge rule', 'Regla de cobro', 'Règle de facturation')}</span>
          <span className="text-right text-sm font-semibold text-[#0F7A52]">{copy.text('Completed renders only', 'Solo renders completados', 'Rendus terminés uniquement')}</span>
        </div>
      </div>
    </div>
  );
}

function HeroSection({ data, copy }: PayAsYouGoPageDataProps) {
  return (
    <header className="border-b border-hairline bg-bg">
      <div className={`${containerClassName} grid gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center`}>
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-micro text-brand">{copy.text('AI video credits, no monthly lock-in', 'Créditos de video con IA, sin compromiso mensual', 'Crédits vidéo IA, sans engagement mensuel')}</p>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.04] tracking-normal text-text-primary sm:text-[54px]">
            {data.hero.title}
          </h1>
          <p className="mt-5 max-w-[760px] text-base leading-7 text-text-secondary sm:text-lg">{data.hero.intro}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/app"
              prefetch={false}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-text-primary px-5 text-sm font-semibold text-bg shadow-card transition hover:bg-text-primary/90"
            >
              {data.hero.primaryCta}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
            <Link
              href={data.pricing.fullMatrixHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-hairline bg-surface px-5 text-sm font-semibold text-text-primary transition hover:border-text-muted"
            >
              {data.hero.secondaryCta}
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {data.hero.trustItems.map((item) => (
              <span
                key={item}
                className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 text-[11px] font-semibold text-text-secondary"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[#14A46C]" strokeWidth={1.9} />
                {item}
              </span>
            ))}
          </div>
        </div>
        <HeroQuoteCard data={data} copy={copy} />
      </div>
    </header>
  );
}

function NaturalQuestionsSection({ data, copy }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${containerClassName} grid gap-8 py-10 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start`}>
        <div>
          <SectionHeader
            eyebrow={copy.text('Quick answers', 'Respuestas rápidas', 'Réponses rapides')}
            title={copy.text('Quick answers before you spend credits', 'Lo esencial antes de usar tus créditos', 'L’essentiel avant d’utiliser vos crédits')}
            intro={copy.text('A pay-as-you-go AI video generator lets you buy credits only when you need them, choose a model per project, review the price before rendering, and spend credits only when the render completes successfully.', 'Un generador de video con IA de pago por uso te permite comprar créditos solo cuando los necesitas, elegir un modelo para cada proyecto, revisar el precio antes del render y gastar créditos únicamente cuando el resultado se completa.', 'Un générateur de vidéos IA sans abonnement vous permet d’acheter des crédits uniquement lorsque vous en avez besoin, de choisir un modèle par projet, de vérifier le prix avant le rendu et de ne dépenser les crédits qu’une fois le résultat terminé.')}
          />
          <div className="mt-5 rounded-[8px] border border-hairline bg-bg p-4 shadow-sm">
            <p className="text-sm font-semibold text-text-primary">{copy.text('With MaxVideoAI, you can:', 'Con MaxVideoAI puedes:', 'Avec MaxVideoAI, vous pouvez :')}</p>
            <ul className="mt-3 grid gap-2">
              {quickSummaryItems(copy).map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-text-secondary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14A46C]" strokeWidth={1.9} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {data.naturalQuestions.map((item) => (
            <article key={item.question} className="rounded-[8px] border border-hairline bg-bg p-4 shadow-sm">
              <h2 className="text-base font-semibold leading-snug text-text-primary">{item.question}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{item.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModelTestingOrderSection({ data, copy }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader
          eyebrow={copy.text('Model order', 'Orden de prueba', 'Ordre des essais')}
          title={copy.text('Recommended testing order for pay-as-you-go AI video', 'Orden recomendado para probar video con IA de pago por uso', 'Ordre recommandé pour tester la vidéo IA sans abonnement')}
          intro={copy.text('For most current benchmark tests, start with Seedance 2.0. Then compare Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, and Wan depending on motion, cinematic quality, references, speed, and price.', 'Para una referencia actual, empieza con Seedance 2.0. Después compara Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX y Wan según el movimiento, la calidad cinematográfica, las referencias, la velocidad y el precio.', 'Pour établir une référence actuelle, commencez par Seedance 2.0. Comparez ensuite Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX et Wan selon le mouvement, la qualité cinématographique, les références, la vitesse et le prix.')}
        />
        <ol className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.supportedModels.map((model, index) => (
            <li key={model.family}>
              <Link
                href={model.href}
                className="group flex h-full gap-4 rounded-[8px] border border-hairline bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-text-muted"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-bg font-mono text-sm font-semibold tabular-nums text-text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <EngineIcon engine={model.engineIcon} imageAlt={`${model.family} ${copy.text('AI video model', 'modelo de video con IA', 'modèle de vidéo IA')}`} size={28} rounded="full" />
                    <p className="text-sm font-semibold text-text-primary">{model.family}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{model.body}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary">
          {copy.text('Happy Horse 1.1 and Seedance 2 Mini are new enough that they should be tested directly instead of judged only by older model rankings.', 'Happy Horse 1.1 y Seedance 2 Mini son lo bastante recientes como para probarlos directamente, en lugar de evaluarlos solo con rankings de modelos anteriores.', 'Happy Horse 1.1 et Seedance 2 Mini sont assez récents pour mériter des essais directs plutôt qu’un jugement fondé uniquement sur d’anciens classements.')}
        </p>
      </div>
    </section>
  );
}

function AudienceFitSection({ copy }: PaygCopyProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${containerClassName} py-12`}>
        <div className="grid gap-4 lg:grid-cols-2">
          {audienceFitCards(copy).map((card) => (
            <article key={card.title} className="rounded-[8px] border border-hairline bg-bg p-5 shadow-sm sm:p-6">
              <h2 className="text-2xl font-semibold tracking-normal text-text-primary">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">{card.body}</p>
              <ul className="mt-5 grid gap-2">
                {card.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2 text-sm leading-6 text-text-secondary">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14A46C]" strokeWidth={1.9} />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MeaningSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${containerClassName} grid gap-8 py-12 lg:grid-cols-[0.95fr_1.05fr]`}>
        <div>
          <SectionHeader title={data.meaning.title} intro={data.meaning.body} />
          <ul className="mt-5 grid gap-2">
            {data.meaning.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2 text-sm leading-6 text-text-secondary">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14A46C]" strokeWidth={1.9} />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionHeader title={data.noSubscription.title} intro={data.noSubscription.body} />
          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {data.noSubscription.cards.map((card) => (
              <article key={card.title} className="rounded-[8px] border border-hairline bg-surface p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-text-primary">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SubscriptionComparisonSection({ copy }: PaygCopyProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader
          eyebrow={copy.text('No subscription required', 'Sin suscripción obligatoria', 'Aucun abonnement requis')}
          title={copy.text('Pay-as-you-go vs subscription', 'Pago por uso vs. suscripción', 'Paiement à l’usage ou abonnement')}
          intro={copy.text('The right billing model depends on how often you generate, how many models you need to test, and whether unused monthly credits create waste.', 'La opción adecuada depende de la frecuencia con la que generas, de cuántos modelos necesitas probar y de si los créditos mensuales sin usar se convierten en gasto perdido.', 'Le bon mode de facturation dépend de votre fréquence de génération, du nombre de modèles à tester et du gaspillage éventuel de crédits mensuels inutilisés.')}
        />
        <div className="mt-6 overflow-x-auto rounded-[8px] border border-hairline bg-bg shadow-card">
          <table className="min-w-[780px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
                <th className="px-4 py-3">{copy.text('Decision point', 'Criterio', 'Critère')}</th>
                <th className="px-4 py-3">{copy.text('MaxVideoAI pay-as-you-go', 'MaxVideoAI de pago por uso', 'MaxVideoAI à l’usage')}</th>
                <th className="px-4 py-3">{copy.text('Typical subscription', 'Suscripción típica', 'Abonnement classique')}</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows(copy).map((row) => (
                <tr key={row.label} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-4 font-semibold text-text-primary">{row.label}</td>
                  <td className="px-4 py-4 text-text-secondary">{row.payg}</td>
                  <td className="px-4 py-4 text-text-secondary">{row.subscription}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function WorkflowSection({ copy }: PaygCopyProps) {
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader
          title={copy.text('How pay-as-you-go credits work', 'Cómo funcionan los créditos de pago por uso', 'Comment fonctionne le paiement à l’usage')}
          intro={copy.text('The workflow is designed to make cost visible before launch, then hand detailed price comparisons to the pricing page.', 'El flujo está diseñado para mostrar el costo antes de iniciar y dejar las comparaciones detalladas en la página de precios.', 'Le flux affiche le coût avant le lancement et renvoie les comparaisons détaillées vers la page des tarifs.')}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stepItems(copy).map((step, index) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className="rounded-[8px] border border-hairline bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-text-primary text-sm font-semibold text-bg">
                    {index + 1}
                  </span>
                  <Icon className="h-5 w-5 text-[#1F5EFF]" strokeWidth={1.9} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-text-primary">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{step.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function QuoteFactorsSection({ copy }: PaygCopyProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader
          title={copy.text('What changes the live quote', 'Qué cambia la cotización en tiempo real', 'Ce qui fait varier le devis en direct')}
          intro={copy.text('The app quote combines the choices that actually affect render cost, so the price you approve matches the generation you launch.', 'La cotización de la app combina las opciones que afectan al costo real, para que el precio que apruebas corresponda a la generación que vas a iniciar.', 'Le devis de l’application regroupe les options qui influent réellement sur le coût afin que le prix validé corresponde à la génération lancée.')}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quoteFactors(copy).map((factor) => {
            const Icon = factor.icon;
            return (
              <article key={factor.title} className="rounded-[8px] border border-hairline bg-bg p-4 shadow-sm">
                <Icon className="h-5 w-5 text-[#14A46C]" strokeWidth={1.9} />
                <h3 className="mt-4 text-sm font-semibold text-text-primary">{factor.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{factor.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PricePerModelSection({ data, copy }: PayAsYouGoPageDataProps) {
  const priceHeaders = data.pricing.rows[0]?.priceCells ?? [];

  return (
    <section id="compare-price-per-model" className="border-b border-hairline bg-bg">
      <div className={`${containerClassName} py-12`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader title={data.pricing.title} intro={data.pricing.intro} />
          <Link href={data.pricing.fullMatrixHref} className="text-sm font-semibold text-[#1F5EFF] transition hover:underline">
            {copy.text('Full pricing matrix', 'Matriz completa de precios', 'Grille tarifaire complète')}
          </Link>
        </div>
        <div className="mt-6 overflow-x-auto rounded-[8px] border border-hairline bg-surface shadow-card">
          <table className="min-w-[840px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
                <th className="px-4 py-3">{copy.text('Model', 'Modelo', 'Modèle')}</th>
                <th className="px-4 py-3">{copy.text('Best for', 'Ideal para', 'Idéal pour')}</th>
                {priceHeaders.map((cell) => (
                  <th key={cell.label} className="px-4 py-3 text-right">
                    {cell.label}
                  </th>
                ))}
                <th className="px-4 py-3">{copy.text('Links', 'Enlaces', 'Liens')}</th>
              </tr>
            </thead>
            <tbody>
              {data.pricing.rows.map((row) => (
                <tr key={row.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <EngineIcon engine={row.engineIcon} imageAlt={`${row.engineName} ${copy.text('AI video model', 'modelo de video con IA', 'modèle de vidéo IA')}`} size={34} rounded="full" />
                      <div>
                        <p className="font-semibold text-text-primary">{row.engineName}</p>
                        <p className="text-xs text-text-muted">{row.family}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[270px] px-4 py-3 text-text-secondary">{row.bestFor}</td>
                  {row.priceCells.map((cell) => (
                    <td key={`${row.id}-${cell.label}`} className="px-4 py-3 text-right">
                      <span className="font-mono font-semibold tabular-nums text-text-primary">{examplePriceLabel(cell.value, copy)}</span>
                      {cell.note ? <span className="block text-[11px] text-text-muted">{cell.note}</span> : null}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {row.modelHref ? (
                        <Link href={row.modelHref} className="text-xs font-semibold text-[#1F5EFF] hover:underline">
                          {copy.text('Model', 'Modelo', 'Modèle')}
                        </Link>
                      ) : null}
                      {row.compareHref ? (
                        <Link href={row.compareHref} className="text-xs font-semibold text-[#1F5EFF] hover:underline">
                          {copy.text('Compare', 'Comparar', 'Comparer')}
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function PriceLookupShortcutsSection({ data, copy }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader
          eyebrow={copy.text('Quick price checks', 'Consultas rápidas de precio', 'Vérifications rapides des prix')}
          title={copy.text('Check prices for popular AI video models', 'Consulta precios de modelos de video con IA populares', 'Consultez les prix des modèles de vidéo IA populaires')}
          intro={copy.text('Use these model-specific shortcuts for quick estimates. The full pricing matrix stays the source of truth for exact model, duration, resolution, and audio combinations.', 'Usa estos accesos por modelo para obtener estimaciones rápidas. La matriz completa de precios sigue siendo la referencia para las combinaciones exactas de modelo, duración, resolución y audio.', 'Utilisez ces raccourcis par modèle pour obtenir des estimations rapides. La grille tarifaire complète reste la référence pour les combinaisons exactes de modèle, durée, résolution et audio.')}
        />
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {data.priceLookups.map((lookup) => (
            <Link
              key={lookup.id}
              href={lookup.href}
              className="group flex min-h-[220px] flex-col rounded-[8px] border border-hairline bg-bg p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-text-muted"
            >
              <div className="flex items-start justify-between gap-3">
                <EngineIcon engine={lookup.engineIcon} imageAlt={`${lookup.engineIcon.label} ${copy.text('AI video model', 'modelo de video con IA', 'modèle de vidéo IA')}`} size={36} rounded="full" />
                <span className="rounded-full border border-hairline bg-surface px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-text-primary">
                  {lookup.price}
                </span>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-micro text-text-muted">{lookup.query}</p>
              <h3 className="mt-2 text-base font-semibold leading-snug text-text-primary">{lookup.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{lookup.body}</p>
              {lookup.modelHref ? (
                <span className="mt-auto pt-4 text-xs font-semibold text-[#1F5EFF] group-hover:underline">{copy.text('Open pricing row', 'Abrir fila de precios', 'Ouvrir la ligne tarifaire')}</span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ExampleCostsSection({ data, copy }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader
          title={copy.text('Example costs', 'Costos de ejemplo', 'Exemples de coûts')}
          intro={copy.text('These examples are shortcuts from the current pricing hub. They are useful for orientation, while the app quote is the final price before generation.', 'Estos ejemplos provienen de la página de precios actual y sirven como referencia. La cotización de la app es el precio final antes de generar.', 'Ces exemples proviennent de la page des tarifs actuelle et servent de repères. Le devis de l’application reste le prix final avant la génération.')}
        />
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {data.exampleCosts.map((cost) => (
            <Link key={cost.label} href={cost.href} className="rounded-[8px] border border-hairline bg-bg p-4 shadow-sm transition hover:border-text-muted">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{cost.label}</p>
              <p className="mt-3 text-sm font-semibold text-text-primary">{cost.engine}</p>
              <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-text-primary">{cost.price}</p>
              <p className="mt-1 text-xs font-semibold text-text-muted">{cost.context}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function RefundPolicySection({ data }: PayAsYouGoPageDataProps) {
  const icons = [Eye, CreditCard, RotateCcw] as const;
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader title={data.refundPolicy.title} intro={data.refundPolicy.body} />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {data.refundPolicy.bullets.map((bullet, index) => {
            const Icon = icons[index] ?? BadgeDollarSign;
            return (
              <div key={bullet} className="rounded-[8px] border border-hairline bg-surface p-4 shadow-sm">
                <Icon className="h-5 w-5 text-[#1F5EFF]" strokeWidth={1.9} />
                <p className="mt-3 text-sm leading-6 text-text-secondary">{bullet}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="bg-surface">
      <div className={`${containerClassName} py-12`}>
        <SectionHeader title="FAQ" />
        <div className="mt-6 divide-y divide-hairline rounded-[8px] border border-hairline bg-bg px-5 shadow-sm">
          {data.faq.map((entry) => (
            <article key={entry.question} className="py-5 first:pt-5 last:pb-5">
              <h3 className="text-base font-semibold text-text-primary">{entry.question}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{entry.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoPageView({ locale, data, showcaseVideos }: PayAsYouGoPageViewProps) {
  const copy = getPayAsYouGoViewCopy(locale);
  return (
    <main className="bg-bg">
      <HeroSection data={data} copy={copy} />
      <PayAsYouGoVideoShowcase videos={showcaseVideos} locale={locale} />
      <NaturalQuestionsSection data={data} copy={copy} />
      <ModelTestingOrderSection data={data} copy={copy} />
      <MeaningSection data={data} copy={copy} />
      <AudienceFitSection copy={copy} />
      <SubscriptionComparisonSection copy={copy} />
      <WorkflowSection copy={copy} />
      <QuoteFactorsSection copy={copy} />
      <PricePerModelSection data={data} copy={copy} />
      <PriceLookupShortcutsSection data={data} copy={copy} />
      <ExampleCostsSection data={data} copy={copy} />
      <RefundPolicySection data={data} copy={copy} />
      <FaqSection data={data} copy={copy} />
    </main>
  );
}
