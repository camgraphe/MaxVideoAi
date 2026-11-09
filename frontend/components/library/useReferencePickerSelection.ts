'use client';
import { useEffect, useRef, useState } from 'react';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
import type { ReferencePickerSelection } from './ReferenceLibraryPicker.client';
import { referencePickerCopy } from './reference-picker-copy';
import { libraryPickerCandidate, validateLibraryPickerSelection } from '@/lib/library-picker-validation';
import { resolveMediaSourceRef } from '@/lib/media-identity';
import type { LibraryMediaReference } from '@/lib/media-library-organization';
import { mutateLibraryOrganization } from '@/lib/library-mutations';
function sourceKey(asset: AssetBrowserAsset) {
  const ref: LibraryMediaReference | undefined = asset.libraryRef ?? resolveMediaSourceRef(asset, asset.kind);
  return !ref ? null : JSON.stringify(ref.type === 'job-output'
    ? [ref.type, ref.kind, ref.jobId, ref.outputId]
    : [ref.type, ref.kind, ref.assetId]);
}
/** Captured ordered DTOs and opaque opening lifetime are independent of browse/cache state. */
export function useReferencePickerSelection({
  selection,
  assets,
  locale,
}: {
  selection: ReferencePickerSelection;
  assets: AssetBrowserAsset[];
  locale: string;
}) {
  const copy = referencePickerCopy(locale);
  const owner = selection.ownerId;
  const latestSelection = useRef(selection);
  latestSelection.current = selection;
  const [basket, setBasket] = useState<AssetBrowserAsset[]>([]);
  const lifetime = useRef({ scope: selection.scope, alive: true });
  if (lifetime.current.scope !== selection.scope) lifetime.current = { scope: selection.scope, alive: true };
  const context = lifetime.current;
  useEffect(() => {
    context.alive = true;
    return () => {
      context.alive = false;
    };
  }, [context]);
  const multiple = Boolean(selection.onConfirmMany);
  const labels = locale.startsWith('fr')
    ? ['Retirer', 'Monter', 'Descendre', 'Retour', 'Dans la corbeille : restaurez ce média ou retirez-le.']
    : locale.startsWith('es')
      ? ['Quitar', 'Subir', 'Bajar', 'Volver', 'En la papelera: restaura este archivo o quítalo.']
      : ['Remove', 'Move up', 'Move down', 'Back', 'In Trash: restore this media or remove it.'];
  const unavailableLabel = locale.startsWith('fr')
    ? 'Ce média est indisponible ou a changé. Retirez-le pour choisir sa version actuelle.'
    : locale.startsWith('es')
      ? 'Este archivo no está disponible o ha cambiado. Quítalo para elegir la versión actual.'
      : 'This media is unavailable or has changed. Remove it to choose the current version.';
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inFlight = useRef(false);
  const busy = confirming || Boolean(selection.busy);
  const immediate = Boolean(selection.onToggle);
  const isDisabled = (asset: AssetBrowserAsset) =>
    Boolean(
      asset.organization?.trashedAt ||
        selection.isDisabled?.(asset) ||
        selection.getEligibility?.(asset)?.status === 'blocked',
    );
  const selected = basket[0];
  const same = (a: AssetBrowserAsset, b: AssetBrowserAsset) =>
    a.id === b.id && a.url === b.url && a.sourceRevision === b.sourceRevision;
  const choose = (asset: AssetBrowserAsset) => {
    setFailure(null);
    if (immediate) selection.onToggle?.(asset);
    else
      setBasket((previous) =>
        multiple
          ? previous.some((item) => same(item, asset))
            ? previous.filter((item) => !same(item, asset))
            : [...previous, asset]
          : [asset],
      );
  };
  const keyFor = (asset: AssetBrowserAsset) => JSON.stringify([asset.id, asset.url, asset.sourceRevision ?? null]);
  function changeLoaded(visible: AssetBrowserAsset[], keys: Set<string> | 'all') {
    const allowed = visible.filter((asset) => !isDisabled(asset));
    const requested = keys === 'all' ? new Set(allowed.map(keyFor)) : keys;
    setFailure(null);
    setBasket((previous) => {
      const additions = allowed.filter(
        (asset) => requested.has(keyFor(asset)) && !previous.some((item) => same(item, asset)),
      );
      if (!multiple && additions.length) return [additions.at(-1)!];
      const visibleKeys = new Set(visible.map(keyFor));
      const retained = previous.filter((item) => !visibleKeys.has(keyFor(item)) || requested.has(keyFor(item)));
      return [...retained, ...additions];
    });
  }
  const move = (index: number, delta: number) =>
    setBasket((previous) => {
      const next = previous.slice();
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  useEffect(() => {
    // Missing pages are not removals. Only an observed source change or organization state updates a captured DTO.
    setBasket((previous) => {
      const next = previous.map((item) => {
        const identity = sourceKey(item);
        // A saved copy can reuse a list ID while changing typed projection. It is not a replacement.
        // Unqualified legacy facades are proved on confirmation, never by list ID/URL inference.
        const observed = identity ? assets.find((asset) => sourceKey(asset) === identity) : undefined;
        const sourceChanged = Boolean(
          observed &&
            (observed.url !== item.url ||
              (item.sourceRevision && observed.sourceRevision && item.sourceRevision !== observed.sourceRevision)),
        );
        return observed && (sourceChanged || observed.organization?.trashedAt)
          ? {
              ...item,
              organization: observed.organization ?? item.organization,
              unavailable: Boolean(('unavailable' in item && item.unavailable) || sourceChanged),
            }
          : item;
      });
      return next.some((item, index) => item !== previous[index]) ? next : previous;
    });
  }, [assets]);
  const accept = async (candidates: AssetBrowserAsset[]) => {
    if (
      !candidates.length ||
      busy ||
      inFlight.current ||
      candidates.some(
        (item) =>
          isDisabled(item) ||
          ('unavailable' in item && item.unavailable) ||
          ('validationError' in item && item.validationError),
      )
    )
      return;
    const isCurrent = () => context.alive && lifetime.current === context;
    inFlight.current = true;
    setConfirming(true);
    selection.onBusyChange?.(true);
    setFailure(null);
    try {
      // The insertion owner alone closes on acceptance; rejected choices remain reviewable.
      if (owner) {
        const validation = await validateLibraryPickerSelection(owner, candidates, selection.sourceProof);
        if (!isCurrent()) return;
        setBasket((previous) =>
          previous.map((item) => {
            const index = candidates.findIndex((candidate) => same(candidate, item));
            return index < 0 ? item : {
              ...item,
              organization: validation[index]?.state ?? item.organization,
              validationError: validation[index]?.error,
            };
          }),
        );
        if (validation.some((item) => item.error)) {
          setFailure(validation.some((item) => item.state?.trashedAt) ? labels[4] : unavailableLabel);
          return;
        }
      }
      const live = latestSelection.current;
      if (candidates.some((item) => live.isDisabled?.(item) || live.getEligibility?.(item)?.status === 'blocked')) {
        setFailure(copy.error);
        return;
      }
      const result = multiple ? await live.onConfirmMany?.(candidates, { isCurrent }) : await live.onConfirm?.(candidates[0]);
      if (!isCurrent()) return;
      if (result === false || typeof result === 'string') setFailure(typeof result === 'string' ? result : copy.error);
    } catch {
      if (isCurrent()) setFailure(copy.error);
    } finally {
      if (isCurrent()) {
        inFlight.current = false;
        setConfirming(false);
        selection.onBusyChange?.(false);
      }
    }
  };
  const confirm = () => accept(basket);
  const confirmAsset = (asset: AssetBrowserAsset) => accept([asset]);

  async function restore(item: AssetBrowserAsset) {
    if (!owner || busy || inFlight.current) return;
    inFlight.current = true;
    setConfirming(true);
    selection.onBusyChange?.(true);
    try {
      const response = await mutateLibraryOrganization(owner, {
        operation: 'restore',
        references: [libraryPickerCandidate(item).reference],
      });
      if (!context.alive || lifetime.current !== context) return;
      if (!('results' in response) || response.results[0]?.status !== 'succeeded') throw Error();
      setBasket((previous) =>
        previous.map((value) =>
          same(value, item) ? { ...value, organization: response.results[0].state, validationError: undefined } : value,
        ),
      );
      setFailure(null);
    } catch {
      if (context.alive) setFailure(copy.error);
    } finally {
      if (context.alive && lifetime.current === context) {
        inFlight.current = false;
        setConfirming(false);
        selection.onBusyChange?.(false);
      }
    }
  }
  return {
    copy,
    owner,
    basket,
    setBasket,
    selected,
    choose,
    keyFor,
    changeLoaded,
    move,
    same,
    isDisabled,
    busy,
    immediate,
    failure,
    setFailure,
    setConfirming,
    labels,
    unavailableLabel,
    confirm,
    confirmAsset,
    restore,
  };
}
