'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FEATURES } from '@/content/feature-flags';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { hideJob, runImageGeneration, saveImageToLibrary } from '@/lib/api';
import { buildLoginHref } from '@/lib/auth-entry-href';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { STORYBOARD_GENERATOR_HANDOFF_STORAGE_KEY, buildStoryboardGeneratorHandoff, buildStoryboardGeneratorHandoffUrl } from '@/lib/storyboard-generator-handoff';
import { STORYBOARD_EDIT_SOURCE, STORYBOARD_SOURCE } from '@/lib/storyboard-pricing';
import type { ImageGenerationResponse } from '@/types/image-generation';
import { StoryboardReferenceLibraryModal } from './storyboard/_components/StoryboardReferenceLibraryModal';
import { StoryboardResultPanel } from './storyboard/_components/StoryboardResultPanel';
import { StoryboardBuilderPanel, type StoryboardOptionalField } from './storyboard/_components/StoryboardBuilderPanel';
import { useStoryboardReferences } from './storyboard/_hooks/useStoryboardReferences';
import { useStoryboardPricing } from './storyboard/_hooks/useStoryboardPricing';
import { useStoryboardRecentOutputs, type StoryboardRecentOutput } from './storyboard/_hooks/useStoryboardRecentOutputs';
import { resolveStoryboardWorkspaceCopy } from './storyboard/_lib/storyboard-workspace-copy';
import { KLING_STORYBOARD_FIRST_FRAME_JOB_PREFIX, buildKlingStoryboardFirstFramePrompt } from './storyboard/_lib/storyboard-first-frame';
import { buildKlingFirstFrameFromRecentOutput, getStoredKlingFirstFrame, writeStoredKlingFirstFrame, type KlingFirstFrameState } from './storyboard/_lib/storyboard-kling-first-frame-storage';
import { buildStoryboardPrompt, type StoryboardStyle, type StoryboardTargetModel } from './storyboard/_lib/storyboard-prompt';
import { buildStoryboardShotPlan } from './storyboard/_lib/storyboard-shot-plan';
import { STORYBOARD_REFERENCE_ENGINE } from './storyboard/_lib/storyboard-workspace-config';
import { DEFAULT_STORYBOARD_TIER, STORYBOARD_TEMPLATE_SIZES, getAbsoluteStoryboardTemplateUrl, getStoryboardOutputConfig, getStoryboardLengthPreset, getStoryboardTemplatePath, type StoryboardLengthPresetId, type StoryboardOrientation, type StoryboardTier } from './storyboard/_lib/storyboard-templates';

export default function StoryboardWorkspace() {
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const router = useRouter();
  const { locale, t } = useI18n();
  const copy = resolveStoryboardWorkspaceCopy(t('workspace.storyboard'));
  const [subject, setSubject] = useState('');
  const [action, setAction] = useState('');
  const [dialogue, setDialogue] = useState('');
  const [visualNotes, setVisualNotes] = useState('');
  const [activeOptionalField, setActiveOptionalField] = useState<StoryboardOptionalField | null>(null);
  const [targetModel, setTargetModel] = useState<StoryboardTargetModel>('seedance');
  const [recognizablePeople, setRecognizablePeople] = useState(false);
  const [style, setStyle] = useState<StoryboardStyle>('cinema');
  const [lengthPresetId, setLengthPresetId] = useState<StoryboardLengthPresetId>('medium');
  const [storyboardOrientation, setStoryboardOrientation] = useState<StoryboardOrientation>('landscape');
  const [storyboardTier, setStoryboardTier] = useState<StoryboardTier>(DEFAULT_STORYBOARD_TIER);
  const [editInstruction, setEditInstruction] = useState('');
  const [result, setResult] = useState<ImageGenerationResponse | null>(null);
  const [previewingTemplate, setPreviewingTemplate] = useState(false);
  const [klingFirstFrame, setKlingFirstFrame] = useState<KlingFirstFrameState | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedRecentOutput, setSelectedRecentOutput] = useState<StoryboardRecentOutput | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    outputs: recentOutputs,
    loading: recentOutputsLoading,
    refresh: refreshRecentOutputs,
  } = useStoryboardRecentOutputs(Boolean(user));
  const {
    readyReferenceImages,
    referenceUploading,
    storyboardReferenceField,
    storyboardReferenceAssets,
    libraryModal,
    handleReferenceFile,
    handleRemoveReferenceSlot,
    openReferenceLibrary,
    closeReferenceLibrary,
    handleReferenceLibrarySelect,
  } = useStoryboardReferences({
    authenticated: Boolean(user),
    copy,
    onAuthRequired: () => setAuthModalOpen(true),
    onError: setError,
    onFeedbackReset: () => {
      setError(null);
      setMessage(null);
    },
  });

  useEffect(() => {
    const requestedTarget = new URLSearchParams(window.location.search).get('target');
    if (requestedTarget === 'seedance' || requestedTarget === 'kling') {
      setTargetModel(requestedTarget);
    }
  }, []);

  const lengthPreset = useMemo(() => getStoryboardLengthPreset(lengthPresetId), [lengthPresetId]);
  const durationSec = lengthPreset.durationSec;
  const frameCount = lengthPreset.frameCount;
  const storyboardTemplateSize = STORYBOARD_TEMPLATE_SIZES[storyboardOrientation];
  const templateImagePath = useMemo(() => getStoryboardTemplatePath(frameCount, storyboardOrientation), [frameCount, storyboardOrientation]);
  const generatedImage = result?.images[0] ?? null;
  const selectedRecentImage = selectedRecentOutput ? { url: selectedRecentOutput.url, thumbUrl: selectedRecentOutput.thumbUrl ?? selectedRecentOutput.previewUrl ?? null, width: selectedRecentOutput.width, height: selectedRecentOutput.height, mimeType: selectedRecentOutput.mime } : null;
  const selectedImage = previewingTemplate ? null : selectedRecentImage ?? generatedImage;
  const selectedImageJobId = previewingTemplate ? null : selectedRecentOutput?.jobId ?? result?.jobId ?? null;
  const { activePrice, editOutputConfig, editPriceLabel, tierConfig, tierPriceLabels } = useStoryboardPricing({ locale, storyboardOrientation, storyboardTier, targetModel, selectedImage });
  const selectedKlingFirstFrame = useMemo(() => {
    if (!selectedImage?.url || previewingTemplate) return null;
    if (selectedRecentOutput) {
      const recentFirstFrame = buildKlingFirstFrameFromRecentOutput(selectedRecentOutput);
      if (recentFirstFrame) return recentFirstFrame;
    }
    if (
      klingFirstFrame?.image?.url &&
      klingFirstFrame.storyboardUrl === selectedImage.url &&
      (!selectedImageJobId || klingFirstFrame.storyboardJobId === selectedImageJobId)
    ) {
      return klingFirstFrame;
    }
    return getStoredKlingFirstFrame(selectedImageJobId, selectedImage.url);
  }, [klingFirstFrame, previewingTemplate, selectedImage?.url, selectedImageJobId, selectedRecentOutput]);

  const shotPlan = useMemo(
    () =>
      buildStoryboardShotPlan({
        subject,
        action,
        dialogue,
        style,
        targetModel,
        durationSec,
        frameCount,
        referenceImageCount: readyReferenceImages.length,
      }),
    [action, dialogue, durationSec, frameCount, readyReferenceImages.length, style, subject, targetModel]
  );
  const canRun = Boolean(subject.trim()) && !running && !referenceUploading;
  const saveLabel = copy.saveToLibrary ?? 'Save to Storyboard library';

  function handleRecognizablePeopleToggle() {
    setRecognizablePeople((current) => {
      const nextValue = !current;
      if (nextValue) {
        setTargetModel('kling');
      }
      return nextValue;
    });
  }

  function handleOptionalFieldToggle(field: StoryboardOptionalField) {
    setActiveOptionalField((current) => (current === field ? null : field));
  }

  function handleSelectRecentOutput(output: StoryboardRecentOutput) {
    setPreviewingTemplate(false);
    setSelectedRecentOutput(output);
    setKlingFirstFrame(buildKlingFirstFrameFromRecentOutput(output) ?? getStoredKlingFirstFrame(output.jobId, output.url));
    setError(null);
    setMessage(null);
  }

  function showTemplatePreview() {
    setPreviewingTemplate(true);
    setSelectedRecentOutput(null);
    setKlingFirstFrame(null);
    setEditInstruction('');
    setError(null);
    setMessage(null);
  }

  function handleLengthPresetSelect(presetId: StoryboardLengthPresetId) {
    setLengthPresetId(presetId);
    showTemplatePreview();
  }

  function handleOrientationSelect(orientation: StoryboardOrientation) {
    setStoryboardOrientation(orientation);
    showTemplatePreview();
  }

  async function runStoryboard(edit = false) {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!subject.trim()) {
      setError(copy.missingSubject);
      return;
    }
    if (edit && !selectedImage?.url) return;

    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const templateReference = {
        url: getAbsoluteStoryboardTemplateUrl(frameCount, storyboardOrientation, window.location.origin),
        width: storyboardTemplateSize.width,
        height: storyboardTemplateSize.height,
      };
      const sourceImages = edit && selectedImage ? [selectedImage] : [templateReference, ...readyReferenceImages];
      const outputConfig = edit ? editOutputConfig : tierConfig;
      const prompt = buildStoryboardPrompt({
        subject,
        action,
        dialogue,
        visualNotes,
        style,
        targetModel,
        orientation: storyboardOrientation,
        durationSec,
        frameCount,
        templateReference: !edit,
        referenceImageCount: edit ? 0 : readyReferenceImages.length,
        shotPlan,
        editInstruction: edit ? editInstruction : null,
      });
      const response = await runImageGeneration({
        jobId: `storyboard_${crypto.randomUUID()}`,
        engineId: 'gpt-image-2',
        mode: 'i2i',
        prompt,
        numImages: 1,
        imageUrls: sourceImages.map((image) => image.url),
        referenceImageSizes: sourceImages.map((image) => ({ width: image.width ?? null, height: image.height ?? null })),
        resolution: outputConfig.resolution,
        customImageSize: outputConfig.customImageSize,
        quality: outputConfig.quality,
        outputFormat: 'png',
        source: edit ? STORYBOARD_EDIT_SOURCE : STORYBOARD_SOURCE,
        metadata: edit ? undefined : { storyboard: { role: 'board', targetModel } },
      });
      setResult(response);
      setPreviewingTemplate(false);
      setSelectedRecentOutput(null);
      setKlingFirstFrame(null);

      if (!edit && targetModel === 'kling') {
        const storyboardImage = response.images[0] ?? null;
        if (!storyboardImage?.url) {
          throw new Error(copy.generationFailed);
        }
        const firstFrameConfig = getStoryboardOutputConfig('hd', storyboardOrientation);
        const firstFrameJobId = `${KLING_STORYBOARD_FIRST_FRAME_JOB_PREFIX}${crypto.randomUUID()}`;
        const firstFrameSourceImages = [storyboardImage, ...readyReferenceImages];
        const firstFrameResponse = await runImageGeneration({
          jobId: firstFrameJobId,
          engineId: 'gpt-image-2',
          mode: 'i2i',
          prompt: buildKlingStoryboardFirstFramePrompt({
            subject,
            action,
            dialogue,
            visualNotes,
            style,
            orientation: storyboardOrientation,
            durationSec,
            frameCount,
            shotPlan,
            referenceImageCount: readyReferenceImages.length,
          }),
          numImages: 1,
          imageUrls: firstFrameSourceImages.map((image) => image.url),
          referenceImageSizes: firstFrameSourceImages.map((image) => ({
            width: image.width ?? null,
            height: image.height ?? null,
          })),
          resolution: firstFrameConfig.resolution,
          customImageSize: firstFrameConfig.customImageSize,
          quality: firstFrameConfig.quality,
          outputFormat: 'png',
          source: STORYBOARD_SOURCE,
          metadata: {
            storyboard: {
              role: 'kling_first_frame',
              parentJobId: response.jobId ?? null,
              targetModel: 'kling',
            },
          },
        });
        const firstFrameImage = firstFrameResponse.images[0] ?? null;
        if (!firstFrameImage?.url) {
          throw new Error(copy.generationFailed);
        }
        const nextFirstFrame: KlingFirstFrameState = {
          storyboardJobId: response.jobId ?? null,
          storyboardUrl: storyboardImage.url,
          image: firstFrameImage,
          jobId: firstFrameResponse.jobId ?? firstFrameJobId,
        };
        setKlingFirstFrame(nextFirstFrame);
        writeStoredKlingFirstFrame(nextFirstFrame);
        if (firstFrameResponse.jobId) {
          await hideJob(firstFrameResponse.jobId).catch(() => undefined);
        }
      }
      setMessage(`${copy.outputTitle} · ${edit ? editPriceLabel : activePrice}`);
      if (edit) setEditInstruction('');
      void refreshRecentOutputs();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : copy.generationFailed);
    } finally {
      setRunning(false);
    }
  }

  async function saveSelectedImage() {
    if (!selectedImage?.url) return;
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveImageToLibrary({
        url: selectedImage.url,
        jobId: selectedImageJobId,
        label: copy.outputTitle,
        source: STORYBOARD_SOURCE,
      });
      setMessage(copy.savedToLibrary);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.generationFailed);
    } finally {
      setSaving(false);
    }
  }

  function applySelectedImageToGenerator() {
    if (!selectedImage?.url) return;

    const handoffDraft = selectedRecentOutput?.storyboard ?? null;
    const targetModelForHandoff = selectedKlingFirstFrame?.image?.url ? 'kling' : handoffDraft?.targetModel ?? targetModel;
    if (targetModelForHandoff === 'kling' && !selectedKlingFirstFrame?.image?.url) {
      setError(copy.klingFirstFrameMissing);
      return;
    }
    const handoff = buildStoryboardGeneratorHandoff({
      targetModel: targetModelForHandoff,
      imageUrl: selectedImage.url,
      thumbUrl: selectedImage.thumbUrl ?? null,
      jobId: selectedImageJobId,
      startFrameImageUrl: targetModelForHandoff === 'kling' ? selectedKlingFirstFrame?.image.url ?? null : null,
      startFrameThumbUrl:
        targetModelForHandoff === 'kling' ? selectedKlingFirstFrame?.image.thumbUrl ?? null : null,
      startFrameJobId: targetModelForHandoff === 'kling' ? selectedKlingFirstFrame?.jobId ?? null : null,
      startFrameWidth: targetModelForHandoff === 'kling' ? selectedKlingFirstFrame?.image.width ?? null : null,
      startFrameHeight: targetModelForHandoff === 'kling' ? selectedKlingFirstFrame?.image.height ?? null : null,
      subject: handoffDraft?.subject ?? subject,
      action: handoffDraft?.action ?? action,
      dialogue: handoffDraft?.dialogue ?? dialogue,
      durationSec: handoffDraft?.durationSec ?? durationSec,
      frameCount: handoffDraft?.frameCount ?? frameCount,
      orientation: handoffDraft?.orientation ?? storyboardOrientation,
      width: selectedImage.width ?? null,
      height: selectedImage.height ?? null,
    });
    window.sessionStorage.setItem(STORYBOARD_GENERATOR_HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
    router.push(buildStoryboardGeneratorHandoffUrl(handoff));
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 p-5 lg:p-7">
            <div className="h-96 animate-pulse rounded-card border border-border bg-surface" />
          </main>
        </div>
      </div>
    );
  }

  if (!FEATURES.workflows.toolsSection) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 p-5 lg:p-7">
            <Card className="border border-border bg-surface p-6">
              <h1 className="text-2xl font-semibold text-text-primary">{copy.disabledTitle}</h1>
              <p className="mt-2 text-sm text-text-secondary">{copy.disabledBody}</p>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg dark:bg-transparent">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col md:flex-row">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
          <div className="mx-auto w-full max-w-[1540px]">
            <div className="mb-4 max-w-xl">
              <ButtonLink href="/app/tools" variant="ghost" size="sm" linkComponent={Link} className="px-0">
                <ArrowLeft className="h-4 w-4" />
                {copy.backToTools}
              </ButtonLink>
              <div className="mt-4">
                <h1 className="text-3xl font-semibold text-text-primary dark:text-white">{copy.title}</h1>
                <p className="mt-2 max-w-xl text-sm text-text-secondary dark:text-white/[0.68]">{copy.subtitle}</p>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(360px,520px)_minmax(0,1fr)]">
              <StoryboardBuilderPanel
                copy={copy}
                prompt={{ subject, action, dialogue, visualNotes, activeOptionalField, onSubjectChange: setSubject, onActionChange: setAction, onDialogueChange: setDialogue, onVisualNotesChange: setVisualNotes, onOptionalFieldToggle: handleOptionalFieldToggle }}
                references={{ field: storyboardReferenceField, engine: STORYBOARD_REFERENCE_ENGINE, assets: storyboardReferenceAssets, onFile: handleReferenceFile, onRemove: handleRemoveReferenceSlot, onOpenLibrary: openReferenceLibrary, onError: setError }}
                target={{ targetModel, recognizablePeople, style, onTargetChange: setTargetModel, onRecognizablePeopleToggle: handleRecognizablePeopleToggle, onStyleChange: setStyle }}
                output={{ storyboardOrientation, lengthPresetId, storyboardTier, tierPriceLabels, onOrientationSelect: handleOrientationSelect, onLengthPresetSelect: handleLengthPresetSelect, onTierChange: setStoryboardTier }}
                submission={{ activePrice, canRun, running, error, message, onGenerate: () => void runStoryboard(false) }}
              />

            <StoryboardResultPanel
              activeRecentOutputId={previewingTemplate ? null : selectedRecentOutput?.id ?? null}
              copy={copy}
              durationSec={durationSec}
              editInstruction={editInstruction}
              editPriceLabel={editPriceLabel}
              frameCount={frameCount}
              orientation={storyboardOrientation}
              onApplyEdit={() => void runStoryboard(true)}
              onApplyToGenerator={applySelectedImageToGenerator}
              onDownload={() =>
                selectedImage && triggerAppDownload(selectedImage.url, suggestDownloadFilename(selectedImage.url, 'storyboard-reference'))
              }
              onEditInstructionChange={setEditInstruction}
              onSave={() => void saveSelectedImage()}
              onSelectRecentOutput={handleSelectRecentOutput}
              recentOutputs={recentOutputs}
              recentOutputsLoading={recentOutputsLoading}
              result={result}
              running={running}
              saveLabel={saveLabel}
              saving={saving}
              selectedImage={selectedImage}
              klingFirstFrame={selectedKlingFirstFrame?.image ?? null}
              templateImagePath={templateImagePath}
            />
            </div>
          </div>
        </main>
      </div>
      {authModalOpen ? (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6" role="dialog" aria-modal="true">
          <div className="absolute inset-0" role="presentation" onClick={() => setAuthModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">{copy.authTitle}</h2>
                <p className="mt-2 text-sm text-text-secondary">{copy.authBody}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setAuthModalOpen(false)} aria-label={copy.close}>
                {copy.close}
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ButtonLink
                href={buildLoginHref({ mode: 'signup', nextPath: '/app/tools/storyboard' })}
                size="sm"
              >
                {copy.authPrimary}
              </ButtonLink>
              <ButtonLink
                href={buildLoginHref({ mode: 'signin', nextPath: '/app/tools/storyboard' })}
                variant="outline"
                size="sm"
              >
                {copy.authSecondary}
              </ButtonLink>
            </div>
          </div>
        </div>
      ) : null}
      <StoryboardReferenceLibraryModal
        libraryModal={libraryModal}
        onClose={closeReferenceLibrary}
        onSelect={handleReferenceLibrarySelect}
        toolsEnabled={FEATURES.workflows.toolsSection}
      />
    </div>
  );
}
