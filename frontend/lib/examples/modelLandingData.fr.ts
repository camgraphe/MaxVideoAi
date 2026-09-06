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
      'Le coût varie selon la durée, la résolution et les options activées. Ouvrez un exemple pour vérifier son coût enregistré avant de lancer plusieurs variantes.',
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
      'Parcourez des exemples Veo 3.1, prompts, réglages et schémas image-vers-vidéo, puis ouvrez une fiche pour voir le coût enregistré pour Veo 3.1, Veo 3.1 Fast et Veo 3.1 Lite sur MaxVideoAI.',
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
    metaTitle: 'Exemples Luma Ray 3.2 Modify et Reframe | MaxVideoAI',
    metaDescription:
      'Parcourez des exemples Luma Ray 3.2 pour Modify de video source, Reframe video IA, images guides, tests silencieux 5 s / 10 s, prompts reutilisables et contexte Ray 2 / Flash.',
    subtitle: 'Exemples Luma Ray 3.2 pour Modify de video source, Reframe, images guides, ratios et tests silencieux controles en cout.',
    intro:
      'Cette page est la vue famille de Luma Ray dans MaxVideoAI. Elle met maintenant Ray 3.2 en avant pour Modify de video source, les passes guidees par image ou images cles et le Reframe de livrables, tandis que Ray 2 et Ray 2 Flash restent utiles comme contexte d anciens exemples et couverture de secours. Les pages modele portent les caracteristiques detaillees; cette galerie sert a lire les schemas de prompt, les exemples de retouche et les reglages economes.',
    promptPatterns:
      'Les exemples Luma fonctionnent mieux quand le prompt reste adapte au mode. Pour Modify, ecrivez ce qui reste depuis la video source avant le changement demande. Pour Reframe, nommez le sujet prioritaire et le remplissage du cadre. Pour une generation complementaire, gardez un sujet, un mouvement, une direction camera, le ratio cible et la duree/resolution.',
    strengthsLimits:
      'Ray 3.2 est la route Luma actuelle pour modification de video source, direction visuelle par images cles, recadrage de livrables, passes produit et tests courts complementaires. Ce n est pas un moteur audio ou lip sync dans MaxVideoAI: jugez les exemples sur la preservation de la source, le cadrage, la continuite produit, la discipline de retouche et le controle du prompt. Ray 2 et Ray 2 Flash restent disponibles comme contexte de production plus ancien.',
    pricingNotes:
      'Commencez par des clips 5 s en 540p ou 720p pour valider le mouvement, puis passez seulement les plans approuves sur des rendus plus longs ou plus definis. Le prix client reste celui du devis site avant generation; la route directe Luma conserve ce prix et la securite Fal protege la disponibilite.',
    faq: [
      {
        question: 'Quand faut-il commencer par la page d exemples Luma ?',
        answer: 'Commencez ici quand vous voulez voir des schemas Ray 3.2 Modify et Reframe avant d ouvrir la page modele ou de cloner un prompt dans l app.',
      },
      {
        question: 'Ray 3.2 genere-t-il de l audio ?',
        answer: 'Non. Considerez les exemples Ray 3.2 comme des sorties video silencieuses, puis ajoutez voix, musique ou sound design plus tard.',
      },
      {
        question: 'Faut-il partir du texte ou d une image ?',
        answer: 'Partez d une video source quand le timing fonctionne deja. Utilisez texte ou image seulement pour creer un nouveau clip court et silencieux avant une passe Modify ou Reframe.',
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
    metaTitle: 'Exemples Seedance 2.5, prompts et réglages | MaxVideoAI',
    metaDescription:
      'Découvrez des exemples vidéo Seedance 2.5 et leurs prompts, puis comparez les flux Seedance 2.0, Fast, Mini et 1.5 Pro encore pris en charge.',
    heroTitle: 'Exemples vidéo IA Seedance 2.5, prompts et réglages',
    subtitle:
      'Des exemples, prompts et réglages Seedance menés par Seedance 2.5, avec les flux actuels et encore pris en charge remis dans leur contexte.',
    intro:
      'Commencez par Seedance 2.5 pour les flux actuels de 4 à 30 secondes jusqu’en 1080p, avec audio généré et références, puis comparez les exemples Seedance 2.0, Fast et Mini sans présenter les anciens rendus comme des sorties Seedance 2.5. Ouvrez d’abord une vidéo pour voir son prompt et ses réglages; les liens modèle et comparatif restent sous la galerie.',
    summary:
      'Seedance 2.5 est la route phare pour les flux plus longs jusqu’en 1080p, l’audio généré, les références, l’édition et l’extension. Seedance 2.0 reste disponible pour les besoins de 4K, Fast et Mini couvrent les brouillons ou les lots, et Seedance 1.5 Pro reste pris en charge comme ancien point de comparaison.',
    promptPatterns:
      'Pour Seedance 2.5, définissez une action principale, une direction caméra et le rôle de chaque référence avant d’ajouter les détails de scène. Gardez la même structure de prompt quand vous comparez 2.5 avec Seedance 2.0, Fast ou Mini.',
    strengthsLimits:
      'Utilisez Seedance 2.5 quand la durée, l’audio généré, les références mixtes, l’édition ou l’extension comptent. Sa route publique MaxVideoAI prend en charge les sorties paysage, carrées et verticales en 480p, 720p ou 1080p; gardez Seedance 2.0 lorsque la 4K est requise.',
    pricingNotes:
      'La durée, l’audio et le type de média influencent le prix. Le générateur affiche le tarif avant le lancement.',
    faq: [
      {
        question: 'Tous les exemples Seedance de cette page ont-ils été générés avec Seedance 2.5 ?',
        answer:
          'Non. La galerie conserve les libellés exacts des rendus Seedance 2.5, Seedance 2.0, Fast, Mini et 1.5 Pro encore pris en charge afin que vous puissiez comparer la route réellement utilisée.',
      },
      {
        question: 'Par quel modèle Seedance commencer pour les exemples et les tests de prompt ?',
        answer:
          'Commencez par Seedance 2.5 pour le flux phare actuel jusqu’en 1080p. Utilisez Seedance 2.0 pour les besoins de 4K, Fast pour des brouillons plus rapides et Mini pour des variantes répétables en lot.',
      },
      {
        question: 'Quels réglages influencent le plus le prix d’une vidéo Seedance ?',
        answer:
          'La durée, l’audio généré et l’utilisation d’une vidéo source influencent le plus le prix. Gardez ces réglages alignés quand vous comparez les routes.',
      },
    ],
  },
  ltx: {
    metaTitle: 'Exemples LTX, prompts, réglages et sorties | MaxVideoAI',
    metaDescription:
      "Explorez les exemples vidéo, prompts et réglages LTX 2.5 Pro et Fast, avec des exemples LTX 2.3 et LTX 2 identifiés pour les anciens flux.",
    heroTitle: 'Exemples LTX, prompts, réglages et sorties',
    subtitle: 'Exemples pour les flux LTX 2.5 Pro et LTX 2.5 Fast actuels, avec les anciens flux LTX encore pris en charge.',
    intro:
      "Explorez les prompts, réglages et résultats LTX 2.5 Pro et Fast. La galerie conserve aussi des exemples LTX 2.3 Pro/Fast et LTX 2 Pro/Fast pour les anciens flux et les comparaisons de migration. Chaque vidéo indique le modèle qui a réellement produit le résultat. Ouvrez ses détails pour retrouver le prompt, les réglages et le prix enregistré.",
    summary:
      "LTX 2.5 Pro et Fast occupent le premier plan. Les exemples LTX 2.3 et LTX 2 conservent leur modèle d’origine pour comparer les générations sans confondre leurs capacités.",
    promptPatterns:
      'Commencez par des structures de prompts LTX 2.5 réutilisables pour des plans produit, des clips cinématiques courts et des tests de mouvement cohérents qui se transforment en sorties vidéo répétables, puis adaptez-les à votre scène.',
    strengthsLimits:
      'Utilisez LTX 2.5 avec une image source claire, une instruction de mouvement principale et un objectif caméra unique pour comparer plus proprement les sorties entre Pro et Fast.',
    pricingNotes:
      'Gardez la durée, le ratio, la complexité du mouvement et les réglages de sortie alignés quand vous testez des prompts afin de comparer plus proprement la qualité, la vitesse et le coût.',
    faq: [
      {
        question: 'Quels sont les meilleurs exemples de prompts LTX 2.5 pour commencer ?',
        answer:
          'Le meilleur point de départ reste une structure simple : sujet, action, direction caméra et intention visuelle. Les exemples les plus utiles gardent cette structure stable et ne changent qu’une variable à la fois.',
      },
      {
        question: 'Comment faut-il structurer un prompt LTX 2.5 ?',
        answer:
          'Commencez par un sujet clair, une action principale, une instruction caméra et un repère de style visuel. Les prompts LTX 2.5 fonctionnent généralement mieux quand l’objectif de mouvement est explicite et que la scène reste compacte.',
      },
      {
        question: 'Quels réglages comptent le plus pour les sorties LTX 2.5 ?',
        answer:
          'Les réglages les plus importants sont la durée, le ratio, l’image source pour l’image-vers-vidéo et le niveau de complexité de mouvement demandé. Les garder stables rend les tests beaucoup plus lisibles.',
      },
      {
        question: 'Comment faut-il prompter LTX 2.5 en image-vers-vidéo ?',
        answer:
          'Partez d’une image source forte, puis ajoutez une instruction de mouvement, un mouvement caméra et un objectif de sortie. LTX 2.5 fonctionne mieux quand le prompt prolonge l’image d’origine au lieu de tenter de la remplacer par une scène totalement différente.',
      },
      {
        question: 'Quel modèle LTX utiliser : LTX 2.5 Pro ou LTX 2.5 Fast ?',
        answer:
          'Comparez LTX 2.5 Pro et Fast avec le même prompt et les mêmes réglages. Appuyez-vous sur les exemples pour juger le résultat et sur la page des tarifs pour comparer les coûts actuels. Consultez chaque page modèle pour ses modes et limites ; les anciens exemples LTX décrivent la version indiquée sur leur étiquette.',
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
  grok: {
    subtitle: 'Exemples Grok Imagine Video 1.5 en texte-vers-vidéo, animation depuis une image d’ouverture et références.',
    intro:
      'Cette page permet d’étudier Grok Imagine Video 1.5 via la route Fal de MaxVideoAI. Elle couvre le texte-vers-vidéo, l’image-vers-vidéo à partir d’une image d’ouverture et la génération guidée par une à sept images de référence ; cette disponibilité ne signifie pas une intégration directe avec xAI. La galerie sert à choisir une stratégie d’entrée, pas à supposer qu’un prompt unique fonctionnera dans tous les modes. Le texte convient quand la composition peut être inventée depuis le brief. Une image d’ouverture est préférable quand le premier cadrage, la place du sujet, le produit, la tenue ou la palette existent déjà. Plusieurs références sont utiles lorsque chaque source autorisée joue un rôle distinct : identité, objet, décor ou lumière. Pour lire un exemple, observez ensemble le prompt, le mode, la durée, la résolution, le cadrage et la sortie acceptée. Une belle vignette ne prouve ni la fidélité aux références, ni la stabilité des mains, ni la lisibilité d’un texte fortuit, ni la continuité jusqu’au dernier temps. Définissez donc les critères d’acceptation avant le rendu et conservez une validation humaine pour les ressemblances, les droits sur les sources et la sécurité de marque.',
    promptPatterns:
      'En texte-vers-vidéo, précisez le sujet, l’action, la caméra et la lumière, puis décrivez la fin qui doit rester visible à l’arrêt du clip. Gardez une action principale et une intention de caméra afin de pouvoir diagnostiquer un échec de mouvement. Avec une image d’ouverture, décrivez seulement ce qui doit évoluer : ce qui reste fixe, ce qui bouge, la réaction de la caméra et les détails visuels à préserver. Évitez de demander simultanément une refonte de la source et sa conservation exacte. Pour les références, attribuez un rôle clair à chaque image au lieu de répéter toutes ses caractéristiques dans le prompt. Nommez les images dans l’ordre et indiquez laquelle contrôle la personne, le vêtement, l’objet, le lieu ou la palette, puis expliquez comment ces rôles se rencontrent dans un seul plan. Une ou deux références précises sont souvent plus faciles à interpréter que sept sources contradictoires. Placez les contraintes négatives après la direction positive du plan et réservez-les aux risques visibles : logo indésirable, sujet dupliqué, membre supplémentaire, sous-titre accidentel ou coupe de caméra. Pour comparer deux prompts, ne changez qu’une variable et gardez les sources, la durée, la résolution et le cadrage identiques.',
    strengthsLimits:
      'Grok accepte des départs flexibles en texte, image d’ouverture et multi-référence. Les modes texte et image peuvent utiliser le niveau de sortie supérieur affiché par leur page modèle, alors que le mode référence reste limité aux choix 480p ou 720p indiqués. En image-vers-vidéo, l’image d’ouverture détermine le cadrage ; il ne faut donc pas en déduire un réglage de ratio séparé. Le mode référence reçoit des images, pas une vidéo source, une piste audio ou un document générique. Ajouter des références complexifie la direction et ne garantit pas la cohérence. Évaluez séparément la lisibilité de l’ouverture, l’identité du sujet, le mouvement, l’anatomie, la géométrie, les textes ou filigranes indésirables et le dernier temps. Cette page ne revendique ni audio natif, ni exécution directe chez xAI, ni lip sync garanti, ni typographie parfaite, ni commande absente du mode choisi. Les files d’attente, la disponibilité et le devis exact peuvent évoluer sans modifier le contrat créatif ; consultez donc les détails live du modèle et le prix préalable au rendu. Pour une ressemblance ou un produit sensible, lancez d’abord un diagnostic court, inspectez toutes les images du clip et imposez une approbation humaine avant publication.',
    pricingNotes:
      'Suivez le devis affiché avant la génération : cette page ne fixe ni tarif fournisseur ni coût final. Commencez par un diagnostic court en 480p ou 720p pour les références, ou par un test texte/image en 720p, avant d’augmenter les réglages disponibles du mode retenu. Le devis référence doit tenir compte du nombre réel d’images au lieu d’employer une hypothèse générique de texte-vers-vidéo. Comparez les coûts uniquement lorsque mode, durée, résolution et nombre de références correspondent. Conservez aussi les essais rejetés dans le suivi de production afin de ne pas juger vitesse et stabilité à partir des seuls résultats réussis.',
    faq: [
      { question: 'Grok peut-il partir d’une image ?', answer: 'Oui. L’image-vers-vidéo utilise une image d’ouverture et le prompt dirige le mouvement depuis cette composition. Le mode référence accepte plusieurs images avec des rôles nommés. Choisissez l’image d’ouverture pour un cadre autoritaire unique, et les références quand identité, objet, décor ou palette proviennent de sources autorisées distinctes.' },
      { question: 'Combien de références puis-je utiliser ?', answer: 'Le workflow référence accepte une à sept images. Cette capacité n’est pas un objectif : utilisez seulement les sources nécessaires, donnez à chacune une fonction distincte et retirez les éléments redondants ou contradictoires. Gardez aussi leur ordre stable entre deux tests afin d’attribuer les changements au prompt plutôt qu’à une liste réorganisée.' },
      { question: 'La route est-elle directe chez xAI ?', answer: 'Non. xAI possède la famille Grok, mais MaxVideoAI distribue actuellement ce modèle via Fal. Les exemples décrivent les capacités exposées sur cette route et ne doivent pas être lus comme une promesse d’accès direct à l’API xAI, de files identiques ou de fonctions invisibles dans les détails actuels.' },
      { question: 'Comment évaluer un exemple Grok ?', answer: 'Vérifiez que la composition initiale ou les références nommées restent reconnaissables, puis notez mouvement, caméra, anatomie, géométrie, texte parasite, filigrane et dernier temps. Regardez le clip entier plutôt qu’une vignette et traitez tout comportement demandé mais absent comme une donnée du test, sans le justifier après coup.' },
    ],
  },
  flux: {
    subtitle: 'Exemples FLUX 3 et FLUX 3 Draft en texte-vers-vidéo, images de début/fin et prolongation Extend.',
    intro:
      'Cette page compare la route FLUX 3 standard à FLUX 3 Draft via la distribution Fal de MaxVideoAI. Elle couvre le texte-vers-vidéo, l’image-vers-vidéo depuis un cadre d’ouverture, les transitions entre une première et une dernière image, ainsi que le workflow Extend séparé pour continuer un clip existant. La vue famille aide à choisir à la fois le niveau de modèle et le type d’entrée. Draft convient à une exploration contrôlée en 720p lorsque l’équipe doit encore valider l’action, la caméra, la compatibilité des sources ou la logique de transition. FLUX 3 standard est le modèle frère orienté production et expose l’option de résolution supérieure affichée sur sa page. Aucun des deux libellés ne dispense de revoir le résultat. Un exemple exploitable enregistre le rôle des sources, le prompt, le mode, la durée, la résolution et la question visuelle à trancher. Comparez des tâches équivalentes : un pont entre deux images se juge sur le chemin entre les ancres, une extension sur sa continuité avec le clip source et un départ texte sur le plan inventé depuis le brief. Black Forest Labs possède FLUX ; la route décrite ici passe par Fal et ne revendique donc pas une exécution directe chez le fournisseur.',
    promptPatterns:
      'Décrivez un seul plan, un mouvement de caméra précis, une action mesurable du sujet, l’environnement physique et une fin que l’équipe pourra vérifier. Évitez de combiner plusieurs temps sans rapport dans un rendu de diagnostic. En image-vers-vidéo, indiquez d’abord ce qui doit rester de la composition d’ouverture, puis ajoutez le mouvement. Avec une première et une dernière image, fournissez les deux ancres requises et écrivez la transition : comment la pose, la position de l’objet, la matière, la caméra et la lumière évoluent sans saut impossible. Une perspective et une identité compatibles facilitent l’évaluation du pont. Pour Extend, décrivez ce qui se passe après le clip source au lieu de le raconter à nouveau. Prolongez d’abord le dernier vecteur de caméra, la trajectoire du sujet, l’éclairage, le rythme et l’état de la scène avant d’introduire un nouvel élément. Une coupe cachée, une pose réinitialisée ou un sujet remplacé constitue un défaut de continuité même si la dernière image est élégante. Utilisez Draft pour comparer une variable à la fois, puis gardez les fichiers sources gagnants, la structure du prompt et les critères d’acceptation identiques lors du test sur FLUX 3 standard.',
    strengthsLimits:
      'FLUX 3 est la route de qualité standard et Draft sert à itérer plus vite sur son niveau 720p fixe. Les deux modèles exposent des contrats distincts pour le texte, l’image d’ouverture, les première/dernière images et l’extension ; une entrée obligatoire ne devient pas facultative sur Draft. Extend est un mode séparé de continuation vidéo, avec un clip source éligible et ses propres faits de tarification canoniques. Un workflow début/fin n’est pas un ensemble libre de références, et l’image d’ouverture ne doit pas faire croire à un ratio sélectionnable séparément lorsque la source contrôle le cadrage. Ne déduisez ni audio natif, ni lip sync, ni transformation d’une vidéo de référence hors Extend, ni commande absente du mode sélectionné. Contrôlez la préservation de la source, la continuité caméra, l’identité, l’anatomie, la géométrie, le texte accidentel, les filigranes et le dernier temps. Le rendu Draft apporte une preuve pour la décision créative, pas la garantie que standard reproduira chaque pixel. Pour la livraison, relancez la direction retenue sur le modèle frère réellement prévu et revoyez ce résultat indépendamment.',
    pricingNotes:
      'Draft est utile pour valider une direction avant une passe FLUX 3 standard. Confirmez toujours le devis préalable : durée, résolution, niveau et mode influencent le coût, et Extend ne doit jamais hériter par défaut du tarif d’une génération normale. Cette page famille ne publie aucun montant fixe. Pour comparer, conservez la même source et les mêmes réglages, enregistrez aussi les échecs ou rejets et ne montez en gamme que les directions conformes au critère visuel écrit. Un brouillon moins cher crée de la valeur s’il retire une incertitude ; une succession de brouillons non contrôlés n’est pas automatiquement un workflow efficace.',
    faq: [
      { question: 'Quand utiliser FLUX 3 Draft ?', answer: 'Utilisez Draft lorsqu’un test 720p peut répondre à une question précise sur la direction du prompt, le mouvement, la conservation de l’image d’ouverture, la compatibilité des deux cadres ou la continuité d’une extension. Gardez le prompt et les sources approuvés pour la passe standard. Ne présentez pas Draft comme un équivalent de livraison et ne confondez pas une vignette séduisante avec une transition réussie.' },
      { question: 'FLUX 3 peut-il prolonger une vidéo ?', answer: 'Oui. Choisissez le mode Extend séparé, fournissez un clip source éligible et décrivez la suite après son état final visible. Préservez la direction caméra, la place du sujet, la lumière et le rythme avant d’introduire une nouvelle action. La validation et le prix de l’extension restent propres au mode au lieu de reprendre le contrat d’une génération normale.' },
      { question: 'Quelle différence entre début/fin et image-vers-vidéo ?', answer: 'L’image-vers-vidéo anime une seule composition d’ouverture. Le mode première/dernière image exige deux ancres et doit construire un chemin plausible entre elles. Choisissez des sources compatibles, nommez ce qui se transforme et ce qui reste stable, puis jugez tout le pont plutôt que ses seuls points de départ et d’arrivée.' },
      { question: 'FLUX 3 produit-il de l’audio natif ?', answer: 'Aucune capacité audio n’est revendiquée sur cette page famille. Utilisez uniquement les entrées et contrôles visibles dans le mode FLUX sélectionné, puis prévoyez voix, musique ou sound design dans une étape séparée tant que les détails live du modèle n’indiquent pas explicitement un changement.' },
    ],
  },
};
