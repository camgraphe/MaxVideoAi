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
  ImagePlus,
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
} from '../../_lib/workspace-types';
import { PALETTE_DRAG_START_EVENT } from './CanvasPaletteDragPreview';
import type { StudioCopy } from '../../../_lib/studio-copy';

type ToolbarMenuId = 'audio' | 'image' | 'save' | 'text' | 'video';

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

type ToolbarBlockStyle = CSSProperties & {
  '--template-accent'?: string;
};

export type CanvasFloatingToolbarProps = {
  copy: StudioCopy['canvas'];
  activeCanvasName: string | null;
  canRedo: boolean;
  canUndo: boolean;
  canRenameActiveCanvas: boolean;
  selectionTool: CanvasSelectionTool;
  selectedNodeCount: number;
  onDeleteSelectedNodes: () => void;
  onRedo: () => void;
  onRenameActiveCanvas: (name: string) => void;
  onSaveActiveCanvas: () => void;
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

function clearTextSelection(): void {
  window.getSelection()?.removeAllRanges();
}

export function CanvasFloatingToolbar({
  copy,
  activeCanvasName,
  canRedo,
  canUndo,
  canRenameActiveCanvas,
  selectionTool,
  selectedNodeCount,
  onDeleteSelectedNodes,
  onRedo,
  onRenameActiveCanvas,
  onSaveActiveCanvas,
  onSaveCanvasTemplate,
  onSelectionToolChange,
  onUndo,
}: CanvasFloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [activeMenu, setActiveMenu] = useState<ToolbarMenuId | null>(null);
  const [canvasName, setCanvasName] = useState('');
  const [renameCanvasName, setRenameCanvasName] = useState('');
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

  const handleSaveCanvasAs = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveCanvasTemplate(canvasName);
    setCanvasName('');
    setActiveMenu(null);
  };

  const handleRenameCanvas = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onRenameActiveCanvas(renameCanvasName);
    setRenameCanvasName('');
    setActiveMenu(null);
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
        active={activeMenu === 'save'}
        icon={<Save size={18} />}
        label={copy.toolbar.saveCanvas}
        onClick={() => toggleMenu('save')}
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

      {activeMenu === 'save' ? (
        <ToolbarPopover title={copy.toolbar.saveCanvas} description={copy.toolbar.saveCanvasDescription}>
          <div className={styles.saveActionList}>
            <button
              type="button"
              className={styles.saveActionButton}
              onClick={() => {
                onSaveActiveCanvas();
                setActiveMenu(null);
              }}
            >
              <Save size={15} />
              <span>
                <strong>{copy.templates.saveCurrentCanvas}</strong>
                <small>{activeCanvasName ?? copy.templates.unsavedCanvas}</small>
              </span>
            </button>
            <form className={styles.templateSaveForm} onSubmit={handleSaveCanvasAs}>
              <input
                type="text"
                value={canvasName}
                onChange={(event) => setCanvasName(event.target.value)}
                placeholder={copy.templates.canvasNamePlaceholder}
                aria-label={copy.templates.canvasNameLabel}
              />
              <button type="submit">
                <Save size={13} />
                {copy.templates.saveAsNewCanvas}
              </button>
            </form>
            <form className={styles.templateSaveForm} onSubmit={handleRenameCanvas}>
              <input
                type="text"
                value={renameCanvasName}
                onChange={(event) => setRenameCanvasName(event.target.value)}
                placeholder={activeCanvasName ?? copy.templates.renameCanvasPlaceholder}
                aria-label={copy.templates.renameCanvasLabel}
                disabled={!canRenameActiveCanvas}
              />
              <button type="submit" disabled={!canRenameActiveCanvas}>
                {copy.templates.renameCanvas}
              </button>
            </form>
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
          style={{ '--template-accent': block.accent } as ToolbarBlockStyle}
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
