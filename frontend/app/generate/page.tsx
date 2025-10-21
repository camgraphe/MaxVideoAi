import { redirect } from 'next/navigation';

export const dynamic = 'force-static';

type GeneratePageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function GenerateRedirectPage({ searchParams }: GeneratePageProps) {
  const from = Array.isArray(searchParams.from) ? searchParams.from[0] : searchParams.from;
  const target = from ? `/app?from=${encodeURIComponent(from)}` : '/app';
  redirect(target);
}
