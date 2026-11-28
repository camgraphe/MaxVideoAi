import type { AppLocale } from '@/i18n/locales';

const en = {
  title: 'integrations', brandFirst: true,
  lead: 'Create video, images and audio with MaxVideoAI in ChatGPT or Codex, or connect another assistant via MCP.',
  beforeSignIn: 'When your tool asks to connect, ', signIn: 'sign in to MaxVideoAI', or: ' or ', signUp: 'create an account',
  beforeBilling: '. Credits you add on ', afterBilling: ' are available in every tool connected to that account.',
  install: 'Install the plugin', guides: 'View setup guides', directory: 'Choose your integration', other: 'Using another MCP client?', server: 'Get the server URL',
  inside: 'Inside ChatGPT', capture: 'Full capture', caption: 'Maya’s laptop ad in the conversation',
  alt: 'The ChatGPT conversation shows Maya presenting a graphite laptop in the MaxVideoAI video player, with the chat sidebar and composer visible.',
  gallery: 'What can you create?', intro: 'Start with a photo, a clip or a few words. Here’s what a request can look like in your assistant.',
  examples: [
    ['Video','Animate a product photo','Give my lamp photo a slow push-in.','Play clip','Light catches the glaze on a sculptural lamp.'],
    ['Image','Create a campaign image','Make pink pigment burst across a dark background.','View image','Pink pigment bursts across a dark background.'],
    ['Audio','Design a sound effect','Make soft rain tapping on a copper sheet.','Play sound','A copper surface used as the reference for the sound of rain.'],
    ['Studio','Add subtitles to a clip','Add English subtitles to the video in my library.','Watch in ChatGPT','The finished Atelier presenter video with English subtitles.'],
  ],
  close: 'Close', glama: 'MCP directory', docs: 'MCP documentation', compare: 'Compare video models', more: 'Explore more examples',
  stepsTitle: 'From your first prompt to a finished file',
  wallet: 'Your account and credits', balance: 'Your balance and media library follow your MaxVideoAI account.',
  manage: 'Manage credits', price: 'See pricing',
};
const fr: typeof en = {
  title: 'Intégrations', brandFirst: false,
  lead: 'Créez des vidéos, des images et du son avec MaxVideoAI dans ChatGPT ou Codex, ou reliez un autre assistant via MCP.',
  beforeSignIn: 'Quand votre outil vous le demande, ', signIn: 'connectez-vous à MaxVideoAI', or: ' ou ', signUp: 'créez un compte',
  beforeBilling: '. Les crédits que vous ajoutez sur ', afterBilling: ' sont disponibles dans tous les outils reliés à ce compte.',
  install: 'Installer le plugin', guides: 'Voir les guides', directory: 'Choisissez votre intégration', other: 'Vous utilisez un autre client MCP ?', server: 'Obtenir l’adresse du serveur',
  inside: 'Dans ChatGPT', capture: 'Agrandir la capture', caption: 'La publicité de Maya dans la conversation',
  alt: 'La conversation ChatGPT montre Maya présentant un ordinateur portable graphite dans le lecteur MaxVideoAI. La barre latérale et le champ de saisie sont visibles.',
  gallery: 'Que pouvez-vous créer ?', intro: 'Partez d’une photo, d’un clip ou de quelques mots. Voici quatre demandes à faire dans votre assistant.',
  examples: [
    ['Vidéo','Animer une photo de produit','Fais un lent travelling avant sur ma photo de lampe.','Lire le clip','La lumière se reflète sur l’émail d’une lampe sculpturale.'],
    ['Image','Créer un visuel de campagne','Fais éclater du pigment rose sur un fond sombre.','Voir l’image','Une explosion de pigment rose sur un fond sombre.'],
    ['Audio','Créer un bruitage','Fais entendre une pluie fine sur une plaque de cuivre.','Écouter','La surface en cuivre qui sert de référence pour le son de la pluie.'],
    ['Studio','Sous-titrer un clip','Ajoute des sous-titres anglais à la vidéo de ma bibliothèque.','Voir dans ChatGPT','La vidéo de présentation Atelier terminée avec les sous-titres anglais.'],
  ],
  close: 'Fermer', glama: 'Annuaire MCP', docs: 'Documentation MCP', compare: 'Comparer les modèles vidéo', more: 'Voir d’autres exemples',
  stepsTitle: 'De votre première demande au fichier final',
  wallet: 'Votre compte et vos crédits', balance: 'Votre solde et votre bibliothèque de médias sont rattachés à votre compte MaxVideoAI.',
  manage: 'Gérer les crédits', price: 'Voir les tarifs',
};
const es: typeof en = {
  title: 'Integraciones', brandFirst: false,
  lead: 'Crea video, imágenes y audio con MaxVideoAI en ChatGPT o Codex, o conecta otro asistente mediante MCP.',
  beforeSignIn: 'Cuando tu herramienta te pida conectarte, ', signIn: 'inicia sesión en MaxVideoAI', or: ' o ', signUp: 'crea una cuenta',
  beforeBilling: '. Los créditos que añades en ', afterBilling: ' están disponibles en todas las herramientas conectadas a esa cuenta.',
  install: 'Instalar el plugin', guides: 'Ver las guías', directory: 'Elige tu integración', other: '¿Usas otro cliente MCP?', server: 'Obtener la URL del servidor',
  inside: 'En ChatGPT', capture: 'Ampliar captura', caption: 'El anuncio de Maya en la conversación',
  alt: 'En la conversación de ChatGPT se ve a Maya presentando un portátil grafito en el reproductor de MaxVideoAI, con el panel lateral y el cuadro de texto.',
  gallery: '¿Qué puedes crear?', intro: 'Empieza con una foto, un clip o unas palabras. Así se lo puedes pedir a tu asistente.',
  examples: [
    ['Video','Animar una foto de producto','Acerca lentamente la cámara a la lámpara de mi foto.','Ver el clip','La luz se refleja en el esmalte de una lámpara escultórica.'],
    ['Imagen','Crear una imagen de campaña','Haz que estalle pigmento rosa sobre un fondo oscuro.','Ver imagen','Una explosión de pigmento rosa sobre un fondo oscuro.'],
    ['Audio','Crear un efecto de sonido','Haz que suene una lluvia suave sobre una lámina de cobre.','Escuchar','La superficie de cobre que sirve de referencia para el sonido de la lluvia.'],
    ['Studio','Subtitular un clip','Añade subtítulos en inglés al video de mi biblioteca.','Ver en ChatGPT','El video final de presentación de Atelier con subtítulos en inglés.'],
  ],
  close: 'Cerrar', glama: 'Directorio MCP', docs: 'Documentación MCP', compare: 'Comparar modelos de video', more: 'Ver más ejemplos',
  stepsTitle: 'De tu primera petición al archivo final',
  wallet: 'Tu cuenta y tus créditos', balance: 'Tu saldo y tu biblioteca de medios están vinculados a tu cuenta de MaxVideoAI.',
  manage: 'Gestionar créditos', price: 'Ver precios',
};
export const mcpHubCopy = { en, fr, es } satisfies Record<AppLocale, typeof en>;
