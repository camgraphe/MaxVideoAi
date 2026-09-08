'use client';
import { useRef } from 'react';
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
import styles from './audio-creation.module.css';

type Props = { intent: AudioCreationIntent; draft: AudioCreationDraft; copy: AudioCreationCopy; onChange: (patch: Partial<AudioCreationDraft>) => void; onFile: (file: File) => void; uploading: boolean; onLibrary: () => void };
export function AudioCreationEditor({ intent, draft, copy, onChange, onFile, uploading, onLibrary }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const spoken = intent === 'voice';
  const song = intent === 'song';
  const key = spoken ? 'script' : 'prompt';
  const title = spoken ? copy.script : song || intent === 'music' ? copy.style : copy.prompt;
  const hint = spoken ? copy.scriptHint : song ? copy.styleHint : copy.promptHint;
  const max = spoken ? 5000 : 2000;
  const modelName = intent === 'voice'
    ? draft.reference || draft.voiceModel === 'seed' ? copy.models.voiceSeed : copy.models.voiceMinimax
    : intent === 'song' ? copy.models.song
      : intent === 'sfx' ? copy.models.sfx
        : copy.models.ambience;
  const minimaxVoiceLabel = (voice: typeof AUDIO_MINIMAX_VOICE_VALUES[number]) => voice === 'English_FriendlyPerson' ? 'Friendly Person · EN' : 'Wise Woman';
  return <div className={styles.editor}>
    <div className={styles.modelRow}>
      <strong>{copy.intents[intent][0]}</strong>
      {intent === 'music' ? <div className={styles.quality} aria-label={copy.model}>
        <button type="button" aria-pressed={draft.musicModel === 'clip'} onClick={() => onChange({ musicModel: 'clip', durationSec: 30 })}>{copy.musicClip}<span>{copy.musicClipMeta}</span></button>
        <button type="button" aria-pressed={draft.musicModel === 'pro'} onClick={() => onChange({ musicModel: 'pro' })}>{copy.musicPro}<span>{copy.musicProMeta}</span></button>
      </div> : <div className={styles.modelIdentity}><span>{copy.model}</span><strong>{modelName}</strong></div>}
    </div>
    <div className={styles.writing}>
      <div className={styles.fieldHeading}><label htmlFor="audio-creation-text">{title}</label><span>{draft[key].length}/{max}</span></div>
      <textarea id="audio-creation-text" aria-describedby="audio-text-hint" placeholder={hint} value={draft[key]} maxLength={max} rows={4} onChange={event => onChange({ [key]: event.target.value })} />
      <p id="audio-text-hint" className="sr-only">{hint}</p>
      {!draft[key] ? <div className={styles.ideas}>{copy.examplesByIntent[intent].map((example, index) => <button type="button" key={example} onClick={() => onChange({ [key]: example })}>{copy.examples}{copy.examplesByIntent[intent].length > 1 ? ` ${index + 1}` : ''}<span aria-hidden> ↗</span></button>)}</div> : null}
    </div>
    {song ? <div className={styles.writing}>
      <div className={styles.fieldHeading}><label htmlFor="audio-creation-lyrics">{copy.lyrics}</label><span>{draft.lyrics.length}/3500</span></div>
      <textarea id="audio-creation-lyrics" placeholder={copy.lyricsHint} aria-describedby="audio-lyrics-hint" value={draft.lyrics} maxLength={3500} rows={4} onChange={event => onChange({ lyrics: event.target.value })} />
      <p id="audio-lyrics-hint" className="sr-only">{copy.lyricsHint}</p>
    </div> : null}
    <div className={styles.settings}>
      {spoken ? <>
        <label>{copy.voice}<select disabled={Boolean(draft.reference)} value={draft.reference ? 'reference' : draft.voiceModel === 'minimax' ? `minimax:${draft.minimaxVoiceId}` : `seed:${draft.voice}`} onChange={event => { const [provider, voice] = event.target.value.split(':'); onChange(provider === 'minimax' ? { voiceModel: 'minimax', minimaxVoiceId: voice } : { voiceModel: 'seed', voice }); }}>
          {draft.reference ? <option value="reference">{copy.reference}</option> : null}
          {AUDIO_MINIMAX_VOICE_VALUES.map(voice => <option key={voice} value={`minimax:${voice}`}>{minimaxVoiceLabel(voice)}</option>)}{AUDIO_SEED_AUDIO_VOICE_VALUES.map(voice => <option key={voice} value={`seed:${voice}`}>{voice === 'default' ? copy.auto : voice.split('_')[0].replace(/^./, letter => letter.toUpperCase())}</option>)}
        </select></label>
        <label>{copy.language}<select value={draft.language} onChange={event => onChange({ language: event.target.value })}>
          <option value="auto">{copy.auto}</option><option value="english">English</option><option value="french">Français</option><option value="spanish">Español</option><option value="german">Deutsch</option>
        </select></label>
      </> : song ? <p className={styles.durationNote}>{copy.fullSong}</p> : <label>{copy.duration}<select value={draft.durationSec} onChange={event => { const durationSec = Number(event.target.value); onChange({ durationSec, ...(intent === 'music' && durationSec > 30 ? { musicModel: 'pro' as const } : {}) }); }}>
        {(intent === 'sfx' ? AUDIO_SFX_DURATION_OPTIONS_SEC : intent === 'music' ? draft.musicModel === 'clip' ? AUDIO_LYRIA3_CLIP_DURATION_OPTIONS_SEC : AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC : AUDIO_AMBIENCE_DURATION_OPTIONS_SEC).map(value => <option key={value} value={value}>{value} s</option>)}
      </select></label>}
      {intent === 'music' ? <label>{copy.tempo}<select value={draft.bpm} onChange={event => onChange({ bpm: Number(event.target.value) })}>{AUDIO_LYRIA3_BPM_VALUES.map(bpm => <option key={bpm} value={bpm}>{bpm} BPM</option>)}</select></label> : null}
    </div>
    {spoken && draft.voiceModel === 'seed' && draft.voice !== 'default' && !draft.reference ? <div className={styles.voicePreview}><span>{copy.preview}</span><audio key={draft.voice} controls preload="none" src={`/assets/audio/seed-audio/${draft.voice}.mp3`} /></div> : null}
    {spoken ? <>
      <details className={styles.advanced}><summary>{copy.options}<span aria-hidden>＋</span></summary><div className={styles.settings}>
        <label>{copy.speed}<input type="number" min="0.5" max="2" step="0.01" value={draft.speed} onChange={event => onChange({ speed: Number(event.target.value) })} /></label>
        <label>{copy.volume}<input type="number" min="0.5" max="2" step="0.1" value={draft.volume} onChange={event => onChange({ volume: Number(event.target.value) })} /></label>
        <label>{copy.pitch}<input type="number" min="-12" max="12" step="1" value={draft.pitch} onChange={event => onChange({ pitch: Number(event.target.value) })} /></label>
        {draft.reference || draft.voiceModel === 'seed' ? <>
          <label>{copy.format}<select value={draft.outputFormat} onChange={event => onChange({ outputFormat: event.target.value })}>{AUDIO_SEED_AUDIO_OUTPUT_FORMAT_VALUES.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label>
          <label>{copy.sampleRate}<select value={draft.sampleRate} onChange={event => onChange({ sampleRate: Number(event.target.value) })}>{AUDIO_SEED_AUDIO_SAMPLE_RATE_VALUES.map(value => <option key={value} value={value}>{value / 1000} kHz</option>)}</select></label>
          {([{ field: 'voiceDelivery', label: copy.delivery, options: copy.deliveryLabels }, { field: 'voiceProfile', label: copy.voiceProfile, options: copy.profileLabels }, { field: 'voiceGender', label: copy.voiceGender, options: copy.genderLabels }] as const).map(({ field, label, options }) => <label key={field}>{label}<select value={draft[field]} onChange={event => onChange({ [field]: event.target.value })}>{Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}
        </> : null}
      </div></details>
      <div className={styles.reference}>
        <input ref={input} type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" hidden tabIndex={-1} onChange={event => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ''; }} />
        {draft.reference ? <><div><span>{copy.reference}</span><strong>{draft.reference.name}</strong></div><button type="button" onClick={() => onChange({ reference: null })}>{copy.remove}</button><audio controls preload="none" src={draft.reference.url} aria-label={copy.reference} /></> : <div className={styles.referenceSources}><span>{copy.reference}</span><button type="button" disabled={uploading} onClick={() => input.current?.click()}>{uploading ? copy.loading : copy.import}</button><button type="button" onClick={onLibrary}>{copy.library}</button></div>}
        <p>{copy.referenceHint}</p>
      </div>
    </> : intent === 'ambience' ? <p className={styles.note}>{copy.ambienceHint}</p> : null}
  </div>;
}
