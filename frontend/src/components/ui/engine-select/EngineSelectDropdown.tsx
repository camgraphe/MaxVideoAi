'use client';

import clsx from 'clsx';
import { createPortal } from 'react-dom';
import type { RefObject } from 'react';
import type { EngineAvailability, EngineCaps, Mode } from '@/types/engines';
import { Chip } from '../Chip';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { EngineSelectCopy } from './engine-select-copy';
import {
  formatAvgDuration,
  getModeDisplayOrder,
  getModeLabel,
} from './engine-select-helpers';
import type { DropdownPosition, EngineRegistryMeta } from './engine-select-types';

type EngineSelectDropdownProps = {
  activeOptionId?: string;
  contentRef: RefObject<HTMLDivElement>;
  copy: EngineSelectCopy;
  formatEngineShort: (engine: EngineCaps | null | undefined) => string;
  hasLegacyEngines: boolean;
  highlightedIndex: number;
  legacyToggleId: string;
  legacyToggleLabel: string;
  locale?: string;
  modeLabelOverrides?: Partial<Record<Mode, string>>;
  onBrowse: () => void;
  onHighlight: (index: number) => void;
  onItemRef: (index: number, node: HTMLButtonElement | null) => void;
  onSelectEngine: (engineId: string) => void;
  onToggleLegacy: (checked: boolean) => void;
  portalElement: HTMLDivElement;
  position: DropdownPosition;
  registryMeta: EngineRegistryMeta | null;
  selectedEngine: EngineCaps;
  showLegacy: boolean;
  triggerId: string;
  visibleEngines: EngineCaps[];
};

export function EngineSelectDropdown({
  activeOptionId,
  contentRef,
  copy,
  formatEngineShort,
  hasLegacyEngines,
  highlightedIndex,
  legacyToggleId,
  legacyToggleLabel,
  locale,
  modeLabelOverrides,
  onBrowse,
  onHighlight,
  onItemRef,
  onSelectEngine,
  onToggleLegacy,
  portalElement,
  position,
  registryMeta,
  selectedEngine,
  showLegacy,
  triggerId,
  visibleEngines,
}: EngineSelectDropdownProps) {
  return createPortal(
    <div
      ref={contentRef}
      className="fixed z-[9999]"
      style={{ top: position.top, left: position.left, minWidth: Math.max(position.width, 280) }}
    >
      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-float">
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-3 py-2 text-[12px] text-text-muted">
          <span>Engines</span>
          <div className="flex items-center gap-3">
            {hasLegacyEngines ? (
              <label
                htmlFor={legacyToggleId}
                className="inline-flex items-center gap-2 whitespace-nowrap text-[11px] font-medium text-text-secondary"
              >
                <input
                  id={legacyToggleId}
                  type="checkbox"
                  checked={showLegacy}
                  onChange={(event) => onToggleLegacy(event.currentTarget.checked)}
                  className="h-4 w-4 rounded border border-border accent-brand"
                />
                <span>{legacyToggleLabel}</span>
              </label>
            ) : null}
            <button
              type="button"
              onClick={onBrowse}
              className="rounded-input border border-transparent px-2 py-1 text-[11px] font-medium text-brand transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copy.browse}
            </button>
          </div>
        </div>
        <ul
          className="max-h-72 overflow-y-auto py-1"
          role="listbox"
          aria-labelledby={triggerId}
          aria-activedescendant={activeOptionId}
        >
          {visibleEngines.map((engine, index) => {
            const active = engine.id === selectedEngine.id;
            const highlighted = index === highlightedIndex;
            const meta = registryMeta?.meta.get(engine.id);
            const avgDurationLabel = formatAvgDuration(engine.avgDurationMs);
            const availability: EngineAvailability = meta?.availability ?? engine.availability ?? 'available';
            const disabled = availability === 'paused';
            return (
              <li key={engine.id}>
                <button
                  ref={(node) => onItemRef(index, node)}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    onSelectEngine(engine.id);
                  }}
                  onMouseEnter={() => onHighlight(index)}
                  onFocus={() => onHighlight(index)}
                  className={clsx(
                    'flex w-full items-start gap-4 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'hover:bg-surface-2',
                    active && 'bg-surface-2',
                    highlighted && !active && 'bg-surface-2',
                    disabled && 'cursor-not-allowed opacity-60'
                  )}
                  role="option"
                  id={`${engine.id}-option`}
                  aria-selected={active}
                  aria-disabled={disabled}
                  disabled={disabled}
                  tabIndex={-1}
                >
                  <EngineIcon engine={engine} size={32} className="mt-0.5 shrink-0" />
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {meta?.marketingName ?? formatEngineShort(engine)}
                      </p>
                      <p className="truncate text-[12px] text-text-muted">
                        {engine.provider} - {meta?.versionLabel ?? engine.version ?? '-'}
                      </p>
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {getModeDisplayOrder(engine.id, engine.modes).map((engineMode) => (
                          <Chip key={engineMode} variant="outline" className="px-1.5 py-0.5 text-[10px]">
                            {getModeLabel(engine.id, engineMode, locale, modeLabelOverrides)}
                          </Chip>
                        ))}
                        {engine.isLab && (
                          <Chip variant="ghost" className="px-1.5 py-0.5 text-[10px]">Lab</Chip>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[11px] text-text-muted">
                      {avgDurationLabel && <span>{copy.avgDuration.replace('{value}', avgDurationLabel)}</span>}
                      {engine.status && <span className="uppercase tracking-micro">{engine.status}</span>}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    portalElement
  );
}
