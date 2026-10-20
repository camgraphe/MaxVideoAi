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
test('old MOV edit-list durations are capped by media track lengths without dropping presentation offsets',()=>{
  const media={streams:[{index:0,codec_type:'video',duration:'5.000000'},{index:1,codec_type:'audio',duration:'2.064000'}]};
  const old={streams:[{index:0,codec_type:'video',start_time:'5.000000',duration:'10.000000'},{index:1,codec_type:'audio',start_time:'5.936000',duration:'8.000000'}],format:{start_time:'5.000000',duration:'10.000000'}};
  assert.equal(subtitlePresentationDuration(old,media),5000);
  const longerAudio={streams:[media.streams[0],{...media.streams[1],duration:'5.064000'}]};
  assert.equal(subtitlePresentationDuration({...old,streams:[old.streams[0],{...old.streams[1],duration:'11.000000'}]},longerAudio),6000,'Delayed audio extending past the video must retain its complete presentation span');
  assert.equal(subtitlePresentationDuration({streams:[{index:0,codec_type:'video',start_time:'5',duration:'3'}],format:{start_time:'5',duration:'3'}},media),3000,'A shorter edit-list presentation must not expand to the full physical media track');
});
