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
  ArrowUpRight,
  BoxSelect,
  Clapperboard,
  ImagePlus,
  MessageSquareText,
  Mic2,
  Music2,
  MousePointer2,
  Plus,
  Redo2,
  Save,
  SlidersHorizontal,
  Sparkles,
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
} from './CanvasPaletteDragPreview';
import type { StudioCopy } from '../../../_lib/studio-copy';
import { StudioMenu } from '../ui/StudioMenu';
import { StudioPopover } from '../ui/StudioPopover';
import { TOOLBOX } from '@/lib/toolbox/catalogue';
import { toolboxCopy, type ToolboxVisualId } from '@/components/tools/toolbox-copy';
import { useI18n } from '@/lib/i18n/I18nProvider';

type ToolbarMenuId = 'add' | 'selection' | 'save';

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
  onRedo: () => void;
  onRenameActiveCanvas: (name: string) => void;
  onSaveActiveCanvas: () => void;
  onSaveCanvasTemplate: (name: string) => void;
  onSelectionToolChange: (tool: CanvasSelectionTool) => void;
  onUndo: () => void;
  onCreateBlock: (kind: WorkspaceNodeKind, presetId?: WorkspaceGenerationPresetId) => void;
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
      },
      presetBlock('generate-video', copy, <Clapperboard size={18} />),
      presetBlock('modify-video', copy, <SlidersHorizontal size={18} />),
      presetBlock('extend-video', copy, <Video size={18} />),
      presetBlock('upscale-video', copy, <Sparkles size={18} />),
    ],
    audio: [
      {
        id: 'music',
        kind: 'asset-audio',
        label: copy.edgeAudio,
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
  onRedo,
  onRenameActiveCanvas,
  onSaveActiveCanvas,
  onSaveCanvasTemplate,
  onSelectionToolChange,
  onUndo,
  onCreateBlock,
}: CanvasFloatingToolbarProps) {
  const { locale } = useI18n();
  const toolsCopy = toolboxCopy(locale);
  const suppressBlockClickRef = useRef(false);
  const [activeMenu, setActiveMenu] = useState<ToolbarMenuId | null>(null);
  const [canvasName, setCanvasName] = useState('');
  const [renameCanvasName, setRenameCanvasName] = useState('');
  const blocks = toolbarBlocks(copy.nodes);
  const groupLabels = {
    image: copy.toolbar.imageTools,
    video: copy.toolbar.videoTools,
    audio: copy.toolbar.audioTools,
    text: copy.toolbar.textTools,
  };

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

    clearTextSelection();
    setActiveMenu(null);
    onCreateBlock(kind, presetId);
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
      data-canvas-floating-toolbar="true"
      data-canvas-toolbar-popover-open={activeMenu ? 'true' : 'false'}
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
      <StudioMenu
        id="canvas-toolbar-selection-menu"
        label={copy.toolbar.selection}
        open={activeMenu === 'selection'}
        onOpenChange={setMenuOpen('selection')}
        className={styles.toolbarControl}
        menuClassName={styles.toolbarPopover}
        trigger={(triggerProps) => (
          <ToolbarMenuButton
            active={activeMenu === 'selection'}
            icon={selectionTool === 'pointer' ? <MousePointer2 size={18} /> : <BoxSelect size={18} />}
            label={copy.toolbar.selection}
            menuId="selection"
            triggerProps={triggerProps}
          />
        )}
      >
        {(['pointer', 'marquee'] as const).map((tool) => (
          <button key={tool} type="button" role="menuitemradio" aria-checked={selectionTool === tool}
            className={styles.selectionOption} onClick={() => {
              onSelectionToolChange(tool);
              setActiveMenu(null);
            }}>
            {tool === 'pointer' ? <MousePointer2 size={18} /> : <BoxSelect size={18} />}
            {tool === 'pointer' ? copy.toolbar.selectNodes : copy.toolbar.marqueeSelectNodes}
          </button>
        ))}
      </StudioMenu>
      <StudioMenu
        id="canvas-toolbar-add-menu"
        label={copy.toolbar.add}
        open={activeMenu === 'add'}
        onOpenChange={setMenuOpen('add')}
        className={styles.toolbarControl}
        menuClassName={`${styles.toolbarPopover} ${styles.addPalette}`}
        trigger={(triggerProps) => (
          <ToolbarMenuButton
            active={activeMenu === 'add'}
            icon={<Plus size={18} />}
            label={copy.toolbar.add}
            menuId="add"
            triggerProps={triggerProps}
          />
        )}
      >
        {(['image', 'video', 'audio', 'text'] as const).map((group) => (
          <div key={group} role="group" aria-label={groupLabels[group]} className={styles.paletteGroup}>
            <div className={styles.popoverHeader}><strong>{groupLabels[group]}</strong></div>
            <BlockOptionList blocks={blocks[group]} onBlockClick={handleBlockClick} onBlockMouseDown={handleBlockMouseDown} />
          </div>
        ))}
        <div role="group" aria-label={copy.toolbar.workbenches} className={styles.workbenchGroup}>
          <div className={styles.popoverHeader}><strong>{copy.toolbar.workbenches}</strong></div>
          <div className={styles.workbenchList}>
            {TOOLBOX.filter((tool) => tool.studio === 'standalone').map((tool) => (
              <a key={tool.id} role="menuitem" href={tool.href} target="_blank" rel="noopener noreferrer"
                className={styles.workbenchLink}
                aria-label={`${toolsCopy.tools[tool.id as ToolboxVisualId].title} — ${toolsCopy.open}${tool.qualificationRequired ? ` · ${copy.toolbar.validation}` : ''}`}
                onClick={() => setActiveMenu(null)}>
                <span>{toolsCopy.tools[tool.id as ToolboxVisualId].title}</span>
                {tool.qualificationRequired ? <em className={styles.validationBadge}>{copy.toolbar.validation}</em> : null}
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
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
      {menuId === 'add' ? <span>{label}</span> : null}
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
          </span>
        </button>
      ))}
    </div>
  );
}
