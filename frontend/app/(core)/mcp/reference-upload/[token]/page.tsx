import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { HeaderBar } from '@/components/HeaderBar';
import { FEATURES } from '@/content/feature-flags';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';
import { getOwnedUploadSession } from '@/server/agent-api/reference-upload-sessions';
import { MAX_IMAGE_UPLOAD_BYTES } from '@/server/uploads/store-image-upload';

import { ReferenceUploadClient } from './_components/ReferenceUploadClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Private reference upload',
  robots: { index: false, follow: false },
};

const TOKEN_PATTERN = /^mru_[A-Za-z0-9_-]{43}$/u;

export default async function ReferenceUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!FEATURES.mcp.referenceUploads) notFound();
  const { token } = await params;
  if (!TOKEN_PATTERN.test(token)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    const nextPath = `/mcp/reference-upload/${encodeURIComponent(token)}`;
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const session = await getOwnedUploadSession({ token, userId: data.user.id });
  if (!session) notFound();
  const available = session.state === 'created'
    && session.claimId === null
    && session.expiresAt.getTime() > Date.now();

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <HeaderBar />
      <main className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-micro text-brand">MaxVideoAI × your assistant</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Add a reference image</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-text-secondary sm:text-base">
          Upload one image to your private MaxVideoAI library, then return to Claude or Codex to continue preparing your generation.
        </p>
        <div className="mt-7">
          <ReferenceUploadClient
            token={token}
            expiresAt={session.expiresAt.toISOString()}
            available={available}
            maxBytes={MAX_IMAGE_UPLOAD_BYTES}
          />
        </div>
      </main>
    </div>
  );
}
