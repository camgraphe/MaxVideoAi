'use client';

import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Copy, FileText, ImagePlus, Music2, Plus, RefreshCcw, Save, Trash2, Video } from 'lucide-react';
import styles from '../maxvideoai-editor.module.css';
import type { WorkspaceNodeKind, WorkspaceTemplateId, WorkspaceTemplateSummary } from '../_lib/workspace-types';

const BLOCK_TEMPLATES: Array<{ kind: WorkspaceNodeKind; label: string; description: string; icon: ReactNode }> = [
  { kind: 'asset-image', label: 'Image reference', description: 'Empty image source with one reusable output.', icon: <ImagePlus size={16} /> },
  { kind: 'asset-video', label: 'Video reference', description: 'Empty video source for motion or continuity.', icon: <Video size={16} /> },
  { kind: 'asset-audio', label: 'Audio reference', description: 'Music, voiceover, or SFX source block.', icon: <Music2 size={16} /> },
  { kind: 'text-prompt', label: 'Prompt block', description: 'Text source for prompt, style, camera, or dialogue.', icon: <FileText size={16} /> },
  { kind: 'shot', label: 'Generate block', description: 'Unified video generation block with model inputs.', icon: <Plus size={16} /> },
];
const PALETTE_DRAG_START_EVENT = 'maxvideoai:palette-drag-start';

function clearTextSelection(): void {
  window.getSelection()?.removeAllRanges();
}

export type WorkspaceUserCanvasTemplateSummary = {
  id: string;
  name: string;
  description: string;
};

type NodeLibrarySidebarProps = {
  templates: WorkspaceTemplateSummary[];
  activeTemplateId: WorkspaceTemplateId | null;
  userTemplates: WorkspaceUserCanvasTemplateSummary[];
  activeUserTemplateId: string | null;
  onApplyTemplate: (templateId: WorkspaceTemplateId) => void;
  onApplyUserTemplate: (templateId: string) => void;
  onDeleteUserTemplate: (templateId: string) => void;
  onDuplicateUserTemplate: (templateId: string) => void;
  onSaveCanvasTemplate: (name: string) => void;
};

export function NodeLibrarySidebar({
  templates,
  activeTemplateId,
  userTemplates,
  activeUserTemplateId,
  onApplyTemplate,
  onApplyUserTemplate,
  onDeleteUserTemplate,
  onDuplicateUserTemplate,
  onSaveCanvasTemplate,
}: NodeLibrarySidebarProps) {
  const [templateName, setTemplateName] = useState('');

  const handleTemplateMouseDown = (event: ReactMouseEvent, kind: WorkspaceNodeKind) => {
    if (event.button !== 0) return;
    event.preventDefault();
    clearTextSelection();
    const startX = event.clientX;
    const startY = event.clientY;
    let hasStartedDrag = false;

    const handleMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      if (hasStartedDrag || Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) <= 8) return;
      hasStartedDrag = true;
      clearTextSelection();
      window.dispatchEvent(
        new CustomEvent(PALETTE_DRAG_START_EVENT, {
          detail: {
            kind,
            clientX: moveEvent.clientX,
            clientY: moveEvent.clientY,
          },
        })
      );
    };
    const handleSelectStart = (selectEvent: Event) => {
      selectEvent.preventDefault();
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('selectstart', handleSelectStart);
      clearTextSelection();
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('mouseup', handleUp, { once: true });
  };

  const handleSaveTemplate = () => {
    onSaveCanvasTemplate(templateName);
    setTemplateName('');
  };

  return (
    <aside className={styles.librarySidebar} aria-label="Block template library">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelTitle}>Block templates</p>
          <span className={styles.panelSubtitle}>Drag a block into the canvas</span>
        </div>
      </div>

      <div className={styles.blockTemplateList}>
        {BLOCK_TEMPLATES.map((template) => (
          <div
            key={template.kind}
            data-block-template-kind={template.kind}
            title={`${template.label} - ${template.description}`}
            className={styles.blockTemplateCard}
            onMouseDown={(event) => handleTemplateMouseDown(event, template.kind)}
          >
            <span className={styles.blockTemplateIcon}>{template.icon}</span>
            <span>
              <strong>{template.label}</strong>
              <small>{template.description}</small>
            </span>
          </div>
        ))}
      </div>

      <div className={styles.templateSection}>
        <div className={styles.sectionHeading}>
          <span>Canvas templates</span>
          <RefreshCcw size={14} />
        </div>
        <div className={styles.templateList}>
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`${styles.templateButton} ${template.id === activeTemplateId ? styles.templateButtonActive : ''}`}
              onClick={() => onApplyTemplate(template.id)}
            >
              <strong>{template.name}</strong>
              <span>{template.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.myCanvasTemplatesSection}>
        <div className={styles.sectionHeading}>
          <span>My canvas templates</span>
        </div>
        <div className={styles.myCanvasTemplateForm}>
          <input
            type="text"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Template name"
            aria-label="Canvas template name"
          />
          <button type="button" onClick={handleSaveTemplate}>
            <Save size={13} />
            Save
          </button>
        </div>
        {userTemplates.length ? (
          <div className={styles.myCanvasTemplateList}>
            {userTemplates.map((template) => (
              <div
                key={template.id}
                className={`${styles.myCanvasTemplateItem} ${template.id === activeUserTemplateId ? styles.myCanvasTemplateItemActive : ''}`}
              >
                <button type="button" className={styles.myCanvasTemplateMain} onClick={() => onApplyUserTemplate(template.id)}>
                  <strong>{template.name}</strong>
                  <span>{template.description}</span>
                </button>
                <div className={styles.myCanvasTemplateActions}>
                  <button type="button" onClick={() => onDuplicateUserTemplate(template.id)} aria-label={`Duplicate ${template.name}`}>
                    <Copy size={12} />
                  </button>
                  <button type="button" onClick={() => onDeleteUserTemplate(template.id)} aria-label={`Delete ${template.name}`}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No saved canvas templates yet.</p>
        )}
      </div>
    </aside>
  );
}
