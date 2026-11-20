import { useCallback, useMemo, useRef, useState } from 'react';
import { getBaseEnginesByCategory } from '../../frontend/src/lib/engines';
import { useWorkspaceRouteFormState } from '../../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRouteFormState';
import { useWorkspaceAssetState } from '../../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import { useWorkspaceDraftHydration } from '../../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceDraftHydration';
import { useWorkspaceVideoSettings } from '../../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings';
import { useWorkspaceComposerState } from '../../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceComposerState';
import { useWorkspaceInputSchemaState } from '../../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceInputSchemaState';
import { useWorkspaceGalleryActions } from '../../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGalleryActions';
import type { SelectedVideoPreview } from '../../frontend/lib/video-preview-group';
import type { Mode } from '../../frontend/types/engines';
import type { Job } from '../../frontend/types/jobs';
import type { LocalRenderGroup } from '../../frontend/app/(core)/(workspace)/app/_lib/render-persistence';
import { STORAGE_KEYS, readWorkspaceStorage, writeWorkspaceStorage } from '../../frontend/app/(core)/(workspace)/app/_lib/workspace-storage';

const catalog = getBaseEnginesByCategory('video');
const noop = () => {};
const readStorage = () => null;
const jobs: never[] = [];
const renderGroups = new Map<string, LocalRenderGroup>();
const workflowCopy = { generateVideo: 'Create video', removeAudioToUnlock: 'Remove audio',
  audioUnsupported: 'Unsupported', audioLocked: 'Locked', audioLockedFallback: 'Locked', removeAudioToUseEdit: 'Remove audio' };

/** AppClient's real recall, draft, composer and schema owners in their production order. */
export function useGalleryRecallHarness({ owner = 'recall-owner' as string | null, catalogRevision = 0, activeRenderGroups = renderGroups,
  fromVideoId = null as string | null, searchString = '', replaceRoute = noop as (href: string) => void,
  rememberedJobId = null as string | null, requestedJobId = null as string | null, requestedEngineId = null as string | null, requestedMode = null as Mode | null,
  curatedJobs = jobs as Job[] } = {}) {
  const catalogRef = useRef({ revision: catalogRevision, engines: catalog });
  if (catalogRef.current.revision !== catalogRevision) {
    catalogRef.current = { revision: catalogRevision, engines: catalog.map(engine => ({ ...engine })) };
  }
  const engines = catalogRef.current.engines;
  const engineMap = useMemo(() => new Map(engines.map(engine => [engine.id, engine])), [engines]);
  const route = useWorkspaceRouteFormState(owner);
  const storageScope = owner && owner !== 'public' ? owner : 'anon';
  const readGuestStorage = useCallback((key: string) => owner === 'public' ? readWorkspaceStorage(key, storageScope) : null, [owner, storageScope]);
  const writeGuestStorage = useCallback((key: string, value: string | null) => {
    if (owner === 'public') writeWorkspaceStorage(key, storageScope, value);
  }, [owner, storageScope]);
  const assets = useWorkspaceAssetState(owner);
  const readLegacyStorage = useCallback((key: string) => key === STORAGE_KEYS.previewJobId ? rememberedJobId : null, [rememberedJobId]);
  const [selectedPreview, setSelectedPreview] = useState<SelectedVideoPreview | null>(null);
  const [hydratedForScope, setHydratedForScope] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const preserveStoredDraftRef = useRef(false);
  const hasStoredFormRef = useRef(false);
  const draft = useWorkspaceDraftHydration({ ...route, ...assets, engines,
    authStatus: owner === 'public' ? 'loggedOut' : owner ? 'authed' : 'loading',
    accountId: owner === 'public' ? null : owner, accessToken: owner && owner !== 'public' ? `fixture-${owner}` : null, locale: 'en',
    requestedJobId, fromVideoId, effectiveRequestedEngineId: requestedEngineId,
    effectiveRequestedEngineToken: requestedEngineId ?? '', effectiveRequestedMode: requestedMode, storageScope,
    hydratedForScope, setHydratedForScope, readStorage: readGuestStorage, readScopedStorage: readStorage, writeStorage: writeGuestStorage,
    recentJobs: jobs, selectedPreview, rendersLength: 0, preserveStoredDraftRef, hasStoredFormRef,
    setSelectedPreview, hydratePendingRendersFromStorage: noop, resetRenderState: noop,
  });
  const settings = useWorkspaceVideoSettings({ ...route, ...assets, engines, engineMap,
    locale: 'en', accountScope: owner, activeDraftReady: draft.ready,
    hasActiveSetup: rememberedJobId ? false : draft.hasActiveSetup,
    draftRevision: draft.revision, provider: 'fal', fromVideoId, requestedJobId, searchString,
    authChecked: Boolean(owner), hydratedForScope, storageScope, effectiveRequestedEngineId: null,
    effectiveRequestedEngineToken: null, rendersLength: 0, readScopedStorage: readLegacyStorage,
    writeScopedStorage: noop, replaceRoute, setSelectedPreview, setNotice,
  });
  const composer = useWorkspaceComposerState({ ...route, ...assets, engines,
    effectiveRequestedEngineToken: null, authChecked: Boolean(owner), hydratedForScope, storageScope,
    preserveStoredDraftRef, requestedEngineOverrideIdRef: useRef<string | null>(null),
    requestedEngineOverrideTokenRef: useRef<string | null>(null), requestedModeOverrideRef: useRef<Mode | null>(null),
    writeStorage: noop, uiLocale: 'en', workflowCopy, showNotice: setNotice,
  });
  const schema = useWorkspaceInputSchemaState({ ...composer, hydrationReady: draft.ready,
    uiLocale: 'en', authChecked: Boolean(owner), authLoading: !owner, authenticatedUserId: owner === 'public' ? null : owner,
    uploadLockedCopy: '', setForm: route.setForm, setInputAssets: assets.setInputAssets,
  });
  const gallery = useWorkspaceGalleryActions({ ...route, provider: 'fal', renderGroups: activeRenderGroups,
    guestStarterReady: owner === 'public' && draft.ready && !hasStoredFormRef.current && !requestedEngineId && !requestedMode,
    activeManualMode: composer.activeManualMode,
    recentJobs: curatedJobs,
    batchHeroes: {}, fallbackEngineId: engines[0].id, selectedPreview,
    applyVideoSettingsFromTile: settings.applyVideoSettingsFromTile,
    hydrateVideoSettingsFromJob: settings.hydrateVideoSettingsFromJob,
    showNotice: setNotice, writeScopedStorage: noop, setSelectedPreview,
    setActiveGroupId: noop, setViewMode: noop, setActiveBatchId: noop, setBatchHeroes: noop,
  });
  return { ...route, ...assets, composer, settings, schema, gallery, draft, selectedPreview, notice };
}
