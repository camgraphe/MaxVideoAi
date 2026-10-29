'use client';
import { useRef } from 'react';
import { PromptAssistanceComposer } from '@/components/composer/PromptAssistanceComposer.client';
import { audioAssistanceContext } from '@/lib/prompt-assistance/client-context';
import { PROMPT_ASSISTANCE_PREVIEW } from '@/lib/prompt-assistance/preview-state';
import { AUDIO_ELEVEN_VOICES, findElevenVoice } from '@/lib/audio-eleven-voices';
import {
  AUDIO_AMBIENCE_DURATION_OPTIONS_SEC,
  AUDIO_LYRIA3_BPM_VALUES,
  AUDIO_LYRIA3_CLIP_DURATION_OPTIONS_SEC,
  AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC,
  AUDIO_MINIMAX_VOICE_VALUES,
  AUDIO_SEED_AUDIO_VOICE_VALUES,
  AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES,
  AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES,
  AUDIO_SFX_DURATION_OPTIONS_SEC,
} from '@/lib/audio-generation';
import type { AudioCreationDraft, AudioCreationIntent } from '@/lib/audio-creation';
import type { AudioCreationCopy } from '../_lib/audio-creation-copy';
import { AudioVoicePreview } from './AudioVoicePreview.client';
import styles from './audio-creation.module.css';

type Props = { assistanceAccountId?: string | null; intent: AudioCreationIntent; draft: AudioCreationDraft; copy: AudioCreationCopy; onChange: (patch: Partial<AudioCreationDraft>) => void; onFile: (file: File) => void; uploading: boolean; onLibrary: () => void };
export function AudioCreationEditor({ assistanceAccountId, intent, draft, copy, onChange, onFile, uploading, onLibrary }: Props) {
  const assistanceEnabled = PROMPT_ASSISTANCE_PREVIEW && assistanceAccountId !== undefined;
  const input = useRef<HTMLInputElement>(null);
  const eleven = !draft.reference && draft.voiceModel === 'eleven-v4';
  const elevenVoice = findElevenVoice(draft.elevenVoiceId);
  const spoken = intent === 'voice';
  const song = intent === 'song';
  const key = spoken ? 'script' : 'prompt';
  const title = spoken ? copy.script : song || intent === 'music' ? copy.style : copy.prompt;
  const hint = spoken ? copy.scriptHint : song ? copy.styleHint : copy.promptHint;
  const max = spoken ? 5000 : 2000;
  const modelName = intent === 'voice'
    ? eleven ? copy.models.voiceEleven : draft.reference || draft.voiceModel === 'seed' ? copy.models.voiceSeed : copy.models.voiceMinimax
    : intent === 'music' ? draft.musicModel === 'pro' ? copy.musicPro : copy.musicClip
    : intent === 'song' ? copy.models.song
      : intent === 'sfx' ? copy.models.sfx
        : copy.models.ambience;
  const minimaxVoiceLabel = (voice: typeof AUDIO_MINIMAX_VOICE_VALUES[number]) => voice === 'English_FriendlyPerson' ? 'Friendly Person · EN' : 'Wise Woman';
  const writing = (
<div className={styles.writing}>
      <div className={styles.fieldHeading}><label htmlFor="audio-creation-text">{title}</label><span>{draft[key].length}/{max}</span></div>
      <textarea id="audio-creation-text" aria-describedby="audio-text-hint" placeholder={hint} value={draft[key]} maxLength={max} rows={4} onChange={event => onChange({ [key]: event.target.value })} />
      <p id="audio-text-hint" className="sr-only">{hint}</p>
      {!draft[key] ? <div className={styles.ideas}>{copy.examplesByIntent[intent].map((example, index) => <button type="button" key={example} onClick={() => onChange({ [key]: example })}>{copy.examples}{copy.examplesByIntent[intent].length > 1 ? ` ${index + 1}` : ''}<span aria-hidden> ↗</span></button>)}</div> : null}
    </div>
  );
  return <div className={styles.editor}>
    <div className={styles.modelRow}>
      <strong>{copy.intents[intent][0]}</strong>
      {intent === 'music' ? <div className={styles.quality} aria-label={copy.model}>
        <button type="button" aria-pressed={draft.musicModel === 'clip'} onClick={() => onChange({ musicModel: 'clip', durationSec: 30 })}>{copy.musicClip}<span>{copy.musicClipMeta}</span></button>
        <button type="button" aria-pressed={draft.musicModel === 'pro'} onClick={() => onChange({ musicModel: 'pro' })}>{copy.musicPro}<span>{copy.musicProMeta}</span></button>
      </div> : <div className={styles.modelIdentity}><span>{copy.model}</span><strong>{modelName}</strong></div>}
    </div>
    {assistanceEnabled ? <PromptAssistanceComposer context={{scopeKey: JSON.stringify([assistanceAccountId, intent]), contextKey: JSON.stringify({...draft, [key]: undefined}), live: audioAssistanceContext(intent, draft)}}
      locale="en" modelLabel={modelName} target={spoken ? 'script' : 'prompt'} draftText={draft[key]} maxLength={max} blocked={uploading} onApplyText={text => onChange({[key]: text})}
      renderReferences={spoken && (draft.reference || draft.voiceModel === 'seed') ? insert => <div className={styles.assistanceReferences}>
        <button type="button" aria-label="Add audio reference" disabled={uploading} onClick={() => input.current?.click()}><span aria-hidden>＋</span> Reference</button>
        {draft.reference ? <><button type="button" onClick={() => insert?.('@Audio1')} disabled={!insert}>Audio 1</button><button type="button" aria-label="Remove Audio 1" onClick={() => onChange({reference: null})}>×</button></> : null}
      </div> : undefined}>{writing}</PromptAssistanceComposer> : writing}
    {song ? <div className={styles.writing}>
      <div className={styles.fieldHeading}><label htmlFor="audio-creation-lyrics">{copy.lyrics}</label><span>{draft.lyrics.length}/3500</span></div>
      <textarea id="audio-creation-lyrics" placeholder={copy.lyricsHint} aria-describedby="audio-lyrics-hint" value={draft.lyrics} maxLength={3500} rows={4} onChange={event => onChange({ lyrics: event.target.value })} />
      <p id="audio-lyrics-hint" className="sr-only">{copy.lyricsHint}</p>
    </div> : null}
    <div className={styles.settings}>
      {spoken ? <>
        <label>{copy.model}<select aria-label={copy.model} disabled={Boolean(draft.reference)} value={draft.reference ? 'seed' : draft.voiceModel} onChange={event => onChange({ voiceModel: event.target.value as AudioCreationDraft['voiceModel'] })}>
          <option value="eleven-v4">{copy.models.voiceEleven}</option><option value="minimax">{copy.models.voiceMinimax}</option><option value="seed">{copy.models.voiceSeed}</option>
        </select></label>
        <label>{copy.voice}<select aria-label={copy.voice} disabled={Boolean(draft.reference)} value={draft.reference ? 'reference' : eleven ? draft.elevenVoiceId : draft.voiceModel === 'minimax' ? draft.minimaxVoiceId : draft.voice} onChange={event => onChange(eleven ? { elevenVoiceId: event.target.value } : draft.voiceModel === 'minimax' ? { minimaxVoiceId: event.target.value } : { voice: event.target.value })}>
          {draft.reference ? <option value="reference">{copy.reference}</option> : eleven
            ? AUDIO_ELEVEN_VOICES.map(voice => <option key={voice.id} value={voice.id}>{voice.name} · {copy.genderLabels[voice.gender]} · {copy.accentLabels[voice.accent]} (EN)</option>)
            : draft.voiceModel === 'minimax' ? AUDIO_MINIMAX_VOICE_VALUES.map(voice => <option key={voice} value={voice}>{minimaxVoiceLabel(voice)}</option>)
              : AUDIO_SEED_AUDIO_VOICE_VALUES.map(voice => <option key={voice} value={voice}>{voice === 'default' ? copy.auto : voice.split('_')[0].replace(/^./, letter => letter.toUpperCase())}</option>)}
        </select></label>
        <label>{copy.language}<select value={draft.language} onChange={event => onChange({ language: event.target.value })}>
          <option value="auto">{copy.auto}</option><option value="english">English</option><option value="french">Français</option><option value="spanish">Español</option><option value="german">Deutsch</option>
        </select></label>
      </> : song ? <p className={styles.durationNote}>{copy.fullSong}</p> : <label>{copy.duration}<select value={draft.durationSec} onChange={event => { const durationSec = Number(event.target.value); onChange({ durationSec, ...(intent === 'music' && durationSec > 30 ? { musicModel: 'pro' as const } : {}) }); }}>
        {(intent === 'sfx' ? AUDIO_SFX_DURATION_OPTIONS_SEC : intent === 'music' ? draft.musicModel === 'clip' ? AUDIO_LYRIA3_CLIP_DURATION_OPTIONS_SEC : AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC : AUDIO_AMBIENCE_DURATION_OPTIONS_SEC).map(value => <option key={value} value={value}>{value} s</option>)}
      </select></label>}
      {intent === 'music' ? <label>{copy.tempo}<select value={draft.bpm} onChange={event => onChange({ bpm: Number(event.target.value) })}>{AUDIO_LYRIA3_BPM_VALUES.map(bpm => <option key={bpm} value={bpm}>{bpm} BPM</option>)}</select></label> : null}
    </div>
    {spoken && eleven && elevenVoice ? <div className={styles.voicePreview}>
      <AudioVoicePreview key={elevenVoice.id} voiceId={elevenVoice.id} name={elevenVoice.name} copy={copy} />
    </div> : null}
    {spoken && draft.voiceModel === 'seed' && draft.voice !== 'default' && !draft.reference ? <div className={styles.voicePreview}><span>{copy.preview}</span><audio key={draft.voice} controls preload="none" src={`/assets/audio/seed-audio/${draft.voice}.mp3`} /></div> : null}
    {spoken ? <>
      <details className={styles.advanced}><summary>{copy.options}<span aria-hidden>＋</span></summary><div className={styles.settings}>
        {eleven ? <>
          <label>{copy.stability}<input type="number" min="0" max="1" step="0.01" value={draft.elevenStability} onChange={event => onChange({ elevenStability: Number(event.target.value) })} /></label>
          <label>{copy.similarity}<input type="number" min="0" max="1" step="0.01" value={draft.elevenSimilarityBoost} onChange={event => onChange({ elevenSimilarityBoost: Number(event.target.value) })} /></label>
        </> : <>
        <label>{copy.speed}<input type="number" min="0.5" max="2" step="0.01" value={draft.speed} onChange={event => onChange({ speed: Number(event.target.value) })} /></label>
        <label>{copy.volume}<input type="number" min="0.5" max="2" step="0.1" value={draft.volume} onChange={event => onChange({ volume: Number(event.target.value) })} /></label>
        <label>{copy.pitch}<input type="number" min="-12" max="12" step="1" value={draft.pitch} onChange={event => onChange({ pitch: Number(event.target.value) })} /></label>
        {draft.reference || draft.voiceModel === 'seed' ? <>
          <label>{copy.format}<select value={draft.outputFormat} onChange={event => onChange({ outputFormat: event.target.value })}>{AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label>
          <label>{copy.sampleRate}<select value={draft.sampleRate} onChange={event => onChange({ sampleRate: Number(event.target.value) })}>{AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES.map(value => <option key={value} value={value}>{value / 1000} kHz</option>)}</select></label>
          {([{ field: 'voiceDelivery', label: copy.delivery, options: copy.deliveryLabels }, { field: 'voiceProfile', label: copy.voiceProfile, options: copy.profileLabels }, { field: 'voiceGender', label: copy.voiceGender, options: copy.genderLabels }] as const).map(({ field, label, options }) => <label key={field}>{label}<select value={draft[field]} onChange={event => onChange({ [field]: event.target.value })}>{Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}
        </> : null}
        </>}
      </div></details>
      {draft.reference || draft.voiceModel === 'seed' ? <div className={styles.reference}>
        <input ref={input} type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" hidden tabIndex={-1} onChange={event => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ''; }} />
        {draft.reference ? <><div><span>{copy.reference}</span><strong>{assistanceEnabled ? 'Audio 1' : draft.reference.name}</strong></div><button type="button" onClick={() => onChange({ reference: null })}>{copy.remove}</button><audio controls preload="none" src={draft.reference.url} aria-label={copy.reference} /></> : <div className={styles.referenceSources}><span>{copy.reference}</span><button type="button" disabled={uploading} onClick={() => input.current?.click()}>{uploading ? copy.loading : copy.import}</button><button type="button" onClick={onLibrary}>{copy.library}</button></div>}
        <p>{copy.referenceHint}</p>
      </div> : null}
    </> : intent === 'ambience' ? <p className={styles.note}>{copy.ambienceHint}</p> : null}
  </div>;
}
