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
  AudioWaveform,
  BoxSelect,
  Clapperboard,
  Copy,
  ImagePlus,
  LayoutTemplate,
  Mic2,
  Music2,
  MousePointer2,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Video,
  WandSparkles,
} from 'lucide-react';
import styles from '../../_styles/canvas-toolbar.module.css';
import type { WorkspaceNodeKind, WorkspaceTemplateId, WorkspaceTemplateSummary } from '../../_lib/workspace-types';
import { PALETTE_DRAG_START_EVENT } from './CanvasPaletteDragPreview';

type ToolbarMenuId = 'audio' | 'image' | 'templates' | 'text' | 'video';

export type CanvasSelectionTool = 'pointer' | 'marquee';

type ToolbarBlockDefinition = {
  id: string;
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
  selectionTool: CanvasSelectionTool;
  selectedNodeCount: number;
  templates: WorkspaceTemplateSummary[];
  userTemplates: CanvasToolbarUserTemplate[];
  onApplyTemplate: (templateId: WorkspaceTemplateId) => void;
  onApplyUserTemplate: (templateId: string) => void;
  onDeleteUserTemplate: (templateId: string) => void;
  onDeleteSelectedNodes: () => void;
  onDuplicateUserTemplate: (templateId: string) => void;
  onSaveCanvasTemplate: (name: string) => void;
  onSelectionToolChange: (tool: CanvasSelectionTool) => void;
};

const IMAGE_BLOCKS: ToolbarBlockDefinition[] = [
  {
    id: 'image',
    kind: 'asset-image',
    label: 'Image',
    description: 'Image source, logo, product frame, storyboard panel.',
    icon: <ImagePlus size={18} />,
    accent: '#8b5cf6',
  },
  {
    id: 'generate-image',
    kind: 'shot',
    label: 'Generate image',
    description: 'Prompt-led generation block for visual outputs.',
    icon: <WandSparkles size={18} />,
    accent: '#6366f1',
  },
];

const VIDEO_BLOCKS: ToolbarBlockDefinition[] = [
  {
    id: 'video',
    kind: 'asset-video',
    label: 'Video',
    description: 'Video source, motion reference, source clip, B-roll.',
    icon: <Video size={18} />,
    accent: '#3b82f6',
  },
  {
    id: 'generate-video',
    kind: 'shot',
    label: 'Generate video',
    description: 'Video generation block with model-aware inputs.',
    icon: <Clapperboard size={18} />,
    accent: '#f97316',
  },
  {
    id: 'modify-video',
    kind: 'shot',
    label: 'Modify video',
    description: 'Video-to-video generation workflow block.',
    icon: <SlidersHorizontal size={18} />,
    accent: '#2563eb',
  },
  {
    id: 'upscale',
    kind: 'shot',
    label: 'Upscale',
    description: 'Enhancement workflow block for a video source.',
    icon: <Sparkles size={18} />,
    accent: '#0ea5e9',
  },
];

const AUDIO_BLOCKS: ToolbarBlockDefinition[] = [
  {
    id: 'music',
    kind: 'asset-audio',
    label: 'Music',
    description: 'Music source or reference audio.',
    icon: <Music2 size={18} />,
    accent: '#22c55e',
  },
  {
    id: 'generate-music',
    kind: 'shot',
    label: 'Generate music',
    description: 'Generation block for music direction.',
    icon: <WandSparkles size={18} />,
    accent: '#16a34a',
  },
  {
    id: 'sfx',
    kind: 'shot',
    label: 'SFX',
    description: 'Generation block for sound effects.',
    icon: <AudioWaveform size={18} />,
    accent: '#7c3aed',
  },
  {
    id: 'voice-over',
    kind: 'shot',
    label: 'Voice over',
    description: 'Generation block for narration or voice direction.',
    icon: <Mic2 size={18} />,
    accent: '#14b8a6',
  },
];

const TEXT_BLOCKS: ToolbarBlockDefinition[] = [
  {
    id: 'free-text',
    kind: 'text-prompt',
    label: 'Free text',
    description: 'Connectable text block for prompts, dialogue, notes, or metadata.',
    icon: <Type size={18} />,
    accent: '#60a5fa',
  },
];

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
  selectionTool,
  selectedNodeCount,
  templates,
  userTemplates,
  onApplyTemplate,
  onApplyUserTemplate,
  onDeleteUserTemplate,
  onDeleteSelectedNodes,
  onDuplicateUserTemplate,
  onSaveCanvasTemplate,
  onSelectionToolChange,
}: CanvasFloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [activeMenu, setActiveMenu] = useState<ToolbarMenuId | null>(null);
  const [templateName, setTemplateName] = useState('');
  const selectionCountLabel = selectedNodeCount === 1 ? '1 selected' : `${selectedNodeCount} selected`;

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
      <button
        type="button"
        className={`${styles.toolbarButton} ${selectionTool === 'pointer' ? styles.toolbarButtonActive : ''}`}
        aria-label="Select canvas nodes"
        aria-pressed={selectionTool === 'pointer'}
        onClick={() => onSelectionToolChange('pointer')}
      >
        <MousePointer2 size={18} />
      </button>
      <button
        type="button"
        className={`${styles.toolbarButton} ${selectionTool === 'marquee' ? styles.toolbarButtonActive : ''}`}
        aria-label="Marquee select canvas nodes"
        aria-pressed={selectionTool === 'marquee'}
        onClick={() => onSelectionToolChange('marquee')}
      >
        <BoxSelect size={18} />
      </button>
      <button
        type="button"
        className={styles.toolbarButton}
        aria-label="Delete selected canvas nodes"
        disabled={selectedNodeCount === 0}
        onClick={onDeleteSelectedNodes}
      >
        <Trash2 size={18} />
      </button>
      {selectedNodeCount > 0 ? <span className={styles.selectionCount}>{selectionCountLabel}</span> : null}

      <span className={styles.toolbarSeparator} />

      <ToolbarMenuButton
        active={activeMenu === 'image'}
        icon={<ImagePlus size={18} />}
        label="Image tools"
        onClick={() => toggleMenu('image')}
      />
      <ToolbarMenuButton
        active={activeMenu === 'video'}
        icon={<Video size={18} />}
        label="Video tools"
        onClick={() => toggleMenu('video')}
      />
      <ToolbarMenuButton
        active={activeMenu === 'audio'}
        icon={<Music2 size={18} />}
        label="Audio tools"
        onClick={() => toggleMenu('audio')}
      />
      <ToolbarMenuButton
        active={activeMenu === 'text'}
        icon={<Type size={18} />}
        label="Text tools"
        onClick={() => toggleMenu('text')}
      />

      <ToolbarMenuButton
        active={activeMenu === 'templates'}
        icon={<LayoutTemplate size={18} />}
        label="Canvas templates"
        onClick={() => toggleMenu('templates')}
      />

      {activeMenu === 'image' ? (
        <ToolbarPopover title="Image tools" description="Drag image blocks or image generation tools into the canvas.">
          <BlockOptionList blocks={IMAGE_BLOCKS} onBlockMouseDown={handleBlockMouseDown} />
        </ToolbarPopover>
      ) : null}

      {activeMenu === 'video' ? (
        <ToolbarPopover title="Video tools" description="Drag video sources or video generation tools into the canvas.">
          <BlockOptionList blocks={VIDEO_BLOCKS} onBlockMouseDown={handleBlockMouseDown} />
        </ToolbarPopover>
      ) : null}

      {activeMenu === 'audio' ? (
        <ToolbarPopover title="Audio tools" description="Drag music, sound, or voice tools into the canvas.">
          <BlockOptionList blocks={AUDIO_BLOCKS} onBlockMouseDown={handleBlockMouseDown} />
        </ToolbarPopover>
      ) : null}

      {activeMenu === 'text' ? (
        <ToolbarPopover title="Text tools" description="Drag connectable free text into the canvas.">
          <BlockOptionList blocks={TEXT_BLOCKS} onBlockMouseDown={handleBlockMouseDown} />
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
          key={block.id}
          type="button"
          className={styles.blockOption}
          data-canvas-toolbar-block-id={block.id}
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
