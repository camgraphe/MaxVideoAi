import type { AppLocale } from '@/i18n/locales';

type ExperienceCopy = {
  pace: string; occasional: string; regular: string; explanation: [string, string];
  maxTitle: string; maxText: string; higgsTitle: string; higgsText: string;
  maxTimeline: [string, string, string]; higgsTimeline: [string, string, string];
  timelineLabel: string; details: string; assistantLink: string;
  workflowLabel: string; workflowDetails: [string, string, string];
};

const copy: Record<AppLocale, ExperienceCopy> = {
  en: {
    pace: 'Choose your production pace.', occasional: 'An occasional project', regular: 'A steady production rhythm',
    explanation: [
      'One idea today. Another when you’re ready. Look at what you need to pay to start, and what happens to the balance between projects.',
      'Creating every week? Compare how much of the plan you actually use, eligible Unlimited offers and the tools your production needs.',
    ],
    maxTitle: 'Your credits. Your timing.', maxText: 'No platform subscription. Purchased media credits stay between projects.',
    higgsTitle: 'A plan sets the rhythm.', higgsText: 'An active subscription is required to buy web Credit Packs. Packs expire after 90 days.',
    maxTimeline: ['Buy media credits', 'Create when ready', 'Keep the balance'],
    higgsTimeline: ['Active subscription', 'Buy a Credit Pack', '90-day pack expiry'],
    timelineLabel: 'Standard web credit journey', details: 'Details and conditions', assistantLink: 'Compare assistant access',
    workflowLabel: 'Inside Studio, with Milo',
    workflowDetails: ['Bring a reference, a goal and a creative direction. Milo helps shape the brief.', 'Choose a model and settings. Check the media price before launching a generation.', 'Approve the media generation when you are ready. Each paid render uses your media wallet.'],
  },
  fr: {
    pace: 'Choisissez votre rythme de création.', occasional: 'Un projet ponctuel', regular: 'Une production régulière',
    explanation: [
      'Une idée aujourd’hui. Une autre quand vous voulez. Regardez le montant à avancer et ce que devient le solde entre deux projets.',
      'Vous créez chaque semaine ? Comparez la part du forfait réellement utilisée, les offres Unlimited éligibles et les outils dont vous avez besoin.',
    ],
    maxTitle: 'Vos crédits. Votre rythme.', maxText: 'Sans abonnement à la plateforme. Vos crédits média achetés restent disponibles entre deux projets.',
    higgsTitle: 'Le rythme d’un forfait.', higgsText: 'Un abonnement actif est requis pour acheter des Credit Packs Web. Les packs expirent après 90 jours.',
    maxTimeline: ['Achetez des crédits', 'Créez à votre rythme', 'Gardez le solde'],
    higgsTimeline: ['Abonnement actif', 'Achat d’un Credit Pack', 'Expiration à 90 jours'],
    timelineLabel: 'Parcours standard des crédits Web', details: 'Détails et conditions', assistantLink: 'Comparer l’accès aux assistants',
    workflowLabel: 'Dans Studio, avec Milo',
    workflowDetails: ['Apportez une référence, un objectif et une direction créative. Milo vous aide à préciser le brief.', 'Choisissez un modèle et ses réglages. Consultez le prix du média avant de lancer une génération.', 'Validez la génération quand vous êtes prêt. Chaque rendu payant utilise votre portefeuille média.'],
  },
  es: {
    pace: 'Elige tu ritmo de creación.', occasional: 'Un proyecto puntual', regular: 'Una producción constante',
    explanation: [
      'Una idea hoy. Otra cuando quieras. Compara cuánto necesitas pagar para empezar y qué ocurre con el saldo entre proyectos.',
      '¿Creas cada semana? Compara cuánto aprovechas del plan, las ofertas Unlimited elegibles y las herramientas que necesitas.',
    ],
    maxTitle: 'Tus créditos. Tu ritmo.', maxText: 'Sin suscripción a la plataforma. Los créditos de generación comprados se conservan entre proyectos.',
    higgsTitle: 'El ritmo de un plan.', higgsText: 'Se necesita una suscripción activa para comprar Credit Packs web. Los packs caducan a los 90 días.',
    maxTimeline: ['Compra créditos', 'Crea cuando quieras', 'Conserva el saldo'],
    higgsTimeline: ['Suscripción activa', 'Compra un Credit Pack', 'Caduca a los 90 días'],
    timelineLabel: 'Recorrido estándar de los créditos web', details: 'Detalles y condiciones', assistantLink: 'Comparar acceso a asistentes',
    workflowLabel: 'En Studio, con Milo',
    workflowDetails: ['Aporta una referencia, un objetivo y una dirección creativa. Milo te ayuda a concretar el brief.', 'Elige un modelo y sus ajustes. Consulta el precio del contenido antes de iniciar una generación.', 'Aprueba la generación cuando quieras. Cada render de pago utiliza tu saldo de generación.'],
  },
};

export function getExperienceCopy(locale: AppLocale) { return copy[locale]; }
