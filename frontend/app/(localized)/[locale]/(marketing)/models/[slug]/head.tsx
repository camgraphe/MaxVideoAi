import { ModelJsonLdHead } from '../ModelJsonLdHead';

type HeadProps = {
  params: {
    slug: string;
  };
};

export default function Head({ params }: HeadProps) {
  return <ModelJsonLdHead slug={params.slug} />;
}
