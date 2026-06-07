'use client';

import { RotateCcw, Sparkles } from 'lucide-react';
import styles from '../maxvideoai-editor.module.css';
import type {
  WorkspaceTimelineAudioMix,
  WorkspaceTimelineClipTransform,
  WorkspaceTimelineItem,
} from '../_lib/workspace-types';
import {
  isWorkspaceTimelineVideoTrack,
  workspaceTimelineTrackLabel,
} from '../_lib/workspace-timeline-tracks';
import { formatWorkspaceTimecode } from '../_lib/workspace-timecode';

const DEFAULT_TRANSFORM: WorkspaceTimelineClipTransform = {
  scale: 1,
  positionX: 0,
  positionY: 0,
  rotation: 0,
  opacity: 1,
};

const DEFAULT_AUDIO_MIX: WorkspaceTimelineAudioMix = {
  volume: 100,
  muted: false,
};

type TimelineClipInspectorProps = {
  selectedItem: WorkspaceTimelineItem | null;
  projectFps: number;
  onPatchItem: (itemId: string, patch: Partial<WorkspaceTimelineItem>) => void;
};

function itemEndSec(item: WorkspaceTimelineItem): number {
  return item.startSec + item.durationSec;
}

function percentLabel(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function InspectorEmptyState() {
  return (
    <aside className={styles.settingsPanel} aria-label="Timeline clip settings">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelTitle}>Clip inspector</p>
          <span className={styles.panelSubtitle}>Select a timeline clip to edit</span>
        </div>
      </div>
      <div className={styles.emptyInspector}>
        <Sparkles size={22} />
        <p>Timeline first</p>
        <span>Pick a clip in the timeline to adjust its edit properties.</span>
      </div>
    </aside>
  );
}

function InspectorSlider({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.timelineInspectorControl}>
      <span>
        {label}
        <strong>{displayValue}</strong>
      </span>
      <div className={styles.timelineInspectorControlRow}>
        <input
          className={styles.settingsRange}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
        <input
          className={styles.settingsInput}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(clampNumber(Number(event.currentTarget.value), min, max))}
        />
      </div>
    </label>
  );
}

export function TimelineClipInspector({
  selectedItem,
  projectFps,
  onPatchItem,
}: TimelineClipInspectorProps) {
  if (!selectedItem) return <InspectorEmptyState />;

  const isVideoTrack = isWorkspaceTimelineVideoTrack(selectedItem.track);
  const isAudioClip = selectedItem.mediaKind === 'audio' || !isVideoTrack;
  const canEditTransform = !isAudioClip;
  const canEditAudio = isAudioClip || isVideoTrack || selectedItem.hasEmbeddedAudio;
  const transform = selectedItem.transform ?? DEFAULT_TRANSFORM;
  const audioMix = selectedItem.audioMix ?? DEFAULT_AUDIO_MIX;

  const patchTransform = (patch: Partial<WorkspaceTimelineClipTransform>) => {
    onPatchItem(selectedItem.id, { transform: { ...DEFAULT_TRANSFORM, ...transform, ...patch } });
  };
  const patchAudioMix = (patch: Partial<WorkspaceTimelineAudioMix>) => {
    onPatchItem(selectedItem.id, { audioMix: { ...DEFAULT_AUDIO_MIX, ...audioMix, ...patch } });
  };
  const transitionDuration = selectedItem.transitionOut?.type === 'crossfade' ? selectedItem.transitionOut.durationSec : 0;

  return (
    <aside className={styles.settingsPanel} aria-label="Timeline clip settings">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelTitle}>{selectedItem.title}</p>
          <span className={styles.panelSubtitle}>{workspaceTimelineTrackLabel(selectedItem.track)} clip</span>
        </div>
      </div>
      <div className={styles.settingsBody}>
        <label className={styles.settingsLabel}>
          Clip name
          <input
            className={styles.settingsInput}
            value={selectedItem.title}
            onChange={(event) => onPatchItem(selectedItem.id, { title: event.currentTarget.value })}
          />
        </label>

        {canEditTransform ? (
          <section className={styles.timelineInspectorGroup} aria-label="Clip transform">
            <div className={styles.sectionHeading}>
              <span>Transform</span>
              <button
                type="button"
                className={styles.timelineInspectorResetButton}
                onClick={() => onPatchItem(selectedItem.id, { transform: { ...DEFAULT_TRANSFORM } })}
                aria-label="Reset clip transform"
                title="Reset clip transform"
              >
                <RotateCcw size={13} />
              </button>
            </div>
            <InspectorSlider
              label="Scale"
              value={transform.scale}
              min={0.25}
              max={3}
              step={0.05}
              displayValue={percentLabel(transform.scale)}
              onChange={(value) => patchTransform({ scale: value })}
            />
            <InspectorSlider
              label="Position X"
              value={transform.positionX}
              min={-100}
              max={100}
              step={1}
              displayValue={`${transform.positionX}%`}
              onChange={(value) => patchTransform({ positionX: value })}
            />
            <InspectorSlider
              label="Position Y"
              value={transform.positionY}
              min={-100}
              max={100}
              step={1}
              displayValue={`${transform.positionY}%`}
              onChange={(value) => patchTransform({ positionY: value })}
            />
            <InspectorSlider
              label="Rotation"
              value={transform.rotation}
              min={-180}
              max={180}
              step={1}
              displayValue={`${transform.rotation}deg`}
              onChange={(value) => patchTransform({ rotation: value })}
            />
            <InspectorSlider
              label="Opacity"
              value={Math.round(transform.opacity * 100)}
              min={0}
              max={100}
              step={1}
              displayValue={percentLabel(transform.opacity)}
              onChange={(value) => patchTransform({ opacity: value / 100 })}
            />
          </section>
        ) : null}

        {canEditAudio ? (
          <section className={styles.timelineInspectorGroup} aria-label="Clip audio">
            <div className={styles.sectionHeading}>
              <span>Audio</span>
            </div>
            <InspectorSlider
              label="Volume"
              value={audioMix.volume}
              min={0}
              max={100}
              step={1}
              displayValue={`${audioMix.volume}%`}
              onChange={(value) => patchAudioMix({ volume: value })}
            />
            <label className={styles.timelineInspectorCheckbox}>
              <input
                type="checkbox"
                checked={audioMix.muted}
                onChange={(event) => patchAudioMix({ muted: event.currentTarget.checked })}
              />
              Mute clip
            </label>
          </section>
        ) : null}

        {!isAudioClip ? (
          <section className={styles.timelineInspectorGroup} aria-label="Clip transition">
            <div className={styles.sectionHeading}>
              <span>Transition</span>
            </div>
            <label className={styles.timelineInspectorCheckbox}>
              <input
                type="checkbox"
                checked={transitionDuration > 0}
                onChange={(event) => onPatchItem(selectedItem.id, {
                  transitionOut: event.currentTarget.checked ? { type: 'crossfade', durationSec: 1 } : null,
                })}
              />
              Crossfade to next clip
            </label>
            {transitionDuration > 0 ? (
              <InspectorSlider
                label="Duration"
                value={transitionDuration}
                min={0.25}
                max={2}
                step={0.25}
                displayValue={`${transitionDuration}s`}
                onChange={(value) => onPatchItem(selectedItem.id, { transitionOut: { type: 'crossfade', durationSec: value } })}
              />
            ) : null}
          </section>
        ) : null}

        <div className={styles.infoGrid} data-timeline-clip-timing="true" aria-label="Clip timing details">
          <span>Start</span>
          <strong>{formatWorkspaceTimecode(selectedItem.startSec, projectFps)}</strong>
          <span>End</span>
          <strong>{formatWorkspaceTimecode(itemEndSec(selectedItem), projectFps)}</strong>
          <span>Duration</span>
          <strong>{formatWorkspaceTimecode(selectedItem.durationSec, projectFps)}</strong>
          <span>Source in</span>
          <strong>{formatWorkspaceTimecode(selectedItem.sourceStartSec ?? 0, projectFps)}</strong>
        </div>
      </div>
    </aside>
  );
}
