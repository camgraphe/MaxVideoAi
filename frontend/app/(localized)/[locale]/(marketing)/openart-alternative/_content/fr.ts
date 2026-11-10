import type { OpenArtCopy } from './types';

export const fr = {
  meta: {
    title: 'Alternative à OpenArt sans abonnement — MaxVideoAI',
    description: 'Créez vos plans vidéo sans abonnement avec MaxVideoAI. Prix avant le rendu, crédits conservés et comparaison avec OpenArt Director.',
  },
  hero: {
    title: 'Une alternative à OpenArt.\nPayez à l’usage.',
    lead: 'Avec MaxVideoAI, choisissez le modèle, la durée et le son de votre clip. Le prix s’affiche avant chaque génération. Le solde de vos crédits média achetés reste disponible pour vos prochains projets.',
    action: 'Chiffrer un plan',
    compare: 'Comparer les deux parcours',
    note: 'Recharges média dès 10 USD, sans abonnement MaxVideoAI.',
    imageAlt: 'Six cases de storyboard montrant une course dans une ville sous la pluie, de nuit',
    imageCaption: 'Planche de storyboard issue de MaxVideoAI Studio',
  },
  decision: {
    label: 'Partir du résultat attendu',
    title: 'Gardez la main sur chaque plan.',
    options: [
      {
        title: 'Créer des plans pour votre montage',
        text: 'Préparez votre idée avec Milo dans Studio. Choisissez le modèle, la durée et le son, puis téléchargez le clip pour votre montage.',
        steps: ['Préparer le plan', 'Vérifier le devis', 'Télécharger le clip'],
      },
      {
        title: 'Une vidéo assemblée à partir d’un brief',
        text: 'OpenArt Director prépare le storyboard et les scènes, puis assemble une vidéo avec du son.',
        steps: ['Brief du film', 'Storyboard et scènes', 'Vidéo montée'],
      },
    ],
  },
  matrix: {
    title: 'Comparer l’accès, les crédits et la livraison',
    caption: 'Comparatif des offres MaxVideoAI et OpenArt',
    criterion: 'Critère',
    note: 'Au relevé, OpenArt affichait Starter à 14 USD par siège et par mois avant remise. Vérifiez la période facturée et le tarif applicable à votre compte.',
    sources: 'Consulter les sources officielles',
  },
  rows: {
    entry: {
      label: 'Avant le premier paiement',
      max: 'Consultez les tarifs et obtenez un devis en direct pour vos réglages vidéo avant de recharger votre portefeuille.',
      openart: 'Les nouveaux comptes reçoivent 40 crédits d’essai pendant 7 jours, sans carte bancaire. Starter affiche 4 000 crédits par mois.',
    },
    funding: {
      label: 'Financer un projet',
      max: 'Ajoutez des crédits média à partir de 10 USD selon vos besoins. Vérifiez le prix de chaque rendu avant de le lancer.',
      openart: 'Les offres payantes incluent un quota mensuel. Avec Plus, Pro ou Wonder, les packs de crédits supplémentaires se renouvellent automatiquement chaque mois jusqu’à leur résiliation.',
    },
    balance: {
      label: 'Entre deux projets',
      max: 'Les crédits média achetés restent disponibles dans votre portefeuille pour de futurs projets.',
      openart: 'Le quota du plan se renouvelle à chaque cycle sans report. Les crédits supplémentaires non utilisés peuvent être reportés pendant l’abonnement actif.',
    },
    chat: {
      label: 'Assistant intégré',
      max: 'Préparez vos plans avec Milo Lite, gratuit dans ses limites d’usage et de disponibilité. L’assistance avancée et la génération média utilisent des crédits distincts.',
      openart: 'La conversation avec Chat Mode est gratuite. Les générations et retouches consomment des crédits. Ask First permet de revoir le modèle, les réglages et le coût avant le lancement.',
    },
    mcp: {
      label: 'Assistants externes',
      max: 'Planifiez sans frais MaxVideoAI via MCP avec un hôte compatible. Vérifiez et approuvez le devis média avant de payer depuis votre portefeuille. L’hôte peut avoir ses propres frais et limites.',
      openart: 'Le MCP est inclus dès Starter sans supplément OpenArt. Le Web, le MCP et la CLI partagent les mêmes crédits. Les guides Claude et ChatGPT annoncent aussi l’essai pour les nouveaux comptes. L’accès dépend de l’hôte.',
    },
    delivery: {
      label: 'Ce que vous récupérez',
      max: 'Créez et téléchargez les clips de votre montage. Utilisez Studio pour préparer vos plans et approuver chaque devis média.',
      openart: 'Director prépare les scènes, construit un storyboard et assemble la vidéo avec le son. OpenArt annonce des films allant jusqu’à cinq minutes.',
    },
  },
  workflow: {
    label: 'Le parcours MaxVideoAI',
    title: 'Du brief au montage, un plan à la fois.',
    text: 'Préparez le plan avec Milo dans Studio, ou apportez le brief depuis un assistant compatible via MCP. Chiffrez votre idée avant de décider de la produire.',
    steps: [
      { title: 'Décrire le plan', text: 'Précisez ce qui se passe dans le cadre et ajoutez une référence si elle aide le modèle.' },
      { title: 'Fixer les réglages', text: 'Choisissez le modèle, la durée, la résolution et le son. Vérifiez le devis en direct pour ces réglages.' },
      { title: 'Approuver et télécharger', text: 'Approuvez le prix, puis téléchargez le clip généré pour l’intégrer à votre montage.' },
    ],
    studio: 'Découvrir Studio et Milo',
    mcp: 'Voir les assistants compatibles',
  },
  budget: {
    title: 'Chiffrez vos plans et leurs reprises.',
    intro: 'Comparez à brief, version du modèle, durée, résolution et son identiques. Chiffrez ensuite le résultat dont vous avez besoin sur chaque plateforme.',
    items: [
      { title: 'Somme à avancer', text: 'Regardez le premier paiement de la recharge ou de l’abonnement et la période qu’il couvre.' },
      { title: 'Essais payants', text: 'Comptez les générations terminées, y compris celles écartées au montage. Chaque nouvel essai a son propre devis.' },
      { title: 'Crédits restants', text: 'Vérifiez quand le solde se remet à zéro et ce que vous pourrez utiliser lors du prochain projet.' },
    ],
    guide: 'Estimer le coût d’un projet',
    calculator: 'Voir les prix en direct',
  },
  closing: {
    title: 'Apportez un plan. Voyez ce qu’il coûte.',
    text: 'Choisissez vos réglages et consultez le prix avant de vous connecter.',
    action: 'Chiffrer un plan',
    guide: 'Comparer les plateformes vidéo IA',
  },
  faq: {
    title: 'Questions sur MaxVideoAI et OpenArt',
    items: [
      {
        question: 'Puis-je acheter des crédits OpenArt sans abonnement ?',
        answer: 'OpenArt propose des packs de crédits supplémentaires avec un abonnement Plus, Pro ou Wonder actif. Chaque pack se renouvelle automatiquement chaque mois jusqu’à sa résiliation. Les nouveaux comptes reçoivent 40 crédits d’essai pendant sept jours. MaxVideoAI propose des recharges média à partir de 10 USD sans abonnement.',
      },
      {
        question: 'Les crédits OpenArt non utilisés sont-ils reportés ?',
        answer: 'Sur MaxVideoAI, vos crédits média achetés restent disponibles entre deux projets sans abonnement. Sur OpenArt, le quota mensuel se remet à zéro à chaque cycle. Les crédits supplémentaires non utilisés se reportent tant que l’abonnement est actif.',
      },
      {
        question: 'Chat Mode et le MCP d’OpenArt sont-ils gratuits ?',
        answer: 'La conversation dans Chat Mode est gratuite. Les générations et retouches consomment des crédits. Le MCP est inclus dès Starter sans supplément OpenArt. Les guides Claude et ChatGPT annoncent aussi l’essai pour les nouveaux comptes. L’assistant externe peut avoir ses propres conditions d’accès et tarifs.',
      },
      {
        question: 'Quelle différence entre MaxVideoAI et OpenArt Director ?',
        answer: 'MaxVideoAI vous aide à préparer un plan avec Milo, à le chiffrer et à générer le clip pour votre montage. OpenArt Director prépare un storyboard et assemble plusieurs scènes avec du son. OpenArt annonce des vidéos allant jusqu’à cinq minutes.',
      },
      {
        question: 'Comment comparer le coût d’un clip sur MaxVideoAI et OpenArt ?',
        answer: 'Sur MaxVideoAI, les recharges média commencent à 10 USD sans abonnement et le prix s’affiche avant chaque rendu. À réglages identiques, comparez le paiement initial, les essais terminés, le solde restant et la part du quota utilisée si vous avez un forfait. Chiffrez séparément un clip et un film assemblé avec Director.',
      },
    ],
  },
  evidence: {
    title: 'Sources et périmètre',
    date: '10 novembre 2026',
    note: 'Comparatif publié par MaxVideoAI. Les sources publiques officielles documentent les fonctions et les conditions de crédits présentées.',
  },
  sourceLabels: {
    'openart-pricing': 'Offres et quota Starter',
    'openart-trial': 'Crédits et durée d’essai',
    'openart-credits': 'Quota mensuel et crédits supplémentaires',
    'openart-chat': 'Chat Mode et Ask First',
    'openart-director': 'Director et assemblage du film',
    'openart-mcp': 'MCP, CLI et solde partagé',
    'openart-claude': 'Accès depuis Claude et essai',
    'openart-chatgpt': 'Accès depuis ChatGPT et essai',
    'max-pricing': 'Recharges média et devis en direct',
    'max-wallet': 'Portefeuille et solde média',
    'max-studio': 'Studio, Milo et approbation média',
    'max-mcp': 'Accès via un assistant et prix du rendu',
  },
} satisfies OpenArtCopy;
