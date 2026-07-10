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
