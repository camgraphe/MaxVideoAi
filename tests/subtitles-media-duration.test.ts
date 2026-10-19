import assert from 'node:assert/strict';
import test from 'node:test';
import {subtitlePresentationDuration} from '../frontend/src/server/subtitles/media';

test('subtitle duration measures presented audio/video rather than AAC container padding',()=>{
  assert.equal(subtitlePresentationDuration({streams:[{codec_type:'video',start_time:'0',duration:'12.000000'},{codec_type:'audio',start_time:'0',duration:'12.028005'}],format:{start_time:'0',duration:'12.052000'}}),12028);
  assert.equal(subtitlePresentationDuration({streams:[{codec_type:'video',start_time:'0',duration:'12.066667'},{codec_type:'audio',start_time:'0',duration:'12.066667'}],format:{start_time:'0',duration:'12.118000'}}),12067);
});
test('subtitle duration preserves track offsets and falls back when a track duration is unknown',()=>{
  assert.equal(subtitlePresentationDuration({streams:[{codec_type:'video',start_time:'5',duration:'3'},{codec_type:'audio',start_time:'5.5',duration:'3'}],format:{start_time:'5',duration:'3.6'}}),3500);
  assert.equal(subtitlePresentationDuration({streams:[{codec_type:'video',duration:'3'},{codec_type:'audio'}],format:{duration:'3.6'}}),3600);
  assert.ok(Number.isNaN(subtitlePresentationDuration({streams:[]})));
});
