import type { CanonicalExampleModelSlug, LocalizedModelDescriptor } from '@/lib/examples/modelLandingTypes';

export const FR_MODEL_DATA: Partial<Record<CanonicalExampleModelSlug, LocalizedModelDescriptor>> = {
  sora: {
    "metaTitle": "Exemples historiques Sora | MaxVideoAI",
    "metaDescription": "Ces vidéos ont été créées avec Sora. Les nouvelles générations Sora sont fermées. Découvrez Seedance 2.5, MiniMax H3 et Wan 3 pour votre prochaine vidéo.",
    "heroTitle": "Exemples historiques Sora",
    "subtitle": "Ces vidéos ont été créées avec Sora. Les nouvelles générations Sora sont fermées. Découvrez Seedance 2.5, MiniMax H3 et Wan 3 pour votre prochaine vidéo.",
    "intro": "La génération Sora est fermée. OpenAI et fal.ai arrêtent l’API le 24 septembre 2026. Choisissez Seedance 2.5, MiniMax H3 ou Wan 3 pour une nouvelle vidéo. Vos vidéos existantes restent dans votre bibliothèque.",
    "promptPatterns": "Ces vidéos ont été créées avec Sora. Les nouvelles générations Sora sont fermées. Découvrez Seedance 2.5, MiniMax H3 et Wan 3 pour votre prochaine vidéo.",
    "strengthsLimits": "Ces vidéos ont été créées avec Sora. Les nouvelles générations Sora sont fermées. Découvrez Seedance 2.5, MiniMax H3 et Wan 3 pour votre prochaine vidéo.",
    "pricingNotes": "Les coûts enregistrés sont historiques. Choisissez un modèle disponible et consultez un nouveau devis avant de générer.",
    "faq": [
        {
            "question": "Peut-on encore générer avec Sora ?",
            "answer": "La génération Sora est fermée. OpenAI et fal.ai arrêtent l’API le 24 septembre 2026. Choisissez Seedance 2.5, MiniMax H3 ou Wan 3 pour une nouvelle vidéo. Vos vidéos existantes restent dans votre bibliothèque."
        },
        {
            "question": "Archives Sora et alternatives",
            "answer": "Les coûts enregistrés sont historiques. Choisissez un modèle disponible et consultez un nouveau devis avant de générer."
        }
    ]
},
  veo: {
    metaTitle: "Exemples Veo 3.1, prompts et réglages vidéo | MaxVideoAI",
    metaDescription: "Regardez les exemples Veo 3.1 et leurs prompts. Retrouvez les réglages et le coût enregistré, puis partez d’un texte ou d’une image pour votre vidéo.",
    heroTitle: "Exemples Veo 3.1, prompts et réglages vidéo",
    subtitle: "Exemples Veo 3.1 et Gemini Omni Flash 1.1 : prompts, sources et réglages à examiner.",
    intro: "Comparez les exemples Google de Veo 3.1, Fast et Lite avec Gemini Omni Flash 1.1. Ouvrez un résultat pour consulter son prompt et ses réglages, puis adaptez-le dans votre studio.",
    summary: "Veo et Gemini Omni sont des modèles Google distincts réunis dans cette galerie. Le nom affiché sur chaque exemple fait référence. Les pages modèles et les comparatifs vous aident à choisir le parcours adapté ; vérifiez ensuite le devis actuel avant de générer.",
    promptPatterns: "Décrivez d’abord le sujet, l’action et le mouvement de caméra. Avec une image de départ, précisez ce qui bouge et ce qui reste. Gardez le même brief pour comparer les modèles et ne changez qu’une instruction à la fois.",
    strengthsLimits: "Comparez le mouvement, le cadrage et la continuité du sujet sur tout le clip. Veo et Omni ne partagent pas toutes les sources ni toutes les options de montage : vérifiez le modèle et le mode avant d’ajouter des images, références ou vidéos. Un exemple réussi ne garantit pas le même résultat avec un nouveau prompt.",
    pricingNotes: "La fiche de l’exemple affiche le coût enregistré du rendu. Votre prochaine génération utilise le devis actuel selon le modèle, les sources, la durée et la résolution. Reprenez les réglages disponibles, ajoutez vos propres sources si nécessaire et vérifiez le devis avant l’envoi.",
    faq: [
      {
        question: "Pourquoi des exemples Gemini Omni figurent-ils dans cette galerie Veo ?",
        answer: "Cette galerie regroupe les exemples vidéo de Google, dont Veo et Gemini Omni. Ils restent des modèles distincts : consultez le nom indiqué sur l’exemple et le comparatif Omni versus Veo pour choisir le parcours adapté.",
      },
      {
        question: "Comment recréer un exemple Veo ou Omni ?",
        answer: "Ouvrez sa fiche pour consulter le prompt, les réglages et le coût enregistré, puis utilisez l’action de recréation. Vérifiez le modèle sélectionné, ajoutez les médias sources nécessaires et consultez le nouveau devis dans le studio avant de générer.",
      },
      {
        question: "Comment comparer Veo 3.1, Fast, Lite et Omni ?",
        answer: "Gardez le même sujet et la même intention, puis comparez le résultat complet et le devis actuel. Précisez le mode d’entrée : les commandes de référence et de montage varient selon le modèle, donc les réglages ne se transfèrent pas tous à l’identique.",
      },
    ],
  },
  luma: {
    metaTitle: 'Exemples Luma Ray 3.2 Modify et Reframe | MaxVideoAI',
    metaDescription: "Découvrez les exemples vidéo Luma Ray 3.2 Modify et Reframe, leurs prompts et réglages. Modifiez votre vidéo et consultez le prix avant de générer.",
    subtitle: "Modifiez une scène avec Modify ou adaptez son cadrage avec Reframe : les exemples vidéo Luma Ray 3.2.",
    intro: "Explorez les exemples Luma Ray 3.2 Modify et Reframe. Ouvrez une vidéo pour voir le prompt et les réglages utilisés. Les exemples Ray 2 et Ray 2 Flash conservent le nom de leur modèle d’origine.",
    promptPatterns: "Pour Modify, précisez ce qui doit rester de la vidéo source, puis le changement souhaité. Pour Reframe, indiquez le sujet à garder visible et ce qui doit remplir le nouveau cadre. Les images guides et images clés dépendent du mode choisi.",
    strengthsLimits: "Évaluez la fidélité à la vidéo source, le respect de la modification demandée et la continuité du sujet. Ray 3.2 ne génère pas d’audio dans MaxVideoAI. Les sources et réglages acceptés diffèrent de Ray 2 et Ray 2 Flash : vérifiez le modèle de chaque exemple.",
    pricingNotes: "La fiche indique le coût enregistré de l’exemple. Votre nouvelle vidéo fait l’objet d’un devis selon le mode et les réglages choisis. Consultez ce prix avant de générer et commencez par un essai court avant de réaliser une modification plus longue.",
    faq: [
      {
        question: "Comment reprendre une modification vidéo Luma ?",
        answer: "Ouvrez l’exemple pour consulter son prompt et ses réglages, puis adaptez les consignes à votre propre vidéo. Les fichiers sources privés ne sont pas inclus et une nouvelle génération peut donner un résultat différent.",
      },
      {
        question: "Ray 3.2 génère-t-il de l’audio ?",
        answer: "Non. Les exemples Ray 3.2 sont des vidéos sans son. Ajoutez séparément une voix, de la musique ou des effets sonores.",
      },
      {
        question: "Faut-il utiliser Modify ou Reframe ?",
        answer: "Modify sert à modifier le contenu visuel d’une vidéo source. Reframe permet d’en adapter le cadrage. Consultez la fiche du modèle pour les sources et réglages acceptés dans chaque mode.",
      },
    ],
  },
  wan: {
    subtitle: "Des exemples vidéo Wan avec leurs prompts, leurs réglages et le modèle utilisé.",
    intro: "Regardez les exemples Wan pour comparer le mouvement, le cadrage et la continuité des scènes. Ouvrez une vidéo pour retrouver son prompt, ses réglages et son coût enregistré, puis adaptez-la à votre projet.",
    promptPatterns: "Décrivez un sujet, une action principale et un mouvement de caméra. Si le plan comporte plusieurs étapes, précisez leur ordre et gardez une séquence facile à suivre. Ne changez qu’une consigne à la fois pendant vos essais.",
    strengthsLimits: "Regardez tout le clip pour repérer les changements de sujet, les coupes inattendues et les mouvements qui s’écartent du prompt. Les sources, durées et formats proposés varient selon le modèle Wan et le mode choisi.",
    pricingNotes: "La fiche de l’exemple affiche son coût enregistré. Le modèle, la durée et les autres réglages déterminent un nouveau devis dans le studio. Consultez-le avant de générer et commencez par un essai court pour évaluer le résultat.",
    faq: [
      {
        question: "Puis-je partir d’un exemple Wan pour créer ma vidéo ?",
        answer: "Oui. Consultez son prompt et ses réglages, puis adaptez-les dans le studio. Ajoutez vos propres médias si le mode choisi en demande. Reprendre le même prompt ne garantit pas un résultat identique.",
      },
      {
        question: "Peut-on adapter un exemple Wan au format vertical ?",
        answer: "Vérifiez que le modèle et le mode choisis acceptent le format souhaité. Adaptez le cadrage pour garder le sujet et l’action visibles, puis contrôlez le résultat sur un essai.",
      },
      {
        question: "Changer la durée modifie-t-il le prix avec Wan ?",
        answer: "La durée fait partie des réglages qui peuvent modifier le devis. Choisissez le modèle et les options dont vous avez besoin, puis consultez le prix affiché avant de générer.",
      },
    ],
  },
  kling: {
    metaTitle: 'Exemples vidéo IA Kling, prompts et réglages | MaxVideoAI',
    metaDescription: "Regardez les exemples vidéo Kling 3 et Kling 3.0 Omni : prompts, animation d’images, références, réglages et coûts enregistrés.",
    heroTitle: 'Exemples vidéo IA Kling, prompts et réglages',
    subtitle: "Exemples Kling 3 et Kling 3.0 Omni : voyez comment une image de départ ou des références guident un plan.",
    intro: "Regardez les exemples vidéo Kling, puis ouvrez un résultat pour voir son prompt et ses réglages. Comparez l’animation d’une image avec Kling 3 aux références et modifications vidéo de Kling 3.0 Omni. Chaque exemple indique le modèle utilisé.",
    summary: "Kling 3.0 Omni Pro et Standard acceptent les images de référence, les storyboards et la modification d’une vidéo source. Kling 3 Pro et Standard animent une image de départ. Kling 3.0 Omni 4K propose des rendus 4K natifs guidés par références.",
    promptPatterns: "Décidez si l’image importée doit guider la vidéo comme référence ou en être la première image. Utilisez @Image1 et @Video1 pour identifier les sources dans les modes Omni compatibles. En image-vers-vidéo avec Kling 3, décrivez le mouvement à partir de l’image de départ.",
    strengthsLimits: "Kling 3.0 Omni utilise les références pour guider l’identité, le style, le storyboard ou les modifications vidéo. Une référence ne devient pas forcément la première image. Kling 3 en image-vers-vidéo anime l’image importée. Vérifiez le modèle et le mode avant de reprendre des sources.",
    pricingNotes: "Comparez des durées, formats, options audio et résolutions équivalents dans les modes disponibles. La fiche conserve le coût de l’exemple ; le studio affiche le devis actuel pour le modèle et les réglages choisis. Vérifiez-le avant de générer.",
    faq: [
      {
        question: 'Quelle durée peuvent atteindre les vidéos Kling AI ?',
        answer:
          'Kling 3.0 Omni Standard et Pro prennent en charge des rendus guidés par références jusqu’à 15 secondes en 1080p, avec V2V depuis vidéo source sur Standard et Pro. La route O3 4K sert aux rendus 4K natifs guidés par références, tandis que Kling 3 reste la route image-vers-vidéo avec image de départ.',
      },
      {
        question: 'Combien de temps Kling AI met-il pour générer une vidéo ?',
        answer: "Le temps de génération dépend du modèle, de la durée, des sources, de l’audio, de la résolution et de la demande du moment. Il n’existe pas de délai fixe pour tous les clips. Un essai court permet d’évaluer le résultat et l’attente avec vos réglages.",
      },
      {
        question: 'Quel modèle Kling AI utiliser pour les prompts et les exemples ?',
        answer: "Utilisez Kling 3.0 Omni Standard ou Pro pour guider la vidéo avec des références, un storyboard ou @Video1. Choisissez Kling 3 Standard ou Pro lorsque l’image importée doit être la première image visible.",
      },
      {
        question: 'Comment utiliser Kling AI pour des tests de prompt en image-vers-vidéo ?',
        answer:
          'Pour O3, donnez un rôle clair à chaque référence avec @Image1, @Image2 ou @Video1. Pour Kling 3, partez d’une image source claire, d’une instruction de mouvement et d’un objectif caméra, car l’image doit ouvrir le clip.',
      },
      {
        question: 'Comment adapter des prompts Kling AI entre Kling 3 Pro et Kling 3 Standard ?',
        answer: "Gardez le même sujet, la même action, la même direction de caméra et des réglages équivalents pour comparer Kling 3 Pro et Standard. Examinez les vidéos complètes et les devis actuels. Les deux animent l’image de départ ; Omni est un choix distinct pour les références.",
      },
    ],
  },
  seedance: {
    metaTitle: 'Exemples Seedance 2.5, prompts et réglages | MaxVideoAI',
    metaDescription: "Découvrez les exemples vidéo Seedance 2.5, leurs prompts et réglages. Comparez les versions Seedance et partez d’un exemple pour votre création.",
    heroTitle: 'Exemples vidéo IA Seedance 2.5, prompts et réglages',
    subtitle: "Seedance 2.5 et les versions précédentes : regardez les résultats et trouvez un prompt à adapter.",
    intro: "Explorez les exemples Seedance 2.5 aux côtés de Seedance 2.0, Fast et Mini. Ouvrez une vidéo pour voir son prompt, ses réglages et son coût enregistré. Chaque résultat conserve le nom de son modèle d’origine.",
    summary: "Seedance 2.5 permet de créer des vidéos de 4 à 30 secondes jusqu’en 1080p, avec audio généré, références, édition et prolongation. Seedance 2.0 reste disponible pour la 4K ; Fast et Mini offrent d’autres options pour les essais et les séries de vidéos. Les anciens exemples 1.5 Pro conservent leur nom d’origine.",
    promptPatterns:
      'Pour Seedance 2.5, définissez une action principale, une direction caméra et le rôle de chaque référence avant d’ajouter les détails de scène. Gardez la même structure de prompt quand vous comparez 2.5 avec Seedance 2.0, Fast ou Mini.',
    strengthsLimits:
      'Utilisez Seedance 2.5 quand la durée, l’audio généré, les références mixtes, l’édition ou l’extension comptent. Dans MaxVideoAI, ce modèle prend en charge les sorties paysage, carrées et verticales en 480p, 720p ou 1080p ; gardez Seedance 2.0 lorsque la 4K est requise.',
    pricingNotes: "La durée, l’audio et les médias sources peuvent influencer le prix. La fiche affiche le coût enregistré de l’exemple ; le générateur indique le devis actuel pour vos réglages avant le lancement.",
    faq: [
      {
        question: 'Tous les exemples Seedance de cette page ont-ils été générés avec Seedance 2.5 ?',
        answer:
          'Non. La galerie conserve les libellés exacts des rendus Seedance 2.5, Seedance 2.0, Fast, Mini et 1.5 Pro encore pris en charge afin que vous puissiez comparer le modèle réellement utilisé.',
      },
      {
        question: 'Par quel modèle Seedance commencer pour les exemples et les tests de prompt ?',
        answer:
          'Commencez par Seedance 2.5 pour la création vidéo jusqu’en 1080p. Utilisez Seedance 2.0 pour les besoins de 4K, Fast pour des brouillons plus rapides et Mini pour des variantes répétables en lot.',
      },
      {
        question: 'Quels réglages influencent le plus le prix d’une vidéo Seedance ?',
        answer:
          'La durée, l’audio généré et l’utilisation d’une vidéo source influencent le plus le prix. Gardez ces réglages alignés quand vous comparez les modèles.',
      },
    ],
  },
  ltx: {
    metaTitle: "Exemples vidéo LTX, prompts et réglages | MaxVideoAI",
    metaDescription: "Découvrez les exemples vidéo LTX 2.5 Pro et Fast, leurs prompts et réglages. Comparez aussi les résultats LTX 2.3 et LTX 2, identifiés par modèle.",
    heroTitle: "Exemples vidéo LTX, prompts et réglages",
    subtitle: "Des exemples LTX 2.5 Pro et Fast, avec les versions précédentes clairement identifiées.",
    intro: "Regardez les exemples LTX 2.5 Pro et Fast, puis ouvrez une vidéo pour retrouver son prompt, ses réglages et son coût enregistré. Les résultats LTX 2.3 et LTX 2 conservent le nom de leur modèle d’origine.",
    summary:
      "LTX 2.5 Pro et Fast occupent le premier plan. Les exemples LTX 2.3 et LTX 2 conservent leur modèle d’origine pour comparer les générations sans confondre leurs capacités.",
    promptPatterns: "Décrivez le sujet, l’action, le mouvement de caméra et le style visuel. En image-vers-vidéo, expliquez comment la scène doit s’animer depuis l’image de départ. Gardez ce point de départ et ne changez qu’une consigne à la fois.",
    strengthsLimits: "Comparez tout le clip entre Pro et Fast : le mouvement suit-il le prompt et le sujet reste-t-il cohérent ? Utilisez la même image pour vos essais image-vers-vidéo. Un exemple réussi est un point de départ, pas la garantie d’un résultat identique.",
    pricingNotes: "Précisez le modèle, le mode, la durée, la résolution et les options audio disponibles pour comparer les coûts. La fiche conserve le coût enregistré de l’exemple ; consultez le devis actuel dans le studio avant de générer votre version.",
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
        question: 'Quels réglages comptent le plus pour les résultats LTX 2.5 ?',
        answer:
          'Les réglages les plus importants sont la durée, le ratio, l’image source pour l’image-vers-vidéo et le niveau de complexité de mouvement demandé. Les garder stables rend les tests beaucoup plus lisibles.',
      },
      {
        question: 'Comment faut-il prompter LTX 2.5 en image-vers-vidéo ?',
        answer:
          'Partez d’une image de départ bien définie, puis ajoutez une instruction de mouvement, un mouvement caméra et un objectif de sortie. LTX 2.5 fonctionne mieux quand le prompt prolonge l’image d’origine au lieu de tenter de la remplacer par une scène totalement différente.',
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
    subtitle: "Exemples vidéo MiniMax H3 Max, H3 et anciens Hailuo, avec leurs prompts et réglages.",
    intro: "Regardez MiniMax H3 Max et H3 aux côtés des anciens exemples Hailuo. Ouvrez une vidéo pour voir son prompt, ses réglages et son coût enregistré, puis partez de cet exemple pour créer votre scène.",
    summary: "Chaque exemple MiniMax ou Hailuo garde le nom du modèle qui l’a généré. Comparez le mouvement, la continuité et l’éventuel audio sur tout le clip. Les fiches H3 et H3 Max détaillent les sources et réglages disponibles pour votre projet.",
    promptPatterns: "Commencez par le sujet, une action claire et la direction de caméra. Ajoutez les indications de scène ou de son pertinentes pour le modèle choisi. Pour les références, donnez un rôle précis à chaque source autorisée et vérifiez que le modèle accepte ce type d’entrée.",
    strengthsLimits: "Évaluez le résultat complet : identité du sujet, mouvement, cadrage et éventuel audio généré. H3 Max, H3 et les anciens Hailuo ont des modes et des choix de sortie différents. Un exemple montre un résultat, sans établir une cohérence parfaite ni des commandes identiques pour toute la famille.",
    pricingNotes: "Comparez H3 et H3 Max avec le même brief et le même objectif de sortie. La fiche conserve le coût de l’exemple ; le studio fournit le devis actuel pour votre prochain rendu. Validez un plan court, puis développez les versions qui répondent à vos critères visuels.",
    faq: [
      {
        question: "Pourquoi MiniMax H3 et H3 Max figurent-ils dans la galerie Hailuo ?",
        answer: "Cette galerie réunit les modèles vidéo MiniMax, dont H3, H3 Max et les versions Hailuo précédentes. Chaque vidéo indique le modèle utilisé. Les anciens exemples ne décrivent pas les capacités de H3 ou H3 Max.",
      },
      {
        question: "Comment choisir entre MiniMax H3 et H3 Max ?",
        answer: "Ouvrez le comparatif H3 versus H3 Max et leurs pages modèles. Comparez les sources acceptées, les résolutions proposées et le devis actuel avec votre résultat visé, puis examinez les exemples du modèle exact que vous comptez utiliser.",
      },
      {
        question: "Puis-je reprendre un exemple MiniMax dans mon studio ?",
        answer: "Ouvrez sa fiche, examinez le prompt et les réglages enregistrés, puis utilisez l’action de recréation. Ajoutez vos propres médias nécessaires et vérifiez le devis actuel avant de générer ; un exemple public ne donne pas accès aux fichiers sources privés.",
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
