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
            question: 'Seedance 2.0 Fast vs normal : quelle difference ?',
            answer:
              '"Normal" designe generalement la route Seedance 2.0 standard. Utilisez Fast pour des drafts 480p/720p moins couteux et des checks de timing; utilisez Seedance 2.0 standard quand le plan a besoin de plus de finition, de 1080p ou de 4K, et d une coherence finale plus solide.',
          },
          {
            question: 'Seedance 2.0 et Fast supportent-ils video edit et extend ?',
            answer:
              'Oui. Sur MaxVideoAI, Seedance 2.0 et Seedance 2.0 Fast supportent les workflows video edit et extend, en plus du text-to-video, image-to-video et reference-to-video.',
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
        'Utilisez Seedance 2.0 pour la qualite finale flagship, le rendu Seedance le plus soigne, la livraison en plus haute resolution et les hero shots. Utilisez Seedance 2.0 Mini comme l option moins couteuse quand le cout, le volume batch, les variantes 480p/720p, les tests ecommerce, les hooks UGC et les experiences marketing frequentes comptent davantage. Cette page inclut maintenant des videos cote-a-cote Mini vs Seedance 2.0 avec les memes prompts, plus scorecard, specs et contexte pricing.',
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
            question: 'Les videos comparatives Mini sont-elles incluses ici ?',
            answer:
              'Oui. Cette page Seedance family utilise des sorties Mini et Seedance 2.0 cote-a-cote generees avec les memes prompts, donc la section video est directement comparable.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-seedance-2-0-fast': {
      heroIntro:
        'Utilisez Seedance 2.0 Fast quand la priorite est la vitesse de draft Seedance, les checks de timing et un passage rapide vers le modele flagship. Utilisez Seedance 2.0 Mini comme l option de volume batch moins couteux pour variantes ecommerce ou social, edits video, extensions et tests marketing repetes. Cette page inclut maintenant des videos cote-a-cote Mini vs Fast avec les memes prompts, plus scorecard, specs et contexte pricing.',
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
              'Oui. Cette page Seedance family utilise des sorties Mini et Fast cote-a-cote generees avec les memes prompts, donc la section video est directement comparable.',
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
    'gemini-omni-flash-vs-veo-3-1': {
      meta: {
        title: 'Gemini Omni Flash vs Veo 3.1 : specs Google video et usages',
        description:
          'Comparez Gemini Omni Flash et Veo 3.1 pour edition stateful, references, edition video source, first/last-frame, extend, limites 720p et tarifs Google video.',
        titleBranding: 'none',
      },
      heroIntro:
        'Utilisez Gemini Omni Flash quand le job video Google demande un refine stateful, de plus grandes piles de references image, des editions courtes depuis video source ou une direction sonore par prompt dans une route preview 720p. Utilisez Veo 3.1 quand vous avez besoin du workflow Veo mature pour first/last-frame, extend, plus de choix de resolution de livraison et une route production plus etablie. Cette page reste scorecard/specs tant qu il n existe pas de videos comparees Omni validees.',
      quickVerdict: {
        title: 'Verdict rapide',
        body:
          'Gemini Omni Flash vs Veo 3.1 est surtout un choix de modele d interaction. Omni Flash convient mieux au refine conversationnel, au previous interaction id, aux references plus nombreuses et aux editions courtes depuis video source. Veo 3.1 reste le choix plus sur pour livraison Veo soignee, first/last-frame, extend et sorties plus haute resolution.',
      },
      topCards: [
        {
          title: 'Choisir Omni Flash pour refine',
          body:
            'Omni Flash s appuie sur Google Interactions : previous interaction id et store/refine sont donc des controles produit centraux dans MaxVideoAI.',
        },
        {
          title: 'Choisir Veo 3.1 pour livrer',
          body:
            'Veo 3.1 reste le meilleur defaut quand le brief demande first/last-frame, extend, route Veo plus mature ou finition en resolution plus elevee.',
        },
        {
          title: 'Strategie de references',
          body:
            'Omni Flash peut exploiter de plus grandes piles d images de reference. Veo 3.1 reste preferable quand l objectif est un clip Veo cinematographique controle.',
        },
        {
          title: 'Stade de lancement',
          body:
            'Omni Flash est expose comme preview limitee. Veo 3.1 est aujourd hui la route Google video la plus etablie dans MaxVideoAI.',
        },
      ],
      primaryLinksTitle: 'Prochaines etapes recommandees',
      primaryLinks: [
        {
          href: '/fr/modeles/gemini-omni-flash',
          label: 'Ouvrir la page Gemini Omni Flash',
        },
        {
          href: '/fr/modeles/veo-3-1',
          label: 'Ouvrir la page Veo 3.1',
        },
        {
          href: '/fr/tarifs#gemini-omni-flash-pricing',
          label: 'Voir le prix Omni Flash',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre workflows Google Omni interactifs et route production Veo.',
        items: [
          {
            question: 'Gemini Omni Flash est-il meilleur que Veo 3.1 ?',
            answer:
              'Pas en general. Gemini Omni Flash convient mieux au refine stateful, aux workflows previous interaction id, aux grandes piles de references et aux editions depuis video source. Veo 3.1 reste meilleur pour les controles Veo matures, first/last-frame, extend et les chemins plus haute resolution.',
          },
          {
            question: 'Lequel choisir pour reference-to-video ?',
            answer:
              'Utilisez Omni Flash si vous avez besoin de plus de references ou si vous prevoyez de raffiner la meme interaction. Utilisez Veo 3.1 si le but est un rendu Veo plus etabli et cinematographique.',
          },
          {
            question: 'Lequel supporte first/last-frame et extend ?',
            answer:
              'Veo 3.1 est la page a utiliser pour first/last-frame et extend. La route preview Gemini Omni Flash actuelle dans MaxVideoAI n expose pas ces controles.',
          },
          {
            question: 'Pourquoi Omni Flash est-il marque preview ?',
            answer:
              'Google documente Gemini Omni Flash comme modele preview. MaxVideoAI garde le routage public sous gate et libelle specs/prix comme preview tant que quota et SKUs ne sont pas stabilises.',
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
    'pika-text-to-video-vs-wan-2-6': {
      meta: {
        title: 'Pika 2.2 vs Wan 2.6 : prix, audio et usages',
        description:
          'Comparez Pika 2.2 et Wan 2.6 sur le prix, la durée, l’audio, la résolution et les vidéos de référence pour choisir le bon modèle.',
        titleBranding: 'none',
      },
      heroIntro:
        'Comparez Pika 2.2 Text & Image to Video et Wan 2.6 Text & Image to Video pour arbitrer entre une boucle courte et économique ou un workflow plus complet avec audio. Pika simplifie les animations de prompt ou d’image, tandis que Wan atteint 15 secondes et accepte des vidéos de référence.',
      quickVerdict: {
        title: 'Verdict rapide',
        body:
          'Choisissez Pika 2.2 pour des boucles silencieuses de 5 ou 10 secondes, des essais stylisés et des animations simples à moindre coût. Préférez Wan 2.6 si le plan exige jusqu’à 15 secondes, de l’audio natif ou une à trois vidéos de référence, malgré un tarif supérieur en 720p et 1080p.',
      },
      topCards: [
        {
          title: 'Choisir Pika 2.2',
          body:
            'Idéal pour tester en 720p à petit prix, produire des boucles silencieuses et animer simplement un prompt ou une image.',
        },
        {
          title: 'Choisir Wan 2.6',
          body:
            'À privilégier pour des plans de 15 secondes, l’audio optionnel, la livraison 1080p ou le guidage par vidéos de référence.',
        },
        {
          title: 'Différence clé',
          body:
            'Pika démarre à 0,04 $ par seconde en 720p ; Wan à 0,10 $, avec davantage de durée, l’audio et le contrôle par référence.',
        },
        {
          title: 'Usages recommandés',
          body:
            'Pika convient aux boucles sociales et aux concepts. Wan convient aux plans plus longs, narrés ou guidés par des sources vidéo.',
        },
      ],
      primaryLinksTitle: 'Prochaines étapes recommandées',
      primaryLinks: [
        { href: '/models/pika-text-to-video', label: 'Ouvrir la page du modèle Pika 2.2' },
        { href: '/models/wan-2-6', label: 'Ouvrir la page du modèle Wan 2.6' },
        {
          href: '/ai-video-engines/minimax-hailuo-02-text-vs-pika-text-to-video',
          label: 'Comparer Hailuo 02 et Pika 2.2',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle: 'Réponses courtes pour choisir entre Pika 2.2 et Wan 2.6.',
        items: [
          {
            question: 'Pika 2.2 ou Wan 2.6 : lequel coûte le moins cher pour tester ?',
            answer:
              'Pika 2.2 est moins cher en 720p et convient aux courtes boucles silencieuses. Wan 2.6 justifie son prix lorsque le test demande du son, davantage de durée ou des vidéos de référence.',
          },
          {
            question: 'Que permet Wan 2.6 que Pika 2.2 ne propose pas ?',
            answer:
              'Wan 2.6 génère jusqu’à 15 secondes, accepte un audio optionnel et peut suivre une à trois vidéos de référence. Pika 2.2 reste centré sur le texte et l’image sans audio.',
          },
          {
            question: 'Quel modèle choisir pour un plan final en 1080p ?',
            answer:
              'Les deux proposent le 1080p. Pika suffit pour un plan silencieux simple et moins cher ; Wan est plus adapté si l’audio, la durée ou le guidage vidéo sont essentiels.',
          },
        ],
      },
    },
    'kling-2-6-pro-vs-kling-3-pro': {
      meta: {
        title: 'Kling 2.6 Pro vs Kling 3 Pro : faut-il évoluer ?',
        description:
          'Comparez Kling 2.6 Pro et Kling 3 Pro sur la durée, l’audio, le prix et le contrôle multi-plan pour savoir si la nouvelle version se justifie.',
        titleBranding: 'none',
      },
      heroIntro:
        'Comparez Kling 2.6 Pro et Kling 3 Pro pour déterminer si votre workflow historique suffit encore ou si la génération actuelle mérite son prix supérieur. Les deux produisent en 1080p avec audio, mais Kling 3 Pro monte à 15 secondes et vise les séquences cinématiques multi-plans plus ambitieuses.',
      quickVerdict: {
        title: 'Verdict rapide',
        body:
          'Conservez Kling 2.6 Pro pour des dialogues de 5 ou 10 secondes déjà bien maîtrisés et un coût audio inférieur. Passez à Kling 3 Pro lorsque le projet demande jusqu’à 15 secondes, la génération Kling actuelle et un meilleur cadre pour des séquences multi-plans dont l’enjeu justifie le surcoût.',
      },
      topCards: [
        {
          title: 'Choisir Kling 2.6 Pro',
          body:
            'Gardez ce modèle historique pour vos prompts 1080p validés, les dialogues courts et un tarif audio de 0,14 $ par seconde.',
        },
        {
          title: 'Choisir Kling 3 Pro',
          body:
            'Utilisez le modèle Pro actuel pour les clips jusqu’à 15 secondes et les séquences cinématiques multi-plans prioritaires.',
        },
        {
          title: 'Différence clé',
          body:
            'Les deux offrent texte, image, 1080p et audio ; le choix oppose la valeur d’un modèle historique à la durée du modèle actuel.',
        },
        {
          title: 'Usages recommandés',
          body:
            'Kling 2.6 Pro convient aux dialogues courts répétables. Kling 3 Pro vise les héros de campagne et les séquences planifiées.',
        },
      ],
      primaryLinksTitle: 'Prochaines étapes recommandées',
      primaryLinks: [
        { href: '/models/kling-2-6-pro', label: 'Ouvrir la page Kling 2.6 Pro' },
        { href: '/models/kling-3-pro', label: 'Ouvrir la page Kling 3 Pro' },
        {
          href: '/ai-video-engines/kling-3-pro-vs-kling-3-standard',
          label: 'Comparer Kling 3 Pro et Kling 3 Standard',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle: 'Réponses courtes avant de passer de Kling 2.6 Pro à Kling 3 Pro.',
        items: [
          {
            question: 'Kling 3 Pro remplace-t-il directement Kling 2.6 Pro ?',
            answer:
              'Kling 3 Pro est la route Pro actuelle et augmente la durée maximale de 10 à 15 secondes. Kling 2.6 Pro reste disponible comme option historique pour les workflows courts déjà validés.',
          },
          {
            question: 'Les deux modèles Kling Pro génèrent-ils de l’audio ?',
            answer:
              'Oui. Les deux prennent en charge l’audio en 1080p depuis du texte ou une image. Kling 2.6 Pro coûte 0,14 $ par seconde avec audio, contre 0,168 $ pour Kling 3 Pro avant marge.',
          },
          {
            question: 'Quand le prix supérieur de Kling 3 Pro est-il justifié ?',
            answer:
              'Choisissez Kling 3 Pro pour une durée de 15 secondes, la génération Kling actuelle ou une planification multi-plans. Gardez 2.6 Pro si votre workflow de 10 secondes répond déjà au brief.',
          },
        ],
      },
    },
    'ltx-2-3-fast-vs-luma-ray-2': {
      meta: {
        title: 'LTX 2.3 Fast vs Luma Ray 2 : vitesse, 4K et montage',
        description:
          'Comparez LTX 2.3 Fast et Luma Ray 2 sur la durée, la 4K, l’audio, la transformation vidéo et le recadrage pour choisir votre workflow.',
        titleBranding: 'none',
      },
      heroIntro:
        'Comparez LTX 2.3 Fast et Luma Ray 2 pour choisir entre une génération rapide avec audio et une boîte à outils Luma historique orientée montage. LTX atteint 20 secondes en 1080p, 1440p ou 4K ; Luma reste limité à 9 secondes mais ajoute la transformation vidéo et le recadrage.',
      quickVerdict: {
        title: 'Verdict rapide',
        body:
          'Choisissez LTX 2.3 Fast pour générer rapidement depuis du texte ou une image, avec audio, clips plus longs et sortie jusqu’en 4K. Choisissez Luma Ray 2 lorsqu’une vidéo existante doit être transformée ou recadrée dans de nombreux formats et qu’une livraison 1080p suffit.',
      },
      topCards: [
        {
          title: 'Choisir LTX 2.3 Fast',
          body:
            'Pour les concepts rapides, l’audio natif, les clips jusqu’à 20 secondes et les livraisons du 1080p à la 4K.',
        },
        {
          title: 'Choisir Luma Ray 2',
          body:
            'Pour transformer une vidéo existante ou la recadrer en format large, carré, vertical ou ultra-large.',
        },
        {
          title: 'Différence clé',
          body:
            'LTX gagne en durée, résolution et audio ; Luma apporte le travail sur une vidéo source et davantage de formats.',
        },
        {
          title: 'Usages recommandés',
          body:
            'LTX vise les brouillons de campagne et la haute résolution. Luma vise le réemploi, l’adaptation et les montages historiques.',
        },
      ],
      primaryLinksTitle: 'Prochaines étapes recommandées',
      primaryLinks: [
        { href: '/models/ltx-2-3-fast', label: 'Ouvrir la page LTX 2.3 Fast' },
        { href: '/models/luma-ray-2', label: 'Ouvrir la page Luma Ray 2' },
        {
          href: '/ai-video-engines/ltx-2-3-fast-vs-veo-3-1-fast',
          label: 'Comparer LTX 2.3 Fast et Veo 3.1 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle: 'Réponses courtes entre génération LTX rapide et montage Luma Ray 2.',
        items: [
          {
            question: 'Quel modèle choisir pour générer rapidement en 4K ?',
            answer:
              'LTX 2.3 Fast est le choix évident : il prend en charge la 4K, l’audio et des clips jusqu’à 20 secondes. Luma Ray 2 s’arrête au 1080p et ne produit pas d’audio.',
          },
          {
            question: 'Que permet Luma Ray 2 que LTX 2.3 Fast ne fait pas ?',
            answer:
              'Luma Ray 2 propose la transformation vidéo et le recadrage d’une source existante. LTX 2.3 Fast se concentre sur la génération depuis du texte ou une image.',
          },
          {
            question: 'Le modèle historique Luma Ray 2 reste-t-il pertinent ?',
            answer:
              'Oui, si votre priorité est de modifier une source vidéo ou de l’adapter à plusieurs formats. Pour une nouvelle génération avec audio et haute résolution, choisissez LTX 2.3 Fast.',
          },
        ],
      },
    },
    'kling-2-6-pro-vs-minimax-hailuo-02-text': {
      meta: {
        title: 'Kling 2.6 Pro vs Hailuo 02 : qualité, audio et prix',
        description:
          'Comparez Kling 2.6 Pro et MiniMax Hailuo 02 sur le 1080p, l’audio, le mouvement stylisé et le prix par seconde pour choisir votre modèle.',
        titleBranding: 'none',
      },
      heroIntro:
        'Comparez Kling 2.6 Pro et MiniMax Hailuo 02 Standard pour arbitrer entre un dialogue cinématique en 1080p et une exploration stylisée moins chère. Kling ajoute l’audio natif et une meilleure résolution, tandis que Hailuo produit des animations silencieuses économiques en 512P ou 768P.',
      quickVerdict: {
        title: 'Verdict rapide',
        body:
          'Choisissez Kling 2.6 Pro pour des plans cinématiques en 1080p, du dialogue et un audio natif optionnel. Choisissez MiniMax Hailuo 02 Standard pour tester à moindre coût des styles, formats verticaux ou carrés et mouvements silencieux lorsque le 512P ou 768P suffit.',
      },
      topCards: [
        {
          title: 'Choisir Kling 2.6 Pro',
          body:
            'Pour les dialogues cinématiques en 1080p, l’audio optionnel et les plans où la finition prime sur le prix.',
        },
        {
          title: 'Choisir Hailuo 02',
          body:
            'Pour explorer des concepts stylisés à 0,045 $ par seconde et produire du mouvement silencieux en basse résolution.',
        },
        {
          title: 'Différence clé',
          body:
            'Kling fournit le 1080p et l’audio à 0,14 $ par seconde avec son ; Hailuo coûte moins cher mais reste silencieux et limité au 768P.',
        },
        {
          title: 'Usages recommandés',
          body:
            'Kling convient au dialogue et aux plans finis. Hailuo convient aux accroches stylisées et aux lots d’exploration économiques.',
        },
      ],
      primaryLinksTitle: 'Prochaines étapes recommandées',
      primaryLinks: [
        { href: '/models/kling-2-6-pro', label: 'Ouvrir la page Kling 2.6 Pro' },
        { href: '/models/minimax-hailuo-02-text', label: 'Ouvrir la page MiniMax Hailuo 02' },
        {
          href: '/ai-video-engines/kling-2-6-pro-vs-wan-2-6',
          label: 'Comparer Kling 2.6 Pro et Wan 2.6',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle: 'Réponses courtes entre finition Kling et mouvement Hailuo économique.',
        items: [
          {
            question: 'Kling 2.6 Pro ou Hailuo 02 : lequel choisir pour du dialogue ?',
            answer:
              'Kling 2.6 Pro est plus adapté grâce à son audio natif et sa sortie 1080p. Hailuo 02 produit une vidéo silencieuse et convient mieux aux essais visuels ou stylisés.',
          },
          {
            question: 'Quelle résolution proposent les deux modèles ?',
            answer:
              'Kling 2.6 Pro sort en 1080p. MiniMax Hailuo 02 Standard propose le 512P et le 768P, donc il sert davantage à explorer des concepts qu’à finaliser en haute résolution.',
          },
          {
            question: 'Quand le prix inférieur de Hailuo 02 est-il intéressant ?',
            answer:
              'Utilisez Hailuo pour multiplier les explorations stylisées silencieuses à 0,045 $ par seconde. Payez Kling lorsque l’audio et une livraison 1080p sont indispensables.',
          },
        ],
      },
    },
    'kling-3-standard-vs-kling-o3-standard': {
      meta: {
        title: 'Kling 3 Standard vs Omni Standard : lequel choisir ?',
        description:
          'Comparez Kling 3 Standard et Kling 3.0 Omni Standard sur les références, le montage vidéo, le 1080p, l’audio et le prix pour bien choisir.',
        titleBranding: 'none',
      },
      heroIntro:
        'Comparez Kling 3 Standard et Kling 3.0 Omni Standard lorsque les deux offrent 15 secondes en 1080p avec audio au même tarif de base. Standard simplifie la génération depuis un texte ou une image de départ ; Omni ajoute les références visuelles et la transformation d’une vidéo source.',
      quickVerdict: {
        title: 'Verdict rapide',
        body:
          'Choisissez Kling 3 Standard pour tester directement un prompt ou une image de départ sans complexité inutile. Choisissez Kling 3.0 Omni Standard lorsque des personnages, produits, références visuelles ou une vidéo existante doivent guider le résultat grâce aux modes référence-vers-vidéo ou vidéo-vers-vidéo.',
      },
      topCards: [
        {
          title: 'Choisir Kling 3 Standard',
          body:
            'Pour les prompts directs, l’animation d’une image initiale et des brouillons 1080p répétables avec audio optionnel.',
        },
        {
          title: 'Choisir Omni Standard',
          body:
            'Pour guider le plan avec des références ou transformer une vidéo source en plus des modes texte et image.',
        },
        {
          title: 'Différence clé',
          body:
            'Résolution, durée, audio et tarif de base sont identiques ; Omni élargit les entrées, Standard reste plus simple.',
        },
        {
          title: 'Usages recommandés',
          body:
            'Standard convient aux tests depuis une image. Omni convient à la continuité de personnages, produits et sources vidéo.',
        },
      ],
      primaryLinksTitle: 'Prochaines étapes recommandées',
      primaryLinks: [
        { href: '/models/kling-3-standard', label: 'Ouvrir la page Kling 3 Standard' },
        { href: '/models/kling-o3-standard', label: 'Ouvrir la page Kling 3.0 Omni Standard' },
        {
          href: '/ai-video-engines/kling-3-pro-vs-kling-3-standard',
          label: 'Comparer Kling 3 Pro et Kling 3 Standard',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle: 'Réponses courtes entre les workflows Kling Standard et Omni Standard.',
        items: [
          {
            question: 'Quelle est la différence principale entre Standard et Omni Standard ?',
            answer:
              'Les deux produisent jusqu’à 15 secondes en 1080p avec audio. Omni Standard ajoute les modes référence-vers-vidéo et vidéo-vers-vidéo, absents de Kling 3 Standard.',
          },
          {
            question: 'Kling 3 Standard et Omni Standard coûtent-ils le même prix ?',
            answer:
              'Le catalogue indique les mêmes tarifs fournisseur : 0,084 $ par seconde sans audio et 0,126 $ avec audio, avant la marge appliquée par MaxVideoAI.',
          },
          {
            question: 'Quel modèle choisir pour travailler avec des références ?',
            answer:
              'Choisissez Kling 3.0 Omni Standard si des images de référence ou une vidéo source doivent guider le résultat. Kling 3 Standard suffit avec un prompt ou une image de départ.',
          },
        ],
      },
    },
    'seedance-2-0-fast-vs-veo-3-1': {
      meta: {
        title: 'Seedance 2.0 Fast vs Veo 3.1 : brouillon ou 4K ?',
        description:
          'Comparez Seedance 2.0 Fast et Google Veo 3.1 sur les brouillons, références, montages, durées, audio et sorties 4K pour votre vidéo.',
        titleBranding: 'none',
      },
      heroIntro:
        'Comparez Seedance 2.0 Fast et Google Veo 3.1 pour choisir entre un workflow complet de brouillon et montage ou une livraison finale en haute résolution. Seedance atteint 15 secondes avec références, édition et extension en 480p ou 720p ; Veo monte en 4K pour des publicités et plans B-roll de 8 secondes.',
      quickVerdict: {
        title: 'Verdict rapide',
        body:
          'Choisissez Seedance 2.0 Fast pour planifier vite, produire des brouillons plus longs, exploiter des références, modifier ou prolonger une vidéo lorsque le 720p suffit. Choisissez Google Veo 3.1 pour des publicités courtes et finies, le contrôle première-dernière image et une livraison 1080p ou 4K.',
      },
      topCards: [
        {
          title: 'Choisir Seedance 2.0 Fast',
          body:
            'Pour les brouillons de 4 à 15 secondes, les références visuelles, le montage, l’extension et de nombreux formats.',
        },
        {
          title: 'Choisir Veo 3.1',
          body:
            'Pour des publicités ou plans B-roll finis de 8 secondes, l’audio, le contrôle des images limites et la 4K.',
        },
        {
          title: 'Différence clé',
          body:
            'Seedance offre davantage de durée et d’outils en 480p/720p ; Veo produit des clips plus courts à bien meilleure résolution finale.',
        },
        {
          title: 'Usages recommandés',
          body:
            'Seedance convient à la préparation et aux retouches. Veo convient aux plans de campagne validés et aux masters haute résolution.',
        },
      ],
      primaryLinksTitle: 'Prochaines étapes recommandées',
      primaryLinks: [
        { href: '/models/seedance-2-0-fast', label: 'Ouvrir la page Seedance 2.0 Fast' },
        { href: '/models/veo-3-1', label: 'Ouvrir la page Google Veo 3.1' },
        {
          href: '/ai-video-engines/seedance-2-0-fast-vs-veo-3-1-fast',
          label: 'Comparer Seedance 2.0 Fast et Veo 3.1 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle: 'Réponses courtes entre brouillons Seedance et sorties finales Veo.',
        items: [
          {
            question: 'Seedance 2.0 Fast ou Veo 3.1 : lequel choisir pour les brouillons ?',
            answer:
              'Seedance 2.0 Fast est conçu pour les brouillons rapides, les essais de référence et la préparation des plans. Il atteint 15 secondes et permet aussi de modifier ou prolonger une vidéo.',
          },
          {
            question: 'Quel modèle convient le mieux à une livraison finale 4K ?',
            answer:
              'Google Veo 3.1 est le meilleur choix pour un master 4K fini. Seedance 2.0 Fast s’arrête au 720p et sert davantage à l’itération et au montage.',
          },
          {
            question: 'Les deux modèles acceptent-ils l’audio et les références ?',
            answer:
              'Oui. Seedance ajoute le montage vidéo et davantage de formats, tandis que Veo ajoute le contrôle première-dernière image et une résolution finale supérieure.',
          },
        ],
      },
    },
    'ltx-2-fast-vs-minimax-hailuo-02-text': {
      meta: {
        title: 'LTX 2 Fast vs Hailuo 02 : résolution, audio et usages',
        description:
          'Comparez LTX Video 2.0 Fast et MiniMax Hailuo 02 sur la durée, la résolution, l’audio, les formats et le prix pour vos clips sociaux.',
        titleBranding: 'none',
      },
      heroIntro:
        'Comparez LTX Video 2.0 Fast et MiniMax Hailuo 02 Standard pour choisir entre de longs clips paysage en haute résolution ou des formats stylisés plus modestes. LTX atteint 20 secondes avec audio et une sortie jusqu’en 4K ; Hailuo ajoute les formats vertical et carré en 512P ou 768P silencieux.',
      quickVerdict: {
        title: 'Verdict rapide',
        body:
          'Choisissez LTX Video 2.0 Fast pour des clips paysage rapides, l’audio natif, une durée jusqu’à 20 secondes et des sorties 1080p, 1440p ou 4K. Choisissez MiniMax Hailuo 02 Standard pour un concept stylisé silencieux en vertical, carré ou paysage lorsque le 512P ou 768P suffit.',
      },
      topCards: [
        {
          title: 'Choisir LTX 2 Fast',
          body:
            'Pour des clips sociaux 16:9 plus longs, une génération avec audio et des livraisons du 1080p à la 4K.',
        },
        {
          title: 'Choisir Hailuo 02',
          body:
            'Pour des mouvements stylisés silencieux en 16:9, 9:16 ou 1:1 lorsque le 512P ou le 768P suffit au canal.',
        },
        {
          title: 'Différence clé',
          body:
            'LTX offre durée, audio et haute résolution mais seulement en 16:9 ; Hailuo offre plus de formats sociaux à basse résolution.',
        },
        {
          title: 'Usages recommandés',
          body:
            'LTX convient aux promotions paysage avec musique. Hailuo convient aux accroches verticales, carrées et aux essais visuels.',
        },
      ],
      primaryLinksTitle: 'Prochaines étapes recommandées',
      primaryLinks: [
        { href: '/models/ltx-2-fast', label: 'Ouvrir la page LTX Video 2.0 Fast' },
        { href: '/models/minimax-hailuo-02-text', label: 'Ouvrir la page MiniMax Hailuo 02' },
        {
          href: '/ai-video-engines/ltx-2-3-fast-vs-ltx-2-fast',
          label: 'Comparer LTX 2.3 Fast et LTX 2 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle: 'Réponses courtes entre LTX haute résolution et Hailuo multiformat.',
        items: [
          {
            question: 'Quel modèle choisir pour des clips longs en haute résolution ?',
            answer:
              'LTX Video 2.0 Fast atteint 20 secondes avec audio et une sortie 1080p, 1440p ou 4K. Hailuo 02 s’arrête à 10 secondes et au 768P.',
          },
          {
            question: 'Quel modèle fonctionne le mieux en vertical ou en carré ?',
            answer:
              'MiniMax Hailuo 02 Standard prend en charge le 9:16 et le 1:1 en plus du 16:9. LTX Video 2.0 Fast est limité au 16:9 paysage.',
          },
          {
            question: 'LTX 2 Fast et Hailuo 02 génèrent-ils tous deux de l’audio ?',
            answer:
              'Non. LTX Video 2.0 Fast prend en charge l’audio natif, tandis que Hailuo 02 produit une vidéo silencieuse à sonoriser ensuite si nécessaire.',
          },
        ],
      },
    },
    'minimax-hailuo-02-text-vs-veo-3-1-fast': {
      meta: {
        title: 'Hailuo 02 vs Veo 3.1 Fast : prix, audio et 4K',
        description:
          'Comparez MiniMax Hailuo 02 et Google Veo 3.1 Fast sur le prix, l’audio, les références, la résolution et la durée de génération.',
        titleBranding: 'none',
      },
      heroIntro:
        'Comparez MiniMax Hailuo 02 Standard et Google Veo 3.1 Fast pour arbitrer entre une exploration stylisée peu coûteuse ou un workflow de production plus complet. Hailuo crée du mouvement silencieux en 512P ou 768P à 0,045 $ par seconde ; Veo Fast ajoute audio, références, extension et 4K.',
      quickVerdict: {
        title: 'Verdict rapide',
        body:
          'Choisissez MiniMax Hailuo 02 Standard pour des concepts stylisés silencieux et économiques, jusqu’à 10 secondes lorsque le 768P suffit. Choisissez Google Veo 3.1 Fast pour des publicités avec audio, des références, le contrôle première-dernière image, des extensions ou une livraison 1080p ou 4K.',
      },
      topCards: [
        {
          title: 'Choisir Hailuo 02',
          body:
            'Pour des essais stylisés à 0,045 $ par seconde, des concepts sociaux silencieux et jusqu’à 10 secondes en 768P.',
        },
        {
          title: 'Choisir Veo 3.1 Fast',
          body:
            'Pour l’audio, les références, les images limites, l’extension et des livraisons du 720p à la 4K.',
        },
        {
          title: 'Différence clé',
          body:
            'Hailuo coûte moins cher et offre deux secondes de plus ; Veo Fast élargit la résolution, le son et les contrôles.',
        },
        {
          title: 'Usages recommandés',
          body:
            'Hailuo convient aux tests stylisés et accroches économiques. Veo Fast convient aux publicités, produits et masters finis.',
        },
      ],
      primaryLinksTitle: 'Prochaines étapes recommandées',
      primaryLinks: [
        { href: '/models/minimax-hailuo-02-text', label: 'Ouvrir la page MiniMax Hailuo 02' },
        { href: '/models/veo-3-1-fast', label: 'Ouvrir la page Google Veo 3.1 Fast' },
        {
          href: '/ai-video-engines/seedance-2-0-fast-vs-veo-3-1-fast',
          label: 'Comparer Seedance 2.0 Fast et Veo 3.1 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle: 'Réponses courtes entre Hailuo économique et Veo Fast plus complet.',
        items: [
          {
            question: 'Hailuo 02 ou Veo 3.1 Fast : lequel coûte le moins cher ?',
            answer:
              'Hailuo 02 est facturé 0,045 $ par seconde. Veo 3.1 Fast démarre à 0,10 $ en 720p avec audio et augmente avec la résolution : Hailuo reste le choix économique et silencieux.',
          },
          {
            question: 'Quel modèle prend en charge l’audio et la 4K ?',
            answer:
              'Google Veo 3.1 Fast prend en charge l’audio natif et la sortie jusqu’en 4K. MiniMax Hailuo 02 Standard est silencieux et s’arrête au 768P.',
          },
          {
            question: 'Quand choisir Hailuo 02 plutôt que Veo Fast ?',
            answer:
              'Choisissez Hailuo pour explorer des styles à petit prix sans besoin de son ni de haute résolution. Veo Fast s’impose pour les références, l’audio et une livraison finie.',
          },
        ],
      },
    },
    'kling-3-4k-vs-seedance-2-0': {
      meta: {
        title: 'Kling 3 4K vs Seedance 2.0 : 4K finale ou contrôle ?',
        description:
          'Comparez Kling 3 4K et Seedance 2.0 sur la 4K native, les références, le montage, l’extension, l’audio et la flexibilité du workflow.',
        titleBranding: 'none',
      },
      heroIntro:
        'Comparez Kling 3 4K et Seedance 2.0 : les deux livrent en 4K, mais leurs workflows diffèrent. Kling est une route texte ou image de départ entièrement dédiée au rendu final 4K natif ; Seedance va du 480p à la 4K avec références, montage vidéo, extension, contrôles de mouvement et audio.',
      quickVerdict: {
        title: 'Verdict rapide',
        body:
          'Choisissez Kling 3 4K lorsqu’un prompt ou une image déjà validés doivent être rendus directement en 4K native. Choisissez Seedance 2.0 lorsque le projet exige des itérations en basse résolution, plusieurs références, du montage vidéo, une extension de clip, davantage de formats ou plus de contrôle avant le master 4K.',
      },
      topCards: [
        {
          title: 'Choisir Kling 3 4K',
          body:
            'Pour rendre directement un prompt ou une image validés en 4K native, avec audio optionnel.',
        },
        {
          title: 'Choisir Seedance 2.0',
          body:
            'Pour les références, le montage, l’extension, les contrôles de mouvement, plusieurs résolutions et davantage de formats.',
        },
        {
          title: 'Différence clé',
          body:
            'Kling verrouille chaque rendu en 4K native ; Seedance permet d’itérer dès le 480p avec des entrées beaucoup plus variées.',
        },
        {
          title: 'Usages recommandés',
          body:
            'Kling convient aux héros finaux approuvés. Seedance convient aux campagnes itératives, séquences référencées et retouches.',
        },
      ],
      primaryLinksTitle: 'Prochaines étapes recommandées',
      primaryLinks: [
        { href: '/models/kling-3-4k', label: 'Ouvrir la page Kling 3 4K' },
        { href: '/models/seedance-2-0', label: 'Ouvrir la page Seedance 2.0' },
        {
          href: '/ai-video-engines/kling-3-4k-vs-veo-3-1',
          label: 'Comparer Kling 3 4K et Veo 3.1',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle: 'Réponses courtes entre 4K native dédiée et workflow Seedance complet.',
        items: [
          {
            question: 'Kling 3 4K et Seedance 2.0 prennent-ils tous deux en charge la 4K ?',
            answer:
              'Oui. Kling 3 4K est verrouillé sur une sortie 4K native, tandis que Seedance 2.0 propose 480p, 720p, 1080p et 4K pour itérer avant la livraison finale.',
          },
          {
            question: 'Quel modèle offre le plus de contrôle par références et montage ?',
            answer:
              'Seedance 2.0 ajoute références, montage vidéo, extension, contrôles de mouvement et plusieurs images, vidéos ou audios sources. Kling 3 4K se concentre sur le texte et l’image de départ.',
          },
          {
            question: 'Quel modèle choisir pour un plan héros final en 4K ?',
            answer:
              'Kling 3 4K est une route directe pour rendre un prompt ou une image validés en 4K native. Seedance est préférable si le plan demande encore des références, retouches ou extensions.',
          },
        ],
      },
    },
    'minimax-hailuo-02-text-vs-wan-2-6': {
      meta: {
        title: 'Hailuo 02 vs Wan 2.6 : prix, audio et usages',
        description:
          'Comparez MiniMax Hailuo 02 et Wan 2.6 sur le prix, la durée, le 1080p, l’audio, les vidéos de référence et le mouvement stylisé.',
        titleBranding: 'none',
      },
      heroIntro:
        'Comparez MiniMax Hailuo 02 Standard et Wan 2.6 Text & Image to Video pour arbitrer entre mouvement stylisé économique et workflow généraliste. Hailuo coûte 0,045 $ par seconde pour des clips silencieux en 512P ou 768P ; Wan atteint 15 secondes en 1080p avec audio et références vidéo.',
      quickVerdict: {
        title: 'Verdict rapide',
        body:
          'Choisissez MiniMax Hailuo 02 Standard pour des concepts stylisés silencieux moins chers, des formats verticaux ou carrés et jusqu’à 10 secondes lorsque le 768P suffit. Choisissez Wan 2.6 pour une production généraliste en 1080p, jusqu’à 15 secondes, avec audio optionnel ou une à trois vidéos de référence.',
      },
      topCards: [
        {
          title: 'Choisir Hailuo 02',
          body:
            'Pour du mouvement stylisé à 0,045 $ par seconde et des tests silencieux en paysage, vertical ou carré.',
        },
        {
          title: 'Choisir Wan 2.6',
          body:
            'Pour une livraison 720p ou 1080p, l’audio optionnel, jusqu’à 15 secondes et le guidage par vidéo.',
        },
        {
          title: 'Différence clé',
          body:
            'Hailuo minimise le coût des sorties stylisées ; Wan coûte plus cher mais ajoute résolution, durée, son et références.',
        },
        {
          title: 'Usages recommandés',
          body:
            'Hailuo convient aux concepts sociaux économiques. Wan convient aux narrations, plans B-roll et séquences guidées.',
        },
      ],
      primaryLinksTitle: 'Prochaines étapes recommandées',
      primaryLinks: [
        { href: '/models/minimax-hailuo-02-text', label: 'Ouvrir la page MiniMax Hailuo 02' },
        { href: '/models/wan-2-6', label: 'Ouvrir la page Wan 2.6' },
        {
          href: '/ai-video-engines/veo-3-1-vs-wan-2-6',
          label: 'Comparer Veo 3.1 et Wan 2.6',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle: 'Réponses courtes entre Hailuo stylisé et Wan généraliste.',
        items: [
          {
            question: 'Hailuo 02 ou Wan 2.6 : lequel coûte le moins cher ?',
            answer:
              'Hailuo 02 coûte 0,045 $ par seconde. Wan 2.6 démarre à 0,10 $ en 720p et 0,15 $ en 1080p : Hailuo est moins cher si une sortie silencieuse en basse résolution suffit.',
          },
          {
            question: 'Quel modèle prend en charge l’audio et les vidéos de référence ?',
            answer:
              'Wan 2.6 accepte un audio optionnel et une à trois vidéos de référence. MiniMax Hailuo 02 Standard génère depuis du texte ou une image sans audio.',
          },
          {
            question: 'Quand choisir Wan 2.6 plutôt que Hailuo 02 ?',
            answer:
              'Choisissez Wan pour le 1080p, plus de 10 secondes, l’audio natif ou le guidage vidéo. Choisissez Hailuo pour explorer des styles et formats sociaux à moindre coût.',
          },
        ],
      },
    },
  } satisfies ComparePageOverridesBySlug;
