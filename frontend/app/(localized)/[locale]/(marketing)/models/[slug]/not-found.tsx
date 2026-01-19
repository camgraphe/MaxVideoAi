import { Link } from '@/i18n/navigation';

export default function ModelNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">Model unavailable</h1>
      <p className="text-sm text-text-secondary">We couldn’t find that model in the current roster.</p>
      <Link href="/models" className="text-sm font-semibold text-brand hover:text-brandHover">
        Back to models
      </Link>
    </div>
  );
}
