'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import type {
  StudioCharacter,
  StudioCharacterPage,
  StudioCharacterSummary,
  StudioSaveResult,
} from '@/types/character-studio';
import type { CaptureCharacterBuilderAccountRequest } from '../_lib/character-builder-types';

type Source = { jobId: string; imageUrl: string };
type SaveTarget = Source & { characterId: string | null; loading: boolean };
type FailedRead = { kind: 'list'; before?: string | null } | { kind: 'detail'; id: string; beforeLook?: string | null };
const endpoint = '/api/character-studio/characters';
const merge = <T extends { id: string }>(items: T[]) => [
  ...new Map(items.map((item) => [item.id, item])).values(),
];

export function useCharacterStudioLibrary({
  userId,
  enabled,
  captureAccountRequest,
  captureDraftRequest = captureAccountRequest,
}: {
  userId: string | null;
  enabled: boolean;
  captureAccountRequest: CaptureCharacterBuilderAccountRequest;
  captureDraftRequest?: CaptureCharacterBuilderAccountRequest;
}) {
  const [characters, setCharacters] = useState<StudioCharacterSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudioCharacter | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(false);
  const [failedRead, setFailedRead] = useState<FailedRead | null>(null);
  const [saveTarget, setSaveTarget] = useState<SaveTarget | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const listVersion = useRef(0),
    detailVersion = useRef(0),
    saveVersion = useRef(0);
  useEffect(
    () => () => {
      listVersion.current++;
      detailVersion.current++;
      saveVersion.current++;
    },
    [],
  );

  const load = useCallback(
    async (before?: string | null) => {
      if (!userId) return;
      const request = captureAccountRequest();
      if (!request) return;
      const version = ++listVersion.current;
      setLoading(true);
      setError(false);
      setFailedRead(null);
      try {
        const response = await authFetch(
          `${endpoint}${before ? `?before=${encodeURIComponent(before)}` : ''}`,
          { headers: { Authorization: `Bearer ${request.accessToken}` }, signal: request.signal },
        );
        const body = (await response.json()) as StudioCharacterPage & { ok: boolean };
        if (!response.ok || !body.ok) throw new Error();
        if (!request.isCurrent() || version !== listVersion.current) return;
        setCharacters((previous) => (before ? merge([...previous, ...body.characters]) : body.characters));
        setNextCursor(body.nextCursor);
      } catch {
        if (request.isCurrent() && version === listVersion.current) {
          setFailedRead({ kind: 'list', before });
          setError(true);
        }
      } finally {
        if (request.isCurrent() && version === listVersion.current) setLoading(false);
      }
    },
    [captureAccountRequest, userId],
  );
  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const openCharacter = useCallback(
    async (id: string, beforeLook?: string | null) => {
      const request = captureDraftRequest();
      if (!request) return;
      const version = ++detailVersion.current;
      if (!beforeLook) setSelected(null);
      setDetailLoading(true);
      setError(false);
      setFailedRead(null);
      try {
        const response = await authFetch(
          `${endpoint}/${encodeURIComponent(id)}${beforeLook ? `?beforeLook=${encodeURIComponent(beforeLook)}` : ''}`,
          { headers: { Authorization: `Bearer ${request.accessToken}` }, signal: request.signal },
        );
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error();
        if (!request.isCurrent() || version !== detailVersion.current) return;
        const character = body.character as StudioCharacter;
        setSelected((previous) =>
          beforeLook && previous?.id === id
            ? { ...character, looks: merge([...previous.looks, ...character.looks]) }
            : character,
        );
        return character;
      } catch {
        if (request.isCurrent() && version === detailVersion.current) {
          setFailedRead({ kind: 'detail', id, beforeLook });
          setError(true);
        }
      } finally {
        if (request.isCurrent() && version === detailVersion.current) setDetailLoading(false);
      }
    },
    [captureDraftRequest],
  );
  const cancelDetails = () => {
    detailVersion.current++;
    setDetailLoading(false);
  };
  const closeCharacter = () => {
    cancelDetails();
    setSelected(null);
    setError(false);
    setFailedRead(null);
  };

  const openSave = async (source: Source) => {
    const request = captureAccountRequest();
    if (!request) return;
    const version = ++saveVersion.current;
    setSaveError(false);
    setSaveTarget({ ...source, characterId: null, loading: true });
    try {
      const response = await authFetch(`/api/jobs/${encodeURIComponent(source.jobId)}`, {
        headers: { Authorization: `Bearer ${request.accessToken}` },
        signal: request.signal,
      });
      const body = await response.json();
      if (!response.ok || !body.ok || !body.settingsSnapshot?.builder) throw new Error();
      if (!request.isCurrent() || version !== saveVersion.current) return;
      setSaveTarget({
        ...source,
        loading: false,
        characterId: body.settingsSnapshot.builder.characterId ?? null,
      });
    } catch {
      if (request.isCurrent() && version === saveVersion.current) setSaveError(true);
    }
  };
  const closeSave = () => {
    saveVersion.current++;
    setSaveTarget(null);
    setSaveError(false);
    setSaving(false);
  };
  const save = async (name: string): Promise<StudioSaveResult | undefined> => {
    if (!saveTarget || saveTarget.loading || saving) return;
    const request = captureAccountRequest();
    if (!request) return;
    const version = saveVersion.current;
    const source = saveTarget;
    setSaving(true);
    setSaveError(false);
    try {
      const response = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${request.accessToken}` },
        signal: request.signal,
        body: JSON.stringify({ name, jobId: source.jobId, imageUrl: source.imageUrl }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error();
      if (!request.isCurrent() || version !== saveVersion.current) return;
      setCharacters((previous) =>
        merge([body.character, ...previous.filter((item) => item.id !== body.character.id)]),
      );
      setSelected(body.character);
      setSaveTarget(null);
      return body as StudioSaveResult;
    } catch {
      if (request.isCurrent() && version === saveVersion.current) setSaveError(true);
    } finally {
      if (request.isCurrent() && version === saveVersion.current) setSaving(false);
    }
  };
  const updateCharacter = async (id: string, patch: { name: string } | { presentation: import('@/lib/character-studio-presentation').StudioPresentation }) => {
    const request = captureAccountRequest();
    if (!request) return;
    const detail = detailVersion.current;
    setError(false);
    setFailedRead(null);
    try {
      const response = await authFetch(`${endpoint}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${request.accessToken}` },
        signal: request.signal,
        body: JSON.stringify(patch),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error();
      if (!request.isCurrent()) return;
      if ('name' in patch) {
        setCharacters((previous) =>
          previous.map((item) => (item.id === id ? { ...item, name: body.character.name } : item)),
        );
      }
      setSelected((previous) =>
        previous?.id === id
          ? { ...previous, ...('name' in patch ? { name: body.character.name } : { presentation: body.character.presentation }) }
          : previous,
      );
      return true;
    } catch {
      if (request.isCurrent() && detail === detailVersion.current) setError(true);
    }
  };
  return {
    characters,
    nextCursor,
    selected,
    loading,
    detailLoading,
    error,
    retry: () => failedRead?.kind === 'detail' ? openCharacter(failedRead.id, failedRead.beforeLook) : load(failedRead?.before),
    load,
    openCharacter,
    closeCharacter,
    cancelDetails,
    rename: (id: string, name: string) => updateCharacter(id, { name }),
    savePresentation: (id: string, presentation: import('@/lib/character-studio-presentation').StudioPresentation) => updateCharacter(id, { presentation }),
    saveTarget,
    saveError,
    saving,
    openSave,
    closeSave,
    save,
  };
}
