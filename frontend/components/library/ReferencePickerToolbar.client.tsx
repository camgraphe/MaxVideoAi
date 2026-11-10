'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ExternalLink, Search, SlidersHorizontal } from 'lucide-react';
import type { AssetLibraryBrowserProps } from './AssetLibraryBrowser';
import { compactMediaSource } from './media-action-copy';
import { workspaceReferenceCopy } from '@/components/composer/workspace-reference-copy';
import { referencePickerCopy } from './reference-picker-copy';

/** Secondary controls share one disclosure so the reference canvas keeps its height. */
export function ReferencePickerToolbar({
  locale, busy, query, onQueryChange, source, sourceLabels, availableSources, onSourceChange,
  compatibility, onCompatibilityChange, collectionsAvailable, collectionsOpen, onCollectionsToggle,
  organizationActive, headerActions, showCharacterStudio, selectionGuidance, hint, children,
}: Pick<AssetLibraryBrowserProps, 'source' | 'sourceLabels' | 'availableSources' | 'onSourceChange' | 'headerActions' | 'selectionGuidance'> & {
  locale: string;
  busy: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  compatibility?: string;
  onCompatibilityChange: (value: string) => void;
  collectionsAvailable: boolean;
  collectionsOpen: boolean;
  onCollectionsToggle: () => void;
  organizationActive: boolean;
  showCharacterStudio: boolean;
  hint?: string;
  children?: ReactNode;
}) {
  const copy = referencePickerCopy(locale);
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const sourceId = useId();
  const compatibilityId = useId();
  const filtersLabel = locale.startsWith('fr') ? 'Filtres' : locale.startsWith('es') ? 'Filtros' : 'Filters';
  const activeCount = Number(source !== 'all') + Number(compatibility === 'all') + Number(organizationActive);
  return (
    <fieldset className="app-picker-toolbar" disabled={busy}>
      <div className="app-picker-search-row">
        <div className="app-picker-search-field">
          <Search size={16} aria-hidden />
          <input type="search" aria-label={copy.search} value={query}
            onChange={(event) => onQueryChange(event.target.value.slice(0, 200))} placeholder={copy.search} />
        </div>
        <button type="button" className="app-picker-filter-toggle" aria-expanded={expanded} aria-controls={panelId}
          data-active={activeCount > 0 || undefined} onClick={() => {
            if (expanded && collectionsOpen) onCollectionsToggle();
            setExpanded((value) => !value);
          }}>
          <SlidersHorizontal size={16} aria-hidden /><span>{filtersLabel}{activeCount ? ` · ${activeCount}` : ''}</span>
        </button>
        {children}
      </div>
      <div id={panelId} className="app-picker-filters" hidden={!expanded}>
        <div className="app-picker-field">
          <label htmlFor={sourceId}>{copy.source}</label>
          <div className="app-picker-select">
            <select id={sourceId} value={source} onChange={(event) => onSourceChange(event.target.value as typeof source)}>
              {availableSources.map((option) => <option key={option} value={option}>{compactMediaSource(option, locale, sourceLabels[option] ?? option)}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden />
          </div>
        </div>
        {compatibility ? (
          <div className="app-picker-field">
            <label htmlFor={compatibilityId}>{copy.compatibility}</label>
            <div className="app-picker-select">
              <select id={compatibilityId} data-compatibility-filter value={compatibility}
                onChange={(event) => onCompatibilityChange(event.target.value)}>
                <option value="compatible">{copy.compatible}</option><option value="all">{copy.allMedia}</option>
              </select>
              <ChevronDown size={16} aria-hidden />
            </div>
          </div>
        ) : null}
        <div className="app-picker-secondary-actions">
          {collectionsAvailable ? <button type="button" aria-expanded={collectionsOpen} onClick={onCollectionsToggle}>
            {locale.startsWith('es') ? 'Colecciones' : 'Collections'}
          </button> : null}
          {headerActions}
          {showCharacterStudio ? <a className="app-picker-character-link" href="/app/tools/character-builder" target="_blank" rel="noopener noreferrer">
            Character Studio <ExternalLink size={14} aria-hidden />
          </a> : null}
        </div>
        {hint ? <p className="app-picker-help">{hint}</p> : null}
        {selectionGuidance ? <details className="app-picker-guidance">
          <summary>{workspaceReferenceCopy(locale).details}</summary><p>{selectionGuidance}</p>
        </details> : null}
      </div>
    </fieldset>
  );
}
