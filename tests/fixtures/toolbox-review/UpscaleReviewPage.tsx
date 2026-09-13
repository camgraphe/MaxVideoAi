import UpscaleWorkspace from '@/components/tools/UpscaleWorkspace';
import { headers } from 'next/headers';
import Fixture from '../review/Fixture';
export default async function UpscaleToolPage({ searchParams }: { searchParams: Promise<{ review?: string }> }) {
  const host = (await headers()).get('host') ?? '';
  if (process.env.NODE_ENV === 'development' && /^(localhost|127\.0\.0\.1):\d+$/.test(host) && (await searchParams).review === 'local') return <Fixture />;
  return <UpscaleWorkspace />;
}
