'use client';

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value || typeof window === 'undefined' || typeof document === 'undefined') return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall back to a temporary textarea for browser contexts where Clipboard API is blocked.
  }

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // Content outside a modal dialog is inert: selecting a textarea there can copy
  // the previous selection instead, even when execCommand reports success.
  const modal = previousFocus?.closest('dialog[open]') ?? document.querySelector('dialog[open]');
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  textarea.style.opacity = '0';
  (modal ?? document.body).appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
}
