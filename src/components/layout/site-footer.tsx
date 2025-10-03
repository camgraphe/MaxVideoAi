import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-[rgba(248,250,255,0.97)] text-foreground/70 backdrop-blur dark:bg-[rgba(7,9,16,0.92)] dark:text-muted-foreground">
      <div className="w-full px-6 py-12 lg:px-10">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <div className="text-base font-semibold tracking-tight">{siteConfig.name}</div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {siteConfig.description}
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-3 text-sm md:justify-self-center">
            <Link className="text-muted-foreground transition hover:text-foreground" href="/">
              Explore
            </Link>
            <Link className="text-muted-foreground transition hover:text-foreground" href="/collections">
              Collections
            </Link>
            <Link className="text-muted-foreground transition hover:text-foreground" href="/chains">
              Chains
            </Link>
            <Link className="text-muted-foreground transition hover:text-foreground" href="/pricing">
              Pricing
            </Link>
            <Link className="text-muted-foreground transition hover:text-foreground" href="/about">
              About
            </Link>
            <Link className="text-muted-foreground transition hover:text-foreground" href="/legal">
              Legal
            </Link>
            <Link className="text-muted-foreground transition hover:text-foreground" href="/submit">
              Submit clip
            </Link>
            <Link className="text-muted-foreground transition hover:text-foreground" href="/faq">
              FAQ
            </Link>
          </nav>
          <div className="flex items-start justify-start gap-3 md:justify-end">
            <a
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              href={siteConfig.links.twitter}
              target="_blank"
              rel="noreferrer"
              aria-label="Twitter"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
        <div className="mt-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
