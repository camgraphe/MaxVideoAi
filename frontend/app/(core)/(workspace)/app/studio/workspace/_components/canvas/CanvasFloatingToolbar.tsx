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
  MessageSquareText,
  Mic2,
  Music2,
  MousePointer2,
  Redo2,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Video,
  WandSparkles,
} from 'lucide-react';
import styles from '../../_styles/canvas-toolbar.module.css';
import {
  WORKSPACE_BLOCK_PRESETS,
  type WorkspaceBlockPreset,
} from '../../_lib/workspace-block-presets';
import type {
  WorkspaceGenerationPresetId,
  WorkspaceNodeKind,
  WorkspaceTemplateId,
  WorkspaceTemplateSummary,
} from '../../_lib/workspace-types';
import { PALETTE_DRAG_START_EVENT } from './CanvasPaletteDragPreview';
import type { StudioCopy } from '../../../_lib/studio-copy';

type ToolbarMenuId = 'audio' | 'image' | 'templates' | 'text' | 'video';

export type CanvasSelectionTool = 'pointer' | 'marquee';

type ToolbarBlockDefinition = {
  id: string;
  kind: WorkspaceNodeKind;
  presetId?: WorkspaceGenerationPresetId;
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
  copy: StudioCopy['canvas'];
  activeTemplateId: WorkspaceTemplateId | null;
  activeUserTemplateId: string | null;
  canRedo: boolean;
  canUndo: boolean;
  selectionTool: CanvasSelectionTool;
  selectedNodeCount: number;
  templates: WorkspaceTemplateSummary[];
  userTemplates: CanvasToolbarUserTemplate[];
  onApplyTemplate: (templateId: WorkspaceTemplateId) => void;
  onApplyUserTemplate: (templateId: string) => void;
  onDeleteUserTemplate: (templateId: string) => void;
  onDeleteSelectedNodes: () => void;
  onDuplicateUserTemplate: (templateId: string) => void;
  onRedo: () => void;
  onSaveCanvasTemplate: (name: string) => void;
  onSelectionToolChange: (tool: CanvasSelectionTool) => void;
  onUndo: () => void;
};

function copyValue(copy: StudioCopy['canvas']['nodes'], key: string, fallback: string): string {
  return copy[key] ?? fallback;
}

function blockFromPreset(preset: WorkspaceBlockPreset, copy: StudioCopy['canvas']['nodes'], icon: ReactNode): ToolbarBlockDefinition {
  return {
    id: preset.id,
    kind: preset.nodeKind,
    presetId: preset.id,
    label: copyValue(copy, preset.labelKey, preset.id),
    description: copyValue(copy, preset.descriptionKey, preset.id),
    icon,
    accent: preset.accent,
  };
}

function presetBlock(
  presetId: WorkspaceGenerationPresetId,
  copy: StudioCopy['canvas']['nodes'],
  icon: ReactNode
): ToolbarBlockDefinition {
  const preset = WORKSPACE_BLOCK_PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) {
    return {
      id: presetId,
      kind: 'shot',
      label: presetId,
      description: presetId,
      icon,
      accent: '#8b5cf6',
    };
  }
  return blockFromPreset(preset, copy, icon);
}

function toolbarBlocks(copy: StudioCopy['canvas']['nodes']): Record<'audio' | 'image' | 'text' | 'video', ToolbarBlockDefinition[]> {
  return {
    image: [
      {
        id: 'image',
        kind: 'asset-image',
        label: copy.image,
        description: copy.imageDescription,
        icon: <ImagePlus size={18} />,
        accent: '#8b5cf6',
      },
      presetBlock('generate-image', copy, <WandSparkles size={18} />),
      presetBlock('character-builder', copy, <Sparkles size={18} />),
      presetBlock('angle', copy, <SlidersHorizontal size={18} />),
      presetBlock('upscale-image', copy, <Sparkles size={18} />),
    ],
    video: [
      {
        id: 'video',
        kind: 'asset-video',
        label: copy.video,
        description: copy.videoDescription,
        icon: <Video size={18} />,
        accent: '#3b82f6',
      },
      presetBlock('generate-video', copy, <Clapperboard size={18} />),
      presetBlock('modify-video', copy, <SlidersHorizontal size={18} />),
      presetBlock('upscale-video', copy, <Sparkles size={18} />),
    ],
    audio: [
      {
        id: 'music',
        kind: 'asset-audio',
        label: copy.music,
        description: copy.musicDescription,
        icon: <Music2 size={18} />,
        accent: '#22c55e',
      },
      presetBlock('audio-music', copy, <WandSparkles size={18} />),
      presetBlock('audio-voiceover', copy, <Mic2 size={18} />),
      presetBlock('audio-sfx', copy, <AudioWaveform size={18} />),
      presetBlock('audio-sound-design', copy, <AudioWaveform size={18} />),
      presetBlock('audio-sound-design-voice', copy, <Mic2 size={18} />),
    ],
    text: [
      {
        id: 'free-text',
        kind: 'text-prompt',
        label: copy.freeText,
        description: copy.freeTextDescription,
        icon: <Type size={18} />,
        accent: '#60a5fa',
      },
      presetBlock('chat-box', copy, <MessageSquareText size={18} />),
    ],
  };
}

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

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
  copy,
  activeTemplateId,
  activeUserTemplateId,
  canRedo,
  canUndo,
  selectionTool,
  selectedNodeCount,
  templates,
  userTemplates,
  onApplyTemplate,
  onApplyUserTemplate,
  onDeleteUserTemplate,
  onDeleteSelectedNodes,
  onDuplicateUserTemplate,
  onRedo,
  onSaveCanvasTemplate,
  onSelectionToolChange,
  onUndo,
}: CanvasFloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [activeMenu, setActiveMenu] = useState<ToolbarMenuId | null>(null);
  const [templateName, setTemplateName] = useState('');
  const blocks = toolbarBlocks(copy.nodes);

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

  const handleBlockMouseDown = (
    event: ReactMouseEvent,
    kind: WorkspaceNodeKind,
    presetId?: WorkspaceGenerationPresetId
  ) => {
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
            presetId,
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
    <div ref={toolbarRef} className={styles.canvasToolbar} data-canvas-toolbar="true" aria-label={copy.toolbar.ariaLabel}>
      <button
        type="button"
        className={styles.toolbarButton}
        aria-label={copy.toolbar.undo}
        data-tooltip={copy.toolbar.undoTooltip}
        title={copy.toolbar.undoTitle}
        disabled={!canUndo}
        onClick={onUndo}
      >
        <Undo2 size={18} />
      </button>
      <button
        type="button"
        className={styles.toolbarButton}
        aria-label={copy.toolbar.redo}
        data-tooltip={copy.toolbar.redoTooltip}
        title={copy.toolbar.redoTitle}
        disabled={!canRedo}
        onClick={onRedo}
      >
        <Redo2 size={18} />
      </button>
      <span className={styles.toolbarSeparator} />
      <button
        type="button"
        className={`${styles.toolbarButton} ${selectionTool === 'pointer' ? styles.toolbarButtonActive : ''}`}
        aria-label={copy.toolbar.selectNodes}
        aria-pressed={selectionTool === 'pointer'}
        onClick={() => onSelectionToolChange('pointer')}
      >
        <MousePointer2 size={18} />
      </button>
      <button
        type="button"
        className={`${styles.toolbarButton} ${selectionTool === 'marquee' ? styles.toolbarButtonActive : ''}`}
        aria-label={copy.toolbar.marqueeSelectNodes}
        aria-pressed={selectionTool === 'marquee'}
        onClick={() => onSelectionToolChange('marquee')}
      >
        <BoxSelect size={18} />
      </button>
      <button
        type="button"
        className={styles.toolbarButton}
        aria-label={copy.toolbar.deleteSelectedNodes}
        disabled={selectedNodeCount === 0}
        onClick={onDeleteSelectedNodes}
      >
        <Trash2 size={18} />
      </button>

      <span className={styles.toolbarSeparator} />

      <ToolbarMenuButton
        active={activeMenu === 'image'}
        icon={<ImagePlus size={18} />}
        label={copy.toolbar.imageTools}
        onClick={() => toggleMenu('image')}
      />
      <ToolbarMenuButton
        active={activeMenu === 'video'}
        icon={<Video size={18} />}
        label={copy.toolbar.videoTools}
        onClick={() => toggleMenu('video')}
      />
      <ToolbarMenuButton
        active={activeMenu === 'audio'}
        icon={<Music2 size={18} />}
        label={copy.toolbar.audioTools}
        onClick={() => toggleMenu('audio')}
      />
      <ToolbarMenuButton
        active={activeMenu === 'text'}
        icon={<Type size={18} />}
        label={copy.toolbar.textTools}
        onClick={() => toggleMenu('text')}
      />

      <ToolbarMenuButton
        active={activeMenu === 'templates'}
        icon={<LayoutTemplate size={18} />}
        label={copy.toolbar.canvasTemplates}
        onClick={() => toggleMenu('templates')}
      />

      {activeMenu === 'image' ? (
        <ToolbarPopover title={copy.toolbar.imageTools} description={copy.toolbar.imageToolsDescription}>
          <BlockOptionList blocks={blocks.image} onBlockMouseDown={handleBlockMouseDown} />
        </ToolbarPopover>
      ) : null}

      {activeMenu === 'video' ? (
        <ToolbarPopover title={copy.toolbar.videoTools} description={copy.toolbar.videoToolsDescription}>
          <BlockOptionList blocks={blocks.video} onBlockMouseDown={handleBlockMouseDown} />
        </ToolbarPopover>
      ) : null}

      {activeMenu === 'audio' ? (
        <ToolbarPopover title={copy.toolbar.audioTools} description={copy.toolbar.audioToolsDescription}>
          <BlockOptionList blocks={blocks.audio} onBlockMouseDown={handleBlockMouseDown} />
        </ToolbarPopover>
      ) : null}

      {activeMenu === 'text' ? (
        <ToolbarPopover title={copy.toolbar.textTools} description={copy.toolbar.textToolsDescription}>
          <BlockOptionList blocks={blocks.text} onBlockMouseDown={handleBlockMouseDown} />
        </ToolbarPopover>
      ) : null}

      {activeMenu === 'templates' ? (
        <ToolbarPopover title={copy.toolbar.canvasTemplates} description={copy.toolbar.canvasTemplatesDescription} wide>
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
                placeholder={copy.templates.templateNamePlaceholder}
                aria-label={copy.templates.templateNameLabel}
              />
              <button type="submit">
                <Save size={13} />
                {copy.templates.save}
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
                      <button type="button" onClick={() => onDuplicateUserTemplate(template.id)} aria-label={formatCopyValue(copy.templates.duplicate, { name: template.name })}>
                        <Copy size={12} />
                      </button>
                      <button type="button" onClick={() => onDeleteUserTemplate(template.id)} aria-label={formatCopyValue(copy.templates.delete, { name: template.name })}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.emptyTemplateState}>{copy.templates.empty}</p>
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
  onBlockMouseDown: (event: ReactMouseEvent, kind: WorkspaceNodeKind, presetId?: WorkspaceGenerationPresetId) => void;
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
          data-canvas-toolbar-preset-id={block.presetId}
          style={{ '--template-accent': block.accent } as ToolbarTemplateStyle}
          onMouseDown={(event) => onBlockMouseDown(event, block.kind, block.presetId)}
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
