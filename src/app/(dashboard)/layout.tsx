import { DashboardNav } from "@/components/layout/dashboard-nav";
import { requireCurrentSession } from "@/lib/auth/current-user";
import type { ReactNode } from "react";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireCurrentSession();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <DashboardNav
        userName={session.user.name ?? session.user.email}
        userEmail={session.user.email}
        organizationName={session.organization.name}
      />
      <div className="flex flex-1 flex-col bg-muted/10">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
