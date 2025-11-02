import Image from 'next/image';
import Link from 'next/link';

export default function BlogFooter() {
  return (
    <footer className="blog-footer mt-16 rounded-[24px] border border-hairline bg-white/90 p-8 shadow-card">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo-wordmark.svg" alt="MaxVideo AI" width={160} height={32} />
          <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
            The Studio Journal
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
          <Link href="/blog" className="hover:text-text-primary">
            Blog
          </Link>
          <Link href="/legal/terms" className="hover:text-text-primary">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-text-primary">
            Privacy
          </Link>
          <Link href="/legal/acceptable-use" className="hover:text-text-primary">
            Acceptable Use
          </Link>
          <Link href="/legal/takedown" className="hover:text-text-primary">
            Notice &amp; Takedown
          </Link>
        </nav>
      </div>

      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-text-secondary">
        Independent hub for professional AI video — price before you generate, stay on the latest engines,
        one workspace for every shot. Works with Sora 2, Veo 3.1, Pika 2.2, MiniMax Hailuo 02, and more.
      </p>

      <p className="mt-4 text-xs text-text-muted">
        MaxVideoAI allows AI crawlers (GPTBot, OAI-SearchBot, Google-Extended, and CCBot) to index public model pages and documentation for educational and research visibility.
      </p>
    </footer>
  );
}
