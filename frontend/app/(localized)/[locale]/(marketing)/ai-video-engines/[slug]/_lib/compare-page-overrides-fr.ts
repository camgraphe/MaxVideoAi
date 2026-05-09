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
