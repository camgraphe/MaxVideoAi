"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ChevronDown, Sparkles, MoveUpRight, Settings2, Layers3, Gauge, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-border/60 bg-[rgba(248,250,255,0.95)] shadow-[0_10px_30px_-20px_rgba(15,23,42,0.25)] backdrop-blur dark:bg-[rgba(7,9,16,0.92)]"
      )}
    >
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            MaxVideoAI
          </Link>
          {/* Toolkit quick actions */}
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild size="sm" variant="ghost" className="h-8 rounded-full px-3 text-xs">
              <Link href="/generate" className="inline-flex items-center gap-2">
                <MoveUpRight className="h-3.5 w-3.5" /> Toolkit
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="h-8 rounded-full px-3 text-xs">
              <Link href="/generate#assets" className="inline-flex items-center gap-2">
                <Layers3 className="h-3.5 w-3.5" /> Source assets
              </Link>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
                  <Settings2 className="mr-1 h-3.5 w-3.5" /> Advanced control
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2 text-sm">
                <Link href="/pricing" className="block rounded-md px-2 py-2 text-foreground/90 hover:bg-accent">
                  Cost estimator
                </Link>
                <Link href="/chains" className="block rounded-md px-2 py-2 text-foreground/90 hover:bg-accent">
                  Upscale 4K
                </Link>
                <Link href="/chains" className="block rounded-md px-2 py-2 text-foreground/90 hover:bg-accent">
                  Reframe & dual export
                </Link>
                <Link href="/chains" className="block rounded-md px-2 py-2 text-foreground/90 hover:bg-accent">
                  Add audio
                </Link>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href="/submit">Submit clip</Link>
          </Button>
          {/* Avatar-driven menu */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                aria-label="Open user menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-accent/10 text-foreground shadow-sm hover:bg-accent/20"
              >
                <span className="text-xs font-semibold">U</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3 p-3">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">MaxVideoAI</div>
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-2">
                  <ThemeToggle className="h-8 w-8" />
                  <span className="text-xs font-medium text-foreground">Toggle theme</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">camgraphe@gmail.com&apos;s Studio</div>
                <div className="rounded-md bg-muted/50 p-2 text-xs text-foreground/80">
                  camgraphe@gmail.com
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <Link
                  href="/dashboard"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent",
                    pathname === "/dashboard" && "text-primary",
                  )}
                >
                  <Sparkles className="h-4 w-4" /> Dashboard
                </Link>
                <Link
                  href="/generate"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent",
                    pathname?.startsWith("/generate") && "text-primary",
                  )}
                >
                  <Gauge className="h-4 w-4" /> Generate
                </Link>
                <Link
                  href="/jobs"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent",
                    pathname === "/jobs" && "text-primary",
                  )}
                >
                  <MoveUpRight className="h-4 w-4" /> Jobs
                </Link>
                <Link
                  href="/usage"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent",
                    pathname === "/usage" && "text-primary",
                  )}
                >
                  <Layers3 className="h-4 w-4" /> Usage
                </Link>
                <Link
                  href="/billing"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent",
                    pathname === "/billing" && "text-primary",
                  )}
                >
                  <Sparkles className="h-4 w-4" /> Billing
                </Link>
                <Link
                  href="/settings"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent",
                    pathname?.startsWith("/settings") && "text-primary",
                  )}
                >
                  <Settings2 className="h-4 w-4" /> Settings
                </Link>
              </div>
              <div className="space-y-2 border-t border-border pt-2">
                <Button asChild size="sm" className="w-full justify-start gap-2">
                  <Link href="/generate">
                    <MoveUpRight className="h-4 w-4" /> New clip
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-red-500 hover:text-red-600">
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <div className="mt-8 flex flex-col gap-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Toolkit</div>
                <Link href="/generate" className="text-foreground">
                  Toolkit
                </Link>
                <Link href="/generate#assets" className="text-foreground">
                  Source assets
                </Link>
                <Link href="/pricing" className="text-foreground">
                  Cost estimator
                </Link>
                <Link href="/chains" className="text-foreground">
                  Upscale 4K
                </Link>
                <Link href="/chains" className="text-foreground">
                  Reframe & dual export
                </Link>
                <Link href="/chains" className="text-foreground">
                  Add audio
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
