import {redirect} from 'next/navigation';
import {resolveStudioMarketingStarter} from '../_lib/studio-project-marketing-entry';

export default async function RetiredStudioProjectsPage({searchParams}: {searchParams: Promise<{starter?: string | string[]}>}) {
  const starter = resolveStudioMarketingStarter((await searchParams).starter);
  redirect(starter ? `/app/studio?starter=${encodeURIComponent(starter)}` : '/app/studio');
}
