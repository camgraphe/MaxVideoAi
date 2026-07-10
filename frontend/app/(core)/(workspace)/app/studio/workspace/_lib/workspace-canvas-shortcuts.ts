type CanvasKeyboardShortcutOwnership = {
  isBlockedTarget: boolean;
  isCanvasActive: boolean;
  isDefaultPrevented: boolean;
};

export function shouldHandleCanvasKeyboardShortcut({
  isBlockedTarget,
  isCanvasActive,
  isDefaultPrevented,
}: CanvasKeyboardShortcutOwnership): boolean {
  return isCanvasActive && !isDefaultPrevented && !isBlockedTarget;
}

export function shouldHandleCanvasPaste({
  isBlockedTarget,
  isCanvasActive,
}: Omit<CanvasKeyboardShortcutOwnership, 'isDefaultPrevented'>): boolean {
  return shouldHandleCanvasKeyboardShortcut({
    isBlockedTarget,
    isCanvasActive,
    isDefaultPrevented: false,
  });
}
