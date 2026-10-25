'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronDown, Search, X } from 'lucide-react';
import { traceModelPicker } from '@/lib/model-picker-diagnostics';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { getPickerRecommendations } from '@/lib/model-picker-policy';
import type { EngineCaps, Mode } from '@/types/engines';
import type { EngineRegistryMeta } from './engine-select-types';
import type { EnginePickerContext, PickerEstimateRequest } from './model-picker-types';
import { buildEngineFamilyGroups, getModeLabel } from './engine-select-helpers';
import { filterEngineFamilyGroups } from './engine-select-catalogue';
import { modelPickerCopy } from './model-picker-copy';
import { EnginePickerRow, pickerPrice } from './EnginePickerRow';
import { useModelPickerEstimates } from './useModelPickerEstimates';
import { useVisiblePickerModels } from './useVisiblePickerModels';
import styles from './model-picker.module.css';

export function EnginePickerDialog({ engines, engineId, mode, locale, registryMeta, context, disabledEngineReasons, onSelect, onClose, showLegacy = false, onToggleLegacy, initialAll = false }: {
  engines: EngineCaps[]; engineId: string; mode: Mode; locale: string; registryMeta: EngineRegistryMeta | null;
  context?: EnginePickerContext; disabledEngineReasons?: Record<string, string>; onSelect: (id: string) => void; onClose: () => void;
  showLegacy?: boolean; onToggleLegacy?: () => void; initialAll?: boolean;
}) {
  const copy = modelPickerCopy(locale);
  const activeMode = context?.mode ?? mode;
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose });
  const titleId = useId(), panelId = useId();
  const bodyRef = useRef<HTMLDivElement>(null), searchRef = useRef<HTMLInputElement>(null), detailRef = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef<{ id: string; scroll: number } | null>(null);
  const familyGroups = useMemo(() => buildEngineFamilyGroups({ engines, registryMeta, selectedEngineId: engineId, showLegacy }), [engines, registryMeta, engineId, showLegacy]);
  const groups = useMemo(() => getPickerRecommendations(engines, activeMode), [engines, activeMode]);
  const [tab, setTab] = useState<'selected' | 'all'>(() => initialAll || !groups.length ? 'all' : 'selected');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set(familyGroups.filter(group => group.engines.some(engine => engine.id === engineId)).map(group => group.id)));
  const contextKey = context?.key ?? `${engineId}:${activeMode}`;
  const [draft, setDraft] = useState({ key: contextKey, id: engineId });
  const [view, setView] = useState<'list' | 'detail' | 'confirm'>('list');
  const [detailId, setDetailId] = useState<string | null>(null);
  const onOpenChange = useRef(context?.onOpenChange);
  onOpenChange.current = context?.onOpenChange;
  useEffect(() => { traceModelPicker('ready'); onOpenChange.current?.(true); return () => { traceModelPicker('close'); onOpenChange.current?.(false); }; }, []);
  useEffect(() => { setDraft({ key: contextKey, id: engineId }); setView('list'); }, [contextKey, engineId]);
  useEffect(() => {
    if (view === 'list') return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    detailRef.current?.focus({ preventScroll: true });
  }, [view, detailId]);
  const filtered = useMemo(() => filterEngineFamilyGroups({ groups: familyGroups, query, registryMeta }), [familyGroups, query, registryMeta]);
  const searching = Boolean(query.trim());
  const modelCount = searching || tab === 'all' ? filtered.reduce((sum, group) => sum + group.engines.length, 0) : groups.flatMap(group => group.ids).length;
  const modelCountLabel = `${modelCount} ${modelCount === 1 ? copy.model : copy.models}`;
  const renderedIds = view !== 'list' ? [] : searching || tab === 'all'
    ? filtered.flatMap(group => searching || expanded.has(group.id) ? group.engines.map(engine => engine.id) : [])
    : groups.flatMap(group => group.ids);
  const visibleIds = useVisiblePickerModels(bodyRef, renderedIds);
  const pricingIds = view === 'list' ? visibleIds : [view === 'detail' ? detailId ?? draft.id : draft.id];
  const requests: Record<string, PickerEstimateRequest> = {};
  for (const id of pricingIds) { const request = context?.options[id]?.estimate; if (request) requests[id] = request; }
  const pricing = useModelPickerEstimates(context?.scope ?? null, requests);
  const labels = (id: string) => registryMeta?.meta.get(id)?.marketingName ?? engines.find(engine => engine.id === id)?.label ?? id;
  const disabled = (id: string) => disabledEngineReasons?.[id] ?? context?.options[id]?.disabledReason
    ?? (context && !context.options[id] ? copy.loading : !context && !engines.find(engine => engine.id === id)?.modes.includes(activeMode) ? copy.unavailable : undefined);
  const option = context?.options[draft.id];
  const selectedEngine = engines.find(engine => engine.id === draft.id);
  const displayEngine = view === 'detail' ? engines.find(engine => engine.id === detailId) : selectedEngine;
  const displayOption = displayEngine ? context?.options[displayEngine.id] : undefined;
  const displayPrice = pickerPrice(displayEngine ? pricing.rows[displayEngine.id]?.quote : undefined, locale);
  function back() {
    setView('list');
    requestAnimationFrame(() => {
      if (bodyRef.current && returnTo.current) bodyRef.current.scrollTop = returnTo.current.scroll;
      const trigger = returnTo.current ? [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('[data-picker-info]') ?? [])].find(node => node.dataset.pickerInfo === returnTo.current?.id) : null;
      (trigger ?? searchRef.current)?.focus({ preventScroll: true });
    });
  }
  function apply(id = draft.id) {
    if (draft.key !== contextKey || !engines.some(engine => engine.id === id) || disabled(id)) return;
    if (id === engineId) { onClose(); return; }
    if (view !== 'confirm' && context?.options[id]?.changes.length) {
      if (view === 'list') returnTo.current = { id, scroll: bodyRef.current?.scrollTop ?? 0 };
      setDraft({ key: contextKey, id }); setView('confirm'); return;
    }
    onSelect(id);
    onClose();
  }
  const row = (id: string) => {
    const engine = engines.find(item => item.id === id);
    return engine ? <EnginePickerRow key={id} engine={engine} label={labels(id)} option={context?.options[id]} chosen={draft.id === id} current={engineId === id}
      disabled={disabled(id)} quote={pricing.rows[id]} showPrice={Boolean(context)} locale={locale} copy={copy}
      onChoose={() => setDraft({ key: contextKey, id })} onInspect={() => { returnTo.current = { id, scroll: bodyRef.current?.scrollTop ?? 0 }; setDetailId(id); setView('detail'); }} /> : null;
  };
  const hasError = Object.values(pricing.rows).some(value => value.error);
  return createPortal(<div className={`app-experience ${styles.backdrop}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onDialogKeyDown}>
      <header className={styles.header}>
        <div className={styles.titleLine}><h2 id={titleId} data-modal-initial-focus="true" tabIndex={-1}>{copy.title}</h2><button type="button" className={styles.iconButton} aria-label={copy.close} onClick={onClose}><X size={20} /></button></div>
        <p className={styles.context}>{context?.label || getModeLabel(engineId, activeMode, locale)}</p>
        {view === 'list' ? <><div className={styles.search}><Search size={17} /><input ref={searchRef} type="search" value={query} aria-label={copy.search} placeholder={copy.search} onChange={event => setQuery(event.target.value)} />
          {query ? <button type="button" className={styles.iconButton} aria-label={copy.clear} onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X size={16} /></button> : null}</div>
          <div className={styles.tabs} role="tablist" aria-label={copy.title}>
            {(['selected', 'all'] as const).filter(value => value !== 'selected' || groups.length).map(value => <button key={value} type="button" role="tab" id={`${panelId}-${value}`} aria-selected={tab === value} aria-controls={panelId} tabIndex={tab === value ? 0 : -1}
              onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key) && groups.length) { event.preventDefault(); const next = value === 'selected' ? 'all' : 'selected'; setTab(next); document.getElementById(`${panelId}-${next}`)?.focus(); } }}
              onClick={() => { setTab(value); bodyRef.current?.scrollTo?.(0, 0); }}>{copy[value]}</button>)}
          </div></> : null}
      </header>
      <div ref={bodyRef} className={styles.body} id={panelId} role={view === 'list' ? 'tabpanel' : undefined} aria-labelledby={view === 'list' ? `${panelId}-${tab}` : undefined}>
        {view === 'list' ? <>
          <div className={styles.count}>{searching || tab === 'all' ? `${modelCountLabel} · ${filtered.length} ${filtered.length === 1 ? copy.family : copy.families}` : modelCountLabel}
            {tab === 'all' && onToggleLegacy ? <label><input type="checkbox" checked={showLegacy} onChange={onToggleLegacy} />{copy.legacy}</label> : null}</div>
          {!searching && tab === 'selected' ? groups.map(group => <section key={group.group} className={styles.group}><h3>{copy[group.group]}</h3>{group.ids.map(row)}</section>)
            : filtered.map(group => <section key={group.id} className={styles.family}><button type="button" className={styles.familyButton} aria-expanded={searching || expanded.has(group.id)} aria-controls={`${panelId}-${group.id}`} onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })}>
              <EngineIcon engine={group.engines[0]} size={26} /><span>{group.label}</span><small>{group.engines.length}</small><ChevronDown size={16} /></button>
              {searching || expanded.has(group.id) ? <div id={`${panelId}-${group.id}`} className={styles.children}>{group.engines.map(engine => row(engine.id))}</div> : null}</section>)}
          {searching && !filtered.length ? <p className={styles.empty}>{copy.empty}</p> : null}
        </> : displayEngine ? <div className={styles.details}>
          <button type="button" className={styles.back} onClick={back}><ArrowLeft size={16} />{copy.back}</button>
          <div className={styles.detailTitle}><EngineIcon engine={displayEngine} size={36} /><div>{view === 'confirm' ? <small>{copy.before}</small> : null}<h3 ref={detailRef} tabIndex={-1}>{labels(displayEngine.id)}</h3></div></div>
          {view === 'confirm' ? <><p>{copy.settings}</p><dl className={styles.changes}>{displayOption?.changes.map((change, index) => <div key={`${change.label}-${index}`}><dt>{change.label}</dt><dd><span>{change.before}</span><span aria-hidden="true">→</span><strong>{change.after}</strong></dd></div>)}</dl></>
            : <><p>{displayOption?.summary || displayEngine.provider}</p><dl className={styles.changes}><div><dt>{copy.supported}</dt><dd>{displayEngine.modes.map(value => getModeLabel(displayEngine.id, value, locale)).join(' · ')}</dd></div><div><dt>{copy.resolutions}</dt><dd>{displayEngine.resolutions.join(' · ')}</dd></div></dl>{disabled(displayEngine.id) ? <p>{disabled(displayEngine.id)}</p> : null}</>}
          {context ? <div className={styles.estimate}><span>{copy.estimate}</span><strong>{displayPrice ?? displayOption?.priceUnavailableReason ?? (pricing.rows[displayEngine.id]?.error ? copy.error : displayOption?.estimate ? copy.pending : '—')}</strong></div> : null}
          <p className={styles.note}>{context ? copy.priceNote : copy.preserved}</p>
        </div> : null}
      </div>
      <footer className={styles.footer}><div><p>{view === 'confirm' || option?.changes.length ? copy.changes : copy.preserved}</p>{context ? <small>{copy.priceNote}</small> : null}{hasError ? <button type="button" className={styles.retry} onClick={pricing.retry}>{copy.retry}</button> : null}</div>
        <button type="button" className={styles.apply} disabled={draft.key !== contextKey || Boolean(disabled(view === 'detail' ? detailId ?? draft.id : draft.id))}
          onClick={() => apply(view === 'detail' && detailId ? detailId : draft.id)}>
          {view === 'confirm' ? copy.confirm : `${copy.use} ${labels(view === 'detail' ? detailId ?? draft.id : draft.id)}`}
        </button>
      </footer>
    </div>
  </div>, document.body);
}
