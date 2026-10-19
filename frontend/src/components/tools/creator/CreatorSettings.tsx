'use client';
import type { CreatorToolId, CreatorSourceInput, CreatorAvailableProfile } from '@/lib/toolbox/creator-tools';
import type { CreatorSource } from './creator-source-selection';
import { creatorWorkspaceCopy } from './creator-workspace-copy';
import styles from './creator-workspace.module.css';
export type SegmentDraft = { enabled: boolean; start: string; end: string };
export function CreatorSettings({ toolId, locale, settings, onChange, disabled, profile, motionProfileId, motionControlEnabled, onMotionProfileChange }: {
  toolId: CreatorToolId; locale: string; settings: Record<string, string>; onChange(patch: Record<string, string>): void; disabled: boolean;profile?:CreatorAvailableProfile;motionProfileId?:string;motionControlEnabled?:boolean;onMotionProfileChange?(id:string):void;
}) {
  const copy = creatorWorkspaceCopy(locale), photo = toolId === 'product-photo-editor', motion = toolId === 'motion-transfer';
  const select = (key: string, label: string, choices: [string,string][]) => <label key={key}>{label}<select value={settings[key]} disabled={disabled} onChange={event => onChange({ [key]: event.target.value })}>{choices.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  const specialist = motion && motionProfileId === 'motion-kling-v3-v1';
  return <div className={styles.settings}>
    {motion ? <label>{copy.motionMethod}<select disabled={disabled} value={motionProfileId} onChange={event => onMotionProfileChange?.(event.target.value)}>{motionControlEnabled ? <option value="motion-kling-v3-v1">{copy.motionControl}</option> : null}<option value="motion-wan-reference-v1">{copy.referenceGuidance}</option></select></label> : null}
    {(photo || toolId === 'product-video-editor') && select('action', copy.action, photo ? [['studio',copy.studio],['lifestyle',copy.lifestyle],['lighting',copy.lighting]] : [['background',copy.background],['lighting',copy.lighting],['style',copy.styleAction]])}
    {photo && select('model',copy.model,[['gpt-image-2-5-flare','GPT Image 2.5 Flare'],['nano-banana-2','Nano Banana 2']])}
    {photo && select('aspectRatio',copy.aspect,[['auto',copy.auto],...['1:1','4:3','3:4','16:9','9:16'].map(value => [value,value] as [string,string])])}
    {motion && select('orientation',specialist ? copy.characterOrientation : copy.orientation,[['video',copy.video],['image',copy.photo]])}
    {(motion || toolId === 'product-video-editor') && <>{!specialist && profile?.constraints.resolution !== 'provider' ? select('resolution',copy.resolution,['480p','720p','1080p'].map(value => [value,value])) : null}{select('audioPolicy',copy.audioPolicy,[['preserve',copy.preserve],['mute',copy.mute]])}</>}
    {!(toolId === 'lip-sync' && settings.mode === 'video') ? <label>{copy.instruction}<textarea maxLength={2000} value={settings.instruction} disabled={disabled} onChange={event => onChange({ instruction: event.target.value })} /></label> : null}
    <p className={styles.notice}>{photo ? copy.photoDisclosure : motion ? specialist ? copy.motionControlDisclosure : copy.motionDisclosure : toolId === 'lip-sync' ? settings.mode === 'video' ? copy.lipVideoDisclosure : copy.lipDisclosure : copy.videoDisclosure}</p>
  </div>;
}
export function CreatorSegmentFields({ locale, role, source, value, onChange, disabled }: {
  locale: string; role: CreatorSourceInput['role']; source: CreatorSource; value?: SegmentDraft; onChange(value: SegmentDraft): void; disabled: boolean;
}) {
  const copy = creatorWorkspaceCopy(locale), draft = value ?? { enabled:false,start:'0',end:String(source.durationSec ?? '') };
  return <div className={styles.settings}>
    <label><span><input style={{width:20,minHeight:20,marginRight:8}} type="checkbox" checked={draft.enabled} disabled={disabled} onChange={event => onChange({ ...draft, enabled:event.target.checked })} />{copy.segment} — {copy.sourceLabels[role]}</span></label>
    {draft.enabled ? <><div className={styles.timeInputs}>
      <label>{copy.start}<input type="number" min="0" step="0.001" value={draft.start} disabled={disabled} onChange={event => onChange({ ...draft,start:event.target.value })} /></label>
      <label>{copy.end}<input type="number" min="0" step="0.001" max={source.durationSec} value={draft.end} disabled={disabled} onChange={event => onChange({ ...draft,end:event.target.value })} /></label>
    </div><small>{copy.segmentHint}</small></> : null}
  </div>;
}
