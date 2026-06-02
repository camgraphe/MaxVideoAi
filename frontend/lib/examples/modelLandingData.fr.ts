import type { CanonicalExampleModelSlug, LocalizedModelDescriptor } from '@/lib/examples/modelLandingTypes';

export const FR_MODEL_DATA: Partial<Record<CanonicalExampleModelSlug, LocalizedModelDescriptor>> = {
  sora: {
    subtitle: 'Exemples Sora pensés pour un rendu cinématique, des prompts réutilisables et des réglages directement exploitables.',
    intro:
      'Cette page rassemble des exemples Sora réellement exploitables en production, avec prompts, durées et formats observés sur des rendus concrets. L’objectif est de vous aider à reproduire des résultats cohérents sans mélanger les logiques propres aux autres modèles.',
    promptPatterns:
      'Commencez par l’intention du plan, puis précisez la caméra, le mouvement et la lumière. Les prompts courts, structurés et bien hiérarchisés restent les plus fiables.',
    strengthsLimits:
      'Sora est souvent très solide sur les plans cinématiques et la cohérence visuelle. Les limites dépendent ensuite du mode utilisé et du contexte de rendu.',
    pricingNotes:
      'Le coût varie selon la durée, la résolution et les options activées. Vérifiez le prix par clip avant de lancer plusieurs variantes.',
    faq: [
      {
        question: 'Quels prompts fonctionnent le mieux avec Sora ?',
        answer: 'Des prompts structurés, avec sujet, caméra et mouvement clairement séparés.',
      },
      {
        question: 'Peut-on cloner ces exemples Sora dans le studio ?',
        answer: 'Oui. Les exemples sont conçus pour être réutilisés puis ajustés rapidement.',
      },
      {
        question: 'Comment contrôler le budget Sora ?',
        answer: 'Testez d’abord des clips courts, puis augmentez sur les variantes gagnantes.',
      },
    ],
  },
  veo: {
    metaTitle: 'Exemples Veo 3.1, prompts, reglages et image-vers-video | MaxVideoAI',
    metaDescription:
      'Parcourez des exemples Veo 3.1, prompts, reglages, schemas image-vers-video et prix par clip pour Veo 3.1, Veo 3.1 Fast et Veo 3.1 Lite sur MaxVideoAI.',
    heroTitle: 'Exemples Veo 3.1, prompts, reglages et schemas image-vers-video',
    subtitle: 'Exemples Veo 3.1, prompts, reglages et schemas image-vers-video sur la famille Veo actuelle.',
    intro:
      'Parcourez des exemples Veo 3.1, Veo 3.1 Fast et Veo 3.1 Lite, avec des prompts, des reglages reutilisables et des schemas image-vers-video, puis ouvrez les pages modele pour les caracteristiques, limites et tarifs. Utilisez cette page pour etudier la structure des prompts, les schemas texte-vers-video IA et les reglages image-vers-video propres a chaque modele avant d ouvrir la page Veo correspondante.',
    summary:
      'Veo 3.1 mene cette page pour les exemples, prompts, reglages et schemas image-vers-video, avec Veo 3.1 Fast et Veo 3.1 Lite conserves comme variantes Veo actuelles pour une iteration plus rapide et des tests prets pour l audio moins couteux.',
    promptPatterns:
      'Decrivez d abord l objectif du plan, puis la camera, l ambiance et les contraintes de reference utiles pour l image-vers-video. Les exemples Veo 3.1 sont plus lisibles quand la structure du prompt reste stable.',
    strengthsLimits:
      'Veo offre generalement un bon niveau de controle sur le cadrage et le mouvement sur des rendus texte-vers-video et image-vers-video courts. Les capacites varient selon le mode actif et le type d entree.',
    pricingNotes:
      'Comparez les coûts avec des presets identiques en durée et résolution pour isoler la vraie différence entre modèles.',
    faq: [
      {
        question: 'Comment utiliser Veo 3 pour l image-vers-video ?',
        answer:
          'Partez d une image fixe solide, definissez un seul objectif de mouvement et gardez une direction camera explicite. Les flux Veo 3.1 en image-vers-video fonctionnent mieux quand le prompt prolonge l image source au lieu de la remplacer completement.',
      },
      {
        question: 'Quel modele Veo 3 utiliser pour tester des prompts ?',
        answer:
          'Commencez par Veo 3.1 Fast ou Veo 3.1 Lite si vous voulez des tests moins chers et des tests de prompt plus rapides, puis passez a Veo 3.1 pour une sortie cinematique plus aboutie et un meilleur controle guide par references.',
      },
      {
        question: 'Ces exemples Veo 3.1 peuvent-ils servir de base pour des prompts texte-vers-video IA ?',
        answer:
          'Oui. Utilisez-les comme bases texte-vers-video IA en gardant le meme sujet, le meme objectif de mouvement, la meme direction camera et le meme format, puis ne changez qu une variable de prompt a la fois.',
      },
    ],
  },
  luma: {
    metaTitle: 'Exemples Luma Ray 2 et Ray 2 Flash (prompts + reglages) | MaxVideoAI',
    metaDescription:
      'Parcourez des exemples Luma Ray 2 et Ray 2 Flash avec prompts reutilisables, cas modify/reframe et reperes de prix par clip avant de choisir le niveau premium ou rapide dans MaxVideoAI.',
    subtitle: 'Exemples Luma Ray sur Ray 2 et Ray 2 Flash, avec prompts reutilisables, cas modify/reframe et reperes de prix.',
    intro:
      'Cette page est la vue famille de Luma Ray dans MaxVideoAI. Utilisez-la pour comparer rapidement les exemples Ray 2 et Ray 2 Flash avant de decider si le rendu doit partir sur le niveau premium ou sur le niveau brouillon plus rapide. Les pages modele portent les caracteristiques detaillees; cette galerie sert a lire les schemas de prompt, les flux et les arbitrages de cout entre les deux modeles Luma publics.',
    promptPatterns:
      'Les exemples Luma sont plus utiles quand le prompt reste au niveau du plan et du flux: generation neuve, animation depuis image fixe, modify sur video source, ou reframe pour la livraison. Gardez une consigne compacte et dites clairement ce qui doit rester et ce qui peut changer.',
    strengthsLimits:
      'Ray 2 est le meilleur choix pour des finals cinematographiques premium et un niveau de confiance plus eleve. Ray 2 Flash est la couche de throughput la moins couteuse pour valider des concepts, tester des passes modify plus rapides et preparer des declinaisons carre ou verticales. Aucun des deux modeles ne genere d audio natif, donc jugez-les sur le mouvement, le cadrage et le controle sur video source plutot que sur le lip sync.',
    pricingNotes:
      'Gardez des durees et resolutions identiques pour comparer proprement les deux niveaux Luma. Ray 2 justifie plus souvent le cout sur des rendus finaux, alors que Ray 2 Flash est la meilleure base pour l exploration, les retouches sur video source et les variantes de livraison moins couteuses.',
    faq: [
      {
        question: 'Quand faut-il commencer par la page d exemples Luma ?',
        answer: 'Commencez ici quand vous voulez comparer rapidement Ray 2 et Ray 2 Flash avant de choisir le niveau premium ou rapide pour un vrai rendu.',
      },
      {
        question: 'Quelle difference saute le plus aux yeux entre Ray 2 et Ray 2 Flash dans les exemples ?',
        answer: 'Ray 2 reste le niveau premium pour les rendus finaux, tandis que Ray 2 Flash reste le niveau rapide pour les tests. Les flux sont alignes, mais leur role en production est different.',
      },
      {
        question: 'Peut-on comparer ici les usages modify et reframe ?',
        answer: 'Oui. La galerie est justement faite pour montrer a la fois la generation nette et les cas d edition video source avant d ouvrir les pages modele pour les controles complets.',
      },
    ],
  },
  wan: {
    subtitle: 'Exemples Wan pensés pour des séquences structurées, des transitions propres et une continuité guidée.',
    intro:
      'Les exemples Wan de cette page sont pensés pour des séquences courtes à temps forts lisibles et transitions maîtrisées. Ils servent de point de départ concret avant clonage en production, surtout quand le rythme compte autant que le rendu final.',
    promptPatterns:
      'Utilisez des prompts en 2 ou 3 temps: mise en place, action, conclusion. Une formulation explicite des transitions améliore souvent la stabilité.',
    strengthsLimits:
      'Wan fonctionne bien sur des plans structurés et des variations courtes avec continuité. Gardez des scènes simples pour limiter la dérive.',
    pricingNotes:
      'Commencez par un test court à paramètres cibles, puis élargissez aux variantes validées.',
    faq: [
      {
        question: 'Les exemples Wan sont-ils adaptés aux prompts multi-beats ?',
        answer: 'Oui, ils sont structurés pour des séquences courtes avec transitions explicites.',
      },
      {
        question: 'Peut-on adapter Wan aux formats verticaux ?',
        answer: 'Oui, en conservant la logique de mouvement puis en ajustant le cadrage.',
      },
      {
        question: 'Quelle méthode de test prix pour Wan ?',
        answer: 'Validez un clip court en preset final avant de lancer des lots.',
      },
    ],
  },
  kling: {
    metaTitle: 'Exemples vidéo IA Kling, prompts et réglages | MaxVideoAI',
    metaDescription:
      'Parcourez des exemples vidéo IA Kling avec prompts, références visuelles, storyboard, V2V depuis vidéo source, image-vers-vidéo start-frame et tarifs pour Kling 3.0 Omni et Kling 3.',
    heroTitle: 'Exemples vidéo IA Kling, prompts et réglages',
    subtitle:
      'Exemples vidéo IA Kling, prompts, réglages, références, schémas image-vers-vidéo et repères de modèle pour Kling 3.0 Omni, Kling 3 et les versions encore prises en charge.',
    intro:
      'Parcourez des exemples vidéo IA Kling, des prompts et des réglages réutilisables pour Kling 3.0 Omni Pro, Standard et 4K, puis comparez-les aux routes Kling 3 en start frame et aux versions plus anciennes encore prises en charge. Utilisez cette page pour distinguer les prompts O3 guidés par références des prompts Kling 3 image-vers-vidéo classiques avant d’ouvrir la page modèle correspondante.',
    summary:
      'Kling 3.0 Omni Pro et Standard sont les routes actuelles pour les images de référence, les storyboards et le V2V depuis vidéo source. Kling 3 Pro et Standard restent les routes image-vers-vidéo avec start frame visible, tandis que Kling 3.0 Omni 4K sert aux rendus 4K natifs guidés par références.',
    promptPatterns:
      'Commencez par décider si le média importé doit guider le rendu comme référence ou devenir la première image visible. Utilisez les ancres @Image et @Video1 pour O3; utilisez une logique start frame quand le plan doit partir sur Kling 3.',
    strengthsLimits:
      'O3 est plus adapté quand les références guident le style, l’identité, la structure storyboard ou le mouvement d’une vidéo source sans ouvrir le clip. Kling 3 est plus adapté quand l’image importée doit vraiment apparaître comme première frame.',
    pricingNotes:
      'Gardez durée, ratio, audio et résolution alignés quand vous comparez des résultats Kling. Utilisez Standard pour tester O3 à moindre coût, Pro pour les passes référence/V2V plus solides, et 4K seulement une fois la direction validée.',
    faq: [
      {
        question: 'Quelle durée peuvent atteindre les vidéos Kling AI ?',
        answer:
          'Kling 3.0 Omni Standard et Pro prennent en charge des rendus guidés par références jusqu’à 15 secondes en 1080p, avec V2V depuis vidéo source sur Standard et Pro. La route O3 4K sert aux rendus 4K natifs guidés par références, tandis que Kling 3 reste la route image-vers-vidéo avec start frame.',
      },
      {
        question: 'Combien de temps Kling AI met-il pour générer une vidéo ?',
        answer:
          'Le temps de rendu dépend du modèle Kling, de la durée, des médias importés, de l’audio, de la résolution et de la file d’attente. Les tests courts en Standard restent les plus rapides pour valider une direction, tandis que le V2V O3, l’audio et la 4K native prennent plus de temps.',
      },
      {
        question: 'Quel modèle Kling AI utiliser pour les prompts et les exemples ?',
        answer:
          'Utilisez Kling 3.0 Omni Standard ou Pro quand des références, un storyboard ou @Video1 doivent guider le rendu sans devenir l’ouverture du clip. Utilisez Kling 3 Standard ou Pro quand l’image importée doit être la start frame visible.',
      },
      {
        question: 'Comment utiliser Kling AI pour des tests de prompt en image-vers-vidéo ?',
        answer:
          'Pour O3, donnez un rôle clair à chaque référence avec @Image1, @Image2 ou @Video1. Pour Kling 3, partez d’une image source claire, d’une instruction de mouvement et d’un objectif caméra, car l’image doit ouvrir le clip.',
      },
      {
        question: 'Comment adapter des prompts Kling AI entre Kling 3 Pro et Kling 3 Standard ?',
        answer:
          'Gardez le même sujet, la même action, la même direction caméra et la même durée quand vous comparez les niveaux. Changez seulement l’intention de route : O3 pour références/storyboard/V2V, Kling 3 pour start frame, et 4K uniquement pour les rendus validés.',
      },
    ],
  },
  seedance: {
    metaTitle: 'Exemples vidéo IA Seedance, prompts et réglages | MaxVideoAI',
    metaDescription:
      'Parcourez des exemples vidéo IA Seedance avec prompts, réglages et prix par clip pour Seedance 2.0, Seedance 2.0 Fast et le flux Seedance 1.5 Pro encore pris en charge sur MaxVideoAI.',
    heroTitle: 'Exemples vidéo IA Seedance, prompts et réglages',
    subtitle: 'Exemples vidéo IA Seedance, prompts, réglages et sorties pour les flux Seedance actuels et les versions encore prises en charge.',
    intro:
      'Parcourez des exemples vidéo IA Seedance, des prompts et des réglages réutilisables pour Seedance 2.0 et Seedance 2.0 Fast, puis explorez la configuration Seedance 1.5 Pro encore prise en charge pour des flux plus anciens et des clips plus courts. Utilisez cette page pour comparer des flux vidéo Seedance, des structures de prompt et des schemas de sortie avant d’ouvrir la page modèle Seedance correspondante.',
    summary:
      'Seedance 2.0 et Seedance 2.0 Fast structurent d’abord cette page d’exemples vidéo IA Seedance, tandis que Seedance 1.5 Pro reste disponible plus bas comme configuration plus ancienne encore prise en charge pour des clips courts et répétables.',
    promptPatterns:
      'Un objectif de plan clair, puis contraintes caméra/environnement. Les prompts compacts donnent les résultats les plus réguliers sur les flux vidéo IA Seedance.',
    strengthsLimits:
      'Seedance est utile quand vous cherchez une caméra stable et un mouvement lisible. Limitez la complexité de scène.',
    pricingNotes:
      'Comparez Seedance sur des presets identiques pour obtenir un signal coût fiable.',
    faq: [
      {
        question: 'Ces exemples vidéo IA Seedance sont-ils optimisés pour la stabilité caméra ?',
        answer: 'Oui, la plupart des exemples vidéo IA Seedance de cette page privilégient des mouvements lisibles et peu de dérive.',
      },
      {
        question: 'Quel modèle vidéo IA Seedance faut-il utiliser pour les exemples et les tests de prompt ?',
        answer:
          'Commencez par Seedance 2.0 Fast si vous voulez des tests moins coûteux et des tests de prompt plus rapides, puis passez à Seedance 2.0 pour une meilleure qualité multi-plans, l’audio natif et des sorties plus prêtes pour la production.',
      },
      {
        question: 'Quels réglages influencent le plus le prix sur les flux vidéo Seedance ?',
        answer:
          'La durée et la résolution restent les premiers facteurs de prix sur les flux vidéo Seedance, puis viennent les options propres au flux.',
      },
    ],
  },
  ltx: {
    metaTitle: 'Exemples LTX, prompts, réglages et sorties | MaxVideoAI',
    metaDescription:
      'Parcourez des exemples de prompts LTX 2.3 Pro et LTX 2.3 Fast, des réglages, des sorties et des schemas image-vers-vidéo, puis consultez les flux LTX 2 encore pris en charge sur MaxVideoAI.',
    heroTitle: 'Exemples LTX, prompts, réglages et sorties',
    subtitle: 'Exemples pour les flux LTX 2.3 Pro et LTX 2.3 Fast actuels, avec les anciens flux LTX encore pris en charge.',
    intro:
      'Parcourez les exemples de prompts, les réglages réutilisables et les schemas de sortie de LTX 2.3 Pro et LTX 2.3 Fast, puis consultez LTX 2 et LTX 2 Fast comme configurations encore prises en charge pour des flux plus anciens, des bases de prompts historiques et du contexte de migration. Utilisez cette page pour étudier la structure des prompts, les schemas image-vers-vidéo IA et les réglages propres à chaque modèle avant d’ouvrir la page LTX correspondante.',
    summary:
      'LTX 2.3 Pro et LTX 2.3 Fast mènent cette page pour les exemples de prompts, les réglages, les sorties et les schemas image-vers-vidéo, tandis que LTX 2 et LTX 2 Fast restent disponibles plus bas pour les flux plus anciens et le contexte de migration.',
    promptPatterns:
      'Commencez par des structures de prompts LTX 2.3 réutilisables pour des plans produit, des clips cinématiques courts et des tests de mouvement cohérents qui se transforment en sorties vidéo répétables, puis adaptez-les à votre scène.',
    strengthsLimits:
      'Utilisez LTX 2.3 avec une image source claire, une instruction de mouvement principale et un objectif caméra unique pour comparer plus proprement les sorties entre Pro et Fast.',
    pricingNotes:
      'Gardez la durée, le ratio, la complexité du mouvement et les réglages de sortie alignés quand vous testez des prompts afin de comparer plus proprement la qualité, la vitesse et le coût.',
    faq: [
      {
        question: 'Quels sont les meilleurs exemples de prompts LTX 2.3 pour commencer ?',
        answer:
          'Le meilleur point de départ reste une structure simple : sujet, action, direction caméra et intention visuelle. Les exemples les plus utiles gardent cette structure stable et ne changent qu’une variable à la fois.',
      },
      {
        question: 'Comment faut-il structurer un prompt LTX 2.3 ?',
        answer:
          'Commencez par un sujet clair, une action principale, une instruction caméra et un repère de style visuel. Les prompts LTX 2.3 fonctionnent généralement mieux quand l’objectif de mouvement est explicite et que la scène reste compacte.',
      },
      {
        question: 'Quels réglages comptent le plus pour les sorties LTX 2.3 ?',
        answer:
          'Les réglages les plus importants sont la durée, le ratio, l’image source pour l’image-vers-vidéo et le niveau de complexité de mouvement demandé. Les garder stables rend les tests beaucoup plus lisibles.',
      },
      {
        question: 'Comment faut-il prompter LTX 2.3 en image-vers-vidéo ?',
        answer:
          'Partez d’une image source forte, puis ajoutez une instruction de mouvement, un mouvement caméra et un objectif de sortie. LTX 2.3 fonctionne mieux quand le prompt prolonge l’image d’origine au lieu de tenter de la remplacer par une scène totalement différente.',
      },
      {
        question: 'Quel modèle LTX utiliser : LTX 2.3 Pro ou LTX 2.3 Fast ?',
        answer:
          'Utilisez LTX 2.3 Pro quand vous cherchez la meilleure qualité actuelle et des flux avancés comme l’audio, Extend et Retake. Utilisez LTX 2.3 Fast quand vous voulez tester des prompts plus vite, à moindre coût, et itérer sur des tests plus longs.',
      },
    ],
  },
  pika: {
    subtitle: 'Exemples Pika pensés pour des boucles courtes, un style social affirmé et un montage rapide.',
    intro:
      'Cette page Pika cible les formats courts et stylisés. Elle permet de cloner des schémas de mouvement efficaces puis d’ajuster le sujet et le style sans refaire toute la configuration.',
    promptPatterns:
      'Commencez par le style, ajoutez ensuite l’action principale, puis une consigne de caméra concise.',
    strengthsLimits:
      'Pika est souvent performant pour des boucles sociales rapides et des visuels très stylisés. Évitez les prompts surchargés pour réduire l’instabilité.',
    pricingNotes:
      'Le coût reste plus prévisible avec des durées courtes et des presets constants.',
    faq: [
      {
        question: 'Comment réutiliser efficacement un exemple Pika ?',
        answer: 'Clonez le schéma de mouvement, puis ajustez seulement le sujet et la direction artistique.',
      },
      {
        question: 'Ces exemples Pika conviennent-ils aux variantes pour réseaux sociaux ?',
        answer: 'Oui, ils sont pensés pour des déclinaisons rapides.',
      },
      {
        question: 'Comment garder des coûts Pika stables ?',
        answer: 'Fixez durée et résolution avant de lancer plusieurs variantes.',
      },
    ],
  },
  hailuo: {
    subtitle: 'Exemples Hailuo pensés pour des tests économiques, des tests de mouvement et une itération progressive.',
    intro:
      'Cette page Hailuo est pensée pour une phase d’exploration à faible coût avant passage sur des modèles premium. Elle sert à valider rapidement des idées de mouvement et de composition sans immobiliser trop de budget.',
    promptPatterns:
      'Privilégiez des prompts courts centrés sur l’action et l’intention caméra.',
    strengthsLimits:
      'Hailuo est utile pour des passes conceptuelles et des tests de mouvement. Pour des scènes complexes, avancez par étapes courtes afin de garder le contrôle.',
    pricingNotes:
      'Utilisez Hailuo comme base de test, puis montez en qualité ou redirigez les variantes gagnantes vers un modèle premium.',
    faq: [
      {
        question: 'Pourquoi utiliser Hailuo avant un modèle premium ?',
        answer: 'Pour valider des directions visuelles avec un coût initial plus bas.',
      },
      {
        question: 'Comment structurer un prompt Hailuo ?',
        answer: 'Un prompt court, une action principale, une caméra claire.',
      },
      {
        question: 'Quelle stratégie budget avec Hailuo ?',
        answer: 'Tester court, sélectionner les meilleures sorties, puis monter en qualité.',
      },
    ],
  },
};
