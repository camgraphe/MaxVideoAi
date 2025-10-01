import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <DashboardShell
      title="Settings"
      description="Account preferences, API keys, and brand kit."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Theme, language, and weekly notifications.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Input id="language" defaultValue="en-US" disabled />
              <p className="text-xs text-muted-foreground">
                FR/EN internationalisation ships with the next sprint via next-intl.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="font-medium">Usage recap emails</p>
                <p className="text-xs text-muted-foreground">Receive a weekly summary of spend and renders.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Button variant="outline">Save changes</Button>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>API keys (coming soon)</CardTitle>
            <CardDescription>
              Bring your own keys if you want VideoHub to orchestrate your provider accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <Label htmlFor="veo-key">Google Veo 3 key</Label>
              <Input id="veo-key" placeholder="VEO-************************" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fal-key">FAL.ai key</Label>
              <Input id="fal-key" placeholder="FAL-************************" disabled />
            </div>
            <p className="text-xs text-muted-foreground">
              These fields unlock with Pack 2 when the “Bring Your Own Key” mode rolls out.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Team members</CardTitle>
            <CardDescription>Invite teammates and manage their roles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Manage who can access your workspace across departments, clients, or agencies. Admins can launch renders and manage billing, members can collaborate on prompts.
            </p>
            <Button asChild>
              <Link href="/settings/members">Manage members</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
