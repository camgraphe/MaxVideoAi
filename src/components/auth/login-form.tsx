"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface LoginFormProps {
  className?: string;
}

export function LoginForm({ className }: LoginFormProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const supabase = getSupabaseBrowserClient();

  function clearAlerts() {
    setMessage(null);
    setError(null);
  }

  async function handlePasswordLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearAlerts();
    startTransition(async () => {
      try {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        if (data.session) {
          await fetch("/auth/set", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ event: "SIGNED_IN", session: data.session }),
          });
        }
        const redirectUrl = searchParams.get("redirect") ?? "/dashboard";
        window.location.href = redirectUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error.");
      }
    });
  }

  async function handleMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearAlerts();
    startTransition(async () => {
      try {
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          searchParams.get("redirect") ?? "/dashboard",
        )}`;
        const { error: signInError } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        });
        if (signInError) {
          setError(signInError.message);
        } else {
          setMessage("Check your inbox for the magic link.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error.");
      }
    });
  }

  return (
    <div className={cn("space-y-6", className)}>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "password" | "magic")}
        className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password">Email & password</TabsTrigger>
          <TabsTrigger value="magic">Magic link</TabsTrigger>
        </TabsList>
        <TabsContent value="password" className="mt-4">
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-password">Email</Label>
              <Input
                id="email-password"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Logging in…" : "Log in"}
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="magic" className="mt-4">
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-magic">Email</Label>
              <Input
                id="email-magic"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Sending magic link…" : "Send magic link"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Nous vous enverrons un lien à usage unique pour vous connecter à cette session.
            </p>
          </form>
        </TabsContent>
      </Tabs>
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
