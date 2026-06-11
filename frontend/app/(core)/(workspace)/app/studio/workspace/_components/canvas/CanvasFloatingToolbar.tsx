'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import {
  Clapperboard,
  Copy,
  FileText,
  ImagePlus,
  LayoutTemplate,
  Maximize2,
  Music2,
  MousePointer2,
  Plus,
  Save,
  Sparkles,
  StickyNote,
  Trash2,
  Video,
} from 'lucide-react';
import styles from '../../_styles/canvas-toolbar.module.css';
import type { WorkspaceNodeKind, WorkspaceTemplateId, WorkspaceTemplateSummary } from '../../_lib/workspace-types';
import { PALETTE_DRAG_START_EVENT } from './CanvasPaletteDragPreview';

type ToolbarMenuId = 'generate' | 'media' | 'plus' | 'templates' | 'text' | 'tools';

type ToolbarBlockDefinition = {
  kind: WorkspaceNodeKind;
  label: string;
  description: string;
  icon: ReactNode;
  accent: string;
};

type ToolbarTemplateStyle = CSSProperties & {
  '--template-accent'?: string;
  '--template-thumbnail'?: string;
};

export type CanvasToolbarUserTemplate = {
  id: string;
  name: string;
  description: string;
};

export type CanvasFloatingToolbarProps = {
  activeTemplateId: WorkspaceTemplateId | null;
  activeUserTemplateId: string | null;
  templates: WorkspaceTemplateSummary[];
  userTemplates: CanvasToolbarUserTemplate[];
  onApplyTemplate: (templateId: WorkspaceTemplateId) => void;
  onApplyUserTemplate: (templateId: string) => void;
  onDeleteUserTemplate: (templateId: string) => void;
  onDuplicateUserTemplate: (templateId: string) => void;
  onFitView: () => void;
  onSaveCanvasTemplate: (name: string) => void;
};

const MEDIA_BLOCKS: ToolbarBlockDefinition[] = [
  {
    kind: 'asset-image',
    label: 'Image reference',
    description: 'Image, logo, product frame, storyboard panel.',
    icon: <ImagePlus size={18} />,
    accent: '#8b5cf6',
  },
  {
    kind: 'asset-video',
    label: 'Video reference',
    description: 'Motion reference, source video, B-roll.',
    icon: <Video size={18} />,
    accent: '#3b82f6',
  },
  {
    kind: 'asset-audio',
    label: 'Audio reference',
    description: 'Music, voiceover, ambience, SFX.',
    icon: <Music2 size={18} />,
    accent: '#22c55e',
  },
];

const TEXT_BLOCKS: ToolbarBlockDefinition[] = [
  {
    kind: 'text-prompt',
    label: 'Prompt block',
    description: 'Model prompt, camera note, dialogue, narration.',
    icon: <FileText size={18} />,
    accent: '#60a5fa',
  },
  {
    kind: 'note',
    label: 'Free text note',
    description: 'Canvas-only note for ideas, labels, and review comments.',
    icon: <StickyNote size={18} />,
    accent: '#facc15',
  },
];

const GENERATE_BLOCKS: ToolbarBlockDefinition[] = [
  {
    kind: 'shot',
    label: 'Video shot',
    description: 'Unified generation block with model-aware inputs.',
    icon: <Clapperboard size={18} />,
    accent: '#f97316',
  },
];

const QUICK_ADD_BLOCKS = [
  GENERATE_BLOCKS[0],
  TEXT_BLOCKS[0],
  TEXT_BLOCKS[1],
  MEDIA_BLOCKS[0],
].filter(Boolean) as ToolbarBlockDefinition[];

function clearTextSelection(): void {
  window.getSelection()?.removeAllRanges();
}

function templateStyle(template: WorkspaceTemplateSummary): ToolbarTemplateStyle {
  return {
    '--template-accent': template.accent ?? '#8b5cf6',
    '--template-thumbnail': template.thumbnailUrl ? `url("${template.thumbnailUrl}")` : undefined,
  };
}

export function CanvasFloatingToolbar({
  activeTemplateId,
  activeUserTemplateId,
  templates,
  userTemplates,
  onApplyTemplate,
  onApplyUserTemplate,
  onDeleteUserTemplate,
  onDuplicateUserTemplate,
  onFitView,
  onSaveCanvasTemplate,
}: CanvasFloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [activeMenu, setActiveMenu] = useState<ToolbarMenuId | null>(null);
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    if (!activeMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && toolbarRef.current?.contains(event.target)) return;
      setActiveMenu(null);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [activeMenu]);

  const handleBlockMouseDown = (event: ReactMouseEvent, kind: WorkspaceNodeKind) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    clearTextSelection();

    const startX = event.clientX;
    const startY = event.clientY;
    let hasStartedDrag = false;

    const handleMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      if (hasStartedDrag || Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) <= 8) return;
      hasStartedDrag = true;
      clearTextSelection();
      setActiveMenu(null);
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

  const handleSaveTemplate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveCanvasTemplate(templateName);
    setTemplateName('');
  };

  const toggleMenu = (menu: ToolbarMenuId) => {
    setActiveMenu((current) => (current === menu ? null : menu));
  };

  return (
    <div ref={toolbarRef} className={styles.canvasToolbar} data-canvas-toolbar="true" aria-label="Canvas creation toolbar">
      <button type="button" className={`${styles.toolbarButton} ${styles.toolbarButtonActive}`} aria-label="Select canvas nodes">
        <MousePointer2 size={18} />
      </button>

      <ToolbarMenuButton
        active={activeMenu === 'media'}
        icon={<ImagePlus size={18} />}
        label="Media blocks"
        onClick={() => toggleMenu('media')}
      />
      <ToolbarMenuButton
        active={activeMenu === 'text'}
        icon={<FileText size={18} />}
        label="Text blocks"
        onClick={() => toggleMenu('text')}
      />
      <ToolbarMenuButton
        active={activeMenu === 'generate'}
        icon={<Clapperboard size={18} />}
        label="Generate blocks"
        onClick={() => toggleMenu('generate')}
      />

      <span className={styles.toolbarSeparator} />

      <ToolbarMenuButton
        active={activeMenu === 'templates'}
        icon={<LayoutTemplate size={18} />}
        label="Canvas templates"
        onClick={() => toggleMenu('templates')}
      />
      <ToolbarMenuButton
        active={activeMenu === 'tools'}
        icon={<Maximize2 size={18} />}
        label="Canvas tools"
        onClick={() => toggleMenu('tools')}
      />

      <span className={styles.toolbarSeparator} />

      <ToolbarMenuButton
        active={activeMenu === 'plus'}
        icon={<Plus size={19} />}
        label="Quick add"
        onClick={() => toggleMenu('plus')}
      />

      {activeMenu === 'media' ? (
        <ToolbarPopover title="Media blocks" description="Drag a source block into the canvas.">
          <BlockOptionList blocks={MEDIA_BLOCKS} onBlockMouseDown={handleBlockMouseDown} />
        </ToolbarPopover>
      ) : null}

      {activeMenu === 'text' ? (
        <ToolbarPopover title="Text" description="Prompts connect to models. Notes stay on the canvas.">
          <BlockOptionList blocks={TEXT_BLOCKS} onBlockMouseDown={handleBlockMouseDown} />
        </ToolbarPopover>
      ) : null}

      {activeMenu === 'generate' ? (
        <ToolbarPopover title="Generate" description="Drag a generation block, then connect inputs.">
          <BlockOptionList blocks={GENERATE_BLOCKS} onBlockMouseDown={handleBlockMouseDown} />
        </ToolbarPopover>
      ) : null}

      {activeMenu === 'plus' ? (
        <ToolbarPopover title="Quick add" description="Drag the most common blocks into the graph.">
          <BlockOptionList blocks={QUICK_ADD_BLOCKS} onBlockMouseDown={handleBlockMouseDown} />
        </ToolbarPopover>
      ) : null}

      {activeMenu === 'templates' ? (
        <ToolbarPopover title="Canvas templates" description="Apply graph templates without touching the timeline." wide>
          <div className={styles.templateGrid}>
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`${styles.templateOption} ${template.id === activeTemplateId ? styles.templateOptionActive : ''}`}
                style={templateStyle(template)}
                onClick={() => {
                  onApplyTemplate(template.id);
                  setActiveMenu(null);
                }}
              >
                <span className={styles.templateThumbnail} aria-hidden="true">
                  <Sparkles size={15} />
                </span>
                <span>
                  <strong>{template.name}</strong>
                  <small>{template.description}</small>
                </span>
                {template.badge ? <em>{template.badge}</em> : null}
              </button>
            ))}
          </div>

          <div className={styles.templateSavePanel}>
            <form className={styles.templateSaveForm} onSubmit={handleSaveTemplate}>
              <input
                type="text"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Template name"
                aria-label="Canvas template name"
              />
              <button type="submit">
                <Save size={13} />
                Save
              </button>
            </form>
            {userTemplates.length ? (
              <div className={styles.userTemplateList}>
                {userTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`${styles.userTemplateItem} ${template.id === activeUserTemplateId ? styles.userTemplateItemActive : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onApplyUserTemplate(template.id);
                        setActiveMenu(null);
                      }}
                    >
                      <strong>{template.name}</strong>
                      <span>{template.description}</span>
                    </button>
                    <div>
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
              <p className={styles.emptyTemplateState}>No saved canvas templates yet.</p>
            )}
          </div>
        </ToolbarPopover>
      ) : null}

      {activeMenu === 'tools' ? (
        <ToolbarPopover title="Canvas tools" description="Navigation helpers for large graphs.">
          <button type="button" className={styles.toolAction} onClick={onFitView}>
            <Maximize2 size={16} />
            <span>
              <strong>Fit graph</strong>
              <small>Center every visible node in the canvas.</small>
            </span>
          </button>
        </ToolbarPopover>
      ) : null}
    </div>
  );
}

function ToolbarMenuButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.toolbarButton} ${active ? styles.toolbarButtonActive : ''}`}
      aria-label={label}
      aria-expanded={active}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function ToolbarPopover({
  children,
  description,
  title,
  wide = false,
}: {
  children: ReactNode;
  description: string;
  title: string;
  wide?: boolean;
}) {
  return (
    <section className={`${styles.toolbarPopover} ${wide ? styles.toolbarPopoverWide : ''}`} role="dialog" aria-label={title}>
      <div className={styles.popoverHeader}>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {children}
    </section>
  );
}

function BlockOptionList({
  blocks,
  onBlockMouseDown,
}: {
  blocks: ToolbarBlockDefinition[];
  onBlockMouseDown: (event: ReactMouseEvent, kind: WorkspaceNodeKind) => void;
}) {
  return (
    <div className={styles.blockOptionList}>
      {blocks.map((block) => (
        <button
          key={block.kind}
          type="button"
          className={styles.blockOption}
          data-canvas-toolbar-block-kind={block.kind}
          style={{ '--template-accent': block.accent } as ToolbarTemplateStyle}
          onMouseDown={(event) => onBlockMouseDown(event, block.kind)}
        >
          <span className={styles.blockOptionIcon}>{block.icon}</span>
          <span>
            <strong>{block.label}</strong>
            <small>{block.description}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
