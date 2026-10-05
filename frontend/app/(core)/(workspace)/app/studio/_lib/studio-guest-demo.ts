import type {AppLocale} from '@/i18n/locales';

/** Public reference artwork, not account media or claimed model outputs. */
export const STUDIO_GUEST_MEDIA={
  product:'/assets/studio/guest/bottle-2fa7c45df33c.webp',
  character:'/assets/studio/guest/character-6eb33f948ce8.webp',
  music:'/assets/app-starters/electro-funk-c1a8c5151e60.mp3',
} as const;

const COPY={
  fr:{
    project:'Publicité produit · Démonstration',
    create:'Créer mon projet',
    references:'Les références de cet exemple',
    product:'Gourde isotherme',character:'Personnage',music:'Musique · Electro-funk',
    initial:'J’aimerais faire une publicité vidéo de 14 secondes pour ma gourde isotherme.',
    request:'Bien sûr. Avez-vous une image du produit, un personnage et une musique à m’envoyer ? Ces références nous aideront à définir les plans et l’ambiance.',
    brief:'Voici mon produit en Image 1 et le personnage en Image 2. Utilisez Audio 1 comme musique. Je voudrais deux plans, avec un montage qui suit son rythme.',
    proposal:'Je vous propose deux plans pour une publicité de 14 secondes :',
    shots:[
      {title:'Le produit entre en scène',body:'Un plan rapproché de la gourde d’Image 1, avec une lumière douce et un léger mouvement de caméra. Le produit reste au centre.'},
      {title:'Le produit dans la vie quotidienne',body:'Le personnage d’Image 2 emporte la même gourde dans un parc. Une coupe sur un temps fort d’Audio 1 relie les deux plans, puis le film se termine sur le produit.'},
    ],
    sound:'La musique accompagne l’ensemble des 14 secondes. Nous affinerons la coupe sur son rythme au montage.',
    confirmation:'Avant de générer les clips, je vous présenterai le modèle, les réglages et le devis exact à confirmer.',
    plan:'Proposition de montage · 14 s',
    makeAd:'Créer ma publicité',
    addMedia:'Ajouter des médias',
    enlarge:'Agrandir',close:'Fermer',
    note:'Explorez cet exemple. Connectez-vous pour créer avec vos propres médias.',
    unavailable:'Studio est indisponible pour le moment. Vous pouvez parcourir cet exemple.',
    loginTitle:'Votre idée, votre projet.',
    actions:{create:'Créez un compte pour réaliser votre propre publicité.',send:'Connectez-vous pour envoyer ce message et poursuivre avec Studio.',import:'Connectez-vous pour ajouter vos propres médias.',edit:'Connectez-vous pour modifier le montage de votre propre projet.'},
    loginNote:'Votre message vous attendra dans votre nouveau projet.',
    signup:'Créer un compte',signin:'J’ai déjà un compte',
    personalBrief:'Je souhaite créer une publicité de 14 secondes pour mon produit, avec un personnage et une musique. Aide-moi à définir deux plans et demande-moi les références nécessaires.',
    audioError:'La musique est indisponible pour le moment.',
  },
  en:{
    project:'Product ad · Demonstration',create:'Create my project',references:'References in this example',
    product:'Insulated water bottle',character:'Character',music:'Music · Electro-funk',
    initial:'I’d like to make a 14-second video ad for my insulated water bottle.',
    request:'Of course. Do you have a product image, a character and some music to send me? These references will help us shape the shots and mood.',
    brief:'Here’s my product in Image 1 and the character in Image 2. Use Audio 1 as the music. I’d like two shots, with an edit that follows its rhythm.',
    proposal:'I suggest two shots for a 14-second ad:',
    shots:[
      {title:'Introduce the product',body:'A close-up of the bottle in Image 1, with soft light and a subtle camera move. The product stays in focus.'},
      {title:'The product in everyday life',body:'The character in Image 2 takes the same bottle to a park. A cut on a strong beat in Audio 1 connects the shots, then the film ends on the product.'},
    ],
    sound:'The music runs across all 14 seconds. We’ll refine the cut to its rhythm during editing.',
    confirmation:'Before generating the clips, I’ll show you the model, settings and exact quote to confirm.',
    plan:'Proposed edit · 14 s',makeAd:'Create my ad',addMedia:'Add media',enlarge:'Enlarge',close:'Close',
    note:'Explore this example. Sign in to create with your own media.',
    unavailable:'Studio is unavailable right now. You can still explore this example.',
    loginTitle:'Your idea, your project.',
    actions:{create:'Create an account to make your own ad.',send:'Sign in to send this message and continue with Studio.',import:'Sign in to add your own media.',edit:'Sign in to edit your own project’s timeline.'},
    loginNote:'Your message will be waiting in your new project.',signup:'Create an account',signin:'I already have an account',
    personalBrief:'I want to create a 14-second ad for my product, with a character and some music. Help me shape two shots and ask me for the references you need.',
    audioError:'The music is unavailable right now.',
  },
  es:{
    project:'Anuncio de producto · Demostración',create:'Crear mi proyecto',references:'Referencias de este ejemplo',
    product:'Botella térmica',character:'Personaje',music:'Música · Electro-funk',
    initial:'Me gustaría crear un anuncio de vídeo de 14 segundos para mi botella térmica.',
    request:'Claro. ¿Tienes una imagen del producto, un personaje y una música para enviarme? Estas referencias nos ayudarán a definir los planos y el ambiente.',
    brief:'Aquí está mi producto en Image 1 y el personaje en Image 2. Utiliza Audio 1 como música. Quiero dos planos, con un montaje que siga su ritmo.',
    proposal:'Te propongo dos planos para un anuncio de 14 segundos:',
    shots:[
      {title:'Presentar el producto',body:'Un primer plano de la botella de Image 1, con luz suave y un ligero movimiento de cámara. El producto sigue siendo el protagonista.'},
      {title:'El producto en la vida cotidiana',body:'El personaje de Image 2 lleva la misma botella a un parque. Un corte en un tiempo fuerte de Audio 1 conecta los planos y el vídeo termina mostrando el producto.'},
    ],
    sound:'La música acompaña los 14 segundos. Ajustaremos el corte a su ritmo durante el montaje.',
    confirmation:'Antes de generar los clips, te mostraré el modelo, los ajustes y el precio exacto para confirmar.',
    plan:'Propuesta de montaje · 14 s',makeAd:'Crear mi anuncio',addMedia:'Añadir medios',enlarge:'Ampliar',close:'Cerrar',
    note:'Explora este ejemplo. Inicia sesión para crear con tus propios medios.',
    unavailable:'Studio no está disponible ahora mismo. Puedes explorar este ejemplo.',
    loginTitle:'Tu idea, tu proyecto.',
    actions:{create:'Crea una cuenta para realizar tu propio anuncio.',send:'Inicia sesión para enviar este mensaje y continuar con Studio.',import:'Inicia sesión para añadir tus propios medios.',edit:'Inicia sesión para editar el montaje de tu propio proyecto.'},
    loginNote:'Tu mensaje te esperará en tu nuevo proyecto.',signup:'Crear una cuenta',signin:'Ya tengo una cuenta',
    personalBrief:'Quiero crear un anuncio de 14 segundos para mi producto, con un personaje y música. Ayúdame a definir dos planos y pídeme las referencias necesarias.',
    audioError:'La música no está disponible ahora mismo.',
  },
};

export function studioGuestDemoCopy(locale:AppLocale) {return COPY[locale];}
export type StudioGuestCopy=ReturnType<typeof studioGuestDemoCopy>;
export type StudioGuestAction=keyof StudioGuestCopy['actions'];
