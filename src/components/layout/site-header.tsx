"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/generate", label: "Generate" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-border/60 bg-[rgba(248,250,255,0.95)] shadow-[0_10px_30px_-20px_rgba(15,23,42,0.25)] backdrop-blur dark:bg-[rgba(7,9,16,0.92)]"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            MaxVideoAI
          </Link>
          <nav className="hidden items-center gap-4 text-sm md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-primary",
                  pathname === item.href ? "text-primary" : "text-foreground/70",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href="/generate">New clip</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <div className="mt-8 flex flex-col gap-3">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="text-foreground">
                    {item.label}
                  </Link>
                ))}
                <Link href="/login" className="text-foreground">
                  Login
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
