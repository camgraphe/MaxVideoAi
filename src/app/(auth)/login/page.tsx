import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md border-border/60">
        <CardHeader>
          <CardTitle>Sign in to VideoHub</CardTitle>
          <CardDescription>
            Supabase magic-link auth arrives in Sprint S2. For now, access is handled manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@studio.com" disabled />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" disabled>
            Send magic link
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Need access? Request a beta invite from the <Link href="/" className="underline">home page</Link>.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
