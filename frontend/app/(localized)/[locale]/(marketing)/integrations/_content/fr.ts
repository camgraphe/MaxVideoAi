import {
  MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND,
  MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND,
  MAXVIDEOAI_PUBLIC_PLUGIN_VERSION,
} from '@/config/maxvideoai-plugin-release';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import type { McpClientId } from '../../mcp/_lib/mcp-page-types';
import { buildEnglishIntegrationCopy } from './en';
import {
  getIntegrationInstallAction,
  getIntegrationInstallInstruction,
  getIntegrationLabel,
  localizedIntegrationPath,
} from './shared';
import { buildN8nIntegrationCopy } from './n8n';
import { buildOpenClawIntegrationCopy } from './openclaw';
import type { IntegrationHostGuide, IntegrationPageCopy } from './types';

function buildFrenchGuides(client: McpClientId): IntegrationHostGuide[] {
  if (client === 'claude') {
    return [
      {
        hostId: 'claudeWeb',
        title: 'Connecter MaxVideoAI à Claude',
        intro: 'Ajoutez MaxVideoAI comme connecteur distant personnalisé, puis autorisez votre compte dans le navigateur.',
        installInstruction: getIntegrationInstallInstruction('fr', 'claudeWeb'),
        steps: [
          { title: 'Ouvrir les réglages', body: "Avec un compte individuel Claude (Free, Pro ou Max), ouvrez Personnalisation → Connecteurs → Les vôtres → Ajouter → Ajouter un connecteur personnalisé. En Team ou Enterprise, un propriétaire utilise d’abord Organization settings → Connectors → Add → Custom → Web." },
          { title: 'Ajouter MaxVideoAI', body: "Saisissez MaxVideoAI et l’URL de production ci-dessous, puis Continuer. Vérifiez OAuth et l’enregistrement automatique du client, gardez Se connecter maintenant, puis Ajouter. Choisissez Connecter et vérifiez le consentement MaxVideoAI." },
          { title: 'Approuver la connexion', body: 'Connectez-vous ou créez votre compte MaxVideoAI et vérifiez les accès. Les membres Team ou Enterprise choisissent Connect sur le connecteur ajouté par leur propriétaire. Revenez dans Claude et activez MaxVideoAI via + → Connectors dans la discussion.' },
        ],
        commands: [],
        setupValues: [{ label: 'Serveur MaxVideoAI', value: MCP_PRODUCTION_RESOURCE_URL }],
        limitation: "Le compte Free testé autorisait un connecteur personnalisé. Si cette place est occupée, choisissez lequel conserver avant toute suppression. Supprimer un connecteur dans Claude ne prouve pas la révocation de son autorisation dans MaxVideoAI.",
      },
      {
        hostId: 'claudeCode',
        title: 'Utiliser le même connecteur dans Claude Code',
        intro: 'Enregistrez le serveur distant puis authentifiez-vous depuis le panneau MCP de Claude Code.',
        installInstruction: getIntegrationInstallInstruction('fr', 'claudeCode'),
        steps: [
          { title: 'Ajouter le serveur', body: 'Exécutez une fois la commande ci-dessous avec la portée projet ou utilisateur.' },
          { title: 'Ouvrir le panneau MCP', body: 'Ouvrez /mcp et sélectionnez MaxVideoAI pour lancer l’autorisation dans le navigateur.' },
          { title: 'Commencer par le catalogue', body: 'Demandez l’état du compte ou les modèles vidéo actuels avant de préparer une génération.' },
        ],
        commandLabel: 'Commandes Claude Code',
        commands: [`claude mcp add --transport http maxvideoai ${MCP_PRODUCTION_RESOURCE_URL}`, 'claude mcp get maxvideoai'],
        setupValues: [],
        authTrigger: 'Après l’ajout du serveur, ouvrez /mcp dans Claude Code pour vous authentifier.',
        limitation: 'Claude Code retrouve le même compte, le catalogue actuel, les devis exacts et la validation avant dépense.',
      },
    ];
  }

  if (client === 'chatgpt') {
    return [
      {
        "hostId": "chatgptWeb",
        "title": "Connecter MaxVideoAI dans ChatGPT",
        "intro": "Ajoutez MaxVideoAI dans ChatGPT, puis connectez le compte que vous utilisez sur le site.",
        installInstruction: getIntegrationInstallInstruction('fr', 'chatgptWeb'),
        "steps": [
          {
            "title": "Ouvrir l’ajout MCP personnalisé",
            "body": "Dans Plugins, choisissez Ajouter → Ajouter un serveur MCP personnalisé. Ce parcours actuel ne nécessite pas d’activer le mode développeur au préalable. Les permissions du compte et de l’espace restent applicables."
          },
          {
            "title": "Créer MaxVideoAI et connecter le compte",
            "body": "Nommez-le MaxVideoAI, saisissez l’adresse de production ci-dessous et conservez OAuth détecté. Examinez l’avertissement, choisissez Créer en tant que plugin, puis Connecter et approuvez les accès sur maxvideoai.com. Évitez l’entrée Staging."
          },
          {
            "title": "Essayer dans une nouvelle discussion",
            "body": "Choisissez Essayer dans le chat, puis vérifiez le compte et les modèles disponibles avant de générer."
          }
        ],
        "commands": [],
        "setupValues": [
          {
            "label": "Serveur MCP de production",
            "value": MCP_PRODUCTION_RESOURCE_URL
          }
        ],
        "authTrigger": "Utilisez votre compte MaxVideoAI existant. Créez-en un seulement si nécessaire.",
        "limitation": "Selon votre offre ChatGPT et les permissions de l’espace. Cette connexion directe ne nécessite pas de fiche dans le répertoire public."
      }
    ];
  }

  return [
    {
      hostId: 'codexCli',
      title: 'Installer le plugin MaxVideoAI dans Codex',
      intro: 'Ajoutez la marketplace MaxVideoAI taguée, installez le plugin puis autorisez votre compte depuis une nouvelle conversation Codex.',
      installInstruction: getIntegrationInstallInstruction('fr', 'codexCli'),
      steps: [
        { title: 'Ajouter la marketplace', body: `Enregistrez le dépôt public MaxVideoAI sur le tag de version ${MAXVIDEOAI_PUBLIC_PLUGIN_VERSION} contrôlé.` },
        { title: 'Installer le plugin', body: 'Installez MaxVideoAI une fois pour recevoir les skills plan et generate ainsi que la connexion MCP de production.' },
        { title: 'Démarrer une nouvelle tâche', body: 'Ouvrez une nouvelle conversation Codex, utilisez $maxvideoai:plan ou $maxvideoai:generate, puis terminez OAuth à la demande.' },
      ],
      commandLabel: 'Commandes du plugin Codex',
      commands: [
        MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND,
        MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND,
      ],
      setupValues: [],
      authTrigger: 'OAuth démarre lorsque la nouvelle conversation utilise MaxVideoAI pour la première fois. Connectez-vous ou créez le compte à relier.',
      limitation: 'Le package GitHub tagué inclut les skills plan et generate et la connexion MCP de production. Toute génération attend toujours un devis exact et votre accord explicite.',
    },
  ];
}
export function buildFrenchIntegrationCopy(client: McpClientId): IntegrationPageCopy {
  if (client === 'openclaw') return buildOpenClawIntegrationCopy('fr');
  if (client === 'n8n') return buildN8nIntegrationCopy('fr');
  const base = buildEnglishIntegrationCopy(client);
  const clientLabel = getIntegrationLabel(client);
  const term = client === 'chatgpt'
    ? 'App MaxVideoAI'
    : client === 'claude'
      ? 'Connecteur MaxVideoAI'
      : 'Plugin MaxVideoAI';
  const setupDescription = client === 'chatgpt'
    ? "Connectez MaxVideoAI à ChatGPT par une application MCP de production et OAuth ; comparez les modèles, vérifiez le prix et récupérez vos résultats."
    : client === 'claude'
      ? 'Configurez le connecteur distant dans Claude pour préparer prompts et références, comparer les modèles vidéo IA, vérifier le devis et approuver la génération.'
      : 'Installez le plugin Codex pour préparer prompts et références, comparer les modèles vidéo IA, vérifier le devis exact et approuver la génération.';
  const setupIntro = client === 'chatgpt'
    ? "Ajoutez le MCP MaxVideoAI de production dans ChatGPT et autorisez le compte que vous utilisez déjà sur maxvideoai.com. Ouvrez ensuite une nouvelle discussion avec MaxVideoAI sélectionné. Cette connexion directe est distincte de la publication au répertoire public."
    : client === 'claude'
      ? 'Cette page Claude réunit la configuration du connecteur distant et le passage à la production : développez le brief, comparez modèles et budgets actuels, validez les références puis approuvez un devis MaxVideoAI exact lorsque la demande est prête.'
      : 'Cette page Codex réunit l’installation du plugin et le passage à la production : développez le brief, comparez modèles et budgets actuels, validez les références puis approuvez un devis MaxVideoAI exact lorsque la demande est prête.';
  return {
    ...base,
    meta: {
      title: `${term} pour ${clientLabel} | MaxVideoAI`,
      description: setupDescription,
    },
    hero: {
      ...base.hero,
      eyebrow: client === 'chatgpt' ? 'APP MAXVIDEOAI' : client === 'claude' ? 'CONNECTEUR MAXVIDEOAI' : 'PLUGIN MAXVIDEOAI',
      title: `Créez vos vidéos IA avec MaxVideoAI dans ${clientLabel}`,
      intro: setupIntro,
      unavailable: 'Préparez prompts et références, comparez les modèles, budgétez le projet et découvrez le parcours de production MaxVideoAI.',
      liveStatus: client === 'chatgpt'
        ? "La connexion MCP personnalisée MaxVideoAI est gratuite. Utilisez votre compte existant sur maxvideoai.com ; les générations approuvées utilisent vos crédits MaxVideoAI. Aucune entrée n’est publiée au répertoire OpenAI."
        : 'La connexion MaxVideoAI est gratuite, sans abonnement supplémentaire. Connectez-vous ou créez un compte ; seuls les rendus approuvés utilisent vos crédits MaxVideoAI à la consommation.',
      accountStatus: 'Un compte MaxVideoAI est requis et sa création est gratuite. La connexion n’ajoute aucun abonnement ; seuls les rendus approuvés utilisent vos crédits MaxVideoAI.',
      setupLabel: client === 'chatgpt' ? 'Connecter MaxVideoAI dans ChatGPT' : `Configurer MaxVideoAI dans ${clientLabel}`,
      backLabel: 'Voir le parcours complet dans votre assistant IA',
      backHref: localizedIntegrationPath('fr', 'mcp'),
    },
    compatibility: {
      checkpointLabel: client === 'chatgpt' ? 'Parcours documenté le' : 'Compatibilité vérifiée le',
      machineStatusLabel: 'État de preuve hôte',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 a validé sur le staging contrôlé OAuth, catalogue, budgets, devis exact, médias, récupération, envoi et recharge.',
        claudeCode: 'La configuration du connecteur partagé est prête, mais aucun contrôle direct de Claude Code en production n’a encore été enregistré.',
        claudeWeb: "Contrôlé le 19 octobre 2026 dans Claude Web avec un compte Free : OAuth en production, découverte des modèles, préparation du devis exact et récupération d’un résultat existant terminé. Nouvelle génération payante, lecture intégrée, rafraîchissement du jeton et révocation/reconnexion non testés. La disponibilité peut varier selon le compte.",
        chatgptWeb: "Contrôlé le 19 octobre 2026 dans ChatGPT Web avec le compte Pro testé et un plugin MCP privé : OAuth en production, découverte des modèles, préparation du devis exact et récupération d’un résultat existant terminé. Nouvelle génération payante, lecture intégrée, rafraîchissement du jeton et révocation/reconnexion non testés. Cela ne prouve pas un accès complet en écriture pour tous les comptes Pro.",
        codexCli: 'Codex CLI 0.150.0-alpha.8 a validé en production installation, OAuth, compte, catalogue, recommandations, budgets, devis exact, génération payante, récupération et contrat du lecteur intégré.',
      },
    },
    setup: {
      ...base.setup,
      eyebrow: 'CONNECTEZ VOTRE COMPTE',
      title: `Configurer MaxVideoAI dans ${clientLabel}`,
      intro: 'Connectez-vous ou créez votre compte MaxVideoAI pendant la configuration. OAuth relie ensuite l’assistant à vos crédits, vos médias privés et vos générations dans la bibliothèque MaxVideoAI.',
      installAction: getIntegrationInstallAction('fr', clientLabel),
      hostGuides: buildFrenchGuides(client),
      oauthTitle: 'Ce qui se passe lors de la connexion',
      oauthBody: "Examinez les permissions réellement demandées, qui peuvent inclure openid, email, profile et offline_access. L’assistant ne reçoit jamais votre mot de passe, vos données de paiement ni un accès direct à la base.",
      oauthSteps: ["Connectez le même compte MaxVideoAI que sur le site ; créez-en un seulement si nécessaire", "Vérifiez et approuvez les accès sur MaxVideoAI ; confirmez votre e-mail si vous venez de créer un compte", `Revenez dans ${clientLabel} et vérifiez le compte et les modèles sans générer`],
    },
    workflow: {
      ...base.workflow,
      eyebrow: 'DE L’IDÉE AU RÉSULTAT',
      title: `Créez avec ${clientLabel}, générez avec MaxVideoAI`,
      intro: 'Gardez la discussion créative dans l’assistant. MaxVideoAI apporte les informations à jour et contrôle l’exécution payante.',
      previewSteps: [
        { title: 'Développer le brief', body: `${clientLabel} précise les décisions manquantes, le plan et les prompts.` },
        { title: 'Comparer de vraies options', body: 'MaxVideoAI fournit capacités et budgets actuels : qualité, économie ou mix raisonné.' },
        { title: 'Vérifier le devis exact', body: "Modèle, réglages, références et prix sont validés ensemble avant toute dépense. Précisez durée, résolution, format et audio lorsque le modèle les accepte ; comparez seulement des devis aux mêmes réglages." },
        { title: 'Approuver et suivre', body: 'La génération attend votre accord clair ; le résultat reste dans la bibliothèque MaxVideoAI du compte.' },
      ],
      liveSteps: [
        { title: 'Développer le brief', body: `${clientLabel} précise les choix créatifs, le format, la qualité et le budget.` },
        { title: 'Comparer les modèles actuels', body: 'MaxVideoAI propose le meilleur choix et des alternatives crédibles avec leurs compromis.' },
        { title: 'Vérifier le devis exact', body: "Contrôlez prompt, réglages, références, prix et effet sur le solde. Précisez durée, résolution, format et audio lorsque le modèle les accepte ; comparez seulement des devis aux mêmes réglages." },
        { title: 'Générer et suivre', body: 'Approuvez une fois, récupérez le statut et retrouvez le résultat dans la bibliothèque MaxVideoAI.' },
      ],
    },
    references: {
      title: 'Utiliser des références image, vidéo ou audio selon le modèle',
      planningBody: `${clientLabel} peut créer ou améliorer les idées de références et choisir le bon média pour chaque plan.`,
      liveBody: 'Sélectionnez un média privé existant dans la bibliothèque MaxVideoAI ou ouvrez un envoi sécurisé. Les types et limites viennent des informations actuelles du modèle choisi.',
      gatedBody: 'Préparez les références dans la conversation puis centralisez envois privés, génération et résultats dans votre compte MaxVideoAI.',
    },
    troubleshooting: {
      eyebrow: 'AIDE',
      title: `Aide à la connexion ${clientLabel}`,
      intro: 'L’assistant peut expliquer la prochaine étape sûre sans inventer le solde, l’état du job ni une adresse de compte.',
      items: [
        { question: "Je vois MaxVideoAI Staging ou mon mot de passe du site est refusé", answer: "Staging est un environnement de test avec des comptes distincts. Vérifiez le serveur de la connexion : utilisez https://api.maxvideoai.com/mcp et la connexion de production sur maxvideoai.com. Ne créez pas de compte de test pour retrouver celui du site. Si la connexion de production échoue, utilisez votre connexion Google habituelle ou la réinitialisation du mot de passe." },
        { question: "L’assistant peut-il installer MaxVideoAI pour moi ?", answer: client === 'chatgpt' ? "ChatGPT peut vous guider pour ajouter le MCP personnalisé ; une demande dans le chat n’ajoute pas elle-même la connexion. Vous utilisez les réglages d’installation puis vous connectez votre compte MaxVideoAI dans le navigateur. Sélectionnez ensuite MaxVideoAI dans une nouvelle discussion." : client === 'claude' ? "Claude dans le chat vous guide dans Connectors. Claude Code peut exécuter la commande de configuration si vous lui donnez accès au terminal. Dans les deux cas, vous autorisez la connexion de votre compte dans le navigateur." : "Codex peut exécuter les commandes du plugin avec un accès au terminal et votre autorisation. Vous vous connectez et approuvez les accès dans le navigateur ; une nouvelle tâche charge ensuite le plugin." },
        { question: 'L’assistant me demande de me reconnecter', answer: 'Terminez OAuth dans le navigateur puis revenez dans la discussion. Ne collez jamais votre mot de passe ou une clé API dans le chat.' },
        { question: 'Mon solde est insuffisant', answer: 'Demandez un lien de recharge sécurisé. Le paiement reste sur MaxVideoAI ; rechargez, vérifiez le solde puis préparez un nouveau devis.' },
        { question: 'Je ne trouve pas un résultat terminé', answer: 'Demandez les générations récentes ou ouvrez la bibliothèque MaxVideoAI. Ne relancez pas un job payant en double.' },
      ],
    },
    disconnect: {
      title: `Déconnecter ${clientLabel}`,
      body: 'Supprimez la connexion dans l’assistant et révoquez l’autorisation dans les réglages MaxVideoAI.',
      steps: [`Supprimer MaxVideoAI de ${clientLabel}`, 'Ouvrir les connexions du compte MaxVideoAI et révoquer l’accès', 'Se reconnecter plus tard avec une nouvelle approbation si nécessaire'],
    },
    support: { label: 'Contacter le support MaxVideoAI', href: '/fr/contact' },
  };
}
