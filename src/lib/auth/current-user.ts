import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getUserById,
  createUser,
  updateUser,
  listMembershipsByUserId,
  createOrganizationWithOwner,
  type UserModel,
  type OrganizationModel,
  type OrganizationMembershipModel,
} from "@/db/repositories/users-orgs-repo";

export interface CurrentSessionContext {
  user: UserModel;
  organization: OrganizationModel;
  membership: OrganizationMembershipModel;
  memberships: OrganizationMembershipModel[];
}

export async function requireCurrentSession(): Promise<CurrentSessionContext> {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  let dbUser = await getUserById(user.id);
  if (!dbUser) {
    dbUser = await createUser({
      id: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.full_name ?? user.email ?? "",
      avatarUrl: user.user_metadata?.avatar_url ?? null,
    });
  } else {
    const updatedName = user.user_metadata?.full_name ?? undefined;
    const updatedAvatar = user.user_metadata?.avatar_url ?? undefined;
    if (
      (updatedName && updatedName !== dbUser.name) ||
      (updatedAvatar && updatedAvatar !== dbUser.avatarUrl)
    ) {
      dbUser = await updateUser(dbUser.id, {
        name: updatedName,
        avatarUrl: updatedAvatar,
      });
    }
  }

  let memberships = await listMembershipsByUserId(dbUser.id);

  if (!memberships.length) {
    const orgName = dbUser.name?.trim().length
      ? `${dbUser.name.split(" ")[0]}'s Studio`
      : `${dbUser.email.split("@")[0]}'s Studio`;
    await createOrganizationWithOwner({
      name: orgName,
      ownerId: dbUser.id,
      billingEmail: dbUser.email,
      plan: "free",
      subscriptionStatus: "active",
      seatsLimit: 3,
    });
    memberships = await listMembershipsByUserId(dbUser.id);
  }

  const activeMembership = memberships[0];
  return {
    user: dbUser,
    memberships,
    membership: activeMembership,
    organization: {
      id: activeMembership.organizationId,
      name: activeMembership.organizationName,
      slug: activeMembership.organizationSlug,
      plan: activeMembership.organizationPlan,
      subscriptionStatus: activeMembership.organizationStatus,
      stripeCustomerId: activeMembership.organizationStripeCustomerId,
      stripeSubscriptionId: activeMembership.organizationStripeSubscriptionId,
      billingEmail: activeMembership.organizationBillingEmail,
      credits: activeMembership.organizationCredits,
      autoTopUpEnabled: activeMembership.organizationAutoTopUpEnabled,
      autoTopUpThreshold: activeMembership.organizationAutoTopUpThreshold,
      autoTopUpPackageId: activeMembership.organizationAutoTopUpPackageId,
      seatsLimit: activeMembership.organizationSeatsLimit,
    },
  };
}
