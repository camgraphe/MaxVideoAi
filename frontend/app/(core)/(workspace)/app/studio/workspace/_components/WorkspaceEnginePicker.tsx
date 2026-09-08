'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { StudioCopy } from '../../_lib/studio-copy';
import {
  workspaceEnginePickerTriggerLabel,
  type WorkspaceEnginePickerGroup,
  type WorkspaceEnginePickerItem,
} from '../_lib/models/workspace-engine-picker';
import styles from '../_styles/workspace-engine-picker.module.css';

export type WorkspaceEnginePickerProps = {
  copy: StudioCopy['canvas']['nodes'];
  groups: WorkspaceEnginePickerGroup[];
  selectedModelId: string;
  variant: 'node' | 'inspector';
  onSelect: (item: WorkspaceEnginePickerItem) => void;
};

type PanelGeometry = {
  left: number;
  top: number;
  width: number;
};

const VIEWPORT_PADDING = 12;
const PANEL_GAP = 6;
const PANEL_MAX_WIDTH = 620;
const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_HEIGHT = 520;
const PORTAL_THEME_VARIABLES = [
  '--studio-bg',
  '--studio-bg-soft',
  '--studio-border',
  '--studio-text',
  '--studio-text-strong',
  '--studio-text-muted',
  '--studio-primary',
  '--studio-select-text',
  '--studio-node-shadow',
] as const;

function formatCount(template: string, count: number) {
  return template.replaceAll('{count}', String(count));
}

function firstEnabledIndex(items: WorkspaceEnginePickerItem[]) {
  const index = items.findIndex((item) => !item.disabled);
  return index >= 0 ? index : 0;
}

function panelGeometry(trigger: DOMRect, measuredPanelHeight?: number): PanelGeometry {
  const availableWidth = Math.max(0, window.innerWidth - VIEWPORT_PADDING * 2);
  const width = Math.min(
    PANEL_MAX_WIDTH,
    Math.max(PANEL_MIN_WIDTH, trigger.width),
    availableWidth
  );
  const panelHeight = Math.min(
    measuredPanelHeight ?? PANEL_MAX_HEIGHT,
    PANEL_MAX_HEIGHT,
    window.innerHeight * 0.7
  );
  const fitsBelow = trigger.bottom + PANEL_GAP + panelHeight <= window.innerHeight - VIEWPORT_PADDING;
  const preferredTop = fitsBelow
    ? trigger.bottom + PANEL_GAP
    : trigger.top - PANEL_GAP - panelHeight;

  return {
    left: Math.min(
      Math.max(VIEWPORT_PADDING, trigger.left),
      Math.max(VIEWPORT_PADDING, window.innerWidth - VIEWPORT_PADDING - width)
    ),
    top: Math.min(
      Math.max(VIEWPORT_PADDING, preferredTop),
      Math.max(VIEWPORT_PADDING, window.innerHeight - VIEWPORT_PADDING - panelHeight)
    ),
    width,
  };
}

function optionId(item: WorkspaceEnginePickerItem) {
  return `workspace-engine-option-${item.id}`;
}

export function WorkspaceEnginePicker(props: WorkspaceEnginePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const highlightedOptionRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFamilyId, setActiveFamilyId] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [geometry, setGeometry] = useState<PanelGeometry | null>(null);
  const [portalThemeMode, setPortalThemeMode] = useState<'dark' | 'light'>('light');
  const [portalThemeVariables, setPortalThemeVariables] = useState<Record<string, string>>({});
  const listboxId = useId();
  const triggerId = useId();

  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => props.groups
    .map((group) => ({
      ...group,
      items: normalizedQuery
        ? group.items.filter((item) => item.searchText.includes(normalizedQuery))
        : group.items,
    }))
    .filter((group) => group.items.length > 0), [normalizedQuery, props.groups]);

  const selectedItem = useMemo(
    () => props.groups.flatMap((group) => group.items)
      .find((item) => item.id === props.selectedModelId),
    [props.groups, props.selectedModelId]
  );
  const hasOptions = props.groups.some((group) => group.items.length > 0);
  const triggerLabel = workspaceEnginePickerTriggerLabel({
    groups: props.groups,
    selectedModelId: props.selectedModelId,
    openLabel: props.copy.enginePickerOpen,
    unavailableLabel: props.copy.enginePickerUnavailable,
  });
  const activeGroup = filteredGroups.find((group) => group.id === activeFamilyId)
    ?? filteredGroups[0];
  const activeItems = useMemo(() => activeGroup?.items ?? [], [activeGroup]);
  const highlightedItem = activeItems[highlightedIndex];
  const visibleModelCount = filteredGroups.reduce((total, group) => total + group.items.length, 0);

  const closePicker = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (returnFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const updateGeometry = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const computedStyle = window.getComputedStyle(trigger);
    const measuredPanelHeight = panelRef.current?.getBoundingClientRect().height;
    setGeometry(panelGeometry(trigger.getBoundingClientRect(), measuredPanelHeight));
    setPortalThemeVariables(Object.fromEntries(PORTAL_THEME_VARIABLES.map((variable) => (
      [variable, computedStyle.getPropertyValue(variable)]
    ))));
    setPortalThemeMode(
      trigger.closest<HTMLElement>('[data-studio-theme]')?.dataset.studioTheme === 'dark'
        ? 'dark'
        : 'light'
    );
  }, []);

  const openPicker = useCallback(() => {
    const selectedGroup = props.groups.find((group) => (
      group.items.some((item) => item.id === props.selectedModelId)
    ));
    const initialGroup = selectedGroup ?? props.groups[0];
    setActiveFamilyId(initialGroup?.id ?? '');
    setHighlightedIndex(firstEnabledIndex(initialGroup?.items ?? []));
    updateGeometry();
    setOpen(true);
  }, [props.groups, props.selectedModelId, updateGeometry]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (
        panelRef.current?.contains(event.target as Node)
        || triggerRef.current?.contains(event.target as Node)
      ) return;
      closePicker(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [closePicker, open]);

  useEffect(() => {
    if (!open) return;
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closePicker(false);
    };
    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [closePicker, open]);

  useEffect(() => {
    if (!open) return;
    updateGeometry();
    window.requestAnimationFrame(() => searchRef.current?.focus());
    window.addEventListener('resize', updateGeometry);
    window.addEventListener('scroll', updateGeometry, true);
    return () => {
      window.removeEventListener('resize', updateGeometry);
      window.removeEventListener('scroll', updateGeometry, true);
    };
  }, [open, updateGeometry]);

  useEffect(() => {
    if (!open) return;
    const themeRoot = triggerRef.current?.closest<HTMLElement>('[data-studio-theme]');
    if (!themeRoot) return;
    const observer = new MutationObserver(updateGeometry);
    observer.observe(themeRoot, { attributes: true, attributeFilter: ['data-studio-theme'] });
    return () => observer.disconnect();
  }, [open, updateGeometry]);

  useEffect(() => {
    if (!open || filteredGroups.length === 0) return;
    if (filteredGroups.some((group) => group.id === activeFamilyId)) return;
    setActiveFamilyId(filteredGroups[0].id);
    setHighlightedIndex(firstEnabledIndex(filteredGroups[0].items));
  }, [activeFamilyId, filteredGroups, open]);

  useEffect(() => {
    if (highlightedIndex < activeItems.length) return;
    setHighlightedIndex(firstEnabledIndex(activeItems));
  }, [activeItems, highlightedIndex]);

  useEffect(() => {
    if (!open) return;
    highlightedOptionRef.current?.scrollIntoView({ block: 'nearest' });
  }, [highlightedItem, open]);

  const moveHighlight = (direction: 1 | -1) => {
    if (activeItems.length === 0) return;
    let nextIndex = highlightedIndex;
    for (let attempt = 0; attempt < activeItems.length; attempt += 1) {
      nextIndex = (nextIndex + direction + activeItems.length) % activeItems.length;
      if (!activeItems[nextIndex].disabled) {
        setHighlightedIndex(nextIndex);
        return;
      }
    }
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker(true);
      return;
    }
    if ((event.target as HTMLElement).closest('[data-engine-family]')) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlight(1);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(-1);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setHighlightedIndex(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setHighlightedIndex(Math.max(0, activeItems.length - 1));
    }
    if (
      event.key === 'Enter'
      && activeItems[highlightedIndex]
      && !activeItems[highlightedIndex].disabled
    ) {
      event.preventDefault();
      props.onSelect(activeItems[highlightedIndex]);
      closePicker(true);
    }
  };

  const selectFamily = (group: WorkspaceEnginePickerGroup) => {
    setActiveFamilyId(group.id);
    setHighlightedIndex(firstEnabledIndex(group.items));
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={`${styles.trigger} ${
          props.variant === 'node' ? styles.triggerNode : styles.triggerInspector
        }`}
        aria-label={hasOptions ? props.copy.enginePickerOpen : props.copy.enginePickerUnavailable}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open && activeGroup ? listboxId : undefined}
        data-studio-engine-picker-trigger={props.variant}
        disabled={!hasOptions}
        onClick={() => {
          if (open) closePicker(false);
          else openPicker();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) openPicker();
          }
        }}
      >
        {selectedItem ? (
          <EngineIcon
            engine={{ id: selectedItem.id, label: selectedItem.label, brandId: selectedItem.brandId }}
            size={props.variant === 'node' ? 20 : 24}
            rounded="full"
          />
        ) : null}
        <span className={styles.triggerLabel}>{triggerLabel}</span>
        <ChevronDown aria-hidden size={14} className={open ? styles.chevronOpen : styles.chevron} />
      </button>

      {open && geometry ? createPortal(
        <div
          ref={panelRef}
          className={styles.panel}
          data-theme={portalThemeMode}
          style={{ ...portalThemeVariables, left: geometry.left, top: geometry.top, width: geometry.width }}
          onKeyDown={handlePanelKeyDown}
        >
          <div className={styles.searchRow}>
            <Search aria-hidden size={15} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={activeGroup ? listboxId : undefined}
              aria-expanded="true"
              aria-activedescendant={highlightedItem ? optionId(highlightedItem) : undefined}
              aria-label={props.copy.enginePickerSearch}
              placeholder={props.copy.enginePickerSearch}
              className={styles.searchInput}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className={styles.resultCounts} aria-live="polite">
              <span>{formatCount(props.copy.enginePickerFamilyCount, filteredGroups.length)}</span>
              <span>{formatCount(props.copy.enginePickerModelCount, visibleModelCount)}</span>
            </div>
          </div>

          <div className={styles.pickerGrid}>
            <nav className={styles.familyColumn} aria-label={props.copy.enginePickerFamilies}>
              {filteredGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  data-engine-family
                  data-studio-engine-family={group.id}
                  className={`${styles.familyButton} ${
                    group.id === activeGroup?.id ? styles.familyButtonActive : ''
                  }`}
                  aria-pressed={group.id === activeGroup?.id}
                  onClick={() => selectFamily(group)}
                >
                  <EngineIcon
                    engine={{ id: group.id, label: group.label, brandId: group.brandId }}
                    size={22}
                    rounded="full"
                  />
                  <span>{group.label}</span>
                  <span className={styles.familyCount}>{group.items.length}</span>
                </button>
              ))}
            </nav>

            <div className={styles.modelRegion}>
              <span className={styles.modelRegionLabel}>{props.copy.enginePickerModels}</span>
              {activeGroup ? (
                <div
                  id={listboxId}
                  role="listbox"
                  tabIndex={0}
                  aria-labelledby={triggerId}
                  aria-activedescendant={highlightedItem ? optionId(highlightedItem) : undefined}
                  className={styles.modelList}
                >
                  {activeItems.map((item, index) => {
                    const selected = item.id === props.selectedModelId;
                    const highlighted = index === highlightedIndex;
                    return (
                      <button
                        ref={highlighted ? highlightedOptionRef : null}
                        key={item.id}
                        id={optionId(item)}
                        type="button"
                        role="option"
                        tabIndex={-1}
                        aria-selected={selected}
                        aria-disabled={item.disabled}
                        title={item.disabledReason}
                        data-studio-engine-option={item.id}
                        data-studio-engine-disabled={item.disabled ? 'true' : 'false'}
                        className={`${styles.modelOption} ${
                          highlighted ? styles.modelOptionHighlighted : ''
                        } ${item.disabled ? styles.modelOptionDisabled : ''}`}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => {
                          if (item.disabled) return;
                          props.onSelect(item);
                          closePicker(true);
                        }}
                      >
                        <EngineIcon
                          engine={{ id: item.id, label: item.label, brandId: item.brandId }}
                          size={28}
                          rounded="full"
                        />
                        <span className={styles.modelCopy}>
                          <strong>{item.label}</strong>
                          <span>{[item.provider, item.versionLabel].filter(Boolean).join(' · ')}</span>
                          {item.disabledReason ? (
                            <span className={styles.disabledReason}>{item.disabledReason}</span>
                          ) : null}
                        </span>
                        {selected ? <Check aria-hidden size={16} className={styles.selectedCheck} /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.noResults}>{props.copy.enginePickerNoResults}</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
