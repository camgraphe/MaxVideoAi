'use client';

import { useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { FileText, ImagePlus, Music2, Plus, RefreshCcw, Video } from 'lucide-react';
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

type NodeLibrarySidebarProps = {
  templates: WorkspaceTemplateSummary[];
  activeTemplateId: WorkspaceTemplateId;
  onAddNode: (kind: WorkspaceNodeKind) => void;
  onApplyTemplate: (templateId: WorkspaceTemplateId) => void;
};

export function NodeLibrarySidebar({
  templates,
  activeTemplateId,
  onAddNode,
  onApplyTemplate,
}: NodeLibrarySidebarProps) {
  const suppressClickRef = useRef(false);

  const handleTemplateMouseDown = (event: ReactMouseEvent, kind: WorkspaceNodeKind) => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    suppressClickRef.current = false;

    const handleMove = (moveEvent: MouseEvent) => {
      if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 8) {
        suppressClickRef.current = true;
      }
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp, { once: true });
    window.dispatchEvent(
      new CustomEvent(PALETTE_DRAG_START_EVENT, {
        detail: {
          kind,
          clientX: event.clientX,
          clientY: event.clientY,
        },
      })
    );
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
            role="button"
            tabIndex={0}
            draggable
            title={`${template.label} - ${template.description}`}
            className={styles.blockTemplateCard}
            onMouseDown={(event) => handleTemplateMouseDown(event, template.kind)}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              onAddNode(template.kind);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onAddNode(template.kind);
            }}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'copy';
              event.dataTransfer.setData('application/x-maxvideoai-node-kind', template.kind);
              event.dataTransfer.setData('text/plain', template.kind);
            }}
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
          <span>Starter templates</span>
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
    </aside>
  );
}
