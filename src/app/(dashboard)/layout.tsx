import type { ReactNode } from "react";
import { DashboardNav } from "@/components/layout/dashboard-nav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <DashboardNav />
      <div className="flex flex-1 flex-col bg-muted/10">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
