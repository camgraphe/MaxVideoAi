"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Film,
  LogOut,
  Settings,
  SquarePen,
  Table,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/generate", label: "Generate", icon: SquarePen },
  { href: "/jobs", label: "Jobs", icon: Table },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface DashboardNavProps {
  userName: string;
  userEmail: string;
  organizationName: string;
}

export function DashboardNav({ userName, userEmail, organizationName }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("maxvideoai.dashboard.collapsed");
    if (stored) {
      setCollapsed(stored === "1");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("maxvideoai.dashboard.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <aside
      className={cn(
        "relative flex h-full w-full flex-col gap-4 border-r border-black/10 bg-[linear-gradient(180deg,rgba(248,249,255,0.95),rgba(233,236,250,0.98))] p-4 transition-all duration-200 dark:border-border/40 dark:bg-[linear-gradient(180deg,rgba(13,17,28,0.9),rgba(8,10,20,0.94))]",
        collapsed ? "md:w-20 md:px-3" : "md:w-64",
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(134,91,255,0.18),transparent)]" />
      <div className={cn("flex items-center justify-between", collapsed && "md:justify-center md:gap-0")}
      >
        <Link
          href="/dashboard"
          className={cn(
            "font-semibold tracking-tight text-foreground",
            collapsed ? "md:flex md:h-10 md:w-10 md:items-center md:justify-center md:rounded-full md:bg-primary/10 md:text-sm" : "",
          )}
          aria-label="MaxVideoAI dashboard"
        >
          {collapsed ? (
            <>
              <span className="hidden md:inline">VH</span>
              <span className="md:hidden">MaxVideoAI</span>
            </>
          ) : (
            "MaxVideoAI"
          )}
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle className={cn("hidden md:flex", collapsed && "md:hidden")}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="hidden h-8 w-8 md:flex"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div
        className={cn(
          "flex flex-col gap-1 rounded-lg border border-black/5 bg-white/50 p-3 text-xs transition-all dark:border-white/10 dark:bg-white/5",
          collapsed && "md:items-center md:p-2",
        )}
      >
        <span className="font-medium text-foreground">
          {collapsed ? organizationName.charAt(0).toUpperCase() : organizationName}
        </span>
        {!collapsed ? <span className="truncate text-muted-foreground">{userName ?? userEmail}</span> : null}
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href} aria-label={label}
              className={cn(
                "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_8px_24px_-16px_rgba(134,91,255,0.8)]"
                  : "text-muted-foreground hover:bg-primary/10 dark:hover:bg-white/5",
                collapsed ? "md:justify-center" : "justify-start gap-3",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {!collapsed ? <span>{label}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-2">
        <Link
          href="/generate"
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border border-black/10 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20 dark:border-white/10 dark:bg-white/5 dark:text-foreground dark:hover:bg-white/10",
            collapsed && "md:justify-center",
          )}
        >
          <Film className="h-4 w-4" aria-hidden />
          {!collapsed ? <span>New clip</span> : null}
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          disabled={signingOut}
          className={cn(
            "justify-start gap-2 text-xs text-muted-foreground hover:text-destructive",
            collapsed && "md:justify-center",
          )}
          >
          <LogOut className="h-4 w-4" />
          {!collapsed ? (signingOut ? "Signing out…" : "Sign out") : null}
        </Button>
      </div>
      <ThemeToggle className="md:hidden" />
    </aside>
  );
}
