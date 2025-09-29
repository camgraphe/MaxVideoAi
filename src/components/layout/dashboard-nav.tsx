"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, Film, Settings, SquarePen, Table } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/generate", label: "Generate", icon: SquarePen },
  { href: "/jobs", label: "Jobs", icon: Table },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <aside className="relative flex h-full w-full flex-col gap-3 border-r border-black/10 bg-[linear-gradient(180deg,rgba(248,249,255,0.95),rgba(233,236,250,0.98))] p-3 sm:gap-4 sm:p-4 md:w-64 dark:border-border/40 dark:bg-[linear-gradient(180deg,rgba(13,17,28,0.9),rgba(8,10,20,0.94))]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(134,91,255,0.18),transparent)]" />
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="font-semibold tracking-tight text-foreground">
          VideoHub
        </Link>
        <ThemeToggle className="hidden md:flex" />
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Button
              key={href}
              variant={isActive ? "default" : "ghost"}
              asChild
              className={cn(
                "justify-start gap-2",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_8px_24px_-16px_rgba(134,91,255,0.8)]"
                  : "text-muted-foreground hover:bg-primary/10 dark:hover:bg-white/5",
              )}
            >
              <Link href={href}>
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </Link>
            </Button>
          );
        })}
      </nav>
      <Button
        variant="secondary"
        asChild
        className="gap-2 border border-black/10 bg-primary/10 text-primary hover:bg-primary/20 dark:border-white/10 dark:bg-white/5 dark:text-foreground dark:hover:bg-white/10"
      >
        <Link href="/generate">
          <Film className="h-4 w-4" />
          New clip
        </Link>
      </Button>
      <ThemeToggle className="md:hidden" />
    </aside>
  );
}
