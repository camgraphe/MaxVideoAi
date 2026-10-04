import '@/styles/marketing-redesign.css';
import '@/styles/marketing-navigation.css';
import { MarketingVideoLayout } from '@/components/marketing/MarketingVideoLayout';

export default function SharedVideoLayout({ children }: { children: React.ReactNode }) {
  return <MarketingVideoLayout>{children}</MarketingVideoLayout>;
}
