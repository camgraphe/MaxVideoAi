import type { OpenArtCopy } from './types';

export const fr = {
  meta: {
    title: 'Alternative à OpenArt pour vos plans vidéo — MaxVideoAI',
    description: 'Comparez MaxVideoAI et OpenArt Director pour créer quelques plans ou un film monté. Abonnements, crédits, conversation gratuite et connexion MCP.',
  },
  hero: {
    title: 'Une alternative à OpenArt\npour vos plans vidéo.',
    lead: 'Générez les clips que vous souhaitez monter vous-même. Consultez le prix avant chaque rendu et financez votre projet sans abonnement MaxVideoAI.',
    action: 'Chiffrer un plan',
    compare: 'Comparer les deux parcours',
    note: 'Recharges média à partir de 10 USD. Chaque génération approuvée utilise le solde de votre portefeuille.',
    imageAlt: 'Six cases de storyboard montrant une course dans une ville sous la pluie, de nuit',
    imageCaption: 'Planche de storyboard issue de MaxVideoAI Studio',
  },
  decision: {
    label: 'Partir du résultat attendu',
    title: 'Quelques plans ou un film monté ?',
    options: [
      {
        title: 'Créer des plans pour votre montage',
        text: 'Choisissez MaxVideoAI si vous avez un découpage et souhaitez régler le modèle, la durée et le budget de chaque clip.',
        steps: ['Choisir un plan', 'Vérifier le devis', 'Télécharger le clip'],
      },
      {
        title: 'Partir d’un brief pour obtenir un film',
        text: 'Choisissez OpenArt Director pour réunir le storyboard, les scènes et le son dans un même parcours qui livre une vidéo montée.',
        steps: ['Décrire le film', 'Diriger les scènes', 'Récupérer la vidéo montée'],
      },
    ],
  },
  matrix: {
    title: 'Comparer l’accès, les crédits et la livraison',
    caption: 'Comparatif des offres MaxVideoAI et OpenArt',
    criterion: 'Critère',
    note: 'Les montants sont en dollars américains. Le tarif Starter affiché par OpenArt est de 14 USD par siège et par mois avant la remise visible lors du relevé. Vérifiez la période facturée, le prix et l’éligibilité avant achat.',
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
      max: 'Planifiez avec Milo Lite sans supplément d’assistance, sous limites de requêtes et de disponibilité. L’assistance avancée et la génération média utilisent des crédits distincts.',
      openart: 'La conversation avec Chat Mode est gratuite. Les générations et retouches consomment des crédits. Activez Ask First pour revoir le modèle, les réglages et le coût avant le lancement.',
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
    title: 'Chiffrer les plans que vous garderez.',
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
    text: 'Essayez vos réglages et vérifiez le devis avant de décider de lancer le rendu.',
    action: 'Chiffrer un plan',
    guide: 'Comparer les plateformes vidéo IA',
  },
  faq: {
    title: 'Questions sur OpenArt et MaxVideoAI',
    items: [
      {
        question: 'Puis-je acheter des crédits OpenArt sans abonnement ?',
        answer: 'OpenArt propose des packs de crédits supplémentaires avec un abonnement Plus, Pro ou Wonder actif. Chaque pack se renouvelle automatiquement chaque mois jusqu’à sa résiliation. Les nouveaux comptes reçoivent 40 crédits d’essai pendant sept jours. MaxVideoAI propose des recharges média à partir de 10 USD sans abonnement.',
      },
      {
        question: 'Les crédits OpenArt non utilisés sont-ils reportés ?',
        answer: 'Les crédits mensuels du plan sont remis à zéro à chaque cycle. Selon OpenArt, les crédits supplémentaires non utilisés se reportent tant que l’abonnement est actif. Vérifiez le type de crédit et les conditions de facturation avant achat.',
      },
      {
        question: 'Chat Mode et le MCP d’OpenArt sont-ils gratuits ?',
        answer: 'La conversation dans Chat Mode est gratuite. Les générations et retouches consomment des crédits. Le MCP est inclus dès Starter sans supplément OpenArt. Les guides Claude et ChatGPT annoncent aussi l’essai pour les nouveaux comptes. Vérifiez séparément l’accès et les tarifs de l’assistant externe.',
      },
      {
        question: 'Dans quel cas choisir OpenArt Director ?',
        answer: 'Director est conçu pour obtenir une vidéo montée avec plusieurs scènes, un storyboard et du son. OpenArt annonce jusqu’à cinq minutes. Choisissez MaxVideoAI pour préparer, chiffrer et générer des clips à assembler dans votre propre montage.',
      },
      {
        question: 'MaxVideoAI revient-il toujours moins cher qu’OpenArt ?',
        answer: 'Le total dépend des réglages du modèle, du nombre d’essais payants et de l’utilisation d’un éventuel quota. Comparez séparément le premier paiement, le coût des rendus et le solde restant. Director et la génération de clips livrent des résultats différents.',
      },
    ],
  },
  evidence: {
    title: 'Sources et périmètre',
    date: '10 novembre 2026',
    note: 'Comparatif publié par MaxVideoAI à partir des pages officielles publiques. Les prix, l’éligibilité des offres et l’accès via un assistant peuvent changer. Le périmètre couvre les fonctions et les règles de crédits documentées.',
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
