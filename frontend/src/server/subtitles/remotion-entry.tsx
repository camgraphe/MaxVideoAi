import React from 'react';
import {AbsoluteFill,Composition,OffthreadVideo,registerRoot,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {SubtitleOverlay} from '../../lib/subtitles/SubtitleOverlay';
import type {SubtitleDocument} from '../../lib/subtitles/document';
export type SubtitleCompositionProps={document:SubtitleDocument|null;width:number;height:number;fps:number;durationInFrames:number};
function SubtitleComposition({document}:SubtitleCompositionProps){
  const {width,height,fps}=useVideoConfig(),frame=useCurrentFrame();
  if(!document)throw new Error('SUBTITLE_DOCUMENT_REQUIRED');
  return <AbsoluteFill style={{backgroundColor:'black'}}><OffthreadVideo src={staticFile('source.mp4')} style={{width:'100%',height:'100%',objectFit:'contain'}}/><SubtitleOverlay document={document} timeMs={frame*1000/fps} width={width} height={height}/></AbsoluteFill>;
}
function Root(){return <Composition id="MaxVideoAISubtitles" component={SubtitleComposition} defaultProps={{document:null,width:320,height:180,fps:30,durationInFrames:30}} width={320} height={180} fps={30} durationInFrames={30} calculateMetadata={({props})=>({width:props.width,height:props.height,fps:props.fps,durationInFrames:props.durationInFrames})}/>;}
registerRoot(Root);
