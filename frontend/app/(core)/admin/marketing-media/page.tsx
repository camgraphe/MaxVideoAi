import { requireAdmin } from '@/server/admin';
import { marketingMediaEnabled } from '@/server/marketing-media/store';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { MarketingMediaLibrary } from './_components/MarketingMediaLibrary.client';

export const dynamic='force-dynamic';
export default async function MarketingMediaPage({searchParams}:{searchParams:Promise<{videoId?:string}>}){
 await requireAdmin();
 const {videoId}=await searchParams;
 return <div className="flex flex-col gap-5">
  <AdminPageHeader title="Marketing media" description="Independent copies for the site, with prompts, settings and reference media. Storage belongs to the site."
   actions={<AdminActionLink href="/admin/playlists">Galleries</AdminActionLink>}/>
  {marketingMediaEnabled()?<MarketingMediaLibrary initialVideoId={videoId??''}/>:<p role="status">Activation pending. Install the marketing media migration before enabling this library.</p>}
 </div>;
}
