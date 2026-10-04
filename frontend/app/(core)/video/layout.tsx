import '@/styles/marketing-redesign.css';
import '@/styles/marketing-navigation.css';
import { MarketingVideoLayout } from '@/components/marketing/MarketingVideoLayout';
import { ExampleReaderStyles } from '@/components/examples/example-reader-styles';

export default function VideoLayout({ children }: { children: React.ReactNode }) {
  return <><ExampleReaderStyles /><MarketingVideoLayout>{children}</MarketingVideoLayout></>;
}
