"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createOrganizationInvite,
  deleteInvite,
  getUserByEmail,
  listInvitesByOrganization,
  listMembersByOrganization,
  removeMember,
} from "@/db/repositories/users-orgs-repo";
import { requireCurrentSession } from "@/lib/auth/current-user";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export async function inviteMemberAction(_prevState: unknown, formData: FormData) {
  const session = await requireCurrentSession();

  if (session.membership.role === "member") {
    return { error: "Only owners or admins can invite members." };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role") ?? "member",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email, role } = parsed.data;

  const existingUser = await getUserByEmail(email.toLowerCase());
  if (existingUser) {
    const existingMemberships = await listMembersByOrganization(session.organization.id);
    const alreadyMember = existingMemberships.some((member) => member.userId === existingUser.id);
    if (alreadyMember) {
      return { error: "This user is already a member of the organization." };
    }
  }

  const invites = await listInvitesByOrganization(session.organization.id);
  if (invites.some((invite) => invite.email.toLowerCase() === email.toLowerCase() && !invite.acceptedAt)) {
    return { error: "An invitation is already pending for this email." };
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await createOrganizationInvite({
    organizationId: session.organization.id,
    email,
    role,
    token,
    invitedBy: session.user.id,
    expiresAt,
  });

  // TODO: send email with invitation link

  revalidatePath("/settings/members");
  return { success: true };
}

const deleteInviteSchema = z.object({ inviteId: z.string().uuid() });

export async function cancelInviteAction(formData: FormData) {
  const session = await requireCurrentSession();
  if (session.membership.role === "member") {
    return { error: "Only owners or admins can manage invites." };
  }

  const parsed = deleteInviteSchema.safeParse({ inviteId: formData.get("inviteId") });
  if (!parsed.success) {
    return { error: "Invalid invite id" };
  }

  await deleteInvite(parsed.data.inviteId);
  revalidatePath("/settings/members");
  return { success: true };
}

const removeMemberSchema = z.object({ memberId: z.string().uuid() });

export async function removeMemberAction(formData: FormData) {
  const session = await requireCurrentSession();
  if (session.membership.role !== "owner") {
    return { error: "Only owners can remove members." };
  }

  const parsed = removeMemberSchema.safeParse({ memberId: formData.get("memberId") });
  if (!parsed.success) {
    return { error: "Invalid member id" };
  }

  if (parsed.data.memberId === session.user.id) {
    return { error: "You cannot remove yourself." };
  }

  await removeMember(session.organization.id, parsed.data.memberId);
  revalidatePath("/settings/members");
  return { success: true };
}
