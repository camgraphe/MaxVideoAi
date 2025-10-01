import { Metadata } from "next";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import { requireCurrentSession } from "@/lib/auth/current-user";
import {
  listMembersByOrganization,
  listInvitesByOrganization,
} from "@/db/repositories/users-orgs-repo";
import { cancelInviteAction, removeMemberAction } from "./actions";
import { formatDistanceToNow } from "date-fns";

export const metadata: Metadata = {
  title: "Team members • MaxVideoAI",
};

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export default async function MembersSettingsPage() {
  const session = await requireCurrentSession();

  const [members, invites] = await Promise.all([
    listMembersByOrganization(session.organization.id),
    listInvitesByOrganization(session.organization.id),
  ]);

  return (
    <DashboardShell
      title="Team members"
      description="Manage who can access your studio and what they can do."
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Active members</CardTitle>
            <CardDescription>People who can use your studio right now.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <ul className="divide-y divide-border/70 text-sm">
                {members.map((member) => {
                  const displayName = member.userName?.trim() || member.userEmail;
                  return (
                    <li key={member.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-foreground/90">{displayName}</p>
                        <p className="text-xs text-muted-foreground/80">{roleLabels[member.role] ?? member.role}</p>
                      </div>
                      {session.membership.role === "owner" && member.userId !== session.user.id ? (
                        <form action={removeMemberAction}>
                          <input type="hidden" name="memberId" value={member.userId} />
                          <Button variant="ghost" size="sm" className="text-destructive">
                            Remove
                          </Button>
                        </form>
                      ) : (
                        <Badge variant={member.userId === session.user.id ? "secondary" : "outline"}>
                          {member.userId === session.user.id ? "You" : roleLabels[member.role] ?? member.role}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Invite teammate</CardTitle>
            <CardDescription>Send an invitation email so teammates can join your workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteMemberForm />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Pending invitations</CardTitle>
          <CardDescription>Invites expire after 7 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {invites.map((invite) => (
                <li key={invite.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground/90">{invite.email}</p>
                    <p className="text-xs text-muted-foreground/80">
                      {roleLabels[invite.role] ?? invite.role} • expires {formatDistanceToNow(invite.expiresAt, { addSuffix: true })}
                    </p>
                  </div>
                  <form action={cancelInviteAction} className="flex items-center gap-2">
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <Button variant="ghost" size="sm" className="text-destructive">
                      Cancel invitation
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
