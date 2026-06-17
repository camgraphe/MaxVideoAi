'use client';

import {
  useState,
  type CSSProperties,
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
import { StudioPopover } from '../ui/StudioPopover';
import { StudioSegmentedControl } from '../ui/StudioSegmentedControl';

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
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CanvasNavigatorTab>('saved');

  const handleReplaceTemplate = (template: WorkspaceTemplateSummary) => {
    const message = formatCopyValue(copy.templates.replaceCurrentCanvasConfirm, { name: template.name });
    if (typeof window !== 'undefined' && !window.confirm(message)) return;
    onApplyTemplate(template.id);
    setIsOpen(false);
  };

  return (
    <StudioPopover
      id="canvas-navigator-popover"
      label={copy.templates.canvasPanel}
      open={isOpen}
      onOpenChange={setIsOpen}
      className={styles.canvasNavigator}
      panelClassName={styles.navigatorPanel}
      trigger={(triggerProps) => (
        <button
          ref={triggerProps.ref}
          id={triggerProps.id}
          type="button"
          className={`${styles.navigatorTrigger} ${isOpen ? styles.navigatorTriggerActive : ''}`}
          aria-label={copy.templates.openCanvasPanel}
          aria-haspopup={triggerProps['aria-haspopup']}
          aria-controls={triggerProps['aria-controls']}
          aria-expanded={triggerProps['aria-expanded']}
          data-canvas-navigator="true"
          onClick={triggerProps.onClick}
          onKeyDown={triggerProps.onKeyDown}
        >
          <LayoutGrid size={17} />
          <span>{copy.templates.canvasPanel}</span>
          {userTemplates.length ? <strong>{userTemplates.length}</strong> : null}
        </button>
      )}
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

          <StudioSegmentedControl<CanvasNavigatorTab>
            className={styles.navigatorTabs}
            activeButtonClassName={styles.navigatorTabActive}
            label={copy.templates.canvasPanel}
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { label: copy.templates.myCanvases, value: 'saved' },
              { label: copy.templates.starterTemplates, value: 'templates' },
            ]}
          />

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
    </StudioPopover>
  );
}
