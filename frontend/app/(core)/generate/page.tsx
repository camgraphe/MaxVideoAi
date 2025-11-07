import { redirect } from 'next/navigation';

type GeneratePageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function GenerateRedirectPage({ searchParams }: GeneratePageProps) {
  const from = Array.isArray(searchParams.from) ? searchParams.from[0] : searchParams.from;
  const engine = Array.isArray(searchParams.engine) ? searchParams.engine[0] : searchParams.engine;
  const params = new URLSearchParams();
  if (from) {
    params.set('from', from);
  }
  if (engine) {
    params.set('engine', engine);
  }
  const query = params.toString();
  const target = query ? `/app?${query}` : '/app';
  redirect(target);
}
