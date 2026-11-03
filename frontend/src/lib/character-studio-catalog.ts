/** Shared authored choice IDs/prompts. Preview images are inspiration, never generation references. */
export type StudioLocale = 'en' | 'fr' | 'es';
export type StudioLabel = Record<StudioLocale, string>;
export type StudioChoice = {
  id: string;
  label: StudioLabel;
  prompt: string;
  tile: number;
  atlas?: 'identity' | 'creatures';
};
const label = (en: string, fr: string, es: string): StudioLabel => ({
  en,
  fr,
  es,
});
const choice = (
  id: string,
  tile: number,
  en: string,
  fr: string,
  es: string,
  prompt: string,
): StudioChoice => ({
  id,
  tile,
  label: label(en, fr, es),
  prompt,
});

export const STUDIO_CHARACTER_TYPES: Array<StudioChoice & { nonHuman?: boolean }> = [
  choice('natural', 0, 'Natural', 'Naturel', 'Natural', 'natural balanced human facial proportions'),
  choice(
    'distinctive',
    1,
    'Distinctive',
    'Singulier',
    'Singular',
    'striking distinctive facial geometry and pronounced features, still believable',
  ),
  choice(
    'exaggerated',
    2,
    'Exaggerated',
    'Exagéré',
    'Exagerado',
    'deliberately exaggerated unusual human facial proportions, highly distinctive character',
  ),
  {
    ...choice('animal', 0, 'Animal', 'Animal', 'Animal', 'an anthropomorphic animal character with an unmistakably animal head, muzzle, ears and species-specific features'),
    atlas: 'creatures', nonHuman: true,
  },
  {
    ...choice('insect', 1, 'Insect', 'Insecte', 'Insecto', 'an expressive insect character with an insect head, compound eyes, antennae and a chitinous exoskeleton'),
    atlas: 'creatures', nonHuman: true,
  },
  {
    ...choice('fruit', 2, 'Fruit head', 'Tête de fruit', 'Cabeza de fruta', 'an imaginative character with a recognizable fruit for a head, expressive features integrated into its natural fruit texture'),
    atlas: 'creatures', nonHuman: true,
  },
  {
    ...choice('alien', 3, 'Alien', 'Extraterrestre', 'Extraterrestre', 'an extraterrestrial character with clearly nonhuman facial structure, unusual eyes and alien surface textures'),
    atlas: 'creatures', nonHuman: true,
  },
];
export const STUDIO_PRESENTATIONS = [
  choice('woman', 4, 'Feminine', 'Féminine', 'Femenina', ''),
  choice('man', 5, 'Masculine', 'Masculine', 'Masculina', ''),
  choice('androgynous', 6, 'Androgynous', 'Androgyne', 'Andrógina', ''),
];
export const STUDIO_AGES = [
  choice('young-adult', 8, 'Young adult', 'Jeune adulte', 'Adulto joven', ''),
  choice('adult', 9, 'Adult', 'Adulte', 'Adulto', ''),
  choice('mature', 10, 'Mature', 'Mature', 'Maduro', ''),
  choice('senior', 11, 'Senior', 'Senior', 'Mayor', ''),
];

export const STUDIO_EYES = [
  choice('almond', 0, 'Almond', 'En amande', 'Almendrados', 'almond-shaped eyes'),
  choice('round', 1, 'Round', 'Ronds', 'Redondos', 'round eyes'),
  choice('hooded', 2, 'Hooded', 'Paupières couvrantes', 'Encapotados', 'hooded eyelids'),
  choice('monolid', 3, 'Monolid', 'Sans pli visible', 'Sin pliegue', 'monolid eyes'),
  choice('upturned', 4, 'Upturned', 'Relevés', 'Ascendentes', 'upturned eyes'),
  choice('downturned', 5, 'Downturned', 'Tombants', 'Descendentes', 'downturned eyes'),
];
export const STUDIO_HAIR = [
  choice('wavy-bob', 0, 'Wavy bob', 'Carré ondulé', 'Bob ondulado', 'wavy bob hairstyle'),
  choice('straight', 1, 'Long straight', 'Longs lisses', 'Largo liso', 'long straight hairstyle'),
  choice('curly', 2, 'Loose curls', 'Boucles souples', 'Rizos suaves', 'loosely curled hairstyle'),
  choice('tied-back', 3, 'Tied back', 'Attachés', 'Recogido', 'tied-back hairstyle'),
  choice('short-crop', 4, 'Short crop', 'Coupe courte', 'Corte corto', 'short cropped hairstyle'),
  choice('braids', 5, 'Braids', 'Tresses', 'Trenzas', 'braided hairstyle'),
  choice('afro', 6, 'Afro', 'Afro', 'Afro', 'natural afro hairstyle'),
  choice('buzz-cut', 7, 'Buzz cut', 'Rasés', 'Rapado', 'buzz cut hairstyle'),
  choice('bald', 8, 'Bald', 'Chauve', 'Calvo', 'bald head without hair'),
  choice('locs', 9, 'Locs', 'Locs', 'Locs', 'locs hairstyle'),
  choice('pixie', 10, 'Pixie', 'Pixie', 'Pixie', 'pixie haircut'),
  choice('fringe', 11, 'Fringe', 'Frange', 'Flequillo', 'hairstyle with a full fringe'),
];
export const STUDIO_CLOTHING = [
  choice('casual', 0, 'Casual', 'Casual', 'Casual', 'casual everyday wardrobe styling'),
  choice('streetwear', 1, 'Streetwear', 'Streetwear', 'Streetwear', 'streetwear styling'),
  choice('sport', 2, 'Sport', 'Sport', 'Deportivo', 'athletic sportswear styling'),
  choice('business', 3, 'Business', 'Business', 'Profesional', 'business wardrobe styling'),
  choice('formal', 4, 'Evening', 'Soirée', 'De noche', 'formal evening wardrobe styling'),
  choice('retro', 5, 'Retro', 'Rétro', 'Retro', 'retro vintage wardrobe styling'),
  choice('bohemian', 6, 'Bohemian', 'Bohème', 'Bohemio', 'bohemian wardrobe styling'),
  choice('alternative', 7, 'Alternative', 'Alternatif', 'Alternativo', 'alternative wardrobe styling'),
];

export const STUDIO_SCENES = [
  choice(
    'blue_photo_studio',
    0,
    'Blue studio',
    'Studio bleu',
    'Estudio azul',
    'blue photography studio backdrop',
  ),
  choice(
    'brown_photostudio_01',
    1,
    'Warm studio',
    'Studio chaleureux',
    'Estudio cálido',
    'warm brown photography studio backdrop',
  ),
  choice(
    'blocky_photo_studio',
    2,
    'Architectural studio',
    'Studio architectural',
    'Estudio arquitectónico',
    'minimal architectural photography studio',
  ),
  choice(
    'ferndale_studio_01',
    3,
    'Softbox studio',
    'Studio softbox',
    'Estudio softbox',
    'softbox-lit photography studio',
  ),
  choice(
    'ferndale_studio_02',
    4,
    'Colored light',
    'Lumière colorée',
    'Luz de color',
    'studio with colored accent lighting',
  ),
  choice(
    'monochrome_studio_01',
    5,
    'Monochrome studio',
    'Studio monochrome',
    'Estudio monocromo',
    'monochrome photography studio',
  ),
  choice('comfy_cafe', 6, 'Cozy café', 'Café cosy', 'Café acogedor', 'cozy cafe interior'),
  choice('cayley_interior', 7, 'Living room', 'Salon', 'Salón', 'comfortable contemporary living room'),
  choice('blinds', 8, 'Kitchen', 'Cuisine', 'Cocina', 'kitchen and dining room with window blinds'),
  choice(
    'blender_institute',
    9,
    'Shared office',
    'Bureau partagé',
    'Oficina compartida',
    'shared creative office interior',
  ),
  choice(
    'art_studio',
    10,
    'Art studio',
    'Atelier d’artiste',
    'Taller de artista',
    'artist studio with workshop details',
  ),
  choice('crossfit_gym', 11, 'Gym', 'Salle de sport', 'Gimnasio', 'gym interior'),
  choice(
    'homecoming_center_rooftop',
    12,
    'City rooftop',
    'Toit-terrasse',
    'Azotea urbana',
    'urban rooftop terrace',
  ),
  choice(
    'hotel_rooftop_balcony',
    13,
    'Hotel balcony',
    'Balcon d’hôtel',
    'Balcón de hotel',
    'hotel balcony above the city',
  ),
  choice(
    'cobblestone_street_night',
    14,
    'Street at night',
    'Rue de nuit',
    'Calle de noche',
    'cobblestone street at night',
  ),
  choice(
    'german_town_street',
    15,
    'Town street',
    'Rue contemporaine',
    'Calle urbana',
    'contemporary town street',
  ),
  choice('birbeck_street_underpass', 16, 'Underpass', 'Passage urbain', 'Paso urbano', 'urban underpass'),
  choice(
    'braustuble_alley',
    17,
    'Historic alley',
    'Ruelle historique',
    'Callejón histórico',
    'historic narrow alley',
  ),
  choice(
    'fish_hoek_beach',
    18,
    'Sandy beach',
    'Plage de sable',
    'Playa de arena',
    'sandy beach by the ocean',
  ),
  choice(
    'autumn_forest_01',
    19,
    'Autumn forest',
    'Forêt d’automne',
    'Bosque de otoño',
    'forest with autumn foliage',
  ),
  choice(
    'epping_forest_02',
    20,
    'Forest clearing',
    'Clairière',
    'Claro del bosque',
    'natural forest clearing',
  ),
  choice('borghese_gardens', 21, 'Garden', 'Parc arboré', 'Parque arbolado', 'lush park with mature trees'),
  choice(
    'lake_pier',
    22,
    'Lake pier',
    'Ponton sur un lac',
    'Muelle en el lago',
    'wooden pier on a calm lake',
  ),
  choice('gamrig', 23, 'Mountains', 'Montagne', 'Montaña', 'natural mountain landscape'),
].map((entry, index) => ({
  ...entry,
  family: ['studio', 'interior', 'urban', 'nature'][Math.floor(index / 6)],
}));

export function getStudioScene(id: unknown) {
  return typeof id === 'string' ? STUDIO_SCENES.find((entry) => entry.id === id) : undefined;
}
