'use client';

let pendingLogoutIntent = false;

export function setLogoutIntent(): void {
  pendingLogoutIntent = true;
}

export function consumeLogoutIntent(): boolean {
  const current = pendingLogoutIntent;
  pendingLogoutIntent = false;
  return current;
}
