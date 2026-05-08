'use client';

import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { CharacterCopy } from '../_lib/character-builder-copy';

export function CharacterBuilderPageFrame({
  children,
  overlays,
}: {
  children: ReactNode;
  overlays?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col xl:flex-row">
        <div className="hidden xl:block">
          <AppSidebar />
        </div>
        <main className="flex-1 min-w-0 overflow-y-auto p-5 pb-80 lg:p-7 lg:pb-40 xl:pb-64">
          {children}
        </main>
      </div>
      {overlays}
    </div>
  );
}

export function CharacterBuilderLoadingSkeleton() {
  return (
    <CharacterBuilderPageFrame>
      <div className="space-y-4 animate-pulse">
        <div className="h-40 rounded-card border border-border bg-surface" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="h-[720px] rounded-card border border-border bg-surface" />
          <div className="h-[560px] rounded-card border border-border bg-surface" />
        </div>
      </div>
    </CharacterBuilderPageFrame>
  );
}

export function CharacterBuilderDisabledState({ title, body }: { title: string; body: string }) {
  return (
    <CharacterBuilderPageFrame>
      <Card className="border border-border p-6">
        <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
        <p className="mt-2 text-sm text-text-secondary">{body}</p>
      </Card>
    </CharacterBuilderPageFrame>
  );
}

export function CharacterBuilderAuthGateModal({
  open,
  copy,
  loginRedirectTarget,
  onClose,
}: {
  open: boolean;
  copy: CharacterCopy;
  loginRedirectTarget: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6">
      <div className="absolute inset-0" role="presentation" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-text-primary">{copy.authGate.title}</h2>
            <p className="mt-2 text-sm text-text-secondary">{copy.authGate.body}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
            aria-label={copy.authGate.close}
          >
            {copy.authGate.close}
          </Button>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <ButtonLink href={`/login?next=${encodeURIComponent(loginRedirectTarget)}`} size="sm" className="px-4">
            {copy.authGate.primary}
          </ButtonLink>
          <ButtonLink
            href={`/login?mode=signin&next=${encodeURIComponent(loginRedirectTarget)}`}
            variant="outline"
            size="sm"
            className="px-4"
          >
            {copy.authGate.secondary}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
