import {
  AudioLines,
  BadgeCheck,
  Clock3,
  ExternalLink,
  FileText,
  Film,
  ImageIcon,
  Lightbulb,
  Link2,
  Maximize2,
  PenLine,
  Sparkles,
  Type,
  Users,
  Volume2,
  type LucideIcon,
} from 'lucide-react';

import type { AppLocale } from '@/i18n/locales';
import { UIIcon } from '@/components/ui/UIIcon';
import { getImageAlt } from '@/lib/image-alt';

import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_MUTED, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';
import type { FeaturedMedia } from '../_lib/model-page-media';
import { SECTION_SCROLL_MARGIN, type SoraCopy } from '../_lib/model-page-specs';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';
import { ModelDecisionDemoMedia } from './ModelDecisionDemoMedia.client';
import { ModelDecisionPromptTabs } from './ModelDecisionPromptTabs.client';

type ModelDecisionPromptingSectionProps = {
  imageAnchorId: string;
  copy: SoraCopy;
  demoMedia: FeaturedMedia | null;
  engineSlug: string;
  isImageEngine: boolean;
  locale: AppLocale;
  modelName: string;
  referenceWorkflows: Array<{ title: string; body: string }>;
};

const REFERENCE_ICONS = [FileText, ImageIcon, Film, AudioLines, Link2] as const satisfies readonly LucideIcon[];

function getPromptLabels(locale: AppLocale, modelName: string) {
  if (locale === 'fr') {
    return {
      tipPrefix: 'Astuce',
      guide: `Guide officiel ${modelName}`,
      global: 'Principes globaux',
      quirks: 'Points moteur à surveiller',
      demoSubject: 'Sujet',
      demoAction: 'Action',
      demoCamera: 'Caméra',
      demoStyle: 'Style',
      demoAudio: 'Audio',
      viewFull: 'Voir le rendu complet',
      showPrompt: 'Voir le prompt complet',
      copyPrompt: 'Copier le prompt',
      copied: 'Copié',
      imageExamplesTitle: `Prompts image ${modelName}`,
      imageExamplesIntro: 'Exemples adaptés aux stills campagne, typographie, retouches et finales 4K.',
      openImageWorkspace: 'Ouvrir l’espace image',
      textToVideo: 'Texte-vers-vidéo',
      audioOn: 'Audio activé',
      referencesTitle: `Comment ${modelName} utilise les références`,
    };
  }
  if (locale === 'es') {
    return {
      tipPrefix: 'Consejo',
      guide: `Guía oficial ${modelName}`,
      global: 'Principios globales',
      quirks: 'Puntos del motor a vigilar',
      demoSubject: 'Sujeto',
      demoAction: 'Acción',
      demoCamera: 'Cámara',
      demoStyle: 'Estilo',
      demoAudio: 'Audio',
      viewFull: 'Ver resultado completo',
      showPrompt: 'Ver prompt completo',
      copyPrompt: 'Copiar prompt',
      copied: 'Copiado',
      imageExamplesTitle: `Prompts de imagen de ${modelName}`,
      imageExamplesIntro: 'Ejemplos para stills de campaña, tipografía, ediciones con referencia y finales 4K.',
      openImageWorkspace: 'Abrir espacio de imagen',
      textToVideo: 'Texto a video',
      audioOn: 'Audio activado',
      referencesTitle: `Cómo ${modelName} usa referencias`,
    };
  }
  return {
    tipPrefix: 'Tip',
    guide: `Official ${modelName} guide`,
    global: 'Global principles',
    quirks: 'Engine quirks / what to watch for',
    demoSubject: 'Subject',
    demoAction: 'Action',
    demoCamera: 'Camera',
    demoStyle: 'Style',
    demoAudio: 'Audio',
    viewFull: 'View full render',
    showPrompt: 'View full prompt',
    copyPrompt: 'Copy prompt',
    copied: 'Copied',
    imageExamplesTitle: `${modelName} image prompt examples`,
    imageExamplesIntro: 'Use these for campaign stills, typography posters, reference edits and 2K-to-4K finals.',
    openImageWorkspace: 'Open image workspace',
    textToVideo: 'Text-to-video',
    audioOn: 'Audio on',
    referencesTitle: `How ${modelName} uses references`,
  };
}

function getDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Biker crâne blindé',
      action: 'La moto approche et marque l’arrêt',
      camera: 'Tracking bas frontal, léger push-in',
      style: 'Cinématique, reflets de rue mouillée',
      audio: 'Moteur, cliquetis métal, tonnerre lointain',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Biker calavera blindado',
      action: 'La moto se acerca y se detiene',
      camera: 'Tracking bajo frontal, leve push-in',
      style: 'Cinemático, reflejos de calle mojada',
      audio: 'Motor, metal, trueno distante',
    };
  }
  return {
    subject: 'Armored skull biker',
    action: 'Motorcycle approaches and stops',
    camera: 'Low front tracking, slight push-in',
    style: 'Cinematic, wet street reflections',
    audio: 'Engine revs, metal clinks, distant thunder',
  };
}

function getRouteDemoSummary(locale: AppLocale, engineSlug: string) {
  if (engineSlug === 'happy-horse-1-0') {
    if (locale === 'fr') {
      return {
        subject: 'Conservatrice dans une galerie de portraits',
        action: 'Traverse la salle pendant que les visages peints prennent vie',
        camera: 'Dolly fluide dans la galerie',
        style: 'Réalisme surréaliste, lumière d’aube, marbre et poussière douce',
        audio: 'Ambiance feutrée de musée, pas de dialogue',
      };
    }
    if (locale === 'es') {
      return {
        subject: 'Conservadora en una galería de retratos',
        action: 'Camina mientras los rostros pintados cobran vida',
        camera: 'Dolly suave por la galería',
        style: 'Realismo surreal, luz de amanecer, mármol y polvo suave',
        audio: 'Ambiente silencioso de museo, sin diálogo',
      };
    }
    return {
      subject: 'Museum curator in a portrait gallery',
      action: 'Walks through as painted faces come alive',
      camera: 'Smooth dolly through the gallery',
      style: 'Surreal realism, dawn light, marble reflections and soft dust',
      audio: 'Quiet museum ambience, no dialogue',
    };
  }

  if (engineSlug === 'kling-2-5-turbo') {
    if (locale === 'fr') {
      return {
        subject: 'Founder près d’une fenêtre',
        action: 'Regarde vers caméra pendant un portrait vertical',
        camera: 'Dérive handheld lente du buste vers le visage',
        style: 'Golden hour, arrière-plan ville flou, portrait startup',
        audio: 'Ambiance douce, pas de dialogue',
      };
    }
    if (locale === 'es') {
      return {
        subject: 'Founder junto a una ventana',
        action: 'Mira a cámara en un retrato vertical',
        camera: 'Deriva handheld lenta del torso al rostro',
        style: 'Golden hour, ciudad desenfocada, retrato startup',
        audio: 'Ambiente suave, sin diálogo',
      };
    }
    return {
      subject: 'Startup founder by a window',
      action: 'Holds a vertical portrait moment',
      camera: 'Slow handheld drift from chest-up to closer on the face',
      style: 'Golden-hour light, blurred city background, founder portrait',
      audio: 'Soft ambience, no dialogue',
    };
  }

  if (engineSlug === 'kling-2-6-pro') {
    if (locale === 'fr') {
      return {
        subject: 'Jeune femme dans un café de nuit',
        action: 'Travaille près d’une fenêtre sous la pluie',
        camera: 'Plan cinématique vertical avec mouvement doux',
        style: 'Café chaleureux, reflets de pluie, mood intime',
        audio: 'Ambiance café et pluie discrète',
      };
    }
    if (locale === 'es') {
      return {
        subject: 'Mujer joven en una cafetería nocturna',
        action: 'Trabaja junto a una ventana con lluvia',
        camera: 'Plano vertical cinemático con movimiento suave',
        style: 'Café cálido, reflejos de lluvia, mood íntimo',
        audio: 'Ambiente de café y lluvia sutil',
      };
    }
    return {
      subject: 'Young woman in a night coffee shop',
      action: 'Works by a rain-streaked window',
      camera: 'Cinematic vertical shot with gentle motion',
      style: 'Warm cafe, rain reflections, intimate mood',
      audio: 'Cafe ambience and subtle rain',
    };
  }

  if (engineSlug === 'ltx-2-fast') {
    if (locale === 'fr') {
      return {
        subject: 'Jeune femme à un passage piéton',
        action: 'Attend puis traverse dans la lumière golden hour',
        camera: 'Départ derrière elle, puis suivi handheld fluide',
        style: 'Ville animée, lumière chaude, clip social cinématique',
        audio: 'Ambiance urbaine, pas de dialogue',
      };
    }
    if (locale === 'es') {
      return {
        subject: 'Joven en un cruce urbano',
        action: 'Espera y cruza con luz golden hour',
        camera: 'Empieza detrás de ella y sigue en handheld suave',
        style: 'Ciudad activa, luz cálida, clip social cinemático',
        audio: 'Ambiente urbano, sin diálogo',
      };
    }
    return {
      subject: 'Young woman at a busy crosswalk',
      action: 'Waits, then crosses in golden-hour light',
      camera: 'Starts behind her, then moves into a smooth handheld follow',
      style: 'Busy city, warm light, cinematic social clip',
      audio: 'City ambience, no dialogue',
    };
  }

  if (engineSlug === 'ltx-2') {
    if (locale === 'fr') {
      return {
        subject: 'Mégapole côtière futuriste',
        action: 'La caméra glisse entre tours et trafic aérien',
        camera: 'Vue aérienne large, travelling cinématique',
        style: 'Coucher de soleil, verre, reflets premium, 4K',
        audio: 'Ambiance futuriste discrète',
      };
    }
    if (locale === 'es') {
      return {
        subject: 'Megaciudad costera futurista',
        action: 'La cámara atraviesa torres y tráfico aéreo',
        camera: 'Vista aérea amplia, travelling cinemático',
        style: 'Atardecer, cristal, reflejos premium, 4K',
        audio: 'Ambiente futurista sutil',
      };
    }
    return {
      subject: 'Futuristic coastal megacity',
      action: 'Camera glides between glass towers and flying traffic',
      camera: 'Wide aerial view with cinematic travel motion',
      style: 'Sunset, glass reflections, premium 4K cityscape',
      audio: 'Subtle futuristic ambience',
    };
  }

  if (engineSlug === 'seedance-2-0') {
    if (locale === 'fr') {
      return {
        subject: 'Bus scolaire muté en créature mécanique',
        action: 'Transformation horrifique absurde dans une rue déserte',
        camera: 'Plan cinématique large avec mouvement contrôlé',
        style: 'Réalisme américain sombre, horror-comedy',
        audio: 'Ambiance inquiétante, métal, tension',
      };
    }
    if (locale === 'es') {
      return {
        subject: 'Autobús escolar mutado en criatura mecánica',
        action: 'Transformación de horror absurdo en una calle desierta',
        camera: 'Plano cinemático amplio con movimiento controlado',
        style: 'Realismo estadounidense oscuro, horror-comedy',
        audio: 'Ambiente inquietante, metal, tensión',
      };
    }
    return {
      subject: 'School bus mutating into a mechanical creature',
      action: 'Dark absurd transformation on a deserted street',
      camera: 'Wide cinematic shot with controlled motion',
      style: 'Grounded American realism, horror-comedy tone',
      audio: 'Uneasy ambience, metal movement, tension',
    };
  }

  if (engineSlug === 'seedance-2-0-fast') {
    if (locale === 'fr') {
      return {
        subject: 'Braquage absurde aux armes gonflables',
        action: 'Les voleurs entrent dans une scène de thriller bancaire',
        camera: 'Cadre cinéma lisible, rythme de brouillon rapide',
        style: 'Thriller tendu avec humour visuel absurde',
        audio: 'Ambiance banque, tension, pas de dialogue long',
      };
    }
    if (locale === 'es') {
      return {
        subject: 'Atraco absurdo con armas inflables',
        action: 'Los ladrones entran en una escena de thriller bancario',
        camera: 'Encuadre cinematográfico claro, ritmo de borrador rápido',
        style: 'Thriller tenso con humor visual absurdo',
        audio: 'Ambiente de banco, tensión, sin diálogo largo',
      };
    }
    return {
      subject: 'Absurd bank robbery with inflatable weapons',
      action: 'Robbers enter a tense crime-thriller setup',
      camera: 'Readable cinematic framing for a fast draft pass',
      style: 'Tense thriller with absurd visual humor',
      audio: 'Bank ambience, tension, no long dialogue',
    };
  }

  if (engineSlug === 'wan-2-5') {
    if (locale === 'fr') {
      return {
        subject: 'Montre fitness sur le poignet d’un runner',
        action: 'Le plan suit la course et les beats d’une piste énergique',
        camera: 'Close-up puis pull-back synchronisé',
        style: 'Vertical sport produit, pluie et énergie musicale',
        audio: 'Piste électronique énergique',
      };
    }
    if (locale === 'es') {
      return {
        subject: 'Reloj fitness en la muñeca de un corredor',
        action: 'La toma sigue la carrera y los beats de una pista energética',
        camera: 'Close-up y pull-back sincronizado',
        style: 'Vertical deportivo de producto, lluvia y energía musical',
        audio: 'Pista electrónica energética',
      };
    }
    return {
      subject: 'Fitness smartwatch on a runner’s wrist',
      action: 'Shot follows the run and beat changes of the track',
      camera: 'Close-up, then synchronized pull-back',
      style: 'Vertical product sport story, rain and music energy',
      audio: 'Energetic electronic track',
    };
  }

  if (engineSlug === 'wan-2-6') {
    if (locale === 'fr') {
      return {
        subject: 'Unboxing produit en studio cuisine',
        action: 'La personne présente un produit sur une table minimaliste',
        camera: 'Plan large 16:9, corps visible, mouvement propre',
        style: 'Studio clair, rendu produit commercial',
        audio: 'Ambiance légère, audio inclus si route active',
      };
    }
    if (locale === 'es') {
      return {
        subject: 'Unboxing de producto en estudio/cocina',
        action: 'La persona presenta un producto sobre una mesa minimalista',
        camera: 'Plano amplio 16:9, cuerpo visible, movimiento limpio',
        style: 'Estudio luminoso, render comercial de producto',
        audio: 'Ambiente ligero, audio incluido si la ruta lo expone',
      };
    }
    return {
      subject: 'Product unboxing in a clean studio kitchen',
      action: 'Person presents a product on a minimalist tabletop',
      camera: 'Wide 16:9 shot with visible body and clean motion',
      style: 'Bright studio, commercial product render',
      audio: 'Light ambience, audio included when the route exposes it',
    };
  }

  return getDemoSummary(locale);
}

function getVeo31DemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Écouteurs sans fil premium',
      action: 'Rotation macro, mise en place, puis fermeture du boîtier',
      camera: 'Dollies fluides entre trois beats courts',
      style: 'Pub produit cinématique, intérieur chaud puis rue froide',
      audio: 'Ambiance urbaine, musique électronique douce, VO courte',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Auriculares inalámbricos premium',
      action: 'Macro giratoria, puesta en uso y cierre del estuche',
      camera: 'Dollies fluidos entre tres beats cortos',
      style: 'Anuncio de producto cinematográfico, interior cálido y calle fría',
      audio: 'Ambiente urbano, música electrónica suave, voz corta',
    };
  }
  return {
    subject: 'Premium wireless earbuds',
    action: 'Macro rotation, in-use moment, and closing case',
    camera: 'Smooth dolly moves across three short beats',
    style: 'Cinematic product ad, warm interior to cool street light',
    audio: 'City ambience, soft electronic bed, short voiceover',
  };
}

function getSora2DemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Coureuse urbaine',
      action: 'Elle serre sa montre puis accélère dans la lumière du matin',
      camera: 'Close-up montre, tracking latéral, puis gros plan visage',
      style: 'Golden hour naturel, rendu lifestyle premium',
      audio: 'Pas rythmés, souffle court, musique légère',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Corredora urbana',
      action: 'Ajusta su reloj y acelera con luz de mañana',
      camera: 'Close-up del reloj, tracking lateral y primer plano final',
      style: 'Golden hour natural, look lifestyle premium',
      audio: 'Pasos rítmicos, respiración breve, música suave',
    };
  }
  return {
    subject: 'Urban runner',
    action: 'Tightens a smartwatch and accelerates through morning light',
    camera: 'Watch close-up, side tracking shot, final face close-up',
    style: 'Natural golden hour, premium lifestyle look',
    audio: 'Rhythmic footsteps, short breath, soft optimistic music',
  };
}

function getSora2ProDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Chat sur ciment frais',
      action: 'Le chat traverse le chantier et les ouvriers réagissent',
      camera: 'Angle CCTV fixe en 16:9',
      style: 'Footage de chantier crédible, ciel couvert, texture humide',
      audio: 'Audio désactivé pour ce rendu',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Gato sobre cemento fresco',
      action: 'El gato cruza la obra y los trabajadores reaccionan',
      camera: 'Ángulo CCTV fijo en 16:9',
      style: 'Metraje de obra creíble, día nublado, textura húmeda',
      audio: 'Audio desactivado en este render',
    };
  }
  return {
    subject: 'Cat crossing fresh cement',
    action: 'The cat crosses the site while workers react',
    camera: 'Fixed 16:9 CCTV angle',
    style: 'Believable construction footage, overcast light, wet texture',
    audio: 'Audio off for this render',
  };
}

function getLtx23FastDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Boxeur dans un tunnel sombre',
      action: 'Il avance vers le ring avec une tension contrôlée',
      camera: 'Tracking bas frontal, push-in lent',
      style: 'Rim light dur, brume légère, arena cinématique',
      audio: 'Rumeur de foule étouffée et impact sonore court',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Boxeador en túnel oscuro',
      action: 'Avanza hacia el ring con tensión controlada',
      camera: 'Tracking bajo frontal, push-in lento',
      style: 'Rim light duro, niebla sutil, arena cinematográfica',
      audio: 'Rumor de público apagado y golpe sonoro corto',
    };
  }
  return {
    subject: 'Boxer in a dark tunnel',
    action: 'Walks toward the ring with controlled tension',
    camera: 'Low front tracking, slow push-in',
    style: 'Hard rim light, subtle haze, cinematic arena mood',
    audio: 'Muted crowd rumble and one short impact cue',
  };
}

function getLtx23ProDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Aventurier au bord du désert',
      action: 'Ouvre une boussole ancienne qui révèle une carte lumineuse',
      camera: 'Plan large arrière, puis push-in lent vers les yeux',
      style: 'Golden hour, poussière, textures bronze, aventure premium',
      audio: 'Vent du désert, clic métal, grondement atmosphérique',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Aventurero al borde del desierto',
      action: 'Abre una brújula antigua que revela un mapa luminoso',
      camera: 'Plano amplio desde atrás, luego push-in lento hacia los ojos',
      style: 'Golden hour, polvo, texturas bronce, aventura premium',
      audio: 'Viento del desierto, clic metálico, rumble atmosférico',
    };
  }
  return {
    subject: 'Adventurer at a desert cliff',
    action: 'Opens an ancient compass that reveals a glowing map',
    camera: 'Wide rear shot, then slow push-in toward the eyes',
    style: 'Golden hour, drifting dust, bronze textures, premium adventure tone',
    audio: 'Desert wind, metallic compass click, low atmospheric rumble',
  };
}

function getKling34kDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Master produit montre premium',
      action: "Reveal lent du bord, reflet et detail d'ecran",
      camera: 'Dolly push 16:9 verrouille en 4K native',
      style: 'Studio minimal, surface graphite, highlights produit nets',
      audio: 'Audio off pour finition montage',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Master de producto smartwatch premium',
      action: 'Reveal lento de borde, reflejo y detalle de pantalla',
      camera: 'Dolly push 16:9 bloqueado en 4K nativo',
      style: 'Estudio minimal, superficie grafito, highlights de producto nitidos',
      audio: 'Audio off para acabado editorial',
    };
  }
  return {
    subject: 'Premium smartwatch product master',
    action: 'Slow reveal of edge, reflection and screen detail',
    camera: 'Locked 16:9 dolly push in native 4K',
    style: 'Minimal studio, graphite surface, crisp product highlights',
    audio: 'Audio off for editorial finishing',
  };
}

function getKling3StandardDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Runner dans une rue néon',
      action: 'Trois beats courts passent du départ à la traversée puis au plan final',
      camera: 'Plans storyboard 1080p, tracking stable et coupe lisible',
      style: 'Nuit pluvieuse, néons, look promo social',
      audio: 'Audio activé : ambiance de rue et un court effet de pas',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Runner en calle neon',
      action: 'Tres beats cortos pasan del inicio al cruce y al plano final',
      camera: 'Storyboard 1080p, tracking estable y corte legible',
      style: 'Noche lluviosa, neones, look promo social',
      audio: 'Audio activado: ambiente de calle y un efecto breve de pasos',
    };
  }
  return {
    subject: 'Runner on a neon street',
    action: 'Three short beats move from launch to crossing and final settle',
    camera: '1080p storyboard shots, stable tracking and readable cuts',
    style: 'Rainy night, neon reflections, social promo look',
    audio: 'Audio on: street ambience and one short footstep cue',
  };
}

function getKling3StandardDemoPrompt(locale: AppLocale) {
  if (locale === 'fr') {
    return [
      'Durée : 12 s • Ratio : 16:9 • Audio : activé',
      '',
      'Shot 1 (0-4 s) : @Element1 runner en veste sombre attend sous une enseigne néon, pluie légère, plan moyen stable.',
      'Shot 2 (4-8 s) : @Element1 traverse la rue, tracking latéral fluide, reflets bleus et rouges sur le sol.',
      'Shot 3 (8-12 s) : il ralentit près d’une vitrine, caméra qui se stabilise, même tenue et même lumière.',
      '',
      'Audio : ambiance de rue humide, pas courts, un léger souffle. Pas de texte, pas de logo, pas de sous-titres.',
    ].join('\n');
  }
  if (locale === 'es') {
    return [
      'Duración: 12 s • Ratio: 16:9 • Audio: activado',
      '',
      'Shot 1 (0-4 s): @Element1 runner con chaqueta oscura espera bajo un letrero neon, lluvia suave, plano medio estable.',
      'Shot 2 (4-8 s): @Element1 cruza la calle, tracking lateral fluido, reflejos azules y rojos en el suelo.',
      'Shot 3 (8-12 s): baja el ritmo junto a una vitrina, cámara se estabiliza, misma ropa y misma luz.',
      '',
      'Audio: ambiente de calle mojada, pasos cortos, respiración leve. Sin texto, sin logos, sin subtítulos.',
    ].join('\n');
  }
  return [
    'Duration: 12s • Aspect: 16:9 • Audio: on',
    '',
    'Shot 1 (0-4s): @Element1 runner in a dark jacket waits under a neon sign, light rain, stable medium shot.',
    'Shot 2 (4-8s): @Element1 crosses the street, smooth side tracking, blue and red reflections on wet pavement.',
    'Shot 3 (8-12s): he slows beside a storefront, camera settles, same wardrobe and lighting anchors.',
    '',
    'Audio: wet street ambience, short footsteps, light breath. No text, no logos, no subtitles.',
  ].join('\n');
}

function getKling3ProDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Présentatrice de lancement produit',
      action: 'Présente un prototype puis marche vers un écran de démonstration',
      camera: 'Trois plans storyboard 1080p avec tracking stable',
      style: 'Studio premium, lumière douce, reflets contrôlés',
      audio: 'Audio activé : courte ligne voice ID et ambiance studio',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Presentadora de lanzamiento de producto',
      action: 'Presenta un prototipo y camina hacia una pantalla demo',
      camera: 'Tres tomas storyboard 1080p con tracking estable',
      style: 'Estudio premium, luz suave, reflejos controlados',
      audio: 'Audio activado: línea corta con voice ID y ambiente de estudio',
    };
  }
  return {
    subject: 'Product launch presenter',
    action: 'Introduces a prototype and walks toward a demo screen',
    camera: 'Three 1080p storyboard shots with stable tracking',
    style: 'Premium studio, soft lighting, controlled reflections',
    audio: 'Audio on: short voice-ID line and studio ambience',
  };
}

function getKling3ProDemoPrompt(locale: AppLocale) {
  if (locale === 'fr') {
    return [
      'Durée : 12 s • Ratio : 16:9 • Audio : activé • shot_type : customize',
      '',
      '@Element1 = présentatrice en blazer bleu marine',
      '@Element2 = prototype transparent sur socle graphite',
      '',
      'Shot 1 (0-4 s) : plan moyen de @Element1 tenant @Element2, studio premium, lumière douce, caméra stable.',
      'Shot 2 (4-8 s) : @Element1 marche vers un écran de démonstration, tracking latéral fluide, même tenue et même produit.',
      'Shot 3 (8-12 s) : gros plan du prototype sur le socle, reflets contrôlés, caméra qui se stabilise sur la composition finale.',
      '',
      'Audio : <<<voice_1>>> “Here is the next generation of our platform.” Ambiance studio discrète, un seul cue sonore doux. Pas de texte, pas de logo, pas de sous-titres.',
    ].join('\n');
  }
  if (locale === 'es') {
    return [
      'Duración: 12 s • Ratio: 16:9 • Audio: activado • shot_type: customize',
      '',
      '@Element1 = presentadora con blazer azul marino',
      '@Element2 = prototipo transparente sobre base grafito',
      '',
      'Shot 1 (0-4 s): plano medio de @Element1 sosteniendo @Element2, estudio premium, luz suave, cámara estable.',
      'Shot 2 (4-8 s): @Element1 camina hacia una pantalla demo, tracking lateral fluido, misma ropa y mismo producto.',
      'Shot 3 (8-12 s): primer plano del prototipo en la base, reflejos controlados, cámara se estabiliza en la composición final.',
      '',
      'Audio: <<<voice_1>>> “Here is the next generation of our platform.” Ambiente de estudio discreto, un solo cue sonoro suave. Sin texto, sin logos, sin subtítulos.',
    ].join('\n');
  }
  return [
    'Duration: 12s • Aspect: 16:9 • Audio: on • shot_type: customize',
    '',
    '@Element1 = female presenter in a navy blazer',
    '@Element2 = translucent product prototype on a graphite plinth',
    '',
    'Shot 1 (0-4s): medium shot of @Element1 holding @Element2, premium studio, soft key light, stable camera.',
    'Shot 2 (4-8s): @Element1 walks toward a demo screen, smooth side tracking, same wardrobe and product anchors.',
    'Shot 3 (8-12s): close-up of the prototype on the plinth, controlled reflections, camera settles on the final composition.',
    '',
    'Audio: <<<voice_1>>> “Here is the next generation of our platform.” Quiet studio ambience, one soft UI chime. No text, no logos, no subtitles.',
  ].join('\n');
}

function getSeedance15DemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Pilote moto en rue humide',
      action: 'La moto approche puis ralentit dans le cadre',
      camera: 'Plan bas verrouillé camera_fixed, léger push-in',
      style: 'Cinématique nocturne, reflets de rue mouillée',
      audio: 'Moteur court, pluie légère, pas de dialogue',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Piloto de moto en calle mojada',
      action: 'La moto se acerca y reduce dentro del encuadre',
      camera: 'Plano bajo bloqueado camera_fixed, push-in leve',
      style: 'Cinemático nocturno, reflejos de calle mojada',
      audio: 'Motor corto, lluvia suave, sin diálogo',
    };
  }
  return {
    subject: 'Motorcycle rider on a wet street',
    action: 'Motorcycle approaches and slows inside the frame',
    camera: 'Low camera_fixed shot, slight push-in',
    style: 'Night cinematic look, wet street reflections',
    audio: 'Short engine cue, light rain, no dialogue',
  };
}

function getSeedance15DemoPrompt(locale: AppLocale) {
  if (locale === 'fr') {
    return [
      'Clip Seedance 1.5 Pro de 10 s en 16:9, audio activé.',
      'Un pilote moto traverse une rue humide de nuit et ralentit dans le cadre.',
      'camera_fixed activé : plan bas verrouillé, léger push-in, mouvement unique et lisible.',
      'Style cinématique nocturne, reflets de rue mouillée, arrière-plan simple, pas de texte ajouté.',
      'Audio : moteur court, pluie légère, ambiance de rue, pas de dialogue.',
      'Seed : réutiliser le même seed pour comparer seulement lumière, timing ou intensité audio.',
    ].join('\n');
  }
  if (locale === 'es') {
    return [
      'Clip Seedance 1.5 Pro de 10 s en 16:9, audio activado.',
      'Un piloto de moto cruza una calle mojada de noche y reduce dentro del encuadre.',
      'camera_fixed activado: plano bajo bloqueado, push-in leve, un solo movimiento legible.',
      'Look cinemático nocturno, reflejos de calle mojada, fondo simple, sin texto añadido.',
      'Audio: motor corto, lluvia suave, ambiente de calle, sin diálogo.',
      'Seed: reutiliza el mismo seed para comparar solo luz, timing o intensidad de audio.',
    ].join('\n');
  }
  return [
    '10s Seedance 1.5 Pro clip in 16:9, audio on.',
    'A motorcycle rider crosses a wet street at night and slows inside the frame.',
    'camera_fixed enabled: low locked shot, slight push-in, one readable motion beat.',
    'Night cinematic look, wet street reflections, simple background, no added text.',
    'Audio: short engine cue, light rain, street ambience, no dialogue.',
    'Seed: reuse the same seed when comparing only lighting, timing or audio intensity.',
  ].join('\n');
}

function getHailuoDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Cycliste sur chemin mouillé',
      action: 'Traverse une flaque et ralentit',
      camera: 'Tracking latéral bas, un push-in doux',
      style: 'Lumière naturelle au crépuscule, décor simple',
      output: 'Brouillon silencieux, mouvement physique uniquement',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Ciclista en camino mojado',
      action: 'Cruza un charco y reduce velocidad',
      camera: 'Tracking lateral bajo, un push-in suave',
      style: 'Luz natural al atardecer, fondo simple',
      output: 'Borrador sin audio, solo movimiento físico',
    };
  }
  return {
    subject: 'Cyclist on wet pavement',
    action: 'Rides through a shallow puddle and slows down',
    camera: 'Low side tracking, one smooth push-in',
    style: 'Natural dusk light, simple background',
    output: 'Silent draft, physics-focused motion only',
  };
}

function getHailuoDemoPrompt(locale: AppLocale) {
  if (locale === 'fr') {
    return [
      'Brouillon Hailuo 02 silencieux de 10 s en 16:9.',
      'Un cycliste traverse une flaque peu profonde sur un chemin en béton vide.',
      'L’eau éclabousse vers l’extérieur et la veste réagit au mouvement.',
      'Tracking latéral bas avec un seul push-in doux, lumière naturelle au crépuscule, décor simple.',
      'Se concentrer sur la physique du mouvement. Pas de dialogue, pas de musique, pas de SFX.',
    ].join('\n');
  }
  if (locale === 'es') {
    return [
      'Borrador Hailuo 02 sin audio de 10 s en 16:9.',
      'Un ciclista cruza un charco poco profundo en un camino de concreto vacío.',
      'El agua salpica hacia afuera y la chaqueta reacciona al movimiento.',
      'Tracking lateral bajo con un solo push-in suave, luz natural al atardecer, fondo simple.',
      'Enfocar la prueba en la física del movimiento. Sin diálogo, sin música, sin SFX.',
    ].join('\n');
  }
  return [
    '10s silent Hailuo 02 draft in 16:9.',
    'A cyclist rides through a shallow puddle on an empty concrete path.',
    'Water splashes outward and the jacket fabric reacts to the motion.',
    'Low side tracking shot with one smooth push-in, natural dusk light, simple background.',
    'Focus on physics-driven movement. No dialogue, no music, no SFX.',
  ].join('\n');
}

function getPikaDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Petit magicien pixel-art',
      action: 'Remue un chaudron lumineux en boucle',
      camera: 'Plan moyen fixe, composition 1:1',
      style: 'Pixel-art rétro, palette chaude, lumière de bougie',
      output: 'Clip silencieux, sans texte ni logo',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Pequeño mago pixel-art',
      action: 'Remueve un caldero brillante en loop',
      camera: 'Plano medio fijo, composición 1:1',
      style: 'Pixel-art retro, paleta cálida, luz de vela',
      output: 'Clip sin audio, sin texto ni logos',
    };
  }
  return {
    subject: 'Tiny pixel-art wizard',
    action: 'Stirs a glowing cauldron in a seamless loop',
    camera: 'Locked medium shot, 1:1 composition',
    style: 'Retro pixel art, warm palette, candlelight',
    output: 'Silent clip, no text or logos',
  };
}

function getPikaDemoPrompt(locale: AppLocale) {
  if (locale === 'fr') {
    return [
      'Loop Pika 2.2 Text-to-Video de 5 s en 1:1.',
      'Un petit magicien pixel-art remue un chaudron lumineux dans une cabane cosy.',
      'Caméra fixe en plan moyen, bulles qui montent en boucle, livres qui flottent doucement.',
      'Palette chaude 16 couleurs, lumière de bougie, gros pixels rétro, mouvement simple et répétable.',
      'Prompt négatif : texte, logos, flou, personnages supplémentaires, mains déformées.',
    ].join('\n');
  }
  if (locale === 'es') {
    return [
      'Loop Pika 2.2 Text-to-Video de 5 s en 1:1.',
      'Un pequeño mago pixel-art remueve un caldero brillante en una cabaña acogedora.',
      'Cámara fija en plano medio, burbujas que suben en loop, libros flotando suavemente.',
      'Paleta cálida de 16 colores, luz de vela, píxeles retro grandes, movimiento simple y repetible.',
      'Prompt negativo: texto, logos, blur, personajes extra, manos deformes.',
    ].join('\n');
  }
  return [
    '5s Pika 2.2 Text-to-Video loop in 1:1.',
    'A tiny pixel-art wizard stirs a glowing cauldron inside a cozy cottage.',
    'Locked medium shot, bubbles rising in a repeatable loop, books floating gently.',
    'Warm 16-color palette, candlelight, chunky retro pixels, simple repeatable motion.',
    'Negative prompt: text, logos, blur, extra characters, distorted hands.',
  ].join('\n');
}

function getLumaFlashDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Voiture sportive dans un tunnel humide',
      action: 'Entre dans la lumière et révèle sa silhouette',
      camera: 'Push-in court, caméra basse et stable',
      style: 'Draft cinématique, reflets rapides, contraste propre',
      output: 'Brouillon silencieux, prêt à comparer avec Ray 2',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Auto deportivo en túnel mojado',
      action: 'Entra en la luz y revela la silueta',
      camera: 'Push-in corto, cámara baja y estable',
      style: 'Borrador cinemático, reflejos rápidos, contraste limpio',
      output: 'Borrador sin audio, listo para comparar con Ray 2',
    };
  }
  return {
    subject: 'Sports car in a wet tunnel',
    action: 'Enters the light and reveals its silhouette',
    camera: 'Short push-in, low stable camera',
    style: 'Cinematic draft, fast reflections, clean contrast',
    output: 'Silent draft, ready to compare against Ray 2',
  };
}

function getLumaFlashDemoPrompt(locale: AppLocale) {
  if (locale === 'fr') {
    return [
      'Brouillon Luma Ray 2 Flash de 5 s en 16:9, sortie silencieuse.',
      'Une voiture sportive futuriste entre dans un tunnel humide et révèle sa silhouette dans une bande de lumière.',
      'Push-in court, caméra basse stable, reflets rapides sur l’asphalte, contraste propre.',
      'Un seul beat de mouvement, énergie teaser, pas de texte lisible, pas de logo ajouté.',
      'Utiliser Flash pour valider direction et timing avant une passe Ray 2.',
    ].join('\n');
  }
  if (locale === 'es') {
    return [
      'Borrador Luma Ray 2 Flash de 5 s en 16:9, salida sin audio.',
      'Un auto deportivo futurista entra en un túnel mojado y revela su silueta en una franja de luz.',
      'Push-in corto, cámara baja estable, reflejos rápidos sobre el asfalto, contraste limpio.',
      'Un solo beat de movimiento, energía de teaser, sin texto legible ni logo agregado.',
      'Usar Flash para validar dirección y timing antes de una pasada Ray 2.',
    ].join('\n');
  }
  return [
    '5s Luma Ray 2 Flash draft in 16:9, silent output.',
    'A futuristic sports car enters a wet tunnel and reveals its silhouette in a band of light.',
    'Short push-in, low stable camera, fast asphalt reflections, clean contrast.',
    'One motion beat, teaser energy, no readable text, no added logo.',
    'Use Flash to validate direction and timing before a Ray 2 pass.',
  ].join('\n');
}

function getLumaRay2DemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Hero produit dans un café en lumière dorée',
      action: 'La caméra glisse vers le produit puis révèle les reflets',
      camera: 'Dolly lent, cadrage stable, profondeur de champ douce',
      style: 'Cinématique premium, reflets contrôlés, aucune marque ajoutée',
      output: 'Rendu silencieux Ray 2, prêt pour une passe de livraison',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Hero de producto en café con luz dorada',
      action: 'La cámara avanza hacia el producto y revela los reflejos',
      camera: 'Dolly lento, encuadre estable, profundidad de campo suave',
      style: 'Cinemático premium, reflejos controlados, sin marca agregada',
      output: 'Render Ray 2 sin audio, listo para entrega',
    };
  }
  return {
    subject: 'Product hero in a golden-hour cafe',
    action: 'Camera glides toward the product and reveals reflections',
    camera: 'Slow dolly, stable framing, shallow depth of field',
    style: 'Premium cinematic look, controlled highlights, no added branding',
    output: 'Silent Ray 2 render, ready for delivery review',
  };
}

function getLumaRay2DemoPrompt(locale: AppLocale) {
  if (locale === 'fr') {
    return [
      'Rendu Luma Ray 2 de 9 s en 16:9, sortie silencieuse.',
      'Un produit premium est posé sur une table de café en lumière dorée, avec reflets propres et arrière-plan doux.',
      'Dolly avant lent, caméra stable, mouvement unique et lisible, profondeur de champ cinématique.',
      'Conserver le cadrage produit, éviter tout texte illisible, logo ajouté ou mouvement trop rapide.',
      'Pour Modify/Reframe, garder le mouvement source validé et préciser uniquement ce qui change.',
    ].join('\n');
  }
  if (locale === 'es') {
    return [
      'Render Luma Ray 2 de 9 s en 16:9, salida sin audio.',
      'Un producto premium sobre una mesa de café con luz dorada, reflejos limpios y fondo suave.',
      'Dolly lento hacia adelante, cámara estable, un solo movimiento claro, profundidad de campo cinemática.',
      'Mantener el encuadre del producto, evitar texto ilegible, logos agregados o movimiento demasiado rápido.',
      'Para Modify/Reframe, conserva el movimiento fuente aprobado y precisa solo qué cambia.',
    ].join('\n');
  }
  return [
    '9s Luma Ray 2 render in 16:9, silent output.',
    'A premium product sits on a golden-hour cafe table with clean reflections and a soft background.',
    'Slow forward dolly, stable camera, one readable motion beat, cinematic depth of field.',
    'Preserve product framing, avoid unreadable text, added logos or overly fast motion.',
    'For Modify/Reframe, keep the approved source motion and specify only what changes.',
  ].join('\n');
}

function getVeoLiteDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Réunion romantique sur un quai de gare',
      action: 'Un couple en tenue début 1900 court l’un vers l’autre',
      camera: 'Plan large en grue qui descend lentement',
      style: 'Lumière du matin, vapeur douce, tons sépia',
      audio: 'Ambiance de gare, pas de dialogue',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Reencuentro romántico en un andén de tren',
      action: 'Una pareja con ropa de principios de 1900 corre para encontrarse',
      camera: 'Plano abierto con grúa descendiendo lentamente',
      style: 'Luz de mañana, vapor suave, tonos sepia',
      audio: 'Ambiente de estación, sin diálogo',
    };
  }
  return {
    subject: 'Romantic train-platform reunion',
    action: 'Early-1900s couple runs toward each other',
    camera: 'Wide crane shot descending slowly',
    style: 'Morning light, soft steam, sepia period-drama tones',
    audio: 'Train station ambience, no dialogue',
  };
}

function getVeoLiteDemoPrompt(locale: AppLocale) {
  if (locale === 'fr') {
    return [
      'Clip Veo 3.1 Lite de 8 s en 16:9, audio inclus.',
      'Réunion romantique cinématique sur un grand quai de gare, énergie de drame d’époque, élégante et intemporelle.',
      'Un jeune couple en vêtements début 1900 court l’un vers l’autre : manteau sombre et chapeau pour l’homme, longue robe beige et petite valise vintage pour la femme.',
      'Plan large en grue qui descend lentement vers eux, sensation légère de longue focale, mouvement fluide.',
      'Lumière douce du matin filtrée par la vapeur et la verrière, tons sépia, bruns, laiton et crème. Une seule action claire, pas de texte ou signalétique proche caméra.',
    ].join('\n');
  }
  if (locale === 'es') {
    return [
      'Clip Veo 3.1 Lite de 8 s en 16:9, audio incluido.',
      'Reencuentro romántico cinematográfico en un gran andén de tren, con energía de drama de época, elegante y atemporal.',
      'Una pareja joven con ropa de principios de 1900 corre para encontrarse: él lleva abrigo oscuro y sombrero; ella, vestido beige largo y una pequeña maleta vintage.',
      'Plano abierto con grúa descendiendo lentamente hacia ellos, ligera sensación de teleobjetivo y movimiento cinematográfico suave.',
      'Luz suave de mañana filtrada por vapor y cristal, tonos sepia, marrones, latón y crema. Una sola acción clara, sin texto ni señalética cerca de cámara.',
    ].join('\n');
  }
  return [
    '8s Veo 3.1 Lite clip in 16:9, audio included.',
    'Romantic cinematic reunion on a large train station platform, grand period-drama energy, elegant and timeless.',
    'A young couple in early-1900s clothing runs toward each other: the man in a dark wool coat and hat, the woman in a long beige dress with a small vintage suitcase.',
    'Wide crane shot descending slowly toward them, slight long-lens feel, smooth cinematic motion.',
    'Soft morning light filtered through steam and glass, sepia tones, muted browns, brass, and cream. One clear action only, no close foreground signage.',
  ].join('\n');
}

function getVeoFastDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Présentatrice dans un bureau de nuit',
      action: 'Elle relève les yeux du laptop et dit une phrase courte',
      camera: 'Plan rapproché moyen, dérive handheld lente',
      style: 'Lumière bleue de ville, lampe de bureau chaude',
      audio: 'Clavier discret, ville en fond, voix courte',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Presentadora en escritorio nocturno',
      action: 'Levanta la mirada del portátil y dice una línea corta',
      camera: 'Plano medio corto, deriva handheld lenta',
      style: 'Luz azul de ciudad, lámpara cálida de escritorio',
      audio: 'Tecleo suave, ciudad de fondo, voz corta',
    };
  }
  return {
    subject: 'Presenter in a late-night desk scene',
    action: 'Looks up from a laptop and delivers one calm line',
    camera: 'Medium close-up, slow handheld drift',
    style: 'Cool city window light with a warm desk lamp',
    audio: 'Soft typing, city hum, short voice line',
  };
}

function getDuration(media: FeaturedMedia | null, locale: AppLocale) {
  const seconds = media?.durationSec ?? 12;
  return locale === 'fr' || locale === 'es' ? `${seconds} s` : `${seconds}s`;
}

function getAspect(media: FeaturedMedia | null) {
  return media?.aspectRatio && /^\d+:\d+$/.test(media.aspectRatio) ? media.aspectRatio : '16:9';
}

function getImagePromptExamples(locale: AppLocale, engineSlug: string) {
  if (engineSlug === 'seedream') {
    if (locale === 'fr') {
      return [
        {
          title: 'Still produit de référence',
          badge: '2K still',
          icon: ImageIcon,
          prompt:
            'Packshot 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, étiquette lisible, fond minimal prêt à servir de référence.',
        },
        {
          title: 'Planche personnage',
          badge: '2-10 refs',
          icon: Users,
          prompt:
            'Planche de référence personnage : même visage, tenue et palette sur quatre vues propres, fond neutre, détails de veste et accessoires cohérents.',
        },
        {
          title: 'Retouche image',
          badge: 'Image edit',
          icon: PenLine,
          prompt:
            'À partir de cette image produit, préserver forme, logo et proportions. Nettoyer poussières et reflets parasites, simplifier le décor, garder une lumière naturelle.',
        },
        {
          title: 'Batch storyboard',
          badge: '4 images',
          icon: Sparkles,
          prompt:
            'Créer quatre images cohérentes pour storyboard de lancement : hero produit, détail matière, contexte lifestyle et frame finale. Même palette, même lumière, cadrages distincts.',
        },
      ];
    }
    if (locale === 'es') {
      return [
        {
          title: 'Still de producto',
          badge: 'Still 2K',
          icon: ImageIcon,
          prompt:
            'Packshot 2K de una botella de perfume ámbar sobre acrílico blanco, luz suave de estudio, sombra limpia, etiqueta legible, fondo minimal listo como referencia.',
        },
        {
          title: 'Hoja de personaje',
          badge: '2-10 refs',
          icon: Users,
          prompt:
            'Hoja de referencia de personaje: mismo rostro, outfit y paleta en cuatro vistas limpias, fondo neutro, detalles consistentes de chaqueta y accesorios.',
        },
        {
          title: 'Edición de imagen',
          badge: 'Image edit',
          icon: PenLine,
          prompt:
            'Usando esta imagen de producto, conservar forma, logo y proporciones. Limpiar polvo y reflejos molestos, simplificar el entorno y mantener luz natural.',
        },
        {
          title: 'Batch storyboard',
          badge: '4 imágenes',
          icon: Sparkles,
          prompt:
            'Crear cuatro imágenes coherentes para storyboard de lanzamiento: hero de producto, detalle de material, contexto lifestyle y frame final. Misma paleta, misma luz, encuadres distintos.',
        },
      ];
    }
    return [
      {
        title: 'Product reference still',
        badge: '2K still',
        icon: ImageIcon,
        prompt:
          '2K product still of an amber perfume bottle on white acrylic, soft studio light, clean shadow, readable label, minimal background ready for reference use.',
      },
      {
        title: 'Character reference sheet',
        badge: '2-10 refs',
        icon: Users,
        prompt:
          'Character reference sheet with the same face, outfit and palette across four clean views, neutral background, consistent jacket details and accessories.',
      },
      {
        title: 'Image edit cleanup',
        badge: 'Image edit',
        icon: PenLine,
        prompt:
          'Using this product image, preserve shape, logo and proportions. Clean dust and unwanted reflections, simplify the environment and keep natural lighting.',
      },
      {
        title: 'Storyboard batch',
        badge: '4 images',
        icon: Sparkles,
        prompt:
          'Create four coherent launch storyboard images: product hero, material detail, lifestyle context and final frame. Same palette, same lighting, distinct compositions.',
      },
    ];
  }

  if (engineSlug === 'nano-banana-2') {
    if (locale === 'fr') {
      return [
        {
          title: 'Scène produit guidée',
          badge: '1K grounded',
          icon: Sparkles,
          prompt:
            'Still produit 1K pour une gourde outdoor sur pierre claire, lumière naturelle, style campagne e-commerce premium, contexte visuel actuel de randonnée urbaine si le grounding web est activé.',
        },
        {
          title: 'Edit produit',
          badge: 'Image edit',
          icon: PenLine,
          prompt:
            'À partir de cette référence produit, garder la forme, le logo, la couleur principale et les proportions. Changer le décor en studio minéral clair, nettoyer reflets et poussières.',
        },
        {
          title: 'Multi-références',
          badge: '14 refs max',
          icon: ImageIcon,
          prompt:
            'Combiner les références en un still cohérent : référence 1 pour identité produit, référence 2 pour matière, référence 3 pour palette, référence 4 pour composition. Ne pas mélanger les styles.',
        },
        {
          title: 'Still large 4K',
          badge: '4K · 21:9',
          icon: Maximize2,
          prompt:
            'Still 4K en ratio 21:9 pour bannière de lancement, produit à gauche, espace négatif à droite pour texte ajouté ensuite, lumière douce, rendu photo réaliste.',
        },
      ];
    }
    if (locale === 'es') {
      return [
        {
          title: 'Escena de producto guiada',
          badge: '1K grounded',
          icon: Sparkles,
          prompt:
            'Still de producto 1K para una botella outdoor sobre piedra clara, luz natural, estilo campaña e-commerce premium, contexto visual actual de trekking urbano si web grounding está activo.',
        },
        {
          title: 'Edit de producto',
          badge: 'Image edit',
          icon: PenLine,
          prompt:
            'Usando esta referencia de producto, mantener forma, logo, color principal y proporciones. Cambiar el entorno a estudio mineral claro, limpiar reflejos y polvo.',
        },
        {
          title: 'Multi-referencias',
          badge: '14 refs max',
          icon: ImageIcon,
          prompt:
            'Combinar las referencias en un still coherente: referencia 1 para identidad del producto, referencia 2 para material, referencia 3 para paleta, referencia 4 para composición. No mezclar estilos.',
        },
        {
          title: 'Still amplio 4K',
          badge: '4K · 21:9',
          icon: Maximize2,
          prompt:
            'Still 4K en ratio 21:9 para banner de lanzamiento, producto a la izquierda, espacio negativo a la derecha para texto añadido después, luz suave, resultado fotorealista.',
        },
      ];
    }
    return [
      {
        title: 'Grounded product scene',
        badge: '1K grounded',
        icon: Sparkles,
        prompt:
          '1K product still for an outdoor water bottle on pale stone, natural daylight, premium e-commerce campaign style, current urban hiking context if web grounding is enabled.',
      },
      {
        title: 'Product edit',
        badge: 'Image edit',
        icon: PenLine,
        prompt:
          'Using this product reference, keep the shape, logo, main color and proportions. Change the environment to a light mineral studio, clean reflections and remove dust.',
      },
      {
        title: 'Multi-reference edit',
        badge: '14 refs max',
        icon: ImageIcon,
        prompt:
          'Combine the references into one cohesive still: reference 1 for product identity, reference 2 for material, reference 3 for palette, reference 4 for composition. Do not blend competing styles.',
      },
      {
        title: 'Wide-ratio 4K still',
        badge: '4K · 21:9',
        icon: Maximize2,
        prompt:
          '4K still in 21:9 for a launch banner, product on the left, negative space on the right for text added later, soft light, photorealistic finish.',
      },
    ];
  }
  if (engineSlug === 'gpt-image-2') {
    if (locale === 'fr') {
      return [
        {
          title: 'Packshot avec label lisible',
          badge: 'High · 1024x768',
          icon: ImageIcon,
          prompt:
            'Packshot catalogue d’un sachet de café premium intitulé "SUMMIT ROAST", notes de dégustation lisibles, table en bois clair, lumière douce, cadrage propre, fond e-commerce.',
        },
        {
          title: 'Poster texte exact',
          badge: '4K text',
          icon: Type,
          prompt:
            'Poster vertical 4K avec titre exact "CREATOR LAUNCH CHECKLIST", 8 modules numérotés, typographie nette, fond blanc, accents bleu nuit et cyan, marges régulières.',
        },
        {
          title: 'Mockup UI',
          badge: '1920x1080',
          icon: Maximize2,
          prompt:
            'Mockup d’écran SaaS 1920x1080 pour dashboard analytics, cards blanches, navigation latérale, titres lisibles, chiffres réalistes, style produit premium.',
        },
        {
          title: 'Retouche contrôlée',
          badge: 'Image edit',
          icon: PenLine,
          prompt:
            'À partir de cette image produit, conserver forme, label, proportions et reflet principal. Remplacer le fond par un studio clair, retirer poussières et reflets parasites.',
        },
        {
          title: 'Edit guidé par masque',
          badge: 'Mask URL',
          icon: Sparkles,
          prompt:
            'Modifier uniquement la zone masquée : remplacer le texte secondaire par "LIMITED RESERVE", garder logo, couleur du packaging, ombre et perspective inchangés.',
        },
        {
          title: 'Hero still 4K',
          badge: '3840x2160',
          icon: Maximize2,
          prompt:
            'Hero still 4K pour page produit, smartphone noir sur surface graphite, texte écran lisible, reflet contrôlé, éclairage studio premium, espace négatif à droite.',
        },
      ];
    }
    if (locale === 'es') {
      return [
        {
          title: 'Still de producto legible',
          badge: 'High · 1024x768',
          icon: ImageIcon,
          prompt:
            'Foto de catálogo de una bolsa de café premium titulada "SUMMIT ROAST", notas de sabor legibles, mesa de madera clara, luz suave, encuadre limpio, fondo e-commerce.',
        },
        {
          title: 'Póster con texto exacto',
          badge: 'Texto 4K',
          icon: Type,
          prompt:
            'Póster vertical 4K con título exacto "CREATOR LAUNCH CHECKLIST", 8 módulos numerados, tipografía nítida, fondo blanco, acentos azul noche y cian, márgenes regulares.',
        },
        {
          title: 'Mockup UI',
          badge: '1920x1080',
          icon: Maximize2,
          prompt:
            'Mockup de pantalla SaaS 1920x1080 para dashboard de analytics, cards blancas, navegación lateral, títulos legibles, cifras realistas, estilo de producto premium.',
        },
        {
          title: 'Edición controlada',
          badge: 'Image edit',
          icon: PenLine,
          prompt:
            'Usando esta imagen de producto, conservar forma, etiqueta, proporciones y reflejo principal. Cambiar el fondo a un estudio claro, quitar polvo y reflejos molestos.',
        },
        {
          title: 'Edit con máscara',
          badge: 'Mask URL',
          icon: Sparkles,
          prompt:
            'Modificar solo la zona con máscara: cambiar el texto secundario a "LIMITED RESERVE", mantener logo, color del packaging, sombra y perspectiva sin cambios.',
        },
        {
          title: 'Hero still 4K',
          badge: '3840x2160',
          icon: Maximize2,
          prompt:
            'Hero still 4K para página de producto, smartphone negro sobre superficie grafito, texto de pantalla legible, reflejo controlado, luz de estudio premium, espacio negativo a la derecha.',
        },
      ];
    }
    return [
      {
        title: 'Product still with readable label',
        badge: 'High · 1024x768',
        icon: ImageIcon,
        prompt:
          'Catalog product photo of a premium coffee bag titled "SUMMIT ROAST", readable tasting notes, light wood table, soft daylight, clean framing, e-commerce background.',
      },
      {
        title: 'Exact-text poster',
        badge: '4K text',
        icon: Type,
        prompt:
          'Vertical 4K poster with exact title "CREATOR LAUNCH CHECKLIST", 8 numbered modules, crisp typography, white background, navy and cyan accents, even margins.',
      },
      {
        title: 'UI mockup',
        badge: '1920x1080',
        icon: Maximize2,
        prompt:
          '1920x1080 SaaS analytics dashboard screen mockup, white cards, left navigation, readable headings, realistic metrics, premium product UI style.',
      },
      {
        title: 'Controlled image edit',
        badge: 'Image edit',
        icon: PenLine,
        prompt:
          'Using this product image, preserve shape, label, proportions and main reflection. Replace the background with a bright studio, remove dust and distracting reflections.',
      },
      {
        title: 'Mask-guided edit',
        badge: 'Mask URL',
        icon: Sparkles,
        prompt:
          'Modify only the masked region: replace the secondary copy with "LIMITED RESERVE", keep logo, packaging color, shadow and perspective unchanged.',
      },
      {
        title: '4K hero still',
        badge: '3840x2160',
        icon: Maximize2,
        prompt:
          '4K product-page hero still, black smartphone on graphite surface, readable screen text, controlled reflection, premium studio lighting, negative space on the right.',
      },
    ];
  }
  if (locale === 'fr') {
    return [
      {
        title: 'Visuel campagne',
        badge: '2K still',
        icon: Sparkles,
        prompt:
          'Still campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.',
      },
      {
        title: 'Poster typographique',
        badge: 'Typographie',
        icon: Type,
        prompt:
          'Poster vertical 4K, grille éditoriale premium, fond graphite, grand titre exact "MIDNIGHT LAUNCH", sous-titre "LIMITED DROP", hiérarchie nette, marges généreuses, texte lisible.',
      },
      {
        title: 'Retouche référence',
        badge: 'Image-to-image',
        icon: PenLine,
        prompt:
          'À partir de cette référence produit, garder la forme, le logo et les proportions. Changer le décor en studio bleu nuit, améliorer les reflets, retirer poussières et traces.',
      },
      {
        title: '2K vers 4K final',
        badge: 'Final 4K',
        icon: Maximize2,
        prompt:
          'Reprendre la composition validée en 2K. Sortie 4K finale, détails plus nets, typographie identique, mêmes couleurs de marque, conserver cadrage et placement du produit.',
      },
    ];
  }
  if (locale === 'es') {
    return [
      {
        title: 'Still de campaña',
        badge: 'Still 2K',
        icon: Sparkles,
        prompt:
          'Still de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.',
      },
      {
        title: 'Póster tipográfico',
        badge: 'Tipografía',
        icon: Type,
        prompt:
          'Póster vertical 4K, grilla editorial premium, fondo grafito, título exacto grande "MIDNIGHT LAUNCH", subtítulo "LIMITED DROP", jerarquía clara, márgenes amplios, texto legible.',
      },
      {
        title: 'Edición con referencia',
        badge: 'Image-to-image',
        icon: PenLine,
        prompt:
          'Usando esta referencia de producto, mantener forma, logo y proporciones. Cambiar el entorno a estudio azul noche, mejorar reflejos, quitar polvo y marcas.',
      },
      {
        title: '2K a final 4K',
        badge: 'Final 4K',
        icon: Maximize2,
        prompt:
          'Reutilizar la composición aprobada en 2K. Salida final 4K, detalles más nítidos, tipografía idéntica, mismos colores de marca, mantener encuadre y posición del producto.',
      },
    ];
  }
  return [
    {
      title: 'Campaign still',
      badge: '2K still',
      icon: Sparkles,
      prompt:
        '2K campaign still for an amber perfume bottle on white acrylic, soft studio key light, clean shadow, exact headline "AURA NOIRE" top-left, small logo lockup bottom edge.',
    },
    {
      title: 'Typography poster',
      badge: 'Typography',
      icon: Type,
      prompt:
        'Vertical 4K poster, premium editorial grid, graphite background, exact headline "MIDNIGHT LAUNCH", subhead "LIMITED DROP", crisp hierarchy, generous margins, readable text.',
    },
    {
      title: 'Reference edit',
      badge: 'Image-to-image',
      icon: PenLine,
      prompt:
        'Using this product reference, keep the shape, logo and proportions. Change the scene to a midnight-blue studio, improve reflections, remove dust and fingerprints.',
    },
    {
      title: '2K to 4K final',
      badge: '4K final',
      icon: Maximize2,
      prompt:
        'Rerun the approved 2K composition as a 4K final. Sharpen fine details, keep typography identical, preserve brand colors, product position and the locked framing.',
    },
  ];
}

export function ModelDecisionPromptingSection({
  imageAnchorId,
  copy,
  demoMedia,
  engineSlug,
  isImageEngine,
  locale,
  modelName,
  referenceWorkflows,
}: ModelDecisionPromptingSectionProps) {
  const labels = getPromptLabels(locale, modelName);
  const isHailuoDraftRoute = engineSlug === 'minimax-hailuo-02-text';
  const isPikaTextRoute = engineSlug === 'pika-text-to-video';
  const isLumaRay2Route = engineSlug === 'luma-ray-2' || engineSlug === 'lumaRay2';
  const isLumaFlashRoute = engineSlug === 'luma-ray-2-flash' || engineSlug === 'lumaRay2_flash';
  const isSora2Route = engineSlug === 'sora-2';
  const isSora2ProRoute = engineSlug === 'sora-2-pro';
  const isVeo31Route = engineSlug === 'veo-3-1';
  const isVeoFastRoute = engineSlug === 'veo-3-1-fast';
  const isVeoLiteRoute = engineSlug === 'veo-3-1-lite';
  const isSeedance20FastRoute = engineSlug === 'seedance-2-0-fast';
  const isSeedance15ProRoute = engineSlug === 'seedance-1-5-pro';
  const isLtx23FastRoute = engineSlug === 'ltx-2-3-fast';
  const isLtx23ProRoute = engineSlug === 'ltx-2-3-pro' || engineSlug === 'ltx-2-3';
  const isKling3ProRoute = engineSlug === 'kling-3-pro';
  const isKling3StandardRoute = engineSlug === 'kling-3-standard';
  const isKling34kRoute = engineSlug === 'kling-3-4k';
  const isSilentPromptRoute = isHailuoDraftRoute || isPikaTextRoute || isLumaRay2Route || isLumaFlashRoute;
  const standardDemo = getRouteDemoSummary(locale, engineSlug);
  const seedance15Demo = getSeedance15DemoSummary(locale);
  const hailuoDemo = getHailuoDemoSummary(locale);
  const pikaDemo = getPikaDemoSummary(locale);
  const lumaRay2Demo = getLumaRay2DemoSummary(locale);
  const lumaFlashDemo = getLumaFlashDemoSummary(locale);
  const sora2Demo = getSora2DemoSummary(locale);
  const sora2ProDemo = getSora2ProDemoSummary(locale);
  const ltx23FastDemo = getLtx23FastDemoSummary(locale);
  const ltx23ProDemo = getLtx23ProDemoSummary(locale);
  const kling3ProDemo = getKling3ProDemoSummary(locale);
  const kling3StandardDemo = getKling3StandardDemoSummary(locale);
  const kling34kDemo = getKling34kDemoSummary(locale);
  const veo31Demo = getVeo31DemoSummary(locale);
  const veoFastDemo = getVeoFastDemoSummary(locale);
  const veoLiteDemo = getVeoLiteDemoSummary(locale);
  const demo = isHailuoDraftRoute
    ? { ...hailuoDemo, audio: hailuoDemo.output }
    : isSeedance15ProRoute
      ? { ...seedance15Demo, output: seedance15Demo.audio }
      : isPikaTextRoute
        ? { ...pikaDemo, audio: pikaDemo.output }
        : isLumaRay2Route
          ? { ...lumaRay2Demo, audio: lumaRay2Demo.output }
          : isLumaFlashRoute
            ? { ...lumaFlashDemo, audio: lumaFlashDemo.output }
            : isSora2Route
              ? { ...sora2Demo, output: sora2Demo.audio }
              : isSora2ProRoute
                ? { ...sora2ProDemo, output: sora2ProDemo.audio }
                : isLtx23FastRoute
                  ? { ...ltx23FastDemo, output: ltx23FastDemo.audio }
                  : isLtx23ProRoute
                    ? { ...ltx23ProDemo, output: ltx23ProDemo.audio }
                    : isKling34kRoute
                      ? { ...kling34kDemo, output: kling34kDemo.audio }
                      : isKling3ProRoute
                        ? { ...kling3ProDemo, output: kling3ProDemo.audio }
                      : isKling3StandardRoute
                        ? { ...kling3StandardDemo, output: kling3StandardDemo.audio }
                      : isVeo31Route
                        ? { ...veo31Demo, output: veo31Demo.audio }
                        : isVeoFastRoute
                          ? { ...veoFastDemo, output: veoFastDemo.audio }
                          : isVeoLiteRoute
                            ? { ...veoLiteDemo, output: veoLiteDemo.audio }
                            : { ...standardDemo, output: standardDemo.audio };
  const title = copy.promptingTitle ?? `Prompt Lab — ${modelName}`;
  const intro = copy.promptingIntro ?? '';
  const imageExamplesIntro =
    engineSlug === 'seedream'
      ? locale === 'fr'
        ? 'Prompts Seedream pour stills produit, planches personnage, retouches image et batches de storyboard.'
        : locale === 'es'
          ? 'Prompts de Seedream para stills de producto, hojas de personaje, edición de imagen y batches de storyboard.'
          : 'Seedream prompts for product stills, character reference sheets, image edits and storyboard batches.'
      : engineSlug === 'nano-banana-2'
      ? locale === 'fr'
        ? 'Exemples pour stills guidés, edits produit, multi-références et formats larges 4K.'
        : locale === 'es'
          ? 'Ejemplos para stills guiados, edits de producto, multi-referencias y formatos amplios 4K.'
          : 'Use these for grounded stills, product edits, multi-reference workflows and wide-ratio 4K images.'
      : engineSlug === 'gpt-image-2'
      ? locale === 'fr'
        ? 'Prompts GPT Image 2 pour texte lisible, packshots produit, mockups UI, edits contrôlés, masques et finales 4K.'
        : locale === 'es'
          ? 'Prompts de GPT Image 2 para texto legible, producto, mockups UI, edits controlados, máscaras y finales 4K.'
          : 'GPT Image 2 prompts for readable text, product stills, UI mockups, controlled edits, masks and 4K finals.'
      : labels.imageExamplesIntro;
  const guideLabel = copy.promptingGuideLabel ?? labels.guide;
  const guideHref = copy.promptingGuideUrl ?? null;
  const referencesTitle =
    engineSlug === 'seedream'
      ? locale === 'fr'
        ? 'Comment Seedream prépare les références'
        : locale === 'es'
          ? 'Cómo Seedream prepara referencias'
          : 'How Seedream prepares references'
      : engineSlug === 'gpt-image-2'
        ? locale === 'fr'
          ? 'Comment GPT Image 2 utilise les sources et masques'
          : locale === 'es'
            ? 'Cómo GPT Image 2 usa fuentes y máscaras'
            : 'How GPT Image 2 uses sources and masks'
      : isHailuoDraftRoute
        ? locale === 'fr'
          ? 'Comment Hailuo 02 structure un test mouvement'
          : locale === 'es'
            ? 'Cómo Hailuo 02 estructura una prueba de movimiento'
            : 'How Hailuo 02 structures motion tests'
        : isPikaTextRoute
          ? locale === 'fr'
            ? 'Comment Pika 2.2 structure un prompt Text-to-Video'
            : locale === 'es'
              ? 'Cómo Pika 2.2 estructura un prompt Text-to-Video'
              : 'How Pika 2.2 structures Text-to-Video prompts'
          : isLumaRay2Route
            ? locale === 'fr'
              ? 'Comment Luma Ray 2 utilise Generate, Modify et Reframe'
              : locale === 'es'
                ? 'Cómo Luma Ray 2 usa Generate, Modify y Reframe'
                : 'How Luma Ray 2 uses Generate, Modify and Reframe'
            : isLumaFlashRoute
            ? locale === 'fr'
              ? 'Comment Luma Ray 2 Flash utilise les images de départ et routes edit'
              : locale === 'es'
                ? 'Cómo Luma Ray 2 Flash usa imágenes iniciales y rutas de edición'
                : 'How Luma Ray 2 Flash uses start frames and edit routes'
            : isLtx23ProRoute
              ? locale === 'fr'
                ? 'Comment LTX 2.3 Pro utilise Generate, Audio, Extend et Retake'
                : locale === 'es'
                  ? 'Cómo LTX 2.3 Pro usa Generate, Audio, Extend y Retake'
                  : 'How LTX 2.3 Pro uses Generate, Audio, Extend and Retake'
            : isKling34kRoute
              ? locale === 'fr'
                ? 'Comment Kling 3 4K utilise les references'
                : locale === 'es'
                  ? 'Cómo Kling 3 4K usa referencias'
                  : 'How Kling 3 4K uses references'
            : isKling3ProRoute
              ? locale === 'fr'
                ? 'Comment Kling 3 Pro utilise les plans et références'
                : locale === 'es'
                  ? 'Cómo Kling 3 Pro usa tomas y referencias'
                  : 'How Kling 3 Pro uses shots and references'
            : isKling3StandardRoute
              ? locale === 'fr'
                ? 'Comment Kling 3 Standard structure les plans et références'
                : locale === 'es'
                  ? 'Cómo Kling 3 Standard estructura tomas y referencias'
                  : 'How Kling 3 Standard structures shots and references'
            : isVeo31Route
              ? locale === 'fr'
                ? 'Comment Veo 3.1 utilise les références'
                : locale === 'es'
                  ? 'Cómo Veo 3.1 usa referencias'
                  : 'How Veo 3.1 uses references'
            : isVeoFastRoute
              ? locale === 'fr'
                ? 'Comment Veo 3.1 Fast utilise images de départ, références et image finale'
                : locale === 'es'
                  ? 'Cómo Veo 3.1 Fast usa imagen inicial, referencias y frame final'
                  : 'How Veo 3.1 Fast uses start, reference and ending frames'
            : isSora2Route
              ? locale === 'fr'
                ? 'Comment Sora 2 utilise prompt, image source et audio'
                : locale === 'es'
                  ? 'Cómo Sora 2 usa prompt, imagen inicial y audio'
                  : 'How Sora 2 uses prompts, start images and audio'
            : isSora2ProRoute
              ? locale === 'fr'
                ? 'Comment Sora 2 Pro utilise prompts, références et audio'
                : locale === 'es'
                  ? 'Cómo Sora 2 Pro usa prompts, referencias y audio'
                  : 'How Sora 2 Pro uses prompts, references and audio'
            : isVeoLiteRoute
              ? locale === 'fr'
                ? 'Comment Veo 3.1 Lite utilise les images de départ'
                : locale === 'es'
                  ? 'Cómo Veo 3.1 Lite usa imágenes iniciales'
                  : 'How Veo 3.1 Lite uses image references'
            : isSeedance15ProRoute
              ? locale === 'fr'
                ? 'Comment prompter Seedance 1.5 Pro'
                : locale === 'es'
                  ? 'Cómo hacer prompts para Seedance 1.5 Pro'
                  : 'How to prompt Seedance 1.5 Pro'
            : labels.referencesTitle;
  const posterSrc = demoMedia?.posterUrl ?? null;
  const demoVideoSrc = demoMedia?.videoUrl ?? demoMedia?.previewVideoUrl ?? null;
  const demoPromptText =
    isHailuoDraftRoute
      ? getHailuoDemoPrompt(locale)
      : isSeedance15ProRoute
        ? getSeedance15DemoPrompt(locale)
      : isSora2Route && copy.demoPrompt.length
        ? copy.demoPrompt.join('\n')
      : isSora2ProRoute && copy.demoPrompt.length
        ? copy.demoPrompt.join('\n')
      : isLtx23FastRoute && copy.demoPrompt.length
        ? copy.demoPrompt.join('\n')
      : isLtx23ProRoute && copy.demoPrompt.length
        ? copy.demoPrompt.join('\n')
      : isVeo31Route && copy.demoPrompt.length
        ? copy.demoPrompt.join('\n')
      : isVeoFastRoute && copy.demoPrompt.length
        ? copy.demoPrompt.join('\n')
      : isKling34kRoute && copy.demoPrompt.length
        ? copy.demoPrompt.join('\n')
      : isKling3ProRoute
        ? (copy.demoPrompt.length ? copy.demoPrompt.join('\n') : getKling3ProDemoPrompt(locale))
      : isKling3StandardRoute
        ? (copy.demoPrompt.length ? copy.demoPrompt.join('\n') : getKling3StandardDemoPrompt(locale))
      : isPikaTextRoute
        ? getPikaDemoPrompt(locale)
        : isLumaRay2Route
          ? getLumaRay2DemoPrompt(locale)
        : isLumaFlashRoute
          ? getLumaFlashDemoPrompt(locale)
          : isVeoLiteRoute
            ? getVeoLiteDemoPrompt(locale)
          : (demoMedia?.prompt ??
              [
                `${labels.demoSubject}: ${demo.subject}`,
                `${labels.demoAction}: ${demo.action}`,
                `${labels.demoCamera}: ${demo.camera}`,
                `${labels.demoStyle}: ${demo.style}`,
                `${labels.demoAudio}: ${demo.audio}`,
              ].join('\n'));
  const demoDurationLabel = isHailuoDraftRoute
    ? (locale === 'fr' || locale === 'es' ? '10 s' : '10s')
    : isSeedance15ProRoute
      ? (locale === 'fr' || locale === 'es' ? '10 s' : '10s')
    : isPikaTextRoute
      ? (locale === 'fr' || locale === 'es' ? '5 s' : '5s')
      : isLumaRay2Route
        ? (locale === 'fr' || locale === 'es' ? '9 s' : '9s')
        : isLumaFlashRoute
        ? (locale === 'fr' || locale === 'es' ? '5 s' : '5s')
        : isSora2ProRoute
          ? (locale === 'fr' || locale === 'es' ? '8 s' : '8s')
        : isSora2Route
          ? (locale === 'fr' || locale === 'es' ? '8 s' : '8s')
          : isLtx23FastRoute
            ? (locale === 'fr' || locale === 'es' ? '10 s' : '10s')
          : isLtx23ProRoute
            ? getDuration(demoMedia, locale)
          : isKling34kRoute
            ? (locale === 'fr' || locale === 'es' ? '6 s' : '6s')
          : isKling3ProRoute
            ? getDuration(demoMedia, locale)
          : isKling3StandardRoute
            ? getDuration(demoMedia, locale)
          : isVeo31Route
            ? (locale === 'fr' || locale === 'es' ? '8 s' : '8s')
          : isVeoFastRoute
            ? (locale === 'fr' || locale === 'es' ? '8 s' : '8s')
          : isVeoLiteRoute
            ? (locale === 'fr' || locale === 'es' ? '8 s' : '8s')
          : getDuration(demoMedia, locale);
  const demoAspectLabel = isSilentPromptRoute ? (isPikaTextRoute ? '1:1' : '16:9') : getAspect(demoMedia);
  const demoModeLabel = isHailuoDraftRoute
    ? locale === 'fr'
      ? 'Brouillon silencieux'
      : locale === 'es'
        ? 'Borrador sin audio'
        : 'Silent motion draft'
    : isSeedance15ProRoute
      ? locale === 'fr'
        ? 'Prompt camera_fixed'
        : locale === 'es'
          ? 'Prompt camera_fixed'
          : 'camera_fixed prompt'
    : isSora2ProRoute
      ? locale === 'fr'
        ? 'Check Pro'
        : locale === 'es'
          ? 'Check Pro'
          : 'Pro scene check'
    : isSora2Route
      ? locale === 'fr'
        ? 'Prompt lifestyle 720p'
        : locale === 'es'
          ? 'Prompt lifestyle 720p'
          : '720p lifestyle prompt'
    : isLtx23FastRoute
      ? locale === 'fr'
        ? 'Check brouillon fast'
        : locale === 'es'
          ? 'Check de borrador fast'
          : 'Fast draft check'
    : isLtx23ProRoute
      ? (copy.demoPromptLabel ?? (locale === 'fr' ? 'Prompt Generate' : locale === 'es' ? 'Prompt Generate' : 'Generate prompt'))
    : isKling34kRoute
      ? (copy.demoPromptLabel ?? (locale === 'fr' ? 'Master 4K final' : locale === 'es' ? 'Master 4K final' : 'Final 4K master'))
    : isKling3ProRoute
      ? (copy.demoPromptLabel ?? (locale === 'fr' ? 'Prompt Pro' : locale === 'es' ? 'Prompt Pro' : 'Pro prompt'))
    : isKling3StandardRoute
      ? (copy.demoPromptLabel ?? (locale === 'fr' ? 'Prompt storyboard' : locale === 'es' ? 'Prompt storyboard' : 'Storyboard prompt'))
    : isVeo31Route
      ? (copy.demoPromptLabel ?? (locale === 'fr' ? 'Prompt Veo 3.1' : locale === 'es' ? 'Prompt Veo 3.1' : 'Veo 3.1 prompt'))
    : isVeoFastRoute
      ? (copy.demoPromptLabel ?? (locale === 'fr' ? 'Prompt Veo Fast' : locale === 'es' ? 'Prompt Veo Fast' : 'Veo Fast prompt'))
    : isPikaTextRoute
      ? 'Text-to-Video'
      : isLumaRay2Route
        ? locale === 'fr'
          ? 'Workflow Ray 2'
          : locale === 'es'
            ? 'Workflow Ray 2'
            : 'Ray 2 workflow'
        : isLumaFlashRoute
        ? locale === 'fr'
          ? 'Brouillon Flash'
          : locale === 'es'
            ? 'Borrador Flash'
            : 'Flash draft'
        : isVeoLiteRoute
          ? locale === 'fr'
            ? 'Prompt Veo Lite'
            : locale === 'es'
              ? 'Prompt Veo Lite'
              : 'Veo Lite prompt'
        : labels.textToVideo;
  const demoOutputLabel = isSilentPromptRoute
    ? locale === 'fr'
      ? 'Sortie'
      : locale === 'es'
        ? 'Salida'
        : 'Output'
    : isSora2ProRoute
      ? labels.demoAudio
    : isSora2Route
      ? labels.demoAudio
    : labels.demoAudio;
  const demoOutputValue = isSilentPromptRoute || isSora2Route || isSora2ProRoute ? demo.output : demo.audio;
  const demoAudioChipLabel = isSilentPromptRoute
    ? locale === 'fr'
      ? 'Silencieux'
      : locale === 'es'
        ? 'Sin audio'
        : 'Silent'
      : isSora2ProRoute
        ? locale === 'fr'
          ? 'Audio désactivé'
          : locale === 'es'
            ? 'Audio desactivado'
            : 'Audio off'
      : isKling34kRoute
        ? locale === 'fr'
          ? 'Audio off'
          : locale === 'es'
            ? 'Audio off'
            : 'Audio off'
      : isKling3ProRoute
        ? labels.audioOn
      : isKling3StandardRoute
        ? labels.audioOn
      : labels.audioOn;
  const demoAlt = isPikaTextRoute
    ? locale === 'fr'
      ? 'Loop pixel-art Pika 2.2'
      : locale === 'es'
        ? 'Loop pixel-art de Pika 2.2'
        : 'Pika 2.2 pixel-art loop'
    : isSeedance20FastRoute
      ? locale === 'fr'
        ? 'Brouillon de mouvement Seedance 2.0 Fast'
        : locale === 'es'
          ? 'Borrador de movimiento Seedance 2.0 Fast'
          : 'Seedance 2.0 Fast motion draft render'
    : isSeedance15ProRoute
      ? locale === 'fr'
        ? 'Rendu moto Seedance 1.5 Pro camera_fixed'
        : locale === 'es'
          ? 'Render moto Seedance 1.5 Pro camera_fixed'
          : 'Seedance 1.5 Pro camera-fixed motorcycle render'
    : isLumaFlashRoute
      ? locale === 'fr'
        ? 'Brouillon tunnel Luma Ray 2 Flash'
        : locale === 'es'
          ? 'Borrador de túnel Luma Ray 2 Flash'
          : 'Luma Ray 2 Flash tunnel draft'
      : isSora2ProRoute
        ? locale === 'fr'
          ? 'Rendu de contrôle de continuité Sora 2 Pro'
          : locale === 'es'
            ? 'Render de control de continuidad con Sora 2 Pro'
            : 'Sora 2 Pro continuity control render'
      : isSora2Route
        ? locale === 'fr'
          ? 'Rendu lifestyle Sora 2 avec audio'
          : locale === 'es'
            ? 'Render lifestyle de Sora 2 con audio'
            : 'Sora 2 lifestyle render with audio'
      : isLtx23FastRoute
        ? locale === 'fr'
          ? 'Brouillon boxer LTX 2.3 Fast'
          : locale === 'es'
            ? 'Borrador boxer de LTX 2.3 Fast'
            : 'LTX 2.3 Fast boxer draft'
      : isLtx23ProRoute
        ? locale === 'fr'
          ? 'Rendu aventure boussole LTX 2.3 Pro'
          : locale === 'es'
            ? 'Render de aventura con brújula LTX 2.3 Pro'
            : 'LTX 2.3 Pro desert compass adventure render'
      : isKling34kRoute
        ? locale === 'fr'
          ? 'Master produit Kling 3 4K'
          : locale === 'es'
            ? 'Master de producto Kling 3 4K'
            : 'Kling 3 4K product master render'
      : isKling3ProRoute
        ? locale === 'fr'
          ? 'Rendu lancement produit Kling 3 Pro'
          : locale === 'es'
            ? 'Render de lanzamiento de producto Kling 3 Pro'
            : 'Kling 3 Pro product launch render'
      : isKling3StandardRoute
        ? locale === 'fr'
          ? 'Brouillon storyboard Kling 3 Standard'
          : locale === 'es'
            ? 'Borrador storyboard Kling 3 Standard'
            : 'Kling 3 Standard storyboard draft render'
      : isVeo31Route
        ? locale === 'fr'
          ? 'Pub produit Veo 3.1 pour écouteurs sans fil'
          : locale === 'es'
            ? 'Anuncio de producto Veo 3.1 para auriculares inalámbricos'
            : 'Veo 3.1 wireless earbuds product ad'
      : isVeoFastRoute
        ? locale === 'fr'
          ? 'Brouillon bureau de nuit Veo 3.1 Fast'
          : locale === 'es'
            ? 'Borrador de escritorio nocturno Veo 3.1 Fast'
            : 'Veo 3.1 Fast late-night desk draft'
      : isLumaRay2Route
        ? locale === 'fr'
          ? 'Rendu produit Luma Ray 2'
          : locale === 'es'
            ? 'Render de producto Luma Ray 2'
            : 'Luma Ray 2 product render'
        : isVeoLiteRoute
          ? locale === 'fr'
            ? 'Réunion romantique Veo 3.1 Lite sur un quai de gare'
            : locale === 'es'
              ? 'Reencuentro romántico Veo 3.1 Lite en andén de tren'
              : 'Veo 3.1 Lite romantic train-platform reunion'
      : getImageAlt({
          kind: 'renderThumb',
          engine: modelName,
          label: copy.demoTitle ?? `${modelName} demo render`,
          prompt: copy.demoTitle ?? `${modelName} demo render`,
          locale,
        });

  return (
    <section id={imageAnchorId} className={`${SECTION_SCROLL_MARGIN} space-y-4`}>
      <div className="rounded-[28px] border border-slate-200/80 bg-white/[0.92] p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:!bg-slate-950/[0.72] dark:shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] sm:p-7">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-[2rem] font-semibold leading-tight tracking-normal text-slate-950 dark:text-white sm:text-[2.45rem]">
            {title}
          </h2>
          {intro ? <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{intro}</p> : null}
          {copy.promptingTip ? (
            <div className="mx-auto mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50/90 px-5 py-2 text-sm text-slate-600 dark:border-white/10 dark:!bg-white/[0.055] dark:text-slate-300">
              <UIIcon icon={Lightbulb} size={15} className="text-slate-500 dark:text-slate-300" />
              <span>{copy.promptingTip.replace(/^Tip:\s*/i, `${labels.tipPrefix}: `)}</span>
            </div>
          ) : null}
          {guideHref ? (
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              <span>{locale === 'fr' ? 'Source : ' : locale === 'es' ? 'Fuente: ' : 'Source: '}</span>
              <a
                href={guideHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-blue-600 hover:decoration-blue-300 dark:text-slate-300 dark:decoration-white/20 dark:hover:text-blue-200"
              >
                <span>{guideLabel}</span>
                <UIIcon icon={ExternalLink} size={11} className={MODEL_PAGE_ICON_MUTED} />
              </a>
            </p>
          ) : null}
        </div>

        {referenceWorkflows.length ? (
          <div className="mt-6 rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:!bg-white/[0.035]">
            <h3 className="!text-left text-base font-semibold text-slate-950 dark:text-white">{referencesTitle}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
              {referenceWorkflows.map((workflow, index) => {
                const Icon = REFERENCE_ICONS[index] ?? Sparkles;
                return (
                  <article key={workflow.title} className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:!bg-slate-950/[0.56] sm:p-4">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full sm:h-9 sm:w-9 ${MODEL_PAGE_ICON_WRAP}`}>
                      <UIIcon icon={Icon} size={17} className={MODEL_PAGE_ICON} />
                    </span>
                    <h4 className="mt-3 !text-left text-[0.82rem] font-semibold leading-snug text-slate-950 dark:text-white sm:text-sm">{workflow.title}</h4>
                    <p className="mt-1 text-[0.74rem] leading-4 text-slate-600 dark:text-slate-300 sm:text-[0.8rem] sm:leading-5">{workflow.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
          <ModelDecisionPromptTabs
            tabs={copy.promptingTabs}
            locale={locale}
            exampleHref={demoMedia?.href ?? null}
            engineSlug={engineSlug}
            isImageEngine={isImageEngine}
          />

          <div className="space-y-4 lg:pt-14">
            <article className="rounded-[20px] border border-hairline bg-surface p-4 shadow-[0_18px_54px_-38px_rgba(15,23,42,0.42)] dark:!bg-white/[0.045]">
              <div className="mb-3 flex items-center gap-3">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${MODEL_PAGE_ICON_WRAP}`}>
                  <UIIcon icon={BadgeCheck} size={19} className={MODEL_PAGE_ICON} />
                </span>
                <h3 className="!text-left text-base font-semibold text-text-primary">{labels.global}</h3>
              </div>
              <ul className="space-y-2.5 text-[0.84rem] leading-5 text-text-secondary">
                {copy.promptingGlobalPrinciples.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <UIIcon icon={BadgeCheck} size={15} className={`mt-0.5 shrink-0 ${MODEL_PAGE_ICON_MUTED}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[20px] border border-hairline bg-surface p-4 shadow-[0_18px_54px_-38px_rgba(15,23,42,0.42)] dark:!bg-white/[0.045]">
              <div className="mb-3 flex items-center gap-3">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${MODEL_PAGE_ICON_WRAP}`}>
                  <UIIcon icon={Sparkles} size={19} className={MODEL_PAGE_ICON} />
                </span>
                <h3 className="!text-left text-base font-semibold text-text-primary">{labels.quirks}</h3>
              </div>
              <ul className="space-y-2.5 text-[0.84rem] leading-5 text-text-secondary">
                {copy.promptingEngineWhy.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <UIIcon icon={BadgeCheck} size={15} className={`mt-0.5 shrink-0 ${MODEL_PAGE_ICON_MUTED}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </div>

      {isImageEngine ? (
        <article className="rounded-[22px] border border-slate-200/80 bg-white/[0.92] p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:!bg-slate-950/[0.72]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="!text-left text-2xl font-semibold text-text-primary">{labels.imageExamplesTitle}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{imageExamplesIntro}</p>
            </div>
            <a
              href={`/app/image?engine=${encodeURIComponent(engineSlug)}`}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-2"
            >
              <UIIcon icon={Sparkles} size={15} />
              <span>{labels.openImageWorkspace}</span>
            </a>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {getImagePromptExamples(locale, engineSlug).map((example) => {
              const Icon = example.icon;
              return (
                <article key={example.title} className="rounded-xl border border-hairline bg-surface p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${MODEL_PAGE_ICON_WRAP}`}>
                      <UIIcon icon={Icon} size={18} className={MODEL_PAGE_ICON} />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="!text-left text-base font-semibold text-text-primary">{example.title}</h3>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[0.68rem] font-semibold text-blue-700 dark:!bg-blue-500/[0.12] dark:text-blue-200">
                          {example.badge}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-text-secondary">{example.prompt}</p>
                      <div className="mt-3">
                        <ModelDecisionCopyButton copyText={example.prompt} label={labels.copyPrompt} copiedLabel={labels.copied} />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </article>
      ) : (
      <article className="grid gap-5 rounded-[22px] border border-slate-200/80 bg-white/[0.92] p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:!bg-slate-950/[0.72] lg:grid-cols-[minmax(0,0.86fr)_minmax(440px,1.14fr)]">
        <div>
          <h2 className="!text-left text-2xl font-semibold text-text-primary">{copy.demoTitle ?? `Demo prompt — ${modelName}`}</h2>
          <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 dark:!bg-blue-500/[0.12] dark:text-blue-200">
            {demoModeLabel}
          </span>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            <strong>{labels.demoSubject}:</strong> {demo.subject} &nbsp;•&nbsp; <strong>{labels.demoAction}:</strong> {demo.action}
            <br />
            <strong>{labels.demoCamera}:</strong> {demo.camera} &nbsp;•&nbsp; <strong>{labels.demoStyle}:</strong> {demo.style}
            <br />
            <strong>{demoOutputLabel}:</strong> {demoOutputValue}
          </p>
          <details className="mt-5 rounded-xl border border-hairline bg-surface p-4 text-sm text-text-secondary shadow-sm">
            <summary className="cursor-pointer font-semibold text-text-primary">{labels.showPrompt}</summary>
            <pre className="mt-3 max-h-[180px] overflow-auto whitespace-pre-wrap rounded-lg border border-hairline bg-bg px-3 py-3 font-mono text-[0.8rem] leading-5 text-text-primary dark:!bg-slate-950/[0.72]">
              {demoPromptText}
            </pre>
            <div className="mt-3">
              <ModelDecisionCopyButton copyText={demoPromptText} label={labels.copyPrompt} copiedLabel={labels.copied} />
            </div>
          </details>
          <div className="mt-5 flex flex-wrap gap-3">
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-secondary">
              <UIIcon icon={Clock3} size={15} />
              {demoDurationLabel}
            </span>
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-secondary">
              <UIIcon icon={Sparkles} size={15} />
              {demoAspectLabel}
            </span>
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-secondary">
              <UIIcon icon={Volume2} size={15} className={MODEL_PAGE_ICON_MUTED} />
              {demoAudioChipLabel}
            </span>
          </div>
        </div>

        <ModelDecisionDemoMedia
          posterSrc={posterSrc}
          videoSrc={demoVideoSrc}
          alt={demoAlt}
          durationLabel={demoDurationLabel}
          aspectLabel={demoAspectLabel}
          renderHref={demoMedia?.href ?? null}
          renderLabel={labels.viewFull}
        />
      </article>
      )}
    </section>
  );
}
