import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';

export default function AdminSeoPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Search performance"
        description="Open Google Search Console for search traffic, indexing, and URL inspection."
      />
      <div className="divide-y divide-border border-y border-border">
        <a
          className="flex items-center justify-between py-4 text-sm font-medium hover:text-brand"
          href="https://search.google.com/search-console"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Search Console
          <span className="text-text-muted">Open external tool</span>
        </a>
        <Link
          className="flex items-center justify-between py-4 text-sm font-medium hover:text-brand"
          href="/admin/video-seo"
        >
          Video publishing
          <span className="text-text-muted">Open in admin</span>
        </Link>
      </div>
    </div>
  );
}
