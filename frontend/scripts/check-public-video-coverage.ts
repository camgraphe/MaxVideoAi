import manifestConfig from '../config/public-video-renditions.manifest.json';
import projectionConfig from '../config/public-video-renditions.generated.json';
import sourceConfig from '../config/public-video-sources.json';
import {
  HERO_ENGINE_MEDIA,
  HERO_VIDEO_ORDER,
} from '../components/marketing/home/home-redesign-visuals';
import type { PublicVideoRenditionProjection } from '../lib/public-video-renditions';
import { checkCriticalHomeVideoCoverage } from './_lib/public-video-coverage';
import type { PublicVideoSource, PublishedManifest } from './_lib/public-video-renditions';

if (sourceConfig.schemaVersion !== 1 || sourceConfig.role !== 'public-demo') {
  throw new Error('Invalid public video source catalogue');
}

const sources: PublicVideoSource[] = sourceConfig.sources.map((source) => ({
  ...source,
  role: 'public-demo',
}));

checkCriticalHomeVideoCoverage({
  heroVideoOrder: HERO_VIDEO_ORDER,
  heroEngineMedia: HERO_ENGINE_MEDIA,
  sources,
  manifest: manifestConfig as PublishedManifest,
  projection: projectionConfig as PublicVideoRenditionProjection,
});

console.log(`[public-video-coverage] check passed heroes=${HERO_VIDEO_ORDER.length}`);
