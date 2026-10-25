'use client';

import { useCallback, useState } from 'react';
import type { ComposerProps } from './composer-types';
import { videoExcerptCopy, videoExcerptDurationMessage } from '@/lib/video-excerpt-copy';
import { getMediaExcerptDurationIssue, getMediaExcerptLimits, getVideoExcerptLimits, mediaExcerptNeedsSelection } from '@/lib/video-excerpt';
import { videoExtensionCopy } from '@/lib/video-extension';
import { getVideoWorkflowSourceState, getVideoWorkflowSourceField, isVideoSourceWorkflow, videoModifyCopy } from '@/lib/video-source-workflow';

/** Shared presentation mask and source eligibility; preparation remains with the workspace owner. */
export function useComposerVideoSourceWorkflow({ engine, assets, activeManualMode, caps, onPrepareVideoExcerpt, onVideoExcerptEditorChange, workspaceDensity, locale }:
  Pick<ComposerProps, 'engine' | 'assets' | 'activeManualMode' | 'caps' | 'onPrepareVideoExcerpt' | 'onVideoExcerptEditorChange'> & { workspaceDensity: boolean; locale: string }) {
  const [excerptEditorOpen, setExcerptEditorOpen] = useState(false);
  const handleExcerptEditorChange = useCallback<NonNullable<ComposerProps['onVideoExcerptEditorChange']>>((field, index, open) => {
    setExcerptEditorOpen(open);
    return onVideoExcerptEditorChange?.(field, index, open);
  }, [onVideoExcerptEditorChange]);
  const excerptCopy = videoExcerptCopy(locale);
  const extensionWorkflow = workspaceDensity && (activeManualMode === 'extend' || caps?.modes?.[0] === 'extend');
  const sourceMode = activeManualMode ?? caps?.modes?.[0];
  const videoSourceWorkflow = (workspaceDensity || Boolean(onPrepareVideoExcerpt)) && isVideoSourceWorkflow(sourceMode) && getVideoWorkflowSourceField(engine.inputSchema, sourceMode) ? sourceMode : undefined;
  const excerptNeedsRange = Boolean(sourceMode && mediaExcerptNeedsSelection(engine, sourceMode, assets));
  const durationNotice = sourceMode ? Object.entries(assets).flatMap(([fieldId, entries]) => {
    const limits = getMediaExcerptLimits(engine, sourceMode, fieldId);
    if (!limits) return [];
    return entries.flatMap(asset => {
      const issue = getMediaExcerptDurationIssue(asset?.durationSec, limits);
      if (!issue || !asset) return [];
      const canExpand = issue === 'too-short' && asset.excerptSource
        && getMediaExcerptDurationIssue(asset.excerptSource.durationSec, limits) !== 'too-short';
      return [videoExcerptDurationMessage(issue, limits, locale, asset.kind === 'audio' ? 'audio' : 'video', Boolean(canExpand))];
    });
  })[0] : undefined;
  const extensionCopy = extensionWorkflow ? videoExtensionCopy(locale) : videoModifyCopy(locale, sourceMode === 'reframe');
  const extensionSourceState = videoSourceWorkflow ? getVideoWorkflowSourceState(engine.inputSchema, assets, videoSourceWorkflow, getVideoExcerptLimits(engine, videoSourceWorkflow)) : null;
  const extensionNotice = excerptEditorOpen ? excerptCopy.quote : durationNotice ?? ((extensionSourceState === 'error' || excerptNeedsRange) && onPrepareVideoExcerpt ? excerptCopy.requires : extensionSourceState === 'missing' ? extensionCopy.uploadForPrice
    : extensionSourceState === 'uploading' ? extensionCopy.uploading : null);
  const extensionQuoteStatus = excerptEditorOpen ? excerptCopy.editing : extensionSourceState === 'missing' ? extensionCopy.awaitingVideo
    : extensionSourceState === 'uploading' ? extensionCopy.awaitingUpload : undefined;
  return { excerptNeedsRange, excerptEditorOpen, handleExcerptEditorChange, extensionWorkflow, sourceMode, videoSourceWorkflow, extensionCopy, extensionSourceState, extensionNotice, extensionQuoteStatus };
}
