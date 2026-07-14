import { JsonLd } from '@/components/SeoJsonLd';

export function IntegrationJsonLdScripts({ breadcrumb }: { breadcrumb: object }) {
  return <JsonLd json={breadcrumb} />;
}
