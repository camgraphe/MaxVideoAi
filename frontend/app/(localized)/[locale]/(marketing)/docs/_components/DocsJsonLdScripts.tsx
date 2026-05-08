import type { buildMetadataUrls } from '@/lib/metadataUrls';
import type { DocsContent } from '../_lib/docs-index-data';
import {
  buildDocsBreadcrumbJsonLd,
  buildDocsCollectionJsonLd,
  buildDocsFaqJsonLd,
} from '../_lib/docs-index-jsonld';

type DocsMetadataUrls = ReturnType<typeof buildMetadataUrls>;

type DocsJsonLdScriptsProps = {
  content: DocsContent;
  metadataUrls: DocsMetadataUrls;
  site: string;
  toc: Record<string, string | undefined>;
};

export function DocsJsonLdScripts({ content, metadataUrls, site, toc }: DocsJsonLdScriptsProps) {
  const schemas = [
    buildDocsCollectionJsonLd({ content, metadataUrls, site, toc }),
    buildDocsBreadcrumbJsonLd({ content, metadataUrls, site, toc }),
    buildDocsFaqJsonLd({ content, metadataUrls, site, toc }),
  ];

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
