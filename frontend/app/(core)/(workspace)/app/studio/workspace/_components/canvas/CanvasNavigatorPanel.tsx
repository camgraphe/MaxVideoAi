'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  Blocks,
  Copy,
  Folders,
  LayoutGrid,
  LayoutTemplate,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  WorkspaceTemplateId,
  WorkspaceTemplateSummary,
} from '../../_lib/workspace-types';
import styles from '../../_styles/canvas-navigator.module.css';
import type { StudioCopy } from '../../../_lib/studio-copy';

type CanvasNavigatorTab = 'saved' | 'templates';

type CanvasNavigatorTemplateStyle = CSSProperties & {
  '--template-accent'?: string;
  '--template-thumbnail'?: string;
};

export type CanvasNavigatorUserCanvas = {
  id: string;
  name: string;
  description: string;
};

export type CanvasNavigatorPanelProps = {
  copy: StudioCopy['canvas'];
  activeTemplateId: WorkspaceTemplateId | null;
  activeUserTemplateId: string | null;
  templates: WorkspaceTemplateSummary[];
  userTemplates: CanvasNavigatorUserCanvas[];
  onAddTemplate: (templateId: WorkspaceTemplateId) => void;
  onApplyTemplate: (templateId: WorkspaceTemplateId) => void;
  onApplyUserTemplate: (templateId: string) => void;
  onCreateCanvasFromTemplate: (templateId: WorkspaceTemplateId) => void;
  onDeleteUserTemplate: (templateId: string) => void;
  onDuplicateUserTemplate: (templateId: string) => void;
};

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function templateStyle(template: WorkspaceTemplateSummary): CanvasNavigatorTemplateStyle {
  return {
    '--template-accent': template.accent ?? '#8b5cf6',
    '--template-thumbnail': template.thumbnailUrl ? `url("${template.thumbnailUrl}")` : 'none',
  };
}

export function CanvasNavigatorPanel({
  copy,
  activeTemplateId,
  activeUserTemplateId,
  templates,
  userTemplates,
  onAddTemplate,
  onApplyTemplate,
  onApplyUserTemplate,
  onCreateCanvasFromTemplate,
  onDeleteUserTemplate,
  onDuplicateUserTemplate,
}: CanvasNavigatorPanelProps) {
  const navigatorRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CanvasNavigatorTab>('saved');

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && navigatorRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  const handleReplaceTemplate = (template: WorkspaceTemplateSummary) => {
    const message = formatCopyValue(copy.templates.replaceCurrentCanvasConfirm, { name: template.name });
    if (typeof window !== 'undefined' && !window.confirm(message)) return;
    onApplyTemplate(template.id);
    setIsOpen(false);
  };

  const handlePanelKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={navigatorRef} className={styles.canvasNavigator} data-canvas-navigator="true">
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.navigatorTrigger} ${isOpen ? styles.navigatorTriggerActive : ''}`}
        aria-label={copy.templates.openCanvasPanel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <LayoutGrid size={17} />
        <span>{copy.templates.canvasPanel}</span>
        {userTemplates.length ? <strong>{userTemplates.length}</strong> : null}
      </button>

      {isOpen ? (
        <section
          className={styles.navigatorPanel}
          role="dialog"
          aria-label={copy.templates.canvasPanel}
          onKeyDown={handlePanelKeyDown}
        >
          <header className={styles.navigatorHeader}>
            <span className={styles.navigatorIcon} aria-hidden="true">
              <Folders size={17} />
            </span>
            <span>
              <strong>{copy.templates.canvasPanel}</strong>
              <small>{copy.templates.canvasPanelDescription}</small>
            </span>
          </header>

          <div className={styles.navigatorTabs} role="tablist" aria-label={copy.templates.canvasPanel}>
            <button
              type="button"
              role="tab"
              className={activeTab === 'saved' ? styles.navigatorTabActive : ''}
              aria-selected={activeTab === 'saved'}
              onClick={() => setActiveTab('saved')}
            >
              {copy.templates.myCanvases}
            </button>
            <button
              type="button"
              role="tab"
              className={activeTab === 'templates' ? styles.navigatorTabActive : ''}
              aria-selected={activeTab === 'templates'}
              onClick={() => setActiveTab('templates')}
            >
              {copy.templates.starterTemplates}
            </button>
          </div>

          {activeTab === 'saved' ? (
            <div className={styles.savedCanvasList}>
              {userTemplates.length ? (
                userTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`${styles.savedCanvasItem} ${template.id === activeUserTemplateId ? styles.savedCanvasItemActive : ''}`}
                    data-canvas-user-template-id={template.id}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onApplyUserTemplate(template.id);
                        setIsOpen(false);
                      }}
                    >
                      <strong>{template.name}</strong>
                      <span>{template.description}</span>
                    </button>
                    {template.id === activeUserTemplateId ? <span className={styles.savedCanvasActiveMarker} aria-hidden="true" /> : null}
                    <div className={styles.savedCanvasActions}>
                      <button type="button" onClick={() => onDuplicateUserTemplate(template.id)} aria-label={formatCopyValue(copy.templates.duplicate, { name: template.name })}>
                        <Copy size={13} />
                      </button>
                      <button type="button" onClick={() => onDeleteUserTemplate(template.id)} aria-label={formatCopyValue(copy.templates.delete, { name: template.name })}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className={styles.navigatorEmpty}>{copy.templates.emptyCanvases}</p>
              )}
            </div>
          ) : (
            <div className={styles.templateGrid}>
              {templates.map((template) => (
                <article
                  key={template.id}
                  className={`${styles.templateCard} ${template.id === activeTemplateId ? styles.templateCardActive : ''}`}
                  data-canvas-template-id={template.id}
                  style={templateStyle(template)}
                >
                  <span className={styles.templatePreview} data-canvas-template-preview="true" aria-hidden="true">
                    <span className={styles.templateThumbnail}>
                      <Sparkles size={15} />
                    </span>
                  </span>
                  <div className={styles.templateBody}>
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                    <span className={styles.templateFlow}>{template.flow}</span>
                  </div>
                  {template.badge ? <em>{template.badge}</em> : null}
                  <div className={styles.templateActions}>
                    <button
                      type="button"
                      onClick={() => {
                        onCreateCanvasFromTemplate(template.id);
                        setIsOpen(false);
                      }}
                    >
                      <LayoutTemplate size={13} />
                      {copy.templates.newCanvas}
                    </button>
                    <button type="button" onClick={() => handleReplaceTemplate(template)}>
                      {copy.templates.replaceCanvas}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAddTemplate(template.id);
                        setIsOpen(false);
                      }}
                    >
                      <Blocks size={13} />
                      {copy.templates.addTemplate}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
