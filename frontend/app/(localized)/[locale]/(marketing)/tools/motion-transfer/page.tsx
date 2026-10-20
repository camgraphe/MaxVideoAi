import { CreatorMarketingRoute, creatorMetadata, type CreatorRouteProps } from '@/components/tools/creator-marketing/CreatorMarketingRoute';
export const generateMetadata = (props: CreatorRouteProps) => creatorMetadata('motion-transfer', props);
export default async function Page(props: CreatorRouteProps) { return CreatorMarketingRoute({ ...props, id: 'motion-transfer' }); }
