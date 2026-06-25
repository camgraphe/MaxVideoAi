import type { ComparePageOverridesBySlug } from './compare-page-overrides-types';

export const FR_COMPARE_PAGE_OVERRIDES = {
    'seedance-1-5-pro-vs-seedance-2-0': {
      meta: {
        title: 'Seedance 1.5 Pro vs Seedance 2.0 | Ce qui change, quand passer a 2.0 et meilleurs cas d usage | MaxVideoAI',
        description:
          'Comparez Seedance 1.5 Pro et Seedance 2.0 sur MaxVideoAI pour voir ce qui change sur l audio, la continuite multi-shot, les references, le prix, et quand passer a 2.0.',
      },
      heroIntro:
        'Comparez Seedance 1.5 Pro et Seedance 2.0 pour voir ce qui change entre l ancien workflow Seedance Pro et le modele video IA Seedance actuel sur l audio natif, la continuite multi-shot et les workflows a references. Utilisez cette page pour comprendre rapidement les compromis avant d ouvrir le modele Seedance actuel, la page d exemples video IA Seedance, ou le workflow video Seedance le plus adapte a votre usage.',
      topCards: [
        {
          title: 'Ce qui change',
          body:
            'Seedance 2.0 est le workflow video IA Seedance le plus recent, avec une meilleure continuite multi-shot, des entrees de reference plus larges, et une approche audio-first plus actuelle que Seedance 1.5 Pro.',
        },
        {
          title: 'Quand rester sur Seedance 1.5 Pro',
          body:
            'Restez sur Seedance 1.5 Pro si vous avez surtout besoin de clips courts et repetables, de setups camera plus simples, et d un workflow plus ancien deja valide en production.',
        },
        {
          title: 'Quand passer a Seedance 2.0',
          body:
            'Passez a Seedance 2.0 si vous avez besoin d une meilleure continuite entre plans, de workflows audio natifs plus riches, ou d un modele actuel plus flexible pour un travail creatif a plus forte valeur.',
        },
        {
          title: 'Meilleurs cas d usage',
          body:
            'Cette page sert a choisir entre un workflow Seedance plus ancien mais encore supporte pour des clips courts et controles, et le workflow Seedance 2.0 actuel pour des pubs multi-shot, des lancements, et des sequences plus ambitieuses guidees par references.',
        },
      ],
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Ouvrir la page modele Seedance 2.0',
        },
        {
          href: '/examples/seedance',
          label: 'Voir les exemples video IA Seedance',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Ouvrir la page modele Seedance 2.0 Fast',
        },
        {
          href: '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
          label: 'Comparer Seedance 2.0 vs Seedance 2.0 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses rapides pour decider s il faut rester sur Seedance 1.5 Pro ou passer a Seedance 2.0.',
        items: [
          {
            question: 'Qu est-ce qui change entre Seedance 1.5 Pro et Seedance 2.0 ?',
            answer:
              'Seedance 2.0 est le modele le plus recent, avec une meilleure continuite multi-shot, des workflows de reference plus larges, et le chemin Seedance actuel pour la production. Seedance 1.5 Pro reste utile pour des clips plus courts, plus simples et repetables.',
          },
          {
            question: 'Seedance 2.0 est-il meilleur que Seedance 1.5 Pro ?',
            answer:
              'Pour la plupart des workflows actuels, oui. Seedance 2.0 est le meilleur choix par defaut si vous cherchez le modele video IA Seedance actuel pour plus de continuite, plus de flexibilite et un usage de production plus large, tandis que Seedance 1.5 Pro reste utile comme setup Seedance Pro plus ancien pour des clips courts.',
          },
          {
            question: 'Quand faut-il passer de Seedance 1.5 Pro a Seedance 2.0 ?',
            answer:
              'Passez a 2.0 si vous avez besoin d un meilleur comportement multi-shot, de workflows audio natifs plus riches, ou de plus de marge pour des productions actuelles basees sur prompts et references. Si votre workflow 1.5 Pro est deja stable sur des clips courts, vous n avez pas besoin de migrer tous les jobs tout de suite.',
          },
          {
            question: 'Seedance 1.5 Pro est-il encore suffisant pour certains workflows ?',
            answer:
              'Oui. Il reste adapte a des clips cinematographiques courts et repetables, ainsi qu aux equipes qui ont deja des prompts valides sur 1.5 Pro et n ont pas encore besoin du workflow 2.0 plus large.',
          },
          {
            question: 'Quel modele est le meilleur pour le multi-shot et l audio natif ?',
            answer:
              'Seedance 2.0 est le meilleur choix pour la continuite multi-shot et pour le workflow audio natif le plus actuel. Seedance 1.5 Pro doit plutot etre traite comme une option plus simple et plus ancienne pour des clips courts.',
          },
        ],
      },
    },
    'seedance-2-0-vs-seedance-2-0-fast': {
      heroIntro:
        'Comparez Seedance 2.0 et Seedance 2.0 Fast pour choisir le bon workflow video IA Seedance actuel selon votre besoin de rendu multi-shot final, d audio natif et de comparaison de workflow. Utilisez cette page pour voir quand le Seedance standard convient mieux a une sortie video Seedance soignee et quand Fast convient mieux aux tests, aux checks de timing et a l iteration moins couteuse.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Ouvrir la page modele Seedance 2.0',
        },
        {
          href: '/examples/seedance',
          label: 'Voir les exemples video IA Seedance',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Ouvrir la page modele Seedance 2.0 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir le bon workflow Seedance actuel.',
        items: [
          {
            question: 'Quel modele video IA Seedance faut-il utiliser pour le travail de draft ?',
            answer:
              'Utilisez Seedance 2.0 Fast pour des tests moins couteux, des tests plus rapides et des comparaisons de workflow. Utilisez Seedance 2.0 quand vous voulez une sortie multi-shot plus aboutie, l audio natif et un workflow plus pret pour la production.',
          },
          {
            question: 'Quelle difference entre Seedance 2.0 et Seedance 2.0 Fast ?',
            answer:
              'Seedance 2.0 est le choix actuel le plus solide pour un rendu multi-shot soigne, l audio natif et des sorties a references plus exigeantes, tandis que Seedance 2.0 Fast convient mieux aux tests moins couteux, aux checks de timing et a l iteration initiale.',
          },
          {
            question: 'Seedance 2.0 est-il meilleur pour une sortie video Seedance soignee ?',
            answer:
              'Oui. Seedance 2.0 convient mieux quand l objectif est une sortie video Seedance soignee, tandis que Fast convient mieux quand l objectif est de tester des idees et de comparer rapidement des workflows.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-seedance-2-0': {
      heroIntro:
        'Utilisez Seedance 2.0 pour la qualite finale flagship, le rendu Seedance le plus soigne, la livraison en plus haute resolution et les hero shots. Utilisez Seedance 2.0 Mini comme l option moins couteuse quand le cout, le volume batch, les variantes 480p/720p, les tests ecommerce, les hooks UGC et les experiences marketing frequentes comptent davantage. Cette page est une comparaison scorecard/specs pour l instant; les videos comparatives Mini ne sont pas encore incluses.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Ouvrir la page modele Seedance 2.0',
        },
        {
          href: '/models/dreamina-seedance-2-0-mini',
          label: 'Ouvrir la page modele Seedance 2.0 Mini',
        },
        {
          href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-seedance-2-0-fast',
          label: 'Comparer Fast vs Mini',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre Seedance 2.0 flagship et la route Mini moins couteuse.',
        items: [
          {
            question: 'Quand choisir Seedance 2.0 Mini ?',
            answer:
              'Choisissez Mini pour les batches moins couteux, les variantes ecommerce, les tests de hooks UGC, les passes A/B marketing et l exploration de prompts a volume quand 480p ou 720p suffit.',
          },
          {
            question: 'Quand Seedance 2.0 reste-t-il le meilleur choix ?',
            answer:
              'Choisissez Seedance 2.0 pour les hero shots finaux, la meilleure finition visuelle, la livraison en plus haute resolution et les sorties ou la qualite Seedance prime sur le cout par variante.',
          },
          {
            question: 'Pourquoi cette page Mini n a-t-elle pas de videos comparatives ?',
            answer:
              'Les pages Mini utilisent pour l instant scorecards, specs et recommandations. Les videos cote-a-cote Mini viendront apres selection de sorties dediees.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-seedance-2-0-fast': {
      heroIntro:
        'Utilisez Seedance 2.0 Fast quand la priorite est la vitesse de draft Seedance, les checks de timing et un passage rapide vers le modele flagship. Utilisez Seedance 2.0 Mini comme l option de volume batch moins couteux pour variantes ecommerce ou social, edits video, extensions et tests marketing repetes. Cette page est une comparaison scorecard/specs pour l instant, sans videos comparatives Mini.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/seedance-2-0-fast',
          label: 'Ouvrir la page modele Seedance 2.0 Fast',
        },
        {
          href: '/models/dreamina-seedance-2-0-mini',
          label: 'Ouvrir la page modele Seedance 2.0 Mini',
        },
        {
          href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-seedance-2-0',
          label: 'Comparer Seedance 2.0 vs Mini',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre Fast oriente vitesse de draft et Mini oriente valeur batch.',
        items: [
          {
            question: 'Mini remplace-t-il Seedance 2.0 Fast ?',
            answer:
              'Non. Fast reste le choix Seedance pour la vitesse de draft. Mini est la route valeur et batch pour des variantes moins couteuses a haute frequence, surtout quand 480p/720p suffit.',
          },
          {
            question: 'Lequel choisir pour des variantes marketing ?',
            answer:
              'Mini est positionne pour de nombreuses variantes ecommerce, UGC et paid social moins couteuses. Fast convient mieux quand le timing de draft Seedance et le retour vers Seedance 2.0 comptent davantage.',
          },
          {
            question: 'Cette page inclut-elle des videos cote-a-cote ?',
            answer:
              'Pas encore. Cette comparaison Mini utilise actuellement seulement scorecards, specs et aide a la decision, donc elle ne demande et n affiche aucun slot video comparatif.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-ltx-2-3-fast': {
      heroIntro:
        'Utilisez LTX 2.3 Fast pour l exploration LTX rapide, plus de marge sur la resolution et des drafts creatifs legers. Utilisez Seedance 2.0 Mini comme l option Dreamina Seedance moins couteuse en batches 480p/720p, variantes ecommerce, hooks UGC, edition video et tests d extension. Cette page est scorecard/specs pour l instant; les videos comparatives Mini ne sont pas affichees.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/ltx-2-3-fast',
          label: 'Ouvrir la page modele LTX 2.3 Fast',
        },
        {
          href: '/models/dreamina-seedance-2-0-mini',
          label: 'Ouvrir la page modele Seedance 2.0 Mini',
        },
        {
          href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-seedance-2-0-fast',
          label: 'Comparer Seedance Fast vs Mini',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre drafts LTX rapides et valeur batch Seedance Mini.',
        items: [
          {
            question: 'Quand choisir LTX 2.3 Fast ?',
            answer:
              'Choisissez LTX 2.3 Fast pour l exploration visuelle rapide, les tests de prompt LTX et les workflows ou sa resolution et son comportement de draft correspondent mieux au brief.',
          },
          {
            question: 'Quand choisir Seedance 2.0 Mini ?',
            answer:
              'Choisissez Mini pour les batches Seedance moins couteux, les variantes produit, les tests social, les hooks UGC, les edits video et les extensions quand 480p/720p suffit.',
          },
          {
            question: 'Pourquoi cette comparaison est-elle scorecard-only ?',
            answer:
              'Les pages Mini utilisent d abord scorecards, specs et recommandations. Les videos cote-a-cote seront ajoutees plus tard apres selection de sorties Mini dediees.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-veo-3-1-fast': {
      heroIntro:
        'Utilisez Seedance 2.0 Mini comme l option batch 480p/720p moins couteuse pour variantes ecommerce, hooks UGC, edits video et experiences marketing frequentes. Utilisez Veo 3.1 Fast quand la qualite Veo, les workflows avec audio, une resolution de livraison plus elevee et une meilleure finition de draft comptent plus que le cout batch. Cette page Mini est scorecard/specs pour l instant et n inclut pas de videos comparatives.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/dreamina-seedance-2-0-mini',
          label: 'Ouvrir la page modele Seedance 2.0 Mini',
        },
        {
          href: '/models/veo-3-1-fast',
          label: 'Ouvrir la page modele Veo 3.1 Fast',
        },
        {
          href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-seedance-2-0',
          label: 'Comparer Seedance 2.0 vs Mini',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre valeur Seedance Mini et flexibilite de production Veo 3.1 Fast.',
        items: [
          {
            question: 'Quand choisir Seedance 2.0 Mini plutot que Veo 3.1 Fast ?',
            answer:
              'Choisissez Mini si l objectif principal est la production batch moins couteuse: nombreuses variantes ecommerce, hooks UGC, tests marketing, edits video ou extensions en 480p/720p.',
          },
          {
            question: 'Quand Veo 3.1 Fast est-il plus adapte ?',
            answer:
              'Choisissez Veo 3.1 Fast si vous avez besoin de qualite Veo, de sortie avec audio, d une meilleure finition de draft ou d une resolution plus elevee plutot que du volume le moins cher.',
          },
          {
            question: 'Les videos comparatives Mini sont-elles disponibles ici ?',
            answer:
              'Non. Cette page utilise volontairement scorecards, specs et copy uniquement jusqu a ce que des videos Mini cote-a-cote soient pretes.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-luma-ray-3-2': {
      heroIntro:
        'Utilisez Seedance 2.0 Mini quand le job demande des batches Dreamina Seedance moins couteux, des variantes ecommerce, des hooks social, de l extension video, des edits depuis source video et des tests avec audio natif en 480p ou 720p. Utilisez Luma Ray 3.2 quand le job depend du mouvement cinematographique Luma, de Modify Video, Reframe, preservation de source video, guide frames et controle visuel 1080p sans audio natif. Cette comparaison Mini est scorecard-only pour l instant: elle se concentre sur specs, positionnement et aide a la decision plutot que sur des videos cote-a-cote.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/dreamina-seedance-2-0-mini',
          label: 'Ouvrir la page modele Seedance 2.0 Mini',
        },
        {
          href: '/models/luma-ray-3-2',
          label: 'Ouvrir la page modele Luma Ray 3.2',
        },
        {
          href: '/ai-video-engines/luma-ray-3-2-vs-seedance-2-0',
          label: 'Comparer Luma Ray 3.2 vs Seedance 2.0',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre valeur batch Seedance Mini et workflows de controle video Luma Ray 3.2.',
        items: [
          {
            question: 'Quand choisir Seedance 2.0 Mini ?',
            answer:
              'Choisissez Mini pour des variantes batch moins couteuses, hooks UGC, tests produit, extension video, edits de source video et experiences avec audio natif quand 480p ou 720p suffit.',
          },
          {
            question: 'Quand Luma Ray 3.2 est-il plus adapte ?',
            answer:
              'Choisissez Luma Ray 3.2 pour Modify Video, Reframe, guide frames, preservation de source video, mouvement cinematographique et tests visuels 1080p quand l audio natif n est pas necessaire.',
          },
          {
            question: 'Pourquoi cette page est-elle scorecard-only ?',
            answer:
              'Les pages Mini restent scorecard-only jusqu a selection de renders Mini cote-a-cote, donc cette page priorise specs, positionnement workflow et compromis de cout.',
          },
        ],
      },
    },
    'luma-ray-3-2-vs-veo-3-1-fast': {
      heroIntro:
        'Utilisez Luma Ray 3.2 quand le probleme creatif porte sur le controle de source video: Modify Video, Reframe, guide frames, preservation du mouvement cinematographique et iteration visuelle 1080p sans audio natif. Utilisez Veo 3.1 Fast quand le brief demande un draft plus rapide au rendu Veo, des options d audio natif, plus de marge de livraison et une finition short-form premium avant production finale. Cette comparaison aide a decider si la prochaine passe doit editer ou reframer un mouvement existant, ou generer un draft Veo plus soigne et audio-ready.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/luma-ray-3-2',
          label: 'Ouvrir la page modele Luma Ray 3.2',
        },
        {
          href: '/models/veo-3-1-fast',
          label: 'Ouvrir la page modele Veo 3.1 Fast',
        },
        {
          href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-luma-ray-3-2',
          label: 'Comparer Seedance Mini vs Luma Ray 3.2',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre controle video Luma et drafts de production Veo rapides.',
        items: [
          {
            question: 'Quand choisir Luma Ray 3.2 plutot que Veo 3.1 Fast ?',
            answer:
              'Choisissez Luma Ray 3.2 quand l edition de source video, le reframe, les guide frames et la preservation ou redirection d un mouvement existant comptent plus que l audio natif.',
          },
          {
            question: 'Quand Veo 3.1 Fast est-il meilleur ?',
            answer:
              'Choisissez Veo 3.1 Fast quand il faut un draft visuel premium plus rapide, des options d audio natif, une finition plus solide ou plus de marge de livraison que Luma Ray 3.2.',
          },
          {
            question: 'Lequel convient mieux aux tests produit ou pub ?',
            answer:
              'Luma Ray 3.2 est plus fort si vous avez deja une source video a modifier ou reframer. Veo 3.1 Fast est plus fort pour de nouveaux drafts cinematographiques, concepts publicitaires audio-ready et tests courts tres soignes.',
          },
        ],
      },
    },
    'happy-horse-1-1-vs-kling-o3-pro': {
      heroIntro:
        'Utilisez Happy Horse 1.1 quand le brief tourne autour de l audio natif, du dialogue, du lip-sync multilingue, des personnages de reference et de workflows texte, image ou reference-to-video. Utilisez Kling O3 Pro quand le projet demande plus de controle omni, de transformation depuis une video source, de references visuelles et de continuite style Kling. Cette comparaison aide a choisir entre un workflow acteur audio-first et une route de production plus lourde basee sur references et video-to-video.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/happy-horse-1-1',
          label: 'Ouvrir la page modele Happy Horse 1.1',
        },
        {
          href: '/models/kling-o3-pro',
          label: 'Ouvrir la page modele Kling O3 Pro',
        },
        {
          href: '/ai-video-engines/happy-horse-1-1-vs-kling-3-pro',
          label: 'Comparer Happy Horse vs Kling 3 Pro',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre generation Alibaba avec audio natif et controle de production Kling omni.',
        items: [
          {
            question: 'Quand choisir Happy Horse 1.1 plutot que Kling O3 Pro ?',
            answer:
              'Choisissez Happy Horse 1.1 pour des personnages qui parlent, l audio synchronise natif, les tests de lip-sync et les references image quand l acteur et la voix sont le centre du rendu.',
          },
          {
            question: 'Quand Kling O3 Pro est-il le meilleur choix ?',
            answer:
              'Choisissez Kling O3 Pro quand vous avez besoin de plus de controle sur source video, references ou transformation, et que le projet depend moins du dialogue natif.',
          },
          {
            question: 'Les deux conviennent-ils aux videos avec references ?',
            answer:
              'Oui, mais pas avec le meme angle. Happy Horse 1.1 met l accent sur les images de reference et les personnages avec audio, tandis que Kling O3 Pro est plus adapte au controle omni et video-to-video.',
          },
        ],
      },
    },
    'happy-horse-1-1-vs-veo-3-1-fast': {
      heroIntro:
        'Utilisez Happy Horse 1.1 quand le clip a besoin d audio natif, de dialogue, de lip-sync et de personnages de reference controlables pour des scenes social ou UGC. Utilisez Veo 3.1 Fast quand vous voulez le rendu Veo, des cycles de draft plus rapides, plus de marge de resolution et des concepts courts plus soignes avant un workflow Veo final. Cette page separe une generation acteur audio-first d une route de draft visuelle premium plus rapide.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/happy-horse-1-1',
          label: 'Ouvrir la page modele Happy Horse 1.1',
        },
        {
          href: '/models/veo-3-1-fast',
          label: 'Ouvrir la page modele Veo 3.1 Fast',
        },
        {
          href: '/ai-video-engines/happy-horse-1-1-vs-veo-3-1',
          label: 'Comparer Happy Horse vs Veo 3.1',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre travail personnage avec audio natif et drafts Veo rapides.',
        items: [
          {
            question: 'Quand Happy Horse 1.1 est-il meilleur que Veo 3.1 Fast ?',
            answer:
              'Choisissez Happy Horse 1.1 quand la performance parlee, l audio synchronise, le lip-sync et les personnages de reference comptent plus que la finition visuelle Veo.',
          },
          {
            question: 'Quand utiliser Veo 3.1 Fast a la place ?',
            answer:
              'Utilisez Veo 3.1 Fast pour des drafts rapides et soignes, des concepts cinematographiques et des workflows ou la qualite visuelle Veo et la resolution priment sur le lip-sync.',
          },
          {
            question: 'Lequel est le plus adapte aux pubs UGC ?',
            answer:
              'Happy Horse 1.1 est plus fort quand la pub UGC repose sur un sujet qui parle. Veo 3.1 Fast est plus fort pour les visuels produit premium, la finition de scene ou un draft Veo rapide.',
          },
        ],
      },
    },
    'happy-horse-1-1-vs-seedance-2-0-fast': {
      heroIntro:
        'Utilisez Happy Horse 1.1 quand le job depend de personnages parlants, d audio synchronise natif, de lip-sync et de references reutilisables. Utilisez Seedance 2.0 Fast quand vous avez besoin de drafts Seedance moins couteux, de checks de timing, d exploration de prompts et d un pont rapide vers Seedance 2.0. Cette comparaison aide a decider si le prochain test doit valider la performance et le dialogue ou simplement iterer plus vite la direction visuelle.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/happy-horse-1-1',
          label: 'Ouvrir la page modele Happy Horse 1.1',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Ouvrir la page modele Seedance 2.0 Fast',
        },
        {
          href: '/ai-video-engines/happy-horse-1-1-vs-seedance-2-0',
          label: 'Comparer Happy Horse vs Seedance 2.0',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre runs Happy Horse audio-first et iteration Seedance rapide.',
        items: [
          {
            question: 'Quand choisir Happy Horse 1.1 ?',
            answer:
              'Choisissez Happy Horse 1.1 quand le test demande audio natif, lip-sync, sujets parlants ou personnages de reference qui portent la scene.',
          },
          {
            question: 'Quand choisir Seedance 2.0 Fast ?',
            answer:
              'Choisissez Seedance 2.0 Fast pour des tests de prompts Seedance moins couteux, du timing de draft, des storyboards et une iteration rapide avant Seedance 2.0.',
          },
          {
            question: 'Lequel convient mieux au batch testing ?',
            answer:
              'Seedance 2.0 Fast est souvent plus adapte a beaucoup d iterations visuelles. Happy Horse 1.1 est meilleur quand chaque variante doit tester audio, dialogue ou reference personnage.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-happy-horse-1-1': {
      heroIntro:
        'Utilisez Seedance 2.0 Mini quand vous cherchez une route Dreamina Seedance moins couteuse pour batches ecommerce, variantes social, edits video, tests d extension et production frequente en 480p ou 720p. Utilisez Happy Horse 1.1 quand la scene depend d audio synchronise natif, de dialogue, de lip-sync et d un meilleur comportement de personnages parlants. Cette comparaison Mini est scorecard-only pour l instant: elle se concentre sur specs, positionnement et aide a la decision plutot que sur des videos cote-a-cote.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/dreamina-seedance-2-0-mini',
          label: 'Ouvrir la page modele Seedance 2.0 Mini',
        },
        {
          href: '/models/happy-horse-1-1',
          label: 'Ouvrir la page modele Happy Horse 1.1',
        },
        {
          href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-seedance-2-0-fast',
          label: 'Comparer Seedance Fast vs Mini',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre valeur batch Seedance Mini et sortie Happy Horse avec audio natif.',
        items: [
          {
            question: 'Quand choisir Seedance 2.0 Mini ?',
            answer:
              'Choisissez Mini pour la production batch moins couteuse, variantes ecommerce, tests de hooks UGC, edits video, extensions et experiences a haute frequence quand 480p ou 720p suffit.',
          },
          {
            question: 'Quand Happy Horse 1.1 est-il plus adapte ?',
            answer:
              'Choisissez Happy Horse 1.1 quand l audio natif, le lip-sync multilingue, les personnages parlants et les sujets de reference comptent plus que le cout par variante le plus bas.',
          },
          {
            question: 'Pourquoi cette page Mini est-elle scorecard-only ?',
            answer:
              'Les pages Mini utilisent scorecards, specs et copy de decision jusqu a ce que des renders Mini cote-a-cote soient prets, donc cette page n affiche pas encore de videos comparatives.',
          },
        ],
      },
    },
    'happy-horse-1-1-vs-ltx-2-3-pro': {
      heroIntro:
        'Utilisez Happy Horse 1.1 quand l histoire depend d audio natif, de lip-sync, de dialogue et de personnages de reference dans des scenes marketing ou UGC courtes. Utilisez LTX 2.3 Pro quand le projet demande des clips plus longs, une livraison en plus haute resolution, de la marge 4K, des workflows d extension ou de retake et plus de finition production. Cette comparaison separe un modele acteur audio-first d un modele de production et edition plus flexible.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/happy-horse-1-1',
          label: 'Ouvrir la page modele Happy Horse 1.1',
        },
        {
          href: '/models/ltx-2-3-pro',
          label: 'Ouvrir la page modele LTX 2.3 Pro',
        },
        {
          href: '/ai-video-engines/ltx-2-3-pro-vs-seedance-2-0',
          label: 'Comparer LTX 2.3 Pro vs Seedance 2.0',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre sortie personnage avec audio natif et controles de production LTX.',
        items: [
          {
            question: 'Quand choisir Happy Horse 1.1 ?',
            answer:
              'Choisissez Happy Horse 1.1 pour l audio natif, le lip-sync, les scenes de dialogue courtes et les personnages de reference quand la performance est le signal principal.',
          },
          {
            question: 'Quand choisir LTX 2.3 Pro ?',
            answer:
              'Choisissez LTX 2.3 Pro pour des clips plus longs, une livraison orientee 4K, des workflows extension ou retake et une finition production ou le controle visuel prime sur le lip-sync.',
          },
          {
            question: 'Quel modele est meilleur pour des pubs produit ?',
            answer:
              'Happy Horse 1.1 est meilleur pour des pubs spokesperson ou UGC avec dialogue. LTX 2.3 Pro est meilleur pour un mouvement produit soigne, une finition haute resolution et une production plus editee.',
          },
        ],
      },
    },
    'veo-3-1-vs-veo-3-1-fast': {
      heroIntro:
        'Comparez Veo 3.1 et Veo 3.1 Fast pour choisir le bon workflow video IA Veo 3 actuel selon votre besoin de texte-to-video soigne, d image-to-video, de tests plus rapides et de controle sur l audio natif.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir le bon workflow Veo actuel.',
        items: [
          {
            question: 'Comment utiliser Veo 3 pour le texte-to-video et les tests ?',
            answer:
              'Utilisez Veo 3.1 Fast pour des tests moins chers, la comparaison de prompts texte-to-video et une iteration plus rapide. Utilisez Veo 3.1 quand vous voulez une sortie finale plus solide, un meilleur controle guide par references et des resultats image-to-video plus soignes.',
          },
          {
            question: 'Peut-on utiliser Veo 3.1 et Veo 3.1 Fast pour l image-to-video ?',
            answer:
              'Oui. Les deux peuvent gerer des workflows image-to-video, mais Veo 3.1 convient mieux a des resultats plus aboutis, tandis que Veo 3.1 Fast convient mieux a des tests de prompt et de cadrage moins chers.',
          },
          {
            question: 'Quand faut-il choisir Veo 3.1 plutot que Veo 3.1 Fast ?',
            answer:
              'Choisissez Veo 3.1 quand la qualite finale, la finition sur l audio natif et un meilleur controle guide par references comptent plus que la vitesse de draft. Choisissez Fast quand l objectif est une iteration moins chere et une validation de workflow plus rapide.',
          },
        ],
      },
    },
    'veo-3-1-fast-vs-veo-3-1-lite': {
      heroIntro:
        'Comparez Veo 3.1 Fast et Veo 3.1 Lite pour choisir le bon workflow video IA Veo 3 actuel selon votre besoin de tests texte-to-video moins chers, de tests image-to-video, de comportement audio et d iteration plus rapide.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre les tiers Veo Fast et Lite actuels.',
        items: [
          {
            question: 'Quel modele Veo 3 convient le mieux pour des tests image-to-video ?',
            answer:
              'Les deux peuvent convenir, mais Veo 3.1 Lite est plus adapte aux tests image-to-video audio-ready les moins chers, tandis que Veo 3.1 Fast est plus adapte quand vous voulez plus de flexibilite et une montee plus fluide vers Veo 3.1.',
          },
          {
            question: 'Veo 3.1 Lite ou Veo 3.1 Fast convient mieux a des tests texte-to-video ?',
            answer:
              'Veo 3.1 Lite convient mieux quand vous voulez les tests audio-ready les moins chers. Veo 3.1 Fast convient mieux quand vous voulez plus de flexibilite, un audio optionnel et un pont plus propre vers le workflow principal Veo 3.1.',
          },
          {
            question: 'Quand faut-il choisir Veo 3.1 Fast plutot que Veo 3.1 Lite ?',
            answer:
              'Choisissez Fast quand vous voulez plus de flexibilite de workflow, un controle audio optionnel et un chemin de montee plus simple vers Veo 3.1. Choisissez Lite quand votre priorite est le testing Veo actuel le moins cher avec audio toujours actif.',
          },
        ],
      },
    },
    'kling-3-pro-vs-kling-3-standard': {
      heroIntro:
        'Comparez Kling 3 Pro et Kling 3 Standard pour choisir le bon modele Kling IA actuel pour la video multi-shot, les workflows Kling en image-vers-video, les Kling Elements reutilisables et la qualite de sortie avec audio natif.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre les tiers Kling Pro et Standard actuels.',
        items: [
          {
            question: 'Quel modele Kling IA actuel convient le mieux a l image-vers-video et aux tests de prompt ?',
            answer:
              'Kling 3 Standard convient mieux a des tests de prompt moins couteux et a des tests image-vers-video repetables, tandis que Kling 3 Pro convient mieux quand vous avez besoin d un controle de scene plus serre et de sorties finales plus prioritaires.',
          },
          {
            question: 'Kling 3 Pro et Kling 3 Standard supportent-ils tous les deux les Kling Elements ?',
            answer:
              'Oui. Les deux modeles Kling actuels supportent les Kling Elements pour la continuite des personnages et des props, mais Kling 3 Pro reste le meilleur choix quand la sequence est plus exigeante ou que la continuite compte davantage.',
          },
          {
            question: 'Quand faut-il choisir Kling 3 Pro plutot que Kling 3 Standard ?',
            answer:
              'Choisissez Kling 3 Pro quand vous avez besoin d un meilleur controle de scene, d une continuite multi-shot plus exigeante et d une sortie finale plus prioritaire. Choisissez Kling 3 Standard quand le controle des couts et les tests repetables comptent davantage.',
          },
        ],
      },
    },
  } satisfies ComparePageOverridesBySlug;
