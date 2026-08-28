import { localePathnames, type AppLocale } from '@/i18n/locales';
import { localizedSlugs } from '@/lib/i18nSlugs';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import type { McpClientActionCopy, McpPageCopy } from './mcp-page-types';

function localizedPath(locale: AppLocale, ...segments: string[]): string {
  const prefix = localePathnames[locale];
  return `/${[prefix, ...segments].filter(Boolean).join('/')}`;
}

function clientActions(
  locale: AppLocale,
  labels: { claude: string; chatgpt: string; codex: string; supporting: string },
): McpClientActionCopy[] {
  const integrations = localizedSlugs[locale].integrations;
  const instruction = (client: McpClientActionCopy['client']) => {
    if (client === 'codex') {
      if (locale === 'fr') {
        return 'Installe le plugin MaxVideoAI pour moi avec ces commandes, puis guide-moi pour connecter mon compte :\ncodex plugin marketplace add camgraphe/MaxVideoAi --ref maxvideoai-plugin-v0.2.0\ncodex plugin add maxvideoai@maxvideoai';
      }
      if (locale === 'es') {
        return 'Instala el plugin MaxVideoAI por mí con estos comandos y guíame para conectar mi cuenta:\ncodex plugin marketplace add camgraphe/MaxVideoAi --ref maxvideoai-plugin-v0.2.0\ncodex plugin add maxvideoai@maxvideoai';
      }
      return 'Install the MaxVideoAI plugin for me with these commands, then guide me through connecting my account:\ncodex plugin marketplace add camgraphe/MaxVideoAi --ref maxvideoai-plugin-v0.2.0\ncodex plugin add maxvideoai@maxvideoai';
    }
    const clientLabel = client === 'claude' ? 'Claude' : 'ChatGPT';
    if (locale === 'fr') return `Connecte MaxVideoAI dans ${clientLabel} avec ce serveur MCP et guide-moi jusqu’à la connexion : ${MCP_PRODUCTION_RESOURCE_URL}`;
    if (locale === 'es') return `Conecta MaxVideoAI en ${clientLabel} con este servidor MCP y guíame hasta completar la conexión: ${MCP_PRODUCTION_RESOURCE_URL}`;
    return `Connect MaxVideoAI in ${clientLabel} with this MCP server and guide me through the connection: ${MCP_PRODUCTION_RESOURCE_URL}`;
  };
  return [
    {
      client: 'claude',
      href: localizedPath(locale, integrations, 'claude'),
      label: labels.claude,
      supportingLabel: labels.supporting,
      installInstruction: instruction('claude'),
    },
    {
      client: 'chatgpt',
      href: localizedPath(locale, integrations, 'chatgpt'),
      label: labels.chatgpt,
      supportingLabel: labels.supporting,
      installInstruction: instruction('chatgpt'),
    },
    {
      client: 'codex',
      href: localizedPath(locale, integrations, 'codex'),
      label: labels.codex,
      supportingLabel: labels.supporting,
      installInstruction: instruction('codex'),
    },
  ];
}

const EN: McpPageCopy = {
  meta: {
    title: 'MaxVideoAI for Claude, ChatGPT & Codex | AI Video',
    description: 'Create AI video with MaxVideoAI in Claude, ChatGPT or Codex: prompts, references, current model advice, project budgets, exact price and generation after approval.',
  },
  breadcrumb: { home: 'Home', current: 'AI video plugin' },
  hero: {
    eyebrows: {
      trial: 'INTRODUCTORY CREDIT WHEN ELIGIBLE',
      budget: 'THE RIGHT MODEL FOR EACH SHOT',
      price: 'PRICE BEFORE YOU GENERATE',
    },
    title: 'Turn Claude, ChatGPT or Codex into your AI video producer.',
    intro: 'From brief to rendered video, inside your AI assistant. It can develop prompts and references, compare the best current models, budget a complete film and generate through MaxVideoAI only after you approve the exact price.',
    previewIntro: 'From brief to rendered video, inside your AI assistant. Develop prompts and references, compare the best current models, budget a complete film and review the exact MaxVideoAI production workflow.',
    trialDisclosure: 'Eligible verified accounts can try one introductory Seedance 2 Mini generation, separate from the regular MaxVideoAI credit balance.',
    actions: clientActions('en', {
      claude: 'Claude connector',
      chatgpt: 'ChatGPT app',
      codex: 'Codex plugin',
      supporting: 'Free · MaxVideoAI account required',
    }),
    connectActions: {
      instructionLabel: 'FAST SETUP',
      instructionBody: 'Choose your assistant and paste one short request. Claude and ChatGPT guide the setup; Codex can run the installation after you approve it.',
      copyInstruction: 'Copy for',
      instructionCopied: 'Copied — paste it into your assistant.',
      endpointLabel: 'Manual MCP setup',
      copyEndpoint: 'Copy server address',
      copied: 'Server address copied. Continue with the setup guide for your assistant.',
      copyError: 'Unable to copy. Select the server address and copy it manually.',
    },
  },
  workflow: {
    ariaLabel: 'AI video production workflow',
    steps: ['Develop the brief and references', 'Compare models and project budgets', 'Approve the exact price and generate'],
  },
  budget: {
    eyebrow: 'Conversation-led budgeting',
    title: 'Ask for a budget for the whole film—not a preset tier',
    intro: 'Tell the assistant whether quality, budget, speed, audio or reference fidelity matters most. It can price one to four concrete proposals, including a quality-first route and credible lower-cost alternatives, with creative attempts shown separately.',
    exampleLabel: 'Example conversation',
    examplePrompt: '“Budget a 60-second film. Quality comes first, but show me credible ways to reduce the total.”',
    qualityLabel: 'Quality-first proposal',
    qualityBody: 'Use the strongest currently executable model for each shot—often Seedance 2.5 when its live capabilities fit—then total every shot with its settings and references.',
    valueLabel: 'Lower-cost alternatives',
    valueBody: 'Keep the same creative brief and compare only validated options, such as Happy Horse, H3 or LTX when they fit. Explain the quality, motion, audio and reference trade-offs shot by shot.',
    attemptsNote: 'The proposal separates the planned renders from an optional creative-retry allowance. A technical failure is tracked and refunded; a creative retry is a new choice.',
    priceReferencesLabel: 'Live per-shot price references',
    priceReferencesBody: 'These are current examples—not packages or a recommendation. Your assistant builds the real project budget from the selected shots.',
    slotLabels: {
      included_trial: 'Eligible introductory credit',
      lowest_paid: 'Current price reference',
      affordable_upgrade: 'Current creative alternative',
    },
    modelLinkLabel: 'See current model details',
    emptyTitle: 'Build a project proposal in the conversation',
    emptyBody: 'Describe the finished video, total duration, shot count and priorities. MaxVideoAI validates each proposed model and returns a comparable budget from current prices.',
  },
  evidence: {
    eyebrow: 'Real workflow evidence',
    title: 'Result, settings, price and provenance together',
    verifiedLabel: 'Verified',
  },
  references: {
    eyebrow: 'Reference-aware production',
    title: 'Keep visual and audio direction consistent across shots',
    intro: 'The assistant can help create reference ideas or choose an existing image, video or audio asset. MaxVideoAI checks which reference kinds and limits the selected model actually supports.',
    planningBody: 'Plan the subject, composition, motion, voice and continuity in the conversation. The assistant remains free to be creative while MaxVideoAI supplies current model constraints.',
    liveBody: 'Choose an account-owned private asset or open a secure MaxVideoAI upload handoff. The asset and completed result remain in the same connected MaxVideoAI library as the website.',
    gatedBody: 'Plan image, video or audio references in the conversation, then keep uploads, generation and completed media together in your MaxVideoAI account.',
    steps: [
      { title: 'Create the direction', body: 'Develop the character, product, composition, motion and audio intention with your assistant.' },
      { title: 'Match the model', body: 'MaxVideoAI checks live image, video and audio reference support for the selected mode.' },
      { title: 'Review everything together', body: 'Confirm prompt, ordered references, settings and exact price before generation.' },
    ],
  },
  answers: {
    eyebrow: 'Direct answers',
    title: 'How MaxVideoAI works with Claude, ChatGPT and Codex',
    updatedLabel: 'Capability review',
    items: {
      integration: {
        title: 'What does MaxVideoAI add to Claude, ChatGPT or Codex?',
        liveBody: 'MaxVideoAI connects the creative conversation to current video and image models, real capabilities, pricing, private references and generation. The assistant can still write, reason and create freely; MaxVideoAI supplies the changing product facts and executes the approved job.',
        gatedBody: 'MaxVideoAI adds current models, real capabilities, budgets, exact pricing, references and generation to the creative conversation.',
      },
      price: {
        title: 'Do I see the exact price before generating?',
        liveBody: 'Yes. Project budgets are free estimates. When you choose a concrete request, MaxVideoAI validates the model, mode, duration, resolution, audio and references, returns a short-lived exact quote, and waits for your explicit approval before spending credits.',
        gatedBody: 'Project planning and model comparisons are free. MaxVideoAI validates the selected request and shows its exact current price before generation.',
      },
      references: {
        title: 'Can I use image, video or audio references?',
        liveBody: 'Yes, when the selected model and mode support them. The assistant can select an existing private MaxVideoAI asset or open a secure upload handoff; MaxVideoAI returns the allowed kinds, roles, order and limits.',
        gatedBody: 'Reference support is model-dependent. Plan image, video or audio references with the assistant, then add supported assets in MaxVideoAI before generation.',
      },
      confirmation: {
        title: 'Can the assistant spend credits by itself?',
        liveBody: 'No. Recommendations, project estimates and exact-quote preparation do not start a job. MaxVideoAI requires a separate, explicit approval of the returned exact quote and still enforces ownership, spending limits and duplicate protection.',
        gatedBody: 'No. The product separates advice from paid execution: review the exact request and price, then approve the generation yourself.',
      },
      credits: {
        title: 'How do I add MaxVideoAI credits?',
        liveBody: 'If the balance is too low, the assistant can open a secure MaxVideoAI top-up page for the missing amount. Payment stays on MaxVideoAI. After funding, it checks the balance and prepares a fresh quote because the previous quote has expired.',
        gatedBody: 'Credits are purchased securely on MaxVideoAI and work across the website and connected assistant. After any top-up, prepare a new quote before generating.',
      },
      library: {
        title: 'Where are my generated images and videos saved?',
        liveBody: 'Completed images and videos are saved to the connected MaxVideoAI account and remain available in its private media library. The assistant can recover recent jobs and return the official library or workspace destination.',
        gatedBody: 'Everything generated on MaxVideoAI is saved to the same account library. The connected workflow uses that same library for references, results and job recovery.',
      },
      disconnect: {
        title: 'How do I disconnect MaxVideoAI?',
        liveBody: 'Remove MaxVideoAI from the assistant, then revoke the saved grant in MaxVideoAI account connections. A later protected action will require a new browser approval.',
        gatedBody: 'Disconnect in two steps whenever you want: remove MaxVideoAI from the assistant and revoke its authorization in your MaxVideoAI account.',
      },
    },
  },
  trust: {
    definition: {
      eyebrow: 'One conversation, many models',
      title: 'Your conversational video production workflow',
      body: 'Instead of opening and comparing many model interfaces yourself, describe the result you want. Your assistant develops the production plan; MaxVideoAI returns executable model facts, current prices, validation, generation and recovery.',
    },
    availability: {
      title: 'How it is priced',
      liveBody: 'The plugin, model advice and project estimates are free. Generation uses your existing pay-as-you-go MaxVideoAI credits, with no separate plugin subscription.',
      gatedBody: 'Model advice and project estimates are free. Generation uses pay-as-you-go MaxVideoAI credits, with no separate plugin subscription.',
    },
    compatibility: {
      title: 'Tested connection paths',
      body: 'The core server is shared across assistants. Compatibility is recorded per host so one successful test is never used to imply every surface behaves identically.',
      checkpointLabel: 'Hosted capability review',
      sourceLabel: 'Compatibility evidence',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 completed the controlled OAuth, catalog, budget, exact-quote, private-media, recovery, upload-handoff and top-up-handoff checks.',
        claudeCode: 'The shared connector configuration is ready, but a direct Claude Code production check has not yet been recorded.',
        chatgptDesktop: 'Add the MaxVideoAI MCP address in ChatGPT developer mode, then connect your account through OAuth at first use.',
        codexCli: 'Codex CLI 0.150.0-alpha.8 completed production installation, OAuth, account, catalog, recommendation, budgeting, exact-quote, paid-generation, recovery and inline-player contract checks.',
      },
    },
    confirmation: {
      title: 'Your approval is the spending boundary',
      liveBody: 'MaxVideoAI first validates the complete request and returns a short-lived exact quote. Only your clear approval starts the generation; the accepted job and result remain recoverable from the connected account.',
      gatedBody: 'Review the complete request and exact price in MaxVideoAI, then submit it yourself. The same separate-confirmation pattern is built into the connected workflow.',
      steps: ['Compare the best fit and alternatives', 'Review exact settings, references and price', 'Approve once, then follow the result in MaxVideoAI'],
    },
    controls: {
      title: 'Private media and spending stay account-owned',
      body: 'OAuth connects one MaxVideoAI account without giving the assistant your password, payment details or direct database access.',
      items: [
        'Private prompts and reference URLs stay out of acquisition analytics.',
        'Every paid job needs a separate confirmation; optional account spending limits add another safeguard.',
        'Remove the client and revoke its MaxVideoAI grant whenever you want to disconnect.',
      ],
    },
    capabilities: {
      title: 'From decision to finished media',
      body: 'The MaxVideoAI integration combines creative guidance with a live product connection. Its remote MCP server keeps model facts, prices, account state and generation current.',
      items: [
        'Recommend the best executable model for each shot and explain credible alternatives.',
        'Budget complete films with one model or a reasoned shot-by-shot mix.',
        'Validate prompts, parameters, image, video and audio references before submission.',
        'Show the exact price, require approval, track the job and recover completed or refunded outcomes.',
      ],
    },
    setup: {
      title: 'Choose Claude, ChatGPT or Codex for the way you work',
      body: 'All three connect to the same MaxVideoAI account, live catalog and approval boundary. Each has a dedicated setup guide for its own connector, app or plugin workflow.',
    },
    faq: {
      title: 'Questions before you connect',
      items: [
        { question: 'Does the assistant always choose the model?', answer: 'No. It asks only for missing priorities, proposes concrete options and lets you keep a preferred compatible model. MaxVideoAI supplies facts; you keep the decision.' },
        { question: 'Will Seedance 2.5 always be recommended?', answer: 'It can lead a quality-first proposal when its current capabilities fit the brief. The assistant should also show credible lower-cost alternatives when budget matters, based on live prices rather than a fixed ranking.' },
        { question: 'What happens if a generation fails?', answer: 'The assistant recovers the existing job instead of creating a duplicate. Definitive technical failures expose their refund or recredit state; a creative retry is a new quote and needs new approval.' },
      ],
    },
    support: { label: 'Contact MaxVideoAI support', href: '/contact' },
  },
};

function frenchCopy(): McpPageCopy {
  return {
    ...EN,
    meta: {
      title: 'MaxVideoAI pour Claude, ChatGPT et Codex | Vidéo IA',
      description: 'Transformez Claude, ChatGPT ou Codex en producteur vidéo IA : prompts, références, modèles actuels, budgets, prix exact, validation et génération.',
    },
    breadcrumb: { home: 'Accueil', current: 'Plugin vidéo IA' },
    hero: {
      ...EN.hero,
      eyebrows: { trial: 'CRÉDIT DE DÉCOUVERTE SI ÉLIGIBLE', budget: 'LE BON MODÈLE POUR CHAQUE PLAN', price: 'LE PRIX AVANT DE GÉNÉRER' },
      title: 'Transformez Claude, ChatGPT ou Codex en producteur vidéo IA.',
      intro: 'Du brief à la vidéo rendue, dans votre assistant IA. Il développe prompts et références, compare les meilleurs modèles actuels, budgète un film complet et génère via MaxVideoAI uniquement après votre validation du prix exact.',
      previewIntro: 'Du brief à la vidéo rendue, dans votre assistant IA. Développez prompts et références, comparez les meilleurs modèles actuels, budgétez un film complet et découvrez le parcours de production MaxVideoAI.',
      trialDisclosure: 'Les comptes vérifiés et éligibles peuvent essayer une génération Seedance 2 Mini de découverte, distincte du solde habituel de crédits MaxVideoAI.',
      actions: clientActions('fr', { claude: 'Connecteur Claude', chatgpt: 'App ChatGPT', codex: 'Plugin Codex', supporting: 'Gratuit · compte MaxVideoAI requis' }),
      connectActions: { instructionLabel: 'INSTALLATION RAPIDE', instructionBody: 'Choisissez votre assistant et collez une courte demande. Claude et ChatGPT guident la configuration ; Codex peut exécuter l’installation après votre accord.', copyInstruction: 'Copier pour', instructionCopied: 'Copié — collez-la dans votre assistant.', endpointLabel: 'Configuration MCP manuelle', copyEndpoint: 'Copier l’adresse du serveur', copied: 'Adresse copiée. Continuez avec le guide de votre assistant.', copyError: 'Copie impossible. Sélectionnez puis copiez manuellement l’adresse.' },
    },
    workflow: { ariaLabel: 'Parcours de production vidéo IA', steps: ['Développer le brief et les références', 'Comparer modèles et budgets du projet', 'Valider le prix exact et générer'] },
    budget: {
      ...EN.budget,
      eyebrow: 'Budget construit dans la discussion',
      title: 'Demandez le budget du film complet, pas une formule prédéfinie',
      intro: 'Indiquez si la qualité, le budget, la vitesse, l’audio ou la fidélité des références compte le plus. L’assistant peut chiffrer jusqu’à quatre propositions concrètes, dont une route qualité et des alternatives moins chères crédibles.',
      exampleLabel: 'Exemple de discussion',
      examplePrompt: '« Budgète un film de 60 secondes. La qualité passe en premier, mais montre-moi des moyens crédibles de réduire le total. »',
      qualityLabel: 'Proposition qualité',
      qualityBody: 'Utiliser le meilleur modèle actuellement exécutable pour chaque plan — souvent Seedance 2.5 lorsque ses capacités conviennent — puis totaliser chaque plan avec ses réglages et références.',
      valueLabel: 'Alternatives moins chères',
      valueBody: 'Conserver le même brief et comparer uniquement des options validées, comme Happy Horse, H3 ou LTX lorsqu’elles conviennent. Expliquer plan par plan les compromis de qualité, mouvement, audio et références.',
      attemptsNote: 'La proposition sépare les rendus prévus d’une marge facultative pour les reprises créatives. Un échec technique est suivi et remboursé ; une nouvelle tentative créative reste un nouveau choix.',
      priceReferencesLabel: 'Repères de prix actuels par plan',
      priceReferencesBody: 'Ce sont des exemples actuels, ni des formules ni une recommandation. L’assistant construit le vrai budget du projet à partir des plans retenus.',
      slotLabels: { included_trial: 'Crédit de découverte éligible', lowest_paid: 'Repère de prix actuel', affordable_upgrade: 'Alternative créative actuelle' },
      modelLinkLabel: 'Voir les détails actuels',
      emptyTitle: 'Construisez une proposition dans la discussion',
      emptyBody: 'Décrivez la vidéo finie, la durée, les plans et les priorités. MaxVideoAI valide chaque modèle proposé et calcule un budget comparable avec les prix actuels.',
    },
    references: {
      ...EN.references,
      eyebrow: 'Production avec références',
      title: 'Conserver la direction visuelle et audio entre les plans',
      intro: 'L’assistant peut créer des idées de référence ou choisir un média image, vidéo ou audio existant. MaxVideoAI vérifie les types et limites réellement acceptés par le modèle.',
      planningBody: 'Préparez sujet, composition, mouvement, voix et continuité dans la discussion. L’assistant reste créatif ; MaxVideoAI apporte les contraintes actuelles.',
      liveBody: 'Choisissez un média privé du compte ou ouvrez un envoi MaxVideoAI sécurisé. Références et résultats restent dans la même bibliothèque MaxVideoAI que sur le site.',
      gatedBody: 'Préparez les références image, vidéo ou audio dans la discussion, puis centralisez envois, génération et résultats dans votre compte MaxVideoAI.',
      steps: [
        { title: 'Créer la direction', body: 'Développez personnage, produit, composition, mouvement et intention audio.' },
        { title: 'Choisir le modèle', body: 'MaxVideoAI vérifie les références image, vidéo et audio du mode choisi.' },
        { title: 'Tout vérifier ensemble', body: 'Validez prompt, ordre des références, réglages et prix exact.' },
      ],
    },
    answers: {
      eyebrow: 'Réponses directes', title: 'Comment MaxVideoAI fonctionne avec Claude, ChatGPT et Codex', updatedLabel: 'Revue des capacités',
      items: {
        integration: { title: 'Que fait MaxVideoAI dans Claude, ChatGPT ou Codex ?', liveBody: 'MaxVideoAI relie la discussion créative aux modèles vidéo et image actuels, aux capacités, prix, références privées et à la génération. L’assistant reste libre de créer ; MaxVideoAI fournit les faits qui changent et exécute le job approuvé.', gatedBody: 'MaxVideoAI ajoute à la discussion les modèles actuels, leurs capacités, des budgets comparables, le prix exact, les références et la génération.' },
        price: { title: 'Vois-je le prix exact avant de générer ?', liveBody: 'Oui. Les budgets sont des estimations gratuites. Pour une demande concrète, MaxVideoAI valide modèle, mode, durée, résolution, audio et références, renvoie un devis exact temporaire et attend votre accord explicite.', gatedBody: 'La planification et les comparaisons sont gratuites. MaxVideoAI valide la demande retenue et affiche son prix exact actuel avant génération.' },
        references: { title: 'Puis-je utiliser des références image, vidéo ou audio ?', liveBody: 'Oui, selon le modèle et le mode. L’assistant choisit un média privé existant ou ouvre un envoi sécurisé ; MaxVideoAI renvoie types, rôles, ordre et limites.', gatedBody: 'Le support dépend du modèle. Préparez les références dans la discussion puis ajoutez les médias compatibles dans MaxVideoAI.' },
        confirmation: { title: 'L’assistant peut-il dépenser seul ?', liveBody: 'Non. Conseils, budgets et préparation du devis ne lancent aucun job. MaxVideoAI exige une validation séparée du devis exact et applique propriété, limites de dépense et protection contre les doublons.', gatedBody: 'Non. Le produit sépare le conseil de l’exécution payante : contrôlez demande et prix, puis validez vous-même.' },
        credits: { title: 'Comment ajouter des crédits MaxVideoAI ?', liveBody: 'Si le solde est trop faible, l’assistant ouvre une recharge MaxVideoAI sécurisée du montant manquant. Le paiement reste sur MaxVideoAI. Ensuite il vérifie le solde et prépare un nouveau devis, car l’ancien a expiré.', gatedBody: 'Les crédits se rechargent sur MaxVideoAI et servent sur le site comme dans l’assistant connecté. Après recharge, préparez toujours un nouveau devis.' },
        library: { title: 'Où sont enregistrées mes images et vidéos ?', liveBody: 'Les médias terminés sont enregistrés dans le compte MaxVideoAI connecté et restent dans sa bibliothèque privée. L’assistant peut récupérer les jobs récents et renvoyer la bibliothèque ou l’espace de travail officiel.', gatedBody: 'Tout média généré est conservé dans la bibliothèque du même compte MaxVideoAI, utilisée aussi pour les références et la récupération.' },
        disconnect: { title: 'Comment déconnecter MaxVideoAI ?', liveBody: 'Supprimez MaxVideoAI de l’assistant puis révoquez l’autorisation dans les connexions du compte. Toute action protégée future demandera une nouvelle approbation.', gatedBody: 'Déconnectez MaxVideoAI quand vous le souhaitez : retirez-le de l’assistant puis révoquez l’autorisation dans votre compte.' },
      },
    },
    trust: {
      ...EN.trust,
      definition: { eyebrow: 'Une discussion, plusieurs modèles', title: 'La façon conversationnelle d’utiliser MaxVideoAI', body: 'Décrivez le résultat voulu au lieu de jongler entre plusieurs interfaces. L’assistant construit le plan ; MaxVideoAI apporte modèles exécutables, prix actuels, validation, génération et récupération.' },
      availability: { title: 'Combien cela coûte', liveBody: 'La connexion, les conseils et budgets sont gratuits. La génération utilise vos crédits MaxVideoAI existants en paiement à l’usage, sans abonnement séparé.', gatedBody: 'Les conseils et budgets sont gratuits. La génération utilise vos crédits MaxVideoAI en paiement à l’usage, sans abonnement séparé.' },
      compatibility: { ...EN.trust.compatibility, title: 'Parcours de connexion testés', body: 'Le serveur est partagé entre assistants, mais chaque hôte est vérifié séparément.', checkpointLabel: 'Revue hébergée', statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 a validé OAuth, catalogue, budget, devis exact, médias privés, récupération, envoi et recharge.',
        claudeCode: 'La configuration du connecteur partagé est prête, mais aucun contrôle direct de Claude Code en production n’a encore été enregistré.',
        chatgptDesktop: 'Ajoutez l’adresse MCP MaxVideoAI dans le mode développeur de ChatGPT puis connectez votre compte par OAuth lors de la première utilisation.',
        codexCli: 'Codex CLI 0.150.0-alpha.8 a validé en production installation, OAuth, compte, catalogue, recommandations, budgets, devis exact, génération payante, récupération et contrat du lecteur intégré.',
      } },
      confirmation: { title: 'Votre validation protège la dépense', liveBody: 'MaxVideoAI valide d’abord la demande et renvoie un devis exact temporaire. Seul votre accord clair lance la génération.', gatedBody: 'Vérifiez la demande et le prix exact dans MaxVideoAI puis soumettez vous-même. La connexion conserve cette validation séparée.', steps: ['Comparer le meilleur choix et ses alternatives', 'Vérifier réglages, références et prix exact', 'Valider une fois puis suivre le résultat'] },
      controls: { title: 'Médias privés et dépenses restent liés au compte', body: 'OAuth relie un compte sans fournir mot de passe, paiement ou accès direct à la base.', items: ['Prompts privés et URL de références restent hors analytics d’acquisition.', 'Chaque job payant demande une validation séparée ; les limites du compte ajoutent une protection.', 'Retirez le client et révoquez son autorisation MaxVideoAI à tout moment.'] },
      capabilities: { title: 'De la décision au média terminé', body: 'L’intégration combine guide créatif et connexion MaxVideoAI. Le serveur MCP distant maintient modèles, prix, compte et génération à jour.', items: ['Recommander le meilleur modèle exécutable par plan et expliquer les alternatives.', 'Budgéter un film avec un modèle ou un mix raisonné.', 'Valider prompts, réglages et références image, vidéo et audio.', 'Afficher le prix exact, demander votre accord, suivre le job et récupérer résultat ou remboursement.'] },
      setup: { title: 'Choisissez Claude, ChatGPT ou Codex selon votre façon de travailler', body: 'Les trois utilisent le même compte MaxVideoAI, le même catalogue actuel et la même validation avant dépense. Chacun dispose d’un guide adapté à son connecteur, son app ou son plugin.' },
      faq: { title: 'Questions avant connexion', items: [
        { question: 'L’assistant choisit-il toujours le modèle ?', answer: 'Non. Il demande les priorités manquantes, propose des options concrètes et respecte votre modèle préféré s’il est compatible.' },
        { question: 'Seedance 2.5 sera-t-il toujours conseillé ?', answer: 'Il peut mener une proposition qualité si ses capacités actuelles correspondent au brief. Si le budget compte, l’assistant montre aussi des alternatives crédibles selon les prix actuels.' },
        { question: 'Que se passe-t-il si une génération échoue ?', answer: 'L’assistant récupère le job existant au lieu de créer un doublon. Un échec technique définitif expose son remboursement ; une nouvelle tentative créative exige un nouveau devis et un nouvel accord.' },
      ] },
      support: { label: 'Contacter le support MaxVideoAI', href: '/fr/contact' },
    },
  };
}

function spanishCopy(): McpPageCopy {
  return {
    ...EN,
    meta: { title: 'MaxVideoAI para Claude, ChatGPT y Codex | Vídeo IA', description: 'Crea vídeo con IA usando MaxVideoAI en Claude, ChatGPT o Codex: prompts, referencias, modelos actuales, presupuestos, precio exacto y generación tras aprobar.' },
    breadcrumb: { home: 'Inicio', current: 'Plugin de vídeo con IA' },
    hero: {
      ...EN.hero,
      eyebrows: { trial: 'CRÉDITO INICIAL SI CUMPLES LOS REQUISITOS', budget: 'EL MODELO ADECUADO PARA CADA PLANO', price: 'PRECIO ANTES DE GENERAR' },
      title: 'Convierte Claude, ChatGPT o Codex en tu productor de vídeo con IA.',
      intro: 'Del brief al vídeo renderizado dentro de tu asistente de IA. Desarrolla prompts y referencias, compara modelos actuales, presupuesta la película completa y genera con MaxVideoAI solo después de aprobar el precio exacto.',
      previewIntro: 'Del brief al vídeo renderizado dentro de tu asistente. Desarrolla prompts y referencias, compara los mejores modelos actuales, presupuesta la película y revisa el flujo de producción de MaxVideoAI.',
      trialDisclosure: 'Las cuentas verificadas y elegibles pueden probar una generación inicial con Seedance 2 Mini, separada del saldo normal de créditos.',
      actions: clientActions('es', { claude: 'Conector Claude', chatgpt: 'App de ChatGPT', codex: 'Plugin de Codex', supporting: 'Gratis · cuenta MaxVideoAI obligatoria' }),
      connectActions: { instructionLabel: 'INSTALACIÓN RÁPIDA', instructionBody: 'Elige tu asistente y pega una petición breve. Claude y ChatGPT guían la configuración; Codex puede ejecutar la instalación después de tu aprobación.', copyInstruction: 'Copiar para', instructionCopied: 'Copiado — pégalo en tu asistente.', endpointLabel: 'Configuración MCP manual', copyEndpoint: 'Copiar dirección del servidor', copied: 'Dirección copiada. Continúa con la guía de tu asistente.', copyError: 'No se pudo copiar. Selecciona y copia la dirección manualmente.' },
    },
    workflow: { ariaLabel: 'Flujo de producción de vídeo con IA', steps: ['Desarrollar brief y referencias', 'Comparar modelos y presupuestos', 'Aprobar el precio exacto y generar'] },
    budget: { ...EN.budget, eyebrow: 'Presupuesto en la conversación', title: 'Pide un presupuesto para toda la película, no un paquete predefinido', intro: 'Indica si importan más calidad, presupuesto, velocidad, audio o fidelidad de referencias. El asistente puede valorar propuestas concretas, una ruta de calidad y alternativas más baratas creíbles.', exampleLabel: 'Ejemplo de conversación', examplePrompt: '«Presupuesta una película de 60 segundos. La calidad es lo primero, pero muéstrame formas creíbles de reducir el total.»', qualityLabel: 'Propuesta de máxima calidad', qualityBody: 'Usar el mejor modelo ejecutable actual para cada plano —a menudo Seedance 2.5 cuando sus capacidades encajan— y sumar cada plano con sus ajustes y referencias.', valueLabel: 'Alternativas más baratas', valueBody: 'Mantener el mismo brief y comparar solo opciones validadas, como Happy Horse, H3 o LTX cuando encajen. Explicar por plano los compromisos de calidad, movimiento, audio y referencias.', attemptsNote: 'La propuesta separa los renders previstos de un margen opcional para reintentos creativos. Un fallo técnico se sigue y reembolsa; un nuevo intento creativo sigue siendo una decisión nueva.', priceReferencesLabel: 'Referencias de precio actuales por plano', priceReferencesBody: 'Son ejemplos actuales, no paquetes ni una recomendación. El asistente construye el presupuesto real a partir de los planos elegidos.', slotLabels: { included_trial: 'Crédito inicial elegible', lowest_paid: 'Referencia de precio actual', affordable_upgrade: 'Alternativa creativa actual' }, modelLinkLabel: 'Ver detalles actuales', emptyTitle: 'Crea una propuesta en la conversación', emptyBody: 'Describe el vídeo, duración, planos y prioridades. MaxVideoAI valida cada modelo y devuelve un presupuesto comparable con precios actuales.' },
    references: { ...EN.references, eyebrow: 'Producción con referencias', title: 'Mantén la dirección visual y de audio entre planos', intro: 'El asistente puede crear ideas o elegir una referencia de imagen, vídeo o audio. MaxVideoAI comprueba los tipos y límites reales del modelo.', planningBody: 'Planifica sujeto, composición, movimiento, voz y continuidad en la conversación. El asistente conserva libertad creativa y MaxVideoAI aporta restricciones actuales.', liveBody: 'Elige un medio privado o abre una carga segura. Las referencias y resultados permanecen en la misma biblioteca MaxVideoAI que el sitio.', gatedBody: 'Planifica referencias de imagen, vídeo o audio en la conversación y reúne cargas, generación y resultados en tu cuenta MaxVideoAI.', steps: [{ title: 'Crear la dirección', body: 'Desarrolla personaje, producto, composición, movimiento e intención de audio.' }, { title: 'Elegir el modelo', body: 'MaxVideoAI comprueba referencias de imagen, vídeo y audio del modo.' }, { title: 'Revisar todo', body: 'Aprueba prompt, orden de referencias, ajustes y precio exacto.' }] },
    answers: { eyebrow: 'Respuestas directas', title: 'Cómo funciona MaxVideoAI con Claude, ChatGPT y Codex', updatedLabel: 'Revisión de capacidades', items: {
      integration: { title: '¿Qué añade MaxVideoAI a Claude, ChatGPT o Codex?', liveBody: 'MaxVideoAI conecta la conversación creativa con modelos actuales, capacidades, precios, referencias privadas y generación. El asistente crea libremente; MaxVideoAI aporta los datos cambiantes y ejecuta el trabajo aprobado.', gatedBody: 'MaxVideoAI añade a la conversación modelos actuales, capacidades, presupuestos comparables, precio exacto, referencias y generación.' },
      price: { title: '¿Veo el precio exacto antes de generar?', liveBody: 'Sí. Los presupuestos son estimaciones gratuitas. Para una solicitud concreta, MaxVideoAI valida modelo, modo, duración, resolución, audio y referencias, devuelve un precio exacto temporal y espera tu aprobación.', gatedBody: 'La planificación y comparación son gratuitas. MaxVideoAI valida la solicitud elegida y muestra su precio exacto antes de generar.' },
      references: { title: '¿Puedo usar referencias de imagen, vídeo o audio?', liveBody: 'Sí, cuando el modelo y modo lo admiten. El asistente selecciona un medio privado o abre una carga segura; MaxVideoAI devuelve tipos, funciones, orden y límites.', gatedBody: 'El soporte depende del modelo. Planifica referencias con el asistente y añade los medios compatibles en MaxVideoAI.' },
      confirmation: { title: '¿Puede el asistente gastar créditos solo?', liveBody: 'No. Recomendaciones, presupuestos y preparación del precio no crean un trabajo. MaxVideoAI exige aprobar el precio exacto por separado y aplica propiedad, límites y protección contra duplicados.', gatedBody: 'No. El producto separa asesoramiento y ejecución: revisa la solicitud y el precio y aprueba tú mismo.' },
      credits: { title: '¿Cómo añado créditos MaxVideoAI?', liveBody: 'Si falta saldo, el asistente abre una recarga segura de MaxVideoAI por la cantidad necesaria. El pago queda en MaxVideoAI. Después comprueba el saldo y prepara un precio nuevo porque el anterior ha caducado.', gatedBody: 'Los créditos se compran en MaxVideoAI y funcionan en el sitio y el asistente conectado. Tras recargar, prepara un precio nuevo.' },
      library: { title: '¿Dónde se guardan mis imágenes y vídeos?', liveBody: 'Los medios terminados se guardan en la cuenta MaxVideoAI conectada y permanecen en su biblioteca privada. El asistente puede recuperar trabajos recientes y devolver la biblioteca o espacio oficial.', gatedBody: 'Todo lo generado queda en la biblioteca de la misma cuenta MaxVideoAI, también usada para referencias y recuperación.' },
      disconnect: { title: '¿Cómo desconecto MaxVideoAI?', liveBody: 'Elimina MaxVideoAI del asistente y revoca la autorización en conexiones de la cuenta. Una acción protegida futura requerirá una aprobación nueva.', gatedBody: 'Desconecta MaxVideoAI cuando quieras: elimínalo del asistente y revoca la autorización en tu cuenta.' },
    } },
    trust: { ...EN.trust,
      definition: { eyebrow: 'Una conversación, muchos modelos', title: 'La forma conversacional de usar MaxVideoAI', body: 'Describe el resultado en vez de alternar entre interfaces. El asistente diseña el plan; MaxVideoAI aporta modelos ejecutables, precios, validación, generación y recuperación.' },
      availability: { title: 'Cuánto cuesta', liveBody: 'La conexión, el asesoramiento y los presupuestos son gratuitos. La generación usa tus créditos MaxVideoAI de pago por uso sin suscripción adicional.', gatedBody: 'El asesoramiento y los presupuestos son gratuitos. La generación usa tus créditos MaxVideoAI de pago por uso sin suscripción adicional.' },
      compatibility: { ...EN.trust.compatibility, title: 'Rutas de conexión probadas', body: 'El servidor se comparte entre asistentes, pero cada cliente se comprueba por separado.', checkpointLabel: 'Revisión alojada', statuses: { claudeDesktop: 'Claude Desktop 1.37937.1 completó OAuth, catálogo, presupuesto, precio exacto, medios, recuperación, carga y recarga.', claudeCode: 'La configuración del conector compartido está lista, pero todavía no se ha registrado una comprobación directa de Claude Code en producción.', chatgptDesktop: 'Añade la dirección MCP de MaxVideoAI en el modo desarrollador de ChatGPT y conecta tu cuenta mediante OAuth en el primer uso.', codexCli: 'Codex CLI 0.150.0-alpha.8 completó en producción la instalación, OAuth, cuenta, catálogo, recomendaciones, presupuestos, precio exacto, generación de pago, recuperación y contrato del reproductor integrado.' } },
      confirmation: { title: 'Tu aprobación protege el gasto', liveBody: 'MaxVideoAI valida la solicitud y devuelve un precio exacto temporal. Solo tu aprobación clara inicia la generación.', gatedBody: 'Revisa la solicitud y el precio en MaxVideoAI y envíala tú mismo. La conexión mantiene esta aprobación separada.', steps: ['Comparar la mejor opción y alternativas', 'Revisar ajustes, referencias y precio', 'Aprobar una vez y seguir el resultado'] },
      controls: { title: 'Medios privados y gasto pertenecen a la cuenta', body: 'OAuth enlaza una cuenta sin entregar contraseña, datos de pago ni acceso directo a la base.', items: ['Prompts privados y URL de referencias quedan fuera de analítica de adquisición.', 'Cada trabajo de pago exige aprobación; los límites de cuenta añaden protección.', 'Elimina el cliente y revoca su autorización cuando quieras.'] },
      capabilities: { title: 'De la decisión al medio terminado', body: 'La integración combina guía creativa y conexión MaxVideoAI. El servidor MCP remoto mantiene modelos, precios, cuenta y generación al día.', items: ['Recomendar el mejor modelo ejecutable por plano y explicar alternativas.', 'Presupuestar una película con un modelo o mezcla razonada.', 'Validar prompts, ajustes y referencias de imagen, vídeo y audio.', 'Mostrar precio exacto, pedir aprobación, seguir el trabajo y recuperar resultado o reembolso.'] },
      setup: { title: 'Elige Claude, ChatGPT o Codex según tu forma de trabajar', body: 'Los tres utilizan la misma cuenta MaxVideoAI, el catálogo actual y la aprobación antes de gastar. Cada uno tiene una guía adaptada a su conector, app o plugin.' },
      faq: { title: 'Preguntas antes de conectar', items: [{ question: '¿El asistente elige siempre el modelo?', answer: 'No. Pregunta solo prioridades faltantes, propone opciones concretas y respeta tu modelo preferido si es compatible.' }, { question: '¿Siempre recomendará Seedance 2.5?', answer: 'Puede liderar una propuesta de calidad si sus capacidades actuales encajan. Cuando importa el presupuesto, también muestra alternativas creíbles con precios actuales.' }, { question: '¿Qué ocurre si una generación falla?', answer: 'El asistente recupera el trabajo existente. Un fallo técnico definitivo muestra su reembolso; un nuevo intento creativo requiere precio y aprobación nuevos.' }] },
      support: { label: 'Contactar con soporte de MaxVideoAI', href: '/es/contact' },
    },
  };
}

const COPY: Record<AppLocale, McpPageCopy> = { en: EN, fr: frenchCopy(), es: spanishCopy() };

export function getMcpPageCopy(locale: AppLocale): McpPageCopy {
  return COPY[locale];
}
