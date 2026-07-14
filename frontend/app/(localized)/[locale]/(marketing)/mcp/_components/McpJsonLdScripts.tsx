import { JsonLd } from '@/components/SeoJsonLd';

export function McpJsonLdScripts({
  application,
  breadcrumb,
}: {
  application: object | null;
  breadcrumb: object;
}) {
  return (
    <>
      {application ? <JsonLd json={application} /> : null}
      <JsonLd json={breadcrumb} />
    </>
  );
}
