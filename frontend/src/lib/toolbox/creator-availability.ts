/** Public discovery is enabled only after the operation and its evidence are verified. */
import { CREATOR_TOOL_IDS, type CreatorToolId } from './catalogue';
export { CREATOR_TOOL_IDS, type CreatorToolId } from './catalogue';
export const CREATOR_TOOL_AVAILABILITY: Readonly<Record<CreatorToolId, { publicReleased: boolean }>> = {
  subtitles: { publicReleased: false },
  'lip-sync': { publicReleased: false },
  'product-photo-editor': { publicReleased: false },
  'product-video-editor': { publicReleased: false },
  'motion-transfer': { publicReleased: false },
};
export function isCreatorToolPublic(id: string): id is CreatorToolId {
  return Object.prototype.hasOwnProperty.call(CREATOR_TOOL_AVAILABILITY, id)
    && CREATOR_TOOL_AVAILABILITY[id as CreatorToolId].publicReleased;
}
export function getReleasedCreatorToolIds(): CreatorToolId[] {
  return CREATOR_TOOL_IDS.filter(isCreatorToolPublic);
}
/** Receives canonical English paths, as used by the route discovery owner. */
export function isCreatorPublicPathAvailable(englishPath: string): boolean {
  const id = englishPath.replace(/\/$/, '').match(/^\/tools\/([^/]+)$/)?.[1];
  return !id || !CREATOR_TOOL_IDS.includes(id as CreatorToolId) || isCreatorToolPublic(id);
}
