import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Login • MaxVideoAI",
};

export default async function LoginPage() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 px-4 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border/70 bg-background/95 p-8 shadow-2xl backdrop-blur">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
          <p className="text-sm text-muted-foreground">
            Connect to your MaxVideoAI studio with your email and password or request a magic link.
          </p>
        </div>
        <LoginForm />
        <div className="flex items-center justify-center text-xs text-muted-foreground">
          <span>Need an account?</span>
          <Button variant="link" asChild size="sm" className="px-1 text-primary">
            <Link href="/">Contact us for early access</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
