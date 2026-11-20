import {makeEditorialDraft} from './editorial-draft.ts';
import {parseEditorialDraft, type EditorialBlock} from '../../frontend/lib/editorial/schema.ts';

/** Layout fixture only: this video ID does not claim to be a playable result. */
export function makeEditorialVideoDraft() {
  const draft = parseEditorialDraft(makeEditorialDraft());
  draft.sources.push({id:'fixture-video', title:'Player layout fixture', publisher:'Fixture Studio',
    url:'https://www.youtube.com/watch?v=abcdefghijk', retrievedAt:'2026-10-25'});
  const base = {type:'video' as const, videoId:'abcdefghijk', sourceId:'fixture-video', credit:'Fixture Studio',
    startSeconds:12, caption:'Player layout fixture — no generated result.'};
  const videos: EditorialBlock[] = [
    {...base, id:'legacy-video', heading:'Legacy disclosure'},
    {...base, id:'inline-landscape', heading:'Inline landscape', presentation:'inline', aspectRatio:'16:9'},
    {...base, id:'inline-portrait', heading:'Inline portrait', presentation:'inline', aspectRatio:'9:16'},
    {...base, id:'disclosure-portrait', heading:'Portrait disclosure', presentation:'disclosure', aspectRatio:'9:16'},
  ];
  for (const variant of Object.values(draft.locales)) variant.blocks.push(...structuredClone(videos));
  draft.assets[0].sha256 = 'a'.repeat(64);
  return draft;
}
