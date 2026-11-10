'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { AssetBrowserAsset, AssetLibraryBrowserProps } from './AssetLibraryBrowser';
import { compactLibraryCopy } from './compact-library-copy';
import { CompactMediaGrid, type MediaDisplayMode } from './CompactMediaGrid.client';
import { Columns3, Grid2X2, List } from 'lucide-react';
import { libraryMediaCaption } from './library-media-caption';
import { compactMediaSource } from './media-action-copy';
import { CompactLibraryFilters } from './CompactLibraryFilters.client';
import { CompactLibrarySelection } from './CompactLibrarySelection.client';
import { CompactLibraryCollections } from './CompactLibraryCollections.client';
import { useLibraryManagementSelection } from './useLibraryManagementSelection';
import { MediaActionPanel } from './MediaActionPanel.client';
import type { ManagedLibraryAsset } from '@/lib/library-management-selection';
function isManaged(asset: AssetBrowserAsset): asset is ManagedLibraryAsset {
  return Boolean(asset.organization && asset.libraryRef && asset.sourceRevision);
}
function managementError(code: string, copy: ReturnType<typeof compactLibraryCopy>) {
  return code === 'SELECTION_LIMIT' || code === 'SNAPSHOT_LIMIT_EXCEEDED'
    ? copy.limit
    : code.includes('EXPIRED')
      ? copy.expired
      : copy.failure;
}
function announcementText(message: string, copy: ReturnType<typeof compactLibraryCopy>) {
  if (message === 'SELECTION_RESET') return copy.reset;
  const tokens = message.split(':');
  return tokens
    .map((token, index) =>
      index % 2
        ? `${({ CONFIRMED: copy.confirmed, FAILED: copy.failed, UNCONFIRMED: copy.unconfirmed, UNATTEMPTED: copy.unattempted } as Record<string, string>)[token] ?? token} ${tokens[index - 1]}`
        : null
    )
    .filter(Boolean)
    .join(' · ');
}
export function CompactLibraryBrowser(props: AssetLibraryBrowserProps) {
  if (!props.management) return null;
  return (
    <OwnedCompactLibraryBrowser
      key={props.management.userId}
      {...props}
      management={props.management}
    />
  );
}
function OwnedCompactLibraryBrowser({
  management,
  locale = 'en',
  assets,
  isLoading,
  error,
  title,
  hideTitle,
  headingId,
  subtitle,
  countLabel,
  onClose,
  closeLabel,
  headerLeadingActions,
  headerActions,
  titleActions,
  headingActions,
  source,
  availableSources,
  sourceLabels,
  onSourceChange,
  searchQuery = '',
  onSearchQueryChange,
  searchPlaceholder,
  sourcesTitle,
  onRetry,
  retryLabel,
  emptyLabel,
  emptyContent,
  emptySearchLabel,
  hasMore,
  isLoadingMore,
  onLoadMore,
  loadMoreLabel,
  renderAssetActions,
  renderAssetMeta,
  renderContinuation,
  getAssetHref,
  getAssetHrefLabel,
  toolsTitle,
  toolsDescription,
  toolLinks,
  className,
}: AssetLibraryBrowserProps & {
  management: NonNullable<AssetLibraryBrowserProps['management']>;
}) {
  const { userId, scope, onScopeChange, totalCount } = management,
    copy = compactLibraryCopy(locale);
  const managed = useMemo(() => assets.filter(isManaged), [assets]);
  const selection = useLibraryManagementSelection({
    userId,
    scope,
    assets: managed,
  });
  const [localQuery, setLocalQuery] = useState('');
  const query = onSearchQueryChange ? searchQuery : localQuery;
  const visible = useMemo(
    () =>
      onSearchQueryChange || !query.trim()
        ? assets
        : assets.filter((a) =>
            [a.name, a.id, a.source].join(' ').toLowerCase().includes(query.trim().toLowerCase())
          ),
    [assets, onSearchQueryChange, query]
  );
  const [density, setDensity] = useState(() => {
    if (typeof window === 'undefined') return 128;
    try {
      const n = Number(window.localStorage.getItem(`library:density:${userId}`));
      return n >= 88 && n <= 184 ? n : window.innerWidth <= 600 ? 104 : 128;
    } catch {
      return 128;
    }
  });
  const [displayMode, setDisplayMode] = useState<MediaDisplayMode>(() => {
    try {
      const stored = window.localStorage.getItem(`library:display:${userId}`);
      return stored === 'grid' || stored === 'list' ? stored : 'mosaic';
    } catch {
      return 'mosaic';
    }
  });
  const scopeKey = JSON.stringify([userId, { ...scope, sort: undefined }]);
  // Retired generations never become current again when a previous filter returns.
  const contextRef = useRef({ scopeKey });
  if (contextRef.current.scopeKey !== scopeKey) contextRef.current = { scopeKey };
  const context = contextRef.current;
  const [viewer, setViewer] = useState<{
    context: typeof context;
    asset: AssetBrowserAsset;
  } | null>(null);
  // Listing replacement may choose a saved mirror. Refresh management metadata,
  // while the reader and all source actions retain the exact opened original/ref.
  const current =
    viewer?.context === context
      ? assets.find((asset) =>
          viewer.asset.organization?.key
            ? asset.organization?.key === viewer.asset.organization.key
            : asset.id === viewer.asset.id && asset.url === viewer.asset.url
        )
      : undefined;
  const selected =
    viewer?.context === context
      ? current
        ? {
            ...viewer.asset,
            organization: current.organization,
            isSaved: current.isSaved ?? viewer.asset.isSaved,
            savedAssetId:
              current.savedAssetId === undefined ? viewer.asset.savedAssetId : current.savedAssetId,
          }
        : viewer.asset
      : null;
  const outcome = selection.outcome;
  const remaining = outcome
    ? outcome.failed.length + outcome.unconfirmed.length + outcome.unattempted.length
    : 0;
  const runSingle = async (asset: ManagedLibraryAsset) => {
    const initiatingViewer = viewer;
    const operation = scope.trash ? 'restore' : 'trash';
    const result = await selection.run(operation, undefined, false, [asset]);
    if (result && 'confirmed' in result && result.confirmed.length)
      setViewer((active) =>
        contextRef.current === context && active === initiatingViewer ? null : active
      );
  };
  return (
    <section
      className={`compact-library ${className ?? ''}`}
      aria-busy={isLoading || selection.pending}
    >
      <header className="compact-library-heading">
        {hideTitle ? (
          <h1 id={headingId} className="sr-only">
            {title}
          </h1>
        ) : (
          <h2 id={headingId}>{title}</h2>
        )}
        {subtitle ? <p>{subtitle}</p> : null}
        {countLabel ? <span>{countLabel}</span> : null}
        <div className="compact-library-heading-actions">
          {titleActions}
          {headingActions}
          <div className="compact-library-kind-actions">{headerLeadingActions}</div>
          <div className="compact-library-import-actions">{headerActions}</div>
          {onClose ? (
            <button type="button" onClick={onClose}>
              {closeLabel ?? copy.close}
            </button>
          ) : null}
        </div>
      </header>
      <div className="compact-library-body">
        <div className="compact-library-main">
          <div className="compact-library-toolbar">
            <CompactLibraryCollections
              userId={userId}
              locale={locale}
              scope={scope}
              onScopeChange={onScopeChange}
            />

            <label className="compact-library-search">
              <span className="sr-only">{copy.search}</span>
              <input
                type="search"
                value={query}
                onChange={(event) => (onSearchQueryChange ?? setLocalQuery)(event.target.value)}
                placeholder={searchPlaceholder}
              />
            </label>
            <CompactLibraryFilters
              {...management}
              locale={locale}
              source={source}
              availableSources={availableSources}
              sourceLabels={sourceLabels}
              sourcesTitle={sourcesTitle}
              onSourceChange={onSourceChange}
              density={density}
              setDensity={setDensity}
            />
            <div className="compact-library-display" role="group" aria-label={copy.display}>
              {(
                [
                  ['mosaic', Columns3],
                  ['grid', Grid2X2],
                  ['list', List],
                ] as const
              ).map(([mode, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  aria-label={copy[mode]}
                  title={copy[mode]}
                  aria-pressed={displayMode === mode}
                  onClick={() => {
                    setDisplayMode(mode);
                    try {
                      window.localStorage.setItem(`library:display:${userId}`, mode);
                    } catch {
                      /* storage unavailable */
                    }
                  }}
                >
                  <Icon size={16} aria-hidden />
                </button>
              ))}
            </div>
            <CompactLibrarySelection
              userId={userId}
              locale={locale}
              scope={scope}
              selection={selection}
              isLoading={isLoading}
            />
            <span className="compact-library-total" role="status">
              {isLoading
                ? copy.countPending
                : `${totalCount.toLocaleString(locale)} ${copy.results}`}
            </span>
          </div>
          <p className="compact-library-announcement" role="status">
            {selection.pending ? copy.pending : announcementText(selection.announcement, copy)}
          </p>
          {selection.error ? <p role="alert">{managementError(selection.error, copy)}</p> : null}
          {outcome && remaining ? (
            <div className="compact-library-outcomes">
              <p>
                {copy.confirmed}: {outcome.confirmed.length} · {copy.failed}:{' '}
                {outcome.failed.length} · {copy.unconfirmed}: {outcome.unconfirmed.length} ·{' '}
                {copy.unattempted}: {outcome.unattempted.length}
              </p>
              {outcome.failed.length ? (
                <details>
                  <summary>{copy.failed}</summary>
                  <ul>
                    {outcome.failed.map((f) => (
                      <li key={f.asset.organization.key}>
                        {f.asset.name ?? copy.unknown}:{' '}
                        {f.error === 'SOURCE_UNAVAILABLE' ? copy.missing : copy.failure}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <button
                type="button"
                disabled={selection.pending}
                onClick={() => void selection.retry()}
              >
                {copy.retryRemaining}
              </button>
            </div>
          ) : null}
          {selection.globalUnconfirmedCount ? (
            <p role="status">
              {copy.unconfirmed}: {selection.globalUnconfirmedCount}
            </p>
          ) : null}
          {selection.globalOutcome?.failed.length ? (
            <details>
              <summary>
                {copy.failed}: {selection.globalOutcome.failedCount}
              </summary>
              <ul>
                {selection.globalOutcome.failed.map((item) => (
                  <li key={item.key}>
                    {assets.find((a) => a.organization?.key === item.key)?.name ?? copy.unknown}:{' '}
                    {item.errorCode === 'SOURCE_UNAVAILABLE' ? copy.missing : copy.failure}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {error ? (
            <p role="alert">
              {error}
              {onRetry ? (
                <button type="button" onClick={onRetry}>
                  {retryLabel ?? copy.retry}
                </button>
              ) : null}
            </p>
          ) : null}
          <CompactMediaGrid
            key={scopeKey}
            userId={userId}
            assets={visible}
            selectedKeys={selection.keys}
            onSelectionChange={selection.change}
            onOpen={(asset) => setViewer({ context, asset })}
            density={density}
            displayMode={displayMode}
            getAssetName={(asset) => libraryMediaCaption(asset, locale)}
            locale={locale}
            disabled={selection.pending}
            loading={isLoading}
            renderAssetMeta={renderAssetMeta}
          />
          {!isLoading && !visible.length ? (
            <div className="compact-library-empty">
              {query ? emptySearchLabel : (emptyContent ?? emptyLabel)}
            </div>
          ) : null}
          {hasMore && onLoadMore ? (
            <button
              type="button"
              className="compact-library-load"
              disabled={isLoadingMore || isLoading}
              onClick={onLoadMore}
            >
              {loadMoreLabel ?? copy.selectLoaded}
            </button>
          ) : null}
          {toolLinks?.length ? (
            <nav aria-label={toolsTitle}>
              <h3>{toolsTitle}</h3>
              {toolsDescription ? <p>{toolsDescription}</p> : null}
              {toolLinks.map((link) => (
                <Link key={link.href} href={link.href} prefetch={false}>
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
      {selected ? (
        <MediaActionPanel
          asset={selected}
          neighbors={visible}
          onNavigateAsset={(asset) => setViewer({ context, asset })}
          locale={locale}
          onClose={() => setViewer(null)}
          details={
            <dl>
              <dt>{copy.source}</dt>
              <dd>{compactMediaSource(selected.source ?? '', locale, copy.unknown)}</dd>
              {selected.width && selected.height ? (
                <>
                  <dt>{copy.details}</dt>
                  <dd>
                    {selected.width} × {selected.height}
                  </dd>
                </>
              ) : null}
              {selected.durationSec != null ? (
                <>
                  <dt>{copy.duration}</dt>
                  <dd>{selected.durationSec}s</dd>
                </>
              ) : null}
              {selected.createdAt ? (
                <>
                  <dt>{copy.date}</dt>
                  <dd>{new Date(selected.createdAt).toLocaleString(locale)}</dd>
                </>
              ) : null}
              {renderAssetMeta ? <dd>{renderAssetMeta(selected)}</dd> : null}
            </dl>
          }
        >
          {renderContinuation?.(selected)}
          {getAssetHref?.(selected) ? (
            <Link href={getAssetHref(selected)!} prefetch={false}>
              {getAssetHrefLabel?.(selected) ?? copy.sourceLink}
            </Link>
          ) : null}
          <div className="app-media-management">
            {renderAssetActions(selected)}
            {isManaged(selected) ? (
              <button
                type="button"
                disabled={selection.pending}
                onClick={() => void runSingle(selected)}
              >
                {scope.trash ? copy.restore : copy.trash}
              </button>
            ) : null}
          </div>
        </MediaActionPanel>
      ) : null}
    </section>
  );
}
