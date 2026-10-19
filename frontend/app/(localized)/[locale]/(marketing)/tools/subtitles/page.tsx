import { CreatorMarketingRoute, creatorMetadata, type CreatorRouteProps } from '@/components/tools/creator-marketing/CreatorMarketingRoute';
export const generateMetadata = (props: CreatorRouteProps) => creatorMetadata('subtitles', props);
export default async function Page(props: CreatorRouteProps) { return CreatorMarketingRoute({ ...props, id: 'subtitles' }); }
