import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function DashboardShell({
  children,
  title,
  description,
  actions,
  className,
}: DashboardShellProps) {
  const showHeader = Boolean(title || description || actions);
  return (
    <div className={cn("relative flex h-full flex-1 flex-col", className)}>
      {showHeader ? (
        <>
          <header className="relative flex flex-col gap-3 border-b border-black/10 bg-[radial-gradient(circle_at_top,rgba(134,91,255,0.18),transparent)] px-4 py-5 sm:px-6 sm:py-6 dark:border-border/60 dark:bg-[radial-gradient(circle_at_top,rgba(134,91,255,0.12),transparent)]">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-white/60 backdrop-blur dark:bg-black/30" />
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                {title ? (
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground/95">{title}</h1>
                ) : null}
                {description ? (
                  <p className="text-sm text-muted-foreground/90">{description}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                {actions}
                <ThemeToggle className="hidden lg:flex" />
              </div>
            </div>
          </header>
          <Separator className="opacity-40" />
        </>
      ) : null}
      <main className="flex flex-1 flex-col gap-6 overflow-y-auto bg-transparent p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
