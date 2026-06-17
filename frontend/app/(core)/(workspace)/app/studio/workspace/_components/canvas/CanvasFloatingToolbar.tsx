'use client';

import {
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
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
import {
  PALETTE_DRAG_START_EVENT,
  PALETTE_PLACEMENT_ARM_EVENT,
} from './CanvasPaletteDragPreview';
import type { StudioCopy } from '../../../_lib/studio-copy';
import { StudioMenu } from '../ui/StudioMenu';
import { StudioPopover } from '../ui/StudioPopover';

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
  meta: string[];
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

function uniqueMeta(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).slice(0, 3);
}

function outputKindLabel(kind: WorkspaceBlockPreset['outputKind'], copy: StudioCopy['canvas']['nodes']): string {
  if (kind === 'audio') return copy.audioReference;
  if (kind === 'image') return copy.image;
  if (kind === 'text') return copy.text;
  return copy.video;
}

function presetMeta(preset: WorkspaceBlockPreset, copy: StudioCopy['canvas']['nodes']): string[] {
  const workflowLabel = preset.family === 'upscale' ? copy.upscale : copy.workflow;
  const modeLabel = preset.nodeKind === 'chat' ? copy.chatbotMode : workflowLabel;
  return uniqueMeta([outputKindLabel(preset.outputKind, copy), modeLabel, copy.outputs]);
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
    meta: presetMeta(preset, copy),
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
      meta: uniqueMeta([copy.workflow, copy.outputs]),
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
        meta: uniqueMeta([copy.image, copy.assetFallback, copy.outputs]),
      },
      presetBlock('generate-image', copy, <WandSparkles size={18} />),
      presetBlock('modify-image', copy, <SlidersHorizontal size={18} />),
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
        meta: uniqueMeta([copy.video, copy.assetFallback, copy.outputs]),
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
        meta: uniqueMeta([copy.audioReference, copy.assetFallback, copy.outputs]),
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
        meta: uniqueMeta([copy.text, copy.promptRole, copy.outputs]),
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
  const suppressBlockClickRef = useRef(false);
  const [activeMenu, setActiveMenu] = useState<ToolbarMenuId | null>(null);
  const [canvasName, setCanvasName] = useState('');
  const [renameCanvasName, setRenameCanvasName] = useState('');
  const blocks = toolbarBlocks(copy.nodes);

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
      suppressBlockClickRef.current = true;
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
      if (hasStartedDrag) {
        window.setTimeout(() => {
          suppressBlockClickRef.current = false;
        }, 0);
      }
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('mouseup', handleUp, { once: true });
  };

  const handleBlockClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    kind: WorkspaceNodeKind,
    presetId?: WorkspaceGenerationPresetId
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (suppressBlockClickRef.current) {
      suppressBlockClickRef.current = false;
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const clientX = event.clientX || rect.left + rect.width / 2;
    const clientY = event.clientY || rect.top + rect.height / 2;
    clearTextSelection();
    setActiveMenu(null);
    window.dispatchEvent(
      new CustomEvent(PALETTE_PLACEMENT_ARM_EVENT, {
        detail: {
          kind,
          presetId,
          clientX,
          clientY,
        },
      })
    );
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

  const setMenuOpen = (menu: ToolbarMenuId) => (open: boolean) => {
    setActiveMenu(open ? menu : null);
  };

  return (
    <div
      className={styles.canvasToolbar}
      data-canvas-toolbar="true"
      aria-label={copy.toolbar.ariaLabel}
    >
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

      <StudioMenu
        id="canvas-toolbar-image-menu"
        label={copy.toolbar.imageTools}
        open={activeMenu === 'image'}
        onOpenChange={setMenuOpen('image')}
        className={styles.toolbarControl}
        menuClassName={styles.toolbarPopover}
        trigger={(triggerProps) => (
          <ToolbarMenuButton
            active={activeMenu === 'image'}
            icon={<ImagePlus size={18} />}
            label={copy.toolbar.imageTools}
            menuId="image"
            triggerProps={triggerProps}
          />
        )}
      >
        <ToolbarPanelHeader title={copy.toolbar.imageTools} description={copy.toolbar.imageToolsDescription} />
        <BlockOptionList blocks={blocks.image} onBlockClick={handleBlockClick} onBlockMouseDown={handleBlockMouseDown} />
      </StudioMenu>
      <StudioMenu
        id="canvas-toolbar-video-menu"
        label={copy.toolbar.videoTools}
        open={activeMenu === 'video'}
        onOpenChange={setMenuOpen('video')}
        className={styles.toolbarControl}
        menuClassName={styles.toolbarPopover}
        trigger={(triggerProps) => (
          <ToolbarMenuButton
            active={activeMenu === 'video'}
            icon={<Video size={18} />}
            label={copy.toolbar.videoTools}
            menuId="video"
            triggerProps={triggerProps}
          />
        )}
      >
        <ToolbarPanelHeader title={copy.toolbar.videoTools} description={copy.toolbar.videoToolsDescription} />
        <BlockOptionList blocks={blocks.video} onBlockClick={handleBlockClick} onBlockMouseDown={handleBlockMouseDown} />
      </StudioMenu>
      <StudioMenu
        id="canvas-toolbar-audio-menu"
        label={copy.toolbar.audioTools}
        open={activeMenu === 'audio'}
        onOpenChange={setMenuOpen('audio')}
        className={styles.toolbarControl}
        menuClassName={styles.toolbarPopover}
        trigger={(triggerProps) => (
          <ToolbarMenuButton
            active={activeMenu === 'audio'}
            icon={<Music2 size={18} />}
            label={copy.toolbar.audioTools}
            menuId="audio"
            triggerProps={triggerProps}
          />
        )}
      >
        <ToolbarPanelHeader title={copy.toolbar.audioTools} description={copy.toolbar.audioToolsDescription} />
        <BlockOptionList blocks={blocks.audio} onBlockClick={handleBlockClick} onBlockMouseDown={handleBlockMouseDown} />
      </StudioMenu>
      <StudioMenu
        id="canvas-toolbar-text-menu"
        label={copy.toolbar.textTools}
        open={activeMenu === 'text'}
        onOpenChange={setMenuOpen('text')}
        className={styles.toolbarControl}
        menuClassName={styles.toolbarPopover}
        trigger={(triggerProps) => (
          <ToolbarMenuButton
            active={activeMenu === 'text'}
            icon={<Type size={18} />}
            label={copy.toolbar.textTools}
            menuId="text"
            triggerProps={triggerProps}
          />
        )}
      >
        <ToolbarPanelHeader title={copy.toolbar.textTools} description={copy.toolbar.textToolsDescription} />
        <BlockOptionList blocks={blocks.text} onBlockClick={handleBlockClick} onBlockMouseDown={handleBlockMouseDown} />
      </StudioMenu>

      <StudioPopover
        id="canvas-toolbar-save-popover"
        label={copy.toolbar.saveCanvas}
        open={activeMenu === 'save'}
        onOpenChange={setMenuOpen('save')}
        className={styles.toolbarControl}
        panelClassName={`${styles.toolbarPopover} ${styles.toolbarPopoverWide}`}
        trigger={(triggerProps) => (
          <ToolbarMenuButton
            active={activeMenu === 'save'}
            icon={<Save size={18} />}
            label={copy.toolbar.saveCanvas}
            menuId="save"
            triggerProps={triggerProps}
          />
        )}
      >
        <ToolbarPanelHeader title={copy.toolbar.saveCanvas} description={copy.toolbar.saveCanvasDescription} />
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
      </StudioPopover>

    </div>
  );
}

function ToolbarMenuButton({
  active,
  icon,
  label,
  menuId,
  triggerProps,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  menuId: ToolbarMenuId;
  triggerProps: {
    'aria-controls': string;
    'aria-expanded': boolean;
    'aria-haspopup': 'dialog' | 'menu';
    id: string;
    onClick: () => void;
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
    ref: (node: HTMLButtonElement | null) => void;
  };
}) {
  return (
    <button
      ref={triggerProps.ref}
      id={triggerProps.id}
      type="button"
      className={`${styles.toolbarButton} ${active ? styles.toolbarButtonActive : ''}`}
      aria-label={label}
      aria-haspopup={triggerProps['aria-haspopup']}
      aria-expanded={triggerProps['aria-expanded']}
      aria-controls={triggerProps['aria-controls']}
      data-canvas-toolbar-menu-id={menuId}
      onClick={triggerProps.onClick}
      onKeyDown={triggerProps.onKeyDown}
    >
      {icon}
    </button>
  );
}

function ToolbarPanelHeader({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className={styles.popoverHeader}>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function BlockOptionList({
  blocks,
  onBlockClick,
  onBlockMouseDown,
}: {
  blocks: ToolbarBlockDefinition[];
  onBlockClick: (event: ReactMouseEvent<HTMLButtonElement>, kind: WorkspaceNodeKind, presetId?: WorkspaceGenerationPresetId) => void;
  onBlockMouseDown: (event: ReactMouseEvent, kind: WorkspaceNodeKind, presetId?: WorkspaceGenerationPresetId) => void;
}) {
  return (
    <div className={styles.blockOptionList}>
      {blocks.map((block) => (
        <button
          key={block.id}
          type="button"
          role="menuitem"
          className={styles.blockOption}
          data-canvas-toolbar-block-id={block.id}
          data-canvas-toolbar-block-kind={block.kind}
          data-canvas-toolbar-preset-id={block.presetId}
          style={{ '--template-accent': block.accent } as ToolbarBlockStyle}
          onClick={(event) => onBlockClick(event, block.kind, block.presetId)}
          onMouseDown={(event) => onBlockMouseDown(event, block.kind, block.presetId)}
        >
          <span className={styles.blockOptionIcon}>{block.icon}</span>
          <span className={styles.blockOptionContent}>
            <strong>{block.label}</strong>
            <small>{block.description}</small>
            <span className={styles.blockOptionMeta} aria-hidden="true">
              {block.meta.map((item) => (
                <em key={item}>{item}</em>
              ))}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
