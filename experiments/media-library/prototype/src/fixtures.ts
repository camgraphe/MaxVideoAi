import type {Collection, MediaItem} from './types';

/** Logical records are synthetic; dimensions, sizes and durations describe local public fixture bytes. */
export const COLLECTIONS: Collection[] = [
  {id: 'collection-campaign', name: 'Campagne'},
  {id: 'collection-portraits', name: 'Portraits'},
  {id: 'collection-references', name: 'Références'},
];

type Template = Omit<MediaItem, 'id' | 'ref' | 'source' | 'createdAt' | 'collectionIds' | 'favorite'>;
const MEDIA_TEMPLATES: Template[] = [
  {
    "name": "Après-fête",
    "kind": "image",
    "width": 960,
    "height": 540,
    "size": 46590,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/afterparty-320.webp",
    "previewUrl": "/fixtures/previews/afterparty.webp",
    "originalUrl": "/fixtures/originals/afterparty.webp"
  },
  {
    "name": "Dixie — portrait",
    "kind": "image",
    "width": 720,
    "height": 1280,
    "size": 33332,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/dixie-320.webp",
    "previewUrl": "/fixtures/previews/dixie.webp",
    "originalUrl": "/fixtures/originals/dixie.webp"
  },
  {
    "name": "Personnage — vidéo",
    "kind": "video",
    "width": 960,
    "height": 540,
    "durationSec": 5,
    "size": 329018,
    "mime": "video/mp4",
    "thumbUrl": "/fixtures/thumbs/main-character-320.webp",
    "previewUrl": "/fixtures/previews/main-character.mp4",
    "originalUrl": "/fixtures/originals/main-character.mp4"
  },
  {
    "name": "Ambiance — audio",
    "kind": "audio",
    "width": 0,
    "height": 0,
    "durationSec": 28,
    "size": 448044,
    "mime": "audio/wav",
    "thumbUrl": "/fixtures/audio-cover.svg",
    "previewUrl": "/fixtures/previews/ambient.m4a",
    "originalUrl": "/fixtures/originals/ambient.wav"
  },
  {
    "name": "Motel disco",
    "kind": "image",
    "width": 1024,
    "height": 1024,
    "size": 181678,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/disco-motel-320.webp",
    "previewUrl": "/fixtures/previews/disco-motel.webp",
    "originalUrl": "/fixtures/originals/disco-motel.webp"
  },
  {
    "name": "Portrait — fixture vidéo",
    "kind": "video",
    "width": 540,
    "height": 960,
    "durationSec": 5,
    "size": 25493,
    "mime": "video/mp4",
    "thumbUrl": "/fixtures/thumbs/portrait-fixture-320.webp",
    "previewUrl": "/fixtures/previews/portrait-fixture.mp4",
    "originalUrl": "/fixtures/originals/portrait-fixture.mp4"
  },
  {
    "name": "Le chapeau — vidéo",
    "kind": "video",
    "width": 960,
    "height": 540,
    "durationSec": 5,
    "size": 211769,
    "mime": "video/mp4",
    "thumbUrl": "/fixtures/thumbs/hat-stays-320.webp",
    "previewUrl": "/fixtures/previews/hat-stays.mp4",
    "originalUrl": "/fixtures/originals/hat-stays.mp4"
  },
  {
    "name": "Portrait acidulé",
    "kind": "image",
    "width": 1024,
    "height": 1024,
    "size": 142914,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/acid-portrait-320.webp",
    "previewUrl": "/fixtures/previews/acid-portrait.webp",
    "originalUrl": "/fixtures/originals/acid-portrait.webp"
  },
  {
    "name": "Service de nuit",
    "kind": "image",
    "width": 1024,
    "height": 1024,
    "size": 178714,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/night-shift-320.webp",
    "previewUrl": "/fixtures/previews/night-shift.webp",
    "originalUrl": "/fixtures/originals/night-shift.webp"
  },
  {
    "name": "Vesper — portrait",
    "kind": "image",
    "width": 720,
    "height": 1280,
    "size": 65892,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/vesper-320.webp",
    "previewUrl": "/fixtures/previews/vesper.webp",
    "originalUrl": "/fixtures/originals/vesper.webp"
  },
  {
    "name": "Campagne Nano",
    "kind": "image",
    "width": 1400,
    "height": 788,
    "size": 13574,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/nano-campaign-320.webp",
    "previewUrl": "/fixtures/previews/nano-campaign.webp",
    "originalUrl": "/fixtures/originals/nano-campaign.webp"
  },
  {
    "name": "Référence Nano",
    "kind": "image",
    "width": 1400,
    "height": 1050,
    "size": 17152,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/nano-reference-320.webp",
    "previewUrl": "/fixtures/previews/nano-reference.webp",
    "originalUrl": "/fixtures/originals/nano-reference.webp"
  },
  {
    "name": "Personnage Seedream",
    "kind": "image",
    "width": 1400,
    "height": 1050,
    "size": 19144,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/seedream-character-320.webp",
    "previewUrl": "/fixtures/previews/seedream-character.webp",
    "originalUrl": "/fixtures/originals/seedream-character.webp"
  },
  {
    "name": "Variation Seedream",
    "kind": "image",
    "width": 1400,
    "height": 1400,
    "size": 19090,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/seedream-edit-320.webp",
    "previewUrl": "/fixtures/previews/seedream-edit.webp",
    "originalUrl": "/fixtures/originals/seedream-edit.webp"
  },
  {
    "name": "Produit GPT",
    "kind": "image",
    "width": 1400,
    "height": 1050,
    "size": 17790,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/gpt-product-320.webp",
    "previewUrl": "/fixtures/previews/gpt-product.webp",
    "originalUrl": "/fixtures/originals/gpt-product.webp"
  },
  {
    "name": "Étude Luma",
    "kind": "image",
    "width": 2048,
    "height": 2048,
    "size": 63626,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/luma-research-320.webp",
    "previewUrl": "/fixtures/previews/luma-research.webp",
    "originalUrl": "/fixtures/originals/luma-research.webp"
  },
  {
    "name": "Le cartographe",
    "kind": "image",
    "width": 1024,
    "height": 1536,
    "size": 2280434,
    "mime": "image/png",
    "thumbUrl": "/fixtures/thumbs/cartographer-320.webp",
    "previewUrl": "/fixtures/previews/cartographer.webp",
    "originalUrl": "/fixtures/originals/cartographer.png"
  },
  {
    "name": "Panorama Nano",
    "kind": "image",
    "width": 1800,
    "height": 771,
    "size": 14502,
    "mime": "image/webp",
    "thumbUrl": "/fixtures/thumbs/nano-wide-320.webp",
    "previewUrl": "/fixtures/previews/nano-wide.webp",
    "originalUrl": "/fixtures/originals/nano-wide.webp"
  },
  {
    "name": "Portrait Pika",
    "kind": "image",
    "width": 1280,
    "height": 2276,
    "size": 116939,
    "mime": "image/jpeg",
    "thumbUrl": "/fixtures/thumbs/pika-portrait-320.webp",
    "previewUrl": "/fixtures/previews/pika-portrait.webp",
    "originalUrl": "/fixtures/originals/pika-portrait.jpg"
  },
  {
    "name": "Portrait Wan",
    "kind": "image",
    "width": 1280,
    "height": 2276,
    "size": 116939,
    "mime": "image/jpeg",
    "thumbUrl": "/fixtures/thumbs/wan-portrait-320.webp",
    "previewUrl": "/fixtures/previews/wan-portrait.webp",
    "originalUrl": "/fixtures/originals/wan-portrait.jpg"
  }
];

/** 20 physical assets repeat across unique deterministic logical records. */
export function createFixtures(count: number): MediaItem[] {
  const length = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const start = Date.UTC(2026, 10, 8, 19, 30);
  return Array.from({length}, (_, index) => {
    const template = MEDIA_TEMPLATES[index % MEDIA_TEMPLATES.length];
    const id = 'ma_f17e' + (index + 1).toString(16).padStart(28, '0');
    const collectionIds: string[] = [];
    if (index % 4 === 0) collectionIds.push(COLLECTIONS[0].id);
    if ((template.kind === 'image' && template.height > template.width) || index % 7 === 0) collectionIds.push(COLLECTIONS[1].id);
    if (index % 5 === 0) collectionIds.push(COLLECTIONS[2].id);
    return {
      ...template,
      id,
      ref: {type: 'asset', assetId: id, kind: template.kind},
      name: template.name + ' ' + String(Math.floor(index / MEDIA_TEMPLATES.length) + 1).padStart(3, '0'),
      source: index % 3 === 0 ? 'upload' : 'generated',
      createdAt: new Date(start - index * 60_000).toISOString(),
      collectionIds,
      favorite: index % 11 === 0 || index % 17 === 0,
    };
  });
}
