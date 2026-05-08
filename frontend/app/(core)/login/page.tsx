'use client';

import { LoginAuthSurface } from './_components/LoginAuthSurface';
import { useLoginPageController } from './_hooks/useLoginPageController';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const controller = useLoginPageController();

  return <LoginAuthSurface {...controller} />;
}
