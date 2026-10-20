import type { CreatorMarketingDictionary, CreatorMarketingLabels } from './creator-copy-types';

export const frLabels: CreatorMarketingLabels = {
  home: 'Accueil', tools: 'Tous les outils', eyebrow: 'Les outils de votre prochaine création',
  open: 'Ouvrir l’outil', how: 'Comment ça marche',
  inputs: '01 / Importez', settings: '02 / Personnalisez', result: '03 / Récupérez',
  workflow: 'Trois étapes pour créer.', limits: 'Pour un meilleur résultat.', faq: 'Les réponses à vos questions.',
  quoteTitle: 'Le prix s’affiche. Vous décidez.',
  quoteBody: 'Ajoutez vos fichiers et choisissez vos réglages. Le prix exact s’affiche avant votre confirmation.',
  related: 'Et pour la suite ?',
  illustration: 'Direction artistique · visuel de présentation — pas un résultat de l’outil',
  preview: 'Bientôt disponible', demo: 'Explorer l’aperçu',
  photo: 'Photo', video: 'Vidéo', voice: 'Voix', character: 'Personnage', performance: 'Mouvement',
  source: 'Point de départ', after: 'Direction créative',
  caption: 'Essayez votre propre phrase', sample: 'Chaque mot, à votre rythme.',
  style: 'Style des sous-titres', styles: ['Sobre', 'Mot surligné', 'Contraste fort'],
  scene: 'Mise en scène', scenes: ['Studio', 'En situation', 'Lumière'],
  compare: 'Comparer les deux mises en scène', sequence: 'Mouvement à suivre',
  next: 'Donnez forme à votre idée.', operation: 'Sous-titrer. Faire parler. Mettre en scène. Animer.',
};

export const frCopy: CreatorMarketingDictionary = {
  subtitles: {
    name: 'Sous-titres vidéo',
    title: 'Sous-titrez votre vidéo. Chaque mot, à votre rythme.',
    description: 'Ajoutez des sous-titres à votre vidéo : corrigez le texte, ajustez les temps et le style, puis téléchargez un SRT, un VTT ou un MP4 sous-titré.',
    intro: 'Importez votre vidéo. Corrigez les mots, ajustez leur apparition et choisissez leur style. Exportez les sous-titres seuls ou intégrés à l’image.',
    input: 'Une vidéo avec de la parole, ou un fichier audio.',
    adjustment: 'Le texte, les temps, la taille, le style et la position.',
    output: 'Un fichier SRT ou VTT, ou votre vidéo sous-titrée en MP4.',
    steps: [
      'Importez votre vidéo ou votre audio et choisissez la langue.',
      'Relisez les sous-titres, ajustez les temps et personnalisez leur apparence.',
      'Téléchargez le texte en SRT ou VTT, ou exportez la vidéo sous-titrée.',
    ],
    limits: [
      'Ajoutez les noms propres et les termes spécialisés avant la transcription pour aider à les reconnaître. Relisez-les avant l’export.',
      'Avec un fichier audio seul, téléchargez vos sous-titres en SRT ou VTT. Le MP4 sous-titré nécessite une vidéo.',
    ],
    questions: [
      { question: 'Puis-je modifier les sous-titres après la transcription ?', answer: 'Oui. Vous pouvez corriger le texte, les temps et le style sans relancer la transcription. Après avoir modifié une phrase, vérifiez qu’elle suit toujours la voix.' },
      { question: 'Quel format choisir ?', answer: 'SRT et VTT permettent d’ajouter les sous-titres dans un lecteur ou un logiciel de montage. Le MP4 les intègre directement à la vidéo ; cet export est inclus avec votre transcription, sans supplément.' },
    ],
  },
  'lip-sync': {
    name: 'Lip Sync',
    title: 'Faites parler un portrait. Ou changez la voix d’une vidéo.',
    description: 'Animez un portrait avec votre voix ou synchronisez les lèvres d’une vidéo avec un nouvel audio. Choisissez le mode Photo ou Vidéo.',
    intro: 'Un visage, une voix, un nouveau dialogue. Ajoutez votre enregistrement à un portrait ou à une vidéo et synchronisez les lèvres avec les paroles.',
    input: 'Un portrait ou une vidéo de visage, avec un enregistrement vocal.',
    adjustment: 'Le mode Photo ou Vidéo et le passage audio à utiliser.',
    output: 'Une vidéo parlante avec la voix que vous avez choisie.',
    steps: [
      'Choisissez Photo pour un portrait, ou Vidéo pour un visage déjà en mouvement.',
      'Ajoutez votre voix et sélectionnez le passage à faire prononcer.',
      'Confirmez le prix, puis regardez et écoutez la nouvelle vidéo.',
    ],
    limits: [
      'Choisissez un visage bien visible et une voix claire. Comparez les lèvres et les traits du visage dans la vidéo obtenue.',
      'En mode Vidéo, sélectionnez des passages audio et vidéo de même durée. L’outil ne les boucle pas et ne les accélère pas pour les faire coïncider.',
    ],
    questions: [
      { question: 'Quelle différence entre Photo et Vidéo ?', answer: 'Photo anime un portrait fixe pour le faire parler. Vidéo adapte les lèvres d’un visage filmé à votre nouvel enregistrement.' },
      { question: 'Puis-je utiliser une voix générée ?', answer: 'Oui. Sélectionnez un audio de votre compte ou importez votre enregistrement. Vous choisissez la voix avant de lancer la création.' },
    ],
  },
  'product-photo-editor': {
    name: 'Retouche photo produit',
    title: 'Votre produit. Une autre mise en scène.',
    description: 'Changez le décor ou l’éclairage de votre photo produit. Choisissez un fond studio, une mise en situation ou une nouvelle lumière.',
    intro: 'Un fond studio, une scène en extérieur, une lumière plus marquée. Partez de votre photo produit et décrivez l’image que vous voulez créer.',
    input: 'Votre photo produit, avec une image d’ambiance si vous le souhaitez.',
    adjustment: 'Le décor, la lumière, le format et les détails à conserver.',
    output: 'Une nouvelle photo à comparer et à télécharger.',
    steps: [
      'Importez une photo où le produit et ses détails sont bien visibles.',
      'Choisissez le type de retouche et décrivez votre mise en scène.',
      'Comparez la nouvelle image avec votre photo, puis téléchargez-la.',
    ],
    limits: [
      'Précisez les détails importants : forme du flacon, couleur, matière. Vérifiez les logos et les inscriptions sur l’image obtenue.',
      'Une nouvelle lumière ou perspective peut modifier l’apparence du produit. Commencez par un changement précis pour mieux juger le résultat.',
    ],
    questions: [
      { question: 'Le logo et l’étiquette restent-ils identiques ?', answer: 'La retouche par IA peut modifier de petits détails ou du texte. Vous pouvez indiquer ce qu’il faut conserver, puis vérifier les inscriptions en pleine taille avant d’utiliser l’image.' },
      { question: 'Puis-je animer la photo ensuite ?', answer: 'Oui. Enregistrez l’image, puis choisissez-la dans un outil vidéo compatible. La création vidéo a son propre prix, à confirmer séparément.' },
    ],
  },
  'product-video-editor': {
    name: 'Retouche vidéo produit',
    title: 'Changez le décor. Gardez votre plan comme point de départ.',
    description: 'Retouchez un plan vidéo produit : choisissez un passage, décrivez un nouveau décor, une lumière ou un style, puis comparez les vidéos.',
    intro: 'Votre produit est déjà filmé. Sélectionnez un passage et demandez un nouveau décor, une autre lumière ou un style visuel différent.',
    input: 'Un plan vidéo produit court, sans changement de plan.',
    adjustment: 'Le passage à retoucher, l’ambiance et le son à conserver ou couper.',
    output: 'Une nouvelle vidéo à comparer avec le plan original.',
    steps: [
      'Importez votre vidéo et délimitez le passage à retoucher.',
      'Décrivez le changement de décor, de lumière ou de style.',
      'Comparez les deux vidéos côte à côte et téléchargez le résultat.',
    ],
    limits: [
      'Utilisez un plan continu. Une coupe, des mains devant le produit ou des mouvements rapides peuvent compliquer la retouche.',
      'Regardez le résultat sur toute sa durée : inscriptions, forme du produit et mouvement de caméra peuvent évoluer avec la retouche.',
    ],
    questions: [
      { question: 'Puis-je retoucher un spot entier ?', answer: 'L’outil travaille sur un plan continu. Pour un spot avec plusieurs plans, retouchez chaque passage séparément, puis assemblez les vidéos dans Studio.' },
      { question: 'Puis-je garder le son de ma vidéo ?', answer: 'Oui, choisissez de conserver l’audio original ou de le couper. Écoutez le résultat avant de l’ajouter à votre montage.' },
    ],
  },
  'motion-transfer': {
    name: 'Motion Transfer',
    title: 'Donnez un mouvement à votre personnage.',
    description: 'Animez une image de personnage à partir d’un mouvement filmé. Choisissez votre personnage, un passage vidéo et la méthode de guidage.',
    intro: 'Une pose, un pas de danse, un geste. Associez l’image de votre personnage à une vidéo de mouvement pour créer une nouvelle animation.',
    input: 'Une image de personnage et une vidéo du mouvement à suivre.',
    adjustment: 'Le passage, la méthode de guidage, l’orientation et le son.',
    output: 'Une vidéo de votre personnage inspirée du mouvement choisi.',
    steps: [
      'Choisissez une image où le personnage et sa pose sont bien visibles.',
      'Ajoutez la vidéo de mouvement et sélectionnez le passage à suivre.',
      'Choisissez la méthode, confirmez le prix et regardez votre personnage s’animer.',
    ],
    limits: [
      'Préférez une vidéo où le corps reste visible. Les gestes masqués ou les mouvements très rapides sont plus difficiles à suivre.',
      'Vérifiez le visage, les mains et les objets tenus. La ressemblance et les gestes peuvent varier dans la vidéo obtenue.',
    ],
    questions: [
      { question: 'Quelle différence entre les deux méthodes ?', answer: 'Contrôle du mouvement utilise une méthode dédiée à la gestuelle du personnage. Inspiration vidéo utilise le clip comme référence générale. Ces deux méthodes ne reproduisent pas les mouvements de la même façon.' },
      { question: 'Puis-je utiliser un personnage créé dans Character Builder ?', answer: 'Oui. Sélectionnez une image enregistrée dans Médias. Si vous avez une planche de plusieurs vues, choisissez d’abord l’image unique à animer.' },
    ],
  },
};
