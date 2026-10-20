'use client';
import { Box, Image as ImageIcon, Sun, Palette, SlidersHorizontal, ChevronDown } from 'lucide-react';
import type { CreatorToolId, CreatorSourceInput, CreatorAvailableProfile } from '@/lib/toolbox/creator-tools';
import type { CreatorLipTiming } from './creator-lip-timing';
import type { CreatorSource } from './creator-source-selection';
import { creatorWorkspaceCopy } from './creator-workspace-copy';
import { creatorExperienceCopy } from './creator-experience-copy';
import { CreatorSegmentPreview } from './CreatorSegmentPreview.client';
import styles from './creator-workspace.module.css';
export type SegmentDraft = { enabled: boolean; start: string; end: string };
export function CreatorSettings({ toolId, locale, settings, onChange, disabled, profile, motionProfileId, motionControlEnabled, onMotionProfileChange }: {
  toolId: CreatorToolId; locale: string; settings: Record<string, string>; onChange(patch: Record<string, string>): void; disabled: boolean;profile?:CreatorAvailableProfile;motionProfileId?:string;motionControlEnabled?:boolean;onMotionProfileChange?(id:string):void;
}) {
  const copy = creatorWorkspaceCopy(locale), experience = creatorExperienceCopy(locale), photo = toolId === 'product-photo-editor', motion = toolId === 'motion-transfer';
  const select = (key: string, label: string, choices: [string,string][]) => <label key={key}>{label}<select aria-label={label} value={settings[key]} disabled={disabled} onChange={event => onChange({ [key]: event.target.value })}>{choices.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  const specialist = motion && motionProfileId === 'motion-kling-v3-v1';
  const choices = photo ? [{id:'studio',label:copy.studio,Icon:Box},{id:'lifestyle',label:copy.lifestyle,Icon:ImageIcon},{id:'lighting',label:copy.lighting,Icon:Sun}]
    : [{id:'background',label:copy.background,Icon:ImageIcon},{id:'lighting',label:copy.lighting,Icon:Sun},{id:'style',label:copy.styleAction,Icon:Palette}];
  return <div className={styles.settings}>
    {(photo || toolId === 'product-video-editor') ? <fieldset className={styles.choiceFieldset}><legend>{photo ? experience.scene : copy.action}</legend><div className={styles.choiceCards}>{choices.map(({id,label,Icon}) => <button key={id} type="button" aria-pressed={settings.action === id} disabled={disabled} onClick={() => onChange({action:id})}><Icon size={21} aria-hidden="true" /><span>{label}</span></button>)}</div></fieldset> : null}
    {!(toolId === 'lip-sync' && settings.mode === 'video') ? <label>{experience.describe}{!photo && toolId !== 'product-video-editor' ? <span className={styles.optional}>{experience.optional}</span> : null}<textarea maxLength={2000} value={settings.instruction} placeholder={experience.placeholders[toolId]} disabled={disabled} onChange={event => onChange({ instruction: event.target.value })} /></label> : null}
    {toolId === 'lip-sync' ? select('resolution',copy.resolution,['480p','720p','1080p'].map(value => [value,value])) : null}
    {toolId !== 'lip-sync' ? <details className={styles.advanced}><summary><SlidersHorizontal size={17} aria-hidden="true" />{experience.advanced}<ChevronDown size={16} aria-hidden="true" /></summary><div className={styles.settings}>
      {motion ? <label>{copy.motionMethod}<select aria-label={copy.motionMethod} disabled={disabled} value={motionProfileId} onChange={event => onMotionProfileChange?.(event.target.value)}>{motionControlEnabled || motionProfileId === 'motion-kling-v3-v1' ? <option value="motion-kling-v3-v1">{copy.motionControl}</option> : null}<option value="motion-wan-reference-v1">{copy.referenceGuidance}</option></select></label> : null}
      {photo && select('model',copy.model,[['gpt-image-2-5-flare','GPT Image 2.5 Flare'],['nano-banana-2','Nano Banana 2']])}
      {photo && select('aspectRatio',copy.aspect,[['auto',copy.auto],...['1:1','4:3','3:4','16:9','9:16'].map(value => [value,value] as [string,string])])}
      {motion && select('orientation',specialist ? copy.characterOrientation : copy.orientation,[['video',copy.video],['image',copy.photo]])}
      {(motion || toolId === 'product-video-editor') && <>{!specialist && profile?.constraints.resolution !== 'provider' ? select('resolution',copy.resolution,['480p','720p','1080p'].map(value => [value,value])) : null}{select('audioPolicy',copy.audioPolicy,[['preserve',copy.preserve],['mute',copy.mute]])}</>}
    </div></details> : null}
    <details className={styles.disclosure}><summary>{copy.details}</summary><p>{photo ? copy.photoDisclosure : motion ? specialist ? copy.motionControlDisclosure : copy.motionDisclosure : toolId === 'lip-sync' ? settings.mode === 'video' ? copy.lipVideoDisclosure : copy.lipDisclosure : copy.videoDisclosure}</p></details>
  </div>;
}
export function CreatorSegmentFields({ locale, role, source, value, onChange, disabled }: {
  locale: string; role: CreatorSourceInput['role']; source: CreatorSource; value?: SegmentDraft; onChange(value: SegmentDraft): void; disabled: boolean;
}) {
  const copy = creatorWorkspaceCopy(locale), experience = creatorExperienceCopy(locale), draft = value ?? { enabled:false,start:'0',end:String(source.durationSec ?? '') };
  const duration = Number(draft.end) - Number(draft.start);
  return <div className={styles.segmentFields}>
    <label className={styles.segmentToggle}><input type="checkbox" checked={draft.enabled} disabled={disabled} onChange={event => onChange({ ...draft, enabled:event.target.checked })} />{copy.segment}</label>
    {draft.enabled ? <><CreatorSegmentPreview key={source.url} locale={locale} source={source} start={draft.start} end={draft.end} disabled={disabled} onMark={(boundary, seconds) => onChange({ ...draft, [boundary]: seconds })} /><div className={styles.timeInputs}>
      <label>{copy.start}<input aria-label={`${copy.start} — ${copy.sourceLabels[role]}`} type="number" min="0" step="any" value={draft.start} disabled={disabled} onChange={event => onChange({ ...draft,start:event.target.value })} /></label>
      <label>{copy.end}<input aria-label={`${copy.end} — ${copy.sourceLabels[role]}`} type="number" min="0" step="any" max={source.durationSec} value={draft.end} disabled={disabled} onChange={event => onChange({ ...draft,end:event.target.value })} /></label>
    </div><small>{draft.end && draft.start && duration > 0 ? `${experience.selectedDuration}: ${Number(duration.toFixed(3))} ${copy.seconds}. ` : ''}{copy.segmentHint}</small></> : null}
  </div>;
}

export function creatorLipTimingMessage(locale: string, timing: CreatorLipTiming): string | undefined {
  if (!timing.issue) return undefined;
  const copy = creatorWorkspaceCopy(locale);
  const messages = { invalid: copy.lipPassageInvalid, outside: copy.lipPassageOutside, short: copy.lipPassageTooShort, long: copy.lipPassageTooLong, mismatch: copy.lipDurationMismatch };
  return `${timing.issue.role === 'audio' ? copy.audio : copy.video}: ${messages[timing.issue.code]}`;
}
export function CreatorLipDurationSummary({ locale, timing, video, disabled, onAdapt }: {
  locale: string; timing: CreatorLipTiming; video: boolean; disabled: boolean; onAdapt(segments: Partial<Record<'source' | 'audio', SegmentDraft>>): void;
}) {
  const copy = creatorWorkspaceCopy(locale), issue = creatorLipTimingMessage(locale, timing);
  const format = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value);
  if (!Object.keys(timing.passages).length) return null;
  return <div className={styles.segmentFields}>
    <div aria-live="polite"><strong>{copy.lipTimingTitle}</strong>
      {(['audio', 'source'] as const).map(role => {
        const passage = timing.passages[role];
        if (!passage) return null;
        const valid = passage.durationSec != null && Number.isFinite(passage.durationSec) && passage.durationSec > 0;
        return <p key={role}>{role === 'audio' ? copy.audio : copy.video}: {valid ? <>{format(passage.durationSec!)} {copy.seconds} · {copy.selectedPassage} {format(passage.startSec)}–{format(passage.endSec!)} {copy.seconds}</> : copy.durationPending}
          {passage.originalDurationSec != null ? <small> · {copy.originalDuration}: {format(passage.originalDurationSec)} {copy.seconds}</small> : null}</p>;
      })}
      {issue ? <p className={styles.error}>{issue}</p> : <>
        {timing.passages.audio?.durationSec != null ? <p>{copy.lipGeneratedDuration}: {format(Math.ceil(timing.passages.audio.durationSec))} {copy.seconds} · {copy.lipFinalDuration}: {format(timing.passages.audio.durationSec)} {copy.seconds}</p> : null}
        <p className={styles.notice}>{copy.lipPhotoTimingHint}</p>
      </>}
    </div>
    {timing.adaptation ? <><button className={styles.adaptPassage} type="button" disabled={disabled} onClick={() => onAdapt(timing.adaptation!.segments)}>{(video ? copy.lipAdaptBoth : copy.lipAdaptAudio)(format(timing.adaptation.durationSec))}</button><small>{copy.lipAdaptHint}</small></> : null}
  </div>;
}
