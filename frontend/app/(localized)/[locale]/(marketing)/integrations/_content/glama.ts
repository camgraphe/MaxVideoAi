import type { AppLocale } from '@/i18n/locales';

export const glamaText = {
  en: {
    heading: 'MaxVideoAI on Glama', title: 'Explore the MaxVideoAI MCP Connector on Glama',
    intro: 'Browse the MaxVideoAI video, image and audio tools on Glama. Open an input schema in the MCP Inspector before connecting your account.',
    kind: 'MCP connector', action: 'Open MaxVideoAI on Glama', details: 'Connector details', publisher: 'Publisher', transport: 'Transport', auth: 'Authentication',
    setup: 'Explore the connector in Glama', steps: [
      ['Open the connector', 'In Server Details, check the com.maxvideoai publisher, the remote endpoint and OAuth support.'],
      ['Choose a tool', 'Under Available Tools, select Inspect beside list_models to open the MCP Inspector.'],
      ['Read the schema', 'Look at the available inputs. When you want to call a tool, connect the MaxVideoAI account that holds your library.'],
    ], tool: 'Inspect list_models', toolHelp: 'This read-only tool lists the models available to the connected account. Open it in the inspector to see the input schema.', docs: 'MCP documentation',
  },
  fr: {
    heading: 'MaxVideoAI sur Glama', title: 'Explorer le connecteur MCP MaxVideoAI sur Glama',
    intro: 'Explorez les outils vidéo, image et audio de MaxVideoAI dans Glama. Ouvrez leur schéma de paramètres dans le MCP Inspector avant de connecter votre compte.',
    kind: 'Connecteur MCP', action: 'Ouvrir MaxVideoAI sur Glama', details: 'Fiche du connecteur', publisher: 'Éditeur', transport: 'Transport', auth: 'Authentification',
    setup: 'Explorer le connecteur dans Glama', steps: [
      ['Ouvrir le connecteur', 'Dans Server Details, vérifiez l’éditeur com.maxvideoai, l’adresse du serveur et la prise en charge d’OAuth.'],
      ['Choisir un outil', 'Sous Available Tools, cliquez sur Inspect à côté de list_models pour ouvrir le MCP Inspector.'],
      ['Lire les paramètres', 'Consultez les entrées disponibles. Pour exécuter un outil, connectez le compte MaxVideoAI qui contient votre bibliothèque.'],
    ], tool: 'Inspecter list_models', toolHelp: 'Cet outil de lecture liste les modèles disponibles pour le compte connecté. Ouvrez-le dans l’inspecteur pour consulter ses paramètres.', docs: 'Documentation MCP',
  },
  es: {
    heading: 'MaxVideoAI en Glama', title: 'Explora el conector MCP de MaxVideoAI en Glama',
    intro: 'Explora las herramientas de video, imagen y audio de MaxVideoAI en Glama. Abre su esquema de parámetros en MCP Inspector antes de conectar tu cuenta.',
    kind: 'Conector MCP', action: 'Abrir MaxVideoAI en Glama', details: 'Ficha del conector', publisher: 'Editor', transport: 'Transporte', auth: 'Autenticación',
    setup: 'Explora el conector en Glama', steps: [
      ['Abre el conector', 'En Server Details, comprueba el editor com.maxvideoai, la dirección del servidor y la compatibilidad con OAuth.'],
      ['Elige una herramienta', 'En Available Tools, selecciona Inspect junto a list_models para abrir MCP Inspector.'],
      ['Lee los parámetros', 'Revisa los campos disponibles. Para ejecutar una herramienta, conecta la cuenta de MaxVideoAI que contiene tu biblioteca.'],
    ], tool: 'Inspeccionar list_models', toolHelp: 'Esta herramienta de lectura enumera los modelos disponibles para la cuenta conectada. Ábrela en el inspector para ver los parámetros.', docs: 'Documentación MCP',
  },
} satisfies Record<AppLocale, object>;
