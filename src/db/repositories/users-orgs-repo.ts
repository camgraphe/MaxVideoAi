import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { dbSchema, getDb } from "@/db/client";

const { users, organizations, organizationMembers, organizationInvites, jobs } = dbSchema;

export interface UserModel {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationModel {
  id: string;
  name: string;
  slug: string;
  plan: string | null;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billingEmail: string | null;
  credits: number;
  autoTopUpEnabled: boolean;
  autoTopUpThreshold: number;
  autoTopUpPackageId: string | null;
  seatsLimit: number;
}

export interface OrganizationMembershipModel {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationPlan: string | null;
  organizationStatus: string | null;
  organizationStripeCustomerId: string | null;
  organizationStripeSubscriptionId: string | null;
  organizationBillingEmail: string | null;
  organizationCredits: number;
  organizationAutoTopUpEnabled: boolean;
  organizationAutoTopUpThreshold: number;
  organizationAutoTopUpPackageId: string | null;
  organizationSeatsLimit: number;
  userId: string;
  userEmail: string;
  userName: string | null;
  role: typeof organizationMembers.$inferSelect["role"];
}

export interface OrganizationInviteModel {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  email: string;
  token: string;
  role: typeof organizationInvites.$inferSelect["role"];
  invitedBy: string | null;
  acceptedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

function mapUser(row: typeof users.$inferSelect): UserModel {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    avatarUrl: row.avatarUrl ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMembership(
  row: typeof organizationMembers.$inferSelect & {
    organization: typeof organizations.$inferSelect;
    user?: typeof users.$inferSelect;
  },
): OrganizationMembershipModel {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organization.name,
    organizationSlug: row.organization.slug,
    organizationPlan: row.organization.plan ?? null,
    organizationStatus: row.organization.subscriptionStatus ?? null,
    organizationStripeCustomerId: row.organization.stripeCustomerId ?? null,
    organizationStripeSubscriptionId: row.organization.stripeSubscriptionId ?? null,
    organizationBillingEmail: row.organization.billingEmail ?? null,
    organizationCredits: row.organization.credits ?? 0,
    organizationAutoTopUpEnabled: row.organization.autoTopUpEnabled ?? false,
    organizationAutoTopUpThreshold: row.organization.autoTopUpThreshold ?? 15,
    organizationAutoTopUpPackageId: row.organization.autoTopUpPackageId ?? null,
    organizationSeatsLimit: row.organization.seatsLimit ?? 1,
    role: row.role,
    userId: row.userId,
    userEmail: row.user?.email ?? "",
    userName: row.user?.name ?? null,
  };
}

function mapInvite(
  row: typeof organizationInvites.$inferSelect & { organization: typeof organizations.$inferSelect },
): OrganizationInviteModel {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organization.name,
    organizationSlug: row.organization.slug,
    email: row.email,
    token: row.token,
    role: row.role,
    invitedBy: row.invitedBy,
    acceptedAt: row.acceptedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export async function getUserById(id: string): Promise<UserModel | null> {
  const db = getDb();
  const row = await db.query.users.findFirst({ where: eq(users.id, id) });
  return row ? mapUser(row) : null;
}

export async function getUserByEmail(email: string): Promise<UserModel | null> {
  const db = getDb();
  const row = await db.query.users.findFirst({ where: eq(users.email, email) });
  return row ? mapUser(row) : null;
}

export async function createUser(input: {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}): Promise<UserModel> {
  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });

  if (existing) {
    if (existing.id !== input.id) {
      return await db.transaction(async (tx) => {
        const updatedEmail = `${existing.email}#legacy-${Date.now()}`;

        await tx
          .update(users)
          .set({ email: updatedEmail })
          .where(eq(users.id, existing.id));

        const [newRow] = await tx
          .insert(users)
          .values({
            id: input.id,
            email: input.email,
            name: input.name ?? existing.name,
            avatarUrl: input.avatarUrl ?? existing.avatarUrl,
          })
          .returning();

        await tx
          .update(organizationMembers)
          .set({ userId: input.id })
          .where(eq(organizationMembers.userId, existing.id));

        await tx
          .update(jobs)
          .set({ createdBy: input.id })
          .where(eq(jobs.createdBy, existing.id));

        await tx.delete(users).where(eq(users.id, existing.id));

        return mapUser(newRow);
      });
    }

    const [updated] = await db
      .update(users)
      .set({
        name: input.name ?? existing.name,
        avatarUrl: input.avatarUrl ?? existing.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return mapUser(updated);
  }

  const [row] = await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      name: input.name ?? null,
      avatarUrl: input.avatarUrl ?? null,
    })
    .returning();
  return mapUser(row);
}

export async function updateUser(
  id: string,
  updates: {
    name?: string | null;
    avatarUrl?: string | null;
  },
): Promise<UserModel> {
  const db = getDb();
  const [row] = await db
    .update(users)
    .set({
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.avatarUrl !== undefined ? { avatarUrl: updates.avatarUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();
  return mapUser(row);
}

function uniqueSlug(base: string) {
  return base
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48) || "studio";
}

export async function createOrganizationWithOwner(input: {
  name: string;
  ownerId: string;
  plan?: string | null;
  subscriptionStatus?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  billingEmail?: string | null;
  credits?: number;
  autoTopUpEnabled?: boolean;
  autoTopUpThreshold?: number;
  autoTopUpPackageId?: string | null;
  seatsLimit?: number;
}): Promise<OrganizationModel> {
  const db = getDb();

  const baseSlug = uniqueSlug(input.name || "studio");
  let slug = baseSlug;
  let counter = 1;

  // Ensure slug uniqueness
  while (true) {
    const existing = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!existing.length) {
      break;
    }
    slug = `${baseSlug}-${counter++}`;
  }

  const orgId = randomUUID();
  const [org] = await db
    .insert(organizations)
    .values({
      id: orgId,
      name: input.name,
      slug,
      plan: input.plan ?? "free",
      subscriptionStatus: input.subscriptionStatus ?? "active",
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      billingEmail: input.billingEmail ?? null,
      credits: input.credits ?? 0,
      autoTopUpEnabled: input.autoTopUpEnabled ?? false,
      autoTopUpThreshold: input.autoTopUpThreshold ?? 15,
      autoTopUpPackageId: input.autoTopUpPackageId ?? "starter",
      seatsLimit: input.seatsLimit ?? 3,
    })
    .returning();

  await db.insert(organizationMembers).values({
    id: randomUUID(),
    organizationId: org.id,
    userId: input.ownerId,
    role: "owner",
  });

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan ?? null,
    subscriptionStatus: org.subscriptionStatus ?? null,
    stripeCustomerId: org.stripeCustomerId ?? null,
    stripeSubscriptionId: org.stripeSubscriptionId ?? null,
    billingEmail: org.billingEmail ?? null,
    credits: org.credits ?? 0,
    autoTopUpEnabled: org.autoTopUpEnabled ?? false,
    autoTopUpThreshold: org.autoTopUpThreshold ?? 15,
    autoTopUpPackageId: org.autoTopUpPackageId ?? "starter",
    seatsLimit: org.seatsLimit ?? 3,
  };
}

export async function updateOrganizationAutoTopUp(
  organizationId: string,
  config: { enabled: boolean; threshold?: number; packageId?: string | null },
): Promise<void> {
  const db = getDb();
  const updates: Partial<typeof organizations.$inferInsert> = {
    autoTopUpEnabled: config.enabled,
    updatedAt: new Date(),
  };
  if (config.threshold !== undefined) {
    updates.autoTopUpThreshold = config.threshold;
  }
  if (config.packageId !== undefined) {
    updates.autoTopUpPackageId = config.packageId;
  }

  await db
    .update(organizations)
    .set(updates)
    .where(eq(organizations.id, organizationId));
}

export async function setOrganizationStripeCustomer(
  organizationId: string,
  customerId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(organizations)
    .set({ stripeCustomerId: customerId, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId));
}

export async function listMembershipsByUserId(userId: string): Promise<OrganizationMembershipModel[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .innerJoin(users, eq(organizationMembers.userId, users.id));
  return rows.map((row) =>
    mapMembership({
      ...row.organization_members,
      organization: row.organizations,
      user: row.users,
    }),
  );
}

export async function listMembersByOrganization(organizationId: string): Promise<OrganizationMembershipModel[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId))
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .innerJoin(users, eq(organizationMembers.userId, users.id));
  return rows.map((row) =>
    mapMembership({
      ...row.organization_members,
      organization: row.organizations,
      user: row.users,
    }),
  );
}

export async function getMembership(userId: string, organizationId: string) {
  const db = getDb();
  const row = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId)),
    )
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .limit(1);
  if (!row.length) {
    return null;
  }
  return mapMembership({
    ...row[0].organization_members,
    organization: row[0].organizations,
    user: row[0].users,
  });
}

export async function listInvitesByOrganization(organizationId: string): Promise<OrganizationInviteModel[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(organizationInvites)
    .where(eq(organizationInvites.organizationId, organizationId))
    .innerJoin(organizations, eq(organizationInvites.organizationId, organizations.id));
  return rows.map((row) =>
    mapInvite({
      ...row.organization_invites,
      organization: row.organizations,
    }),
  );
}

export async function createOrganizationInvite(input: {
  organizationId: string;
  email: string;
  role: typeof organizationInvites.$inferSelect["role"];
  token: string;
  invitedBy?: string | null;
  expiresAt: Date;
}): Promise<OrganizationInviteModel> {
  const db = getDb();
  const [row] = await db
    .insert(organizationInvites)
    .values({
      id: randomUUID(),
      organizationId: input.organizationId,
      email: input.email.toLowerCase(),
      role: input.role,
      token: input.token,
      invitedBy: input.invitedBy ?? null,
      expiresAt: input.expiresAt,
    })
    .returning();

  const orgRow = await db.query.organizations.findFirst({ where: eq(organizations.id, row.organizationId) });
  if (!orgRow) {
    throw new Error("Organization not found after invite creation");
  }

  return mapInvite({ ...row, organization: orgRow });
}

export async function getInviteByToken(token: string): Promise<OrganizationInviteModel | null> {
  const db = getDb();
  const row = await db
    .select()
    .from(organizationInvites)
    .where(eq(organizationInvites.token, token))
    .innerJoin(organizations, eq(organizationInvites.organizationId, organizations.id))
    .limit(1);
  if (!row.length) return null;
  return mapInvite({
    ...row[0].organization_invites,
    organization: row[0].organizations,
  });
}

export async function markInviteAccepted(id: string) {
  const db = getDb();
  await db
    .update(organizationInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(organizationInvites.id, id));
}

export async function deleteInvite(id: string) {
  const db = getDb();
  await db.delete(organizationInvites).where(eq(organizationInvites.id, id));
}

export async function removeMember(organizationId: string, userId: string) {
  const db = getDb();
  await db
    .delete(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)),
    );
}
