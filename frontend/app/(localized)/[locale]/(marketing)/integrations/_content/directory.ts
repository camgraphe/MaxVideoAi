import type { AppLocale } from '@/i18n/locales';

export const directoryCopy = {
  en: {
    heading: 'Install MaxVideoAI and connect your account',
    install: 'Open the MaxVideoAI plugin listing',
    installBody: 'Choose Install plugin, then Connect when prompted. ChatGPT and supported Codex tasks use the same plugin.',
    account: 'Connect your MaxVideoAI account',
    accountBody: 'The first time you use the plugin, sign in to MaxVideoAI or create an account on maxvideoai.com. Top up on the website. Your balance and media library are shared wherever you use that account.',
    chatgpt: { title: 'Select MaxVideoAI in your chat', body: 'Type @MaxVideoAI or choose MaxVideoAI from the + menu. Try “Compare two video models for this product photo.”' },
    codex: { title: 'Select MaxVideoAI in your Codex task', body: 'In a supported task, open Sources → Use plugins and select MaxVideoAI. Try “Use this project’s brief to plan a five-second launch clip.”' },
    approval: 'Review the model, settings and price before approving a render.',
    availability: 'The options you see depend on your OpenAI plan and workspace settings.',
    help: 'OpenAI plugin guide',
  },
  fr: {
    heading: 'Installer MaxVideoAI et connecter votre compte',
    install: 'Ouvrir la fiche du plugin MaxVideoAI',
    installBody: 'Choisissez Installer le plugin, puis Connecter si la demande apparaît. ChatGPT et les tâches Codex compatibles utilisent le même plugin.',
    account: 'Connecter votre compte MaxVideoAI',
    accountBody: 'À la première utilisation, connectez-vous à MaxVideoAI ou créez votre compte sur maxvideoai.com. Les recharges se font sur le site. Votre solde et votre bibliothèque vous suivent partout où vous utilisez ce compte.',
    chatgpt: { title: 'Sélectionner MaxVideoAI dans la conversation', body: 'Tapez @MaxVideoAI ou choisissez MaxVideoAI dans le menu +. Essayez « Compare deux modèles vidéo pour cette photo de produit. »' },
    codex: { title: 'Sélectionner MaxVideoAI dans une tâche Codex', body: 'Dans une tâche compatible, ouvrez Sources → Use plugins et sélectionnez MaxVideoAI. Essayez « À partir du brief de ce projet, prépare un clip de lancement de cinq secondes. »' },
    approval: 'Vérifiez le modèle, les réglages et le prix avant d’autoriser un rendu.',
    availability: 'Les options disponibles dépendent de votre offre OpenAI et des paramètres de votre espace de travail.',
    help: 'Guide des plugins OpenAI',
  },
  es: {
    heading: 'Instala MaxVideoAI y conecta tu cuenta',
    install: 'Abrir la ficha del plugin MaxVideoAI',
    installBody: 'Elige Instalar plugin y después Conectar cuando se te indique. ChatGPT y las tareas compatibles de Codex utilizan el mismo plugin.',
    account: 'Conecta tu cuenta de MaxVideoAI',
    accountBody: 'La primera vez que uses el plugin, inicia sesión en MaxVideoAI o crea tu cuenta en maxvideoai.com. Recarga en la web. El saldo y la biblioteca se comparten dondequiera que uses esa cuenta.',
    chatgpt: { title: 'Selecciona MaxVideoAI en el chat', body: 'Escribe @MaxVideoAI o elige MaxVideoAI en el menú +. Prueba «Compara dos modelos de video para esta foto de producto».' },
    codex: { title: 'Selecciona MaxVideoAI en tu tarea de Codex', body: 'En una tarea compatible, abre Sources → Use plugins y selecciona MaxVideoAI. Prueba «Usa el brief del proyecto para preparar un clip de lanzamiento de cinco segundos».' },
    approval: 'Revisa el modelo, los ajustes y el precio antes de aprobar la generación.',
    availability: 'Las opciones disponibles dependen de tu plan de OpenAI y de los ajustes de tu espacio de trabajo.',
    help: 'Guía de plugins de OpenAI',
  },
} satisfies Record<AppLocale, {
  heading: string; install: string; installBody: string; account: string; accountBody: string;
  chatgpt: {title: string; body: string}; codex: {title: string; body: string};
  approval: string; availability: string; help: string;
}>;
