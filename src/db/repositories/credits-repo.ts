import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { dbSchema, getDb } from "@/db/client";

const { organizations, organizationCreditLedger } = dbSchema;

export class InsufficientCreditsError extends Error {
  constructor(message = "Not enough credits to perform this action") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export async function spendOrganizationCredits(params: {
  organizationId: string;
  amount: number;
  performedBy?: string;
  jobId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const { organizationId, amount } = params;
  if (amount <= 0) {
    throw new Error("Credits to spend must be greater than zero");
  }

  const db = getDb();

  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(organizations)
      .set({
        credits: sql`${organizations.credits} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(organizations.id, organizationId), gte(organizations.credits, amount)))
      .returning({ credits: organizations.credits });

    if (!updated) {
      throw new InsufficientCreditsError();
    }

    await tx.insert(organizationCreditLedger).values({
      id: randomUUID(),
      organizationId,
      delta: -amount,
      reason: params.reason ?? "job",
      performedBy: params.performedBy ?? null,
      jobId: params.jobId ?? null,
      metadata: params.metadata ?? {},
    });

    return updated.credits;
  });
}

export async function grantOrganizationCredits(params: {
  organizationId: string;
  amount: number;
  performedBy?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const { organizationId, amount } = params;
  if (amount <= 0) {
    throw new Error("Credits to grant must be greater than zero");
  }

  const db = getDb();
  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(organizations)
      .set({
        credits: sql`${organizations.credits} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning({ credits: organizations.credits });

    if (!updated) {
      throw new Error("Organization not found");
    }

    await tx.insert(organizationCreditLedger).values({
      id: randomUUID(),
      organizationId,
      delta: amount,
      reason: params.reason ?? "credit_grant",
      performedBy: params.performedBy ?? null,
      metadata: params.metadata ?? {},
    });

    return updated.credits;
  });
}

export async function hasLedgerEntryWithStripeReference(
  organizationId: string,
  stripeSessionId: string,
  priceId?: string,
): Promise<boolean> {
  const db = getDb();
  const conditions = [
    eq(organizationCreditLedger.organizationId, organizationId),
    sql`${organizationCreditLedger.metadata} ->> 'stripe_session_id' = ${stripeSessionId}`,
  ];

  if (priceId) {
    conditions.push(sql`${organizationCreditLedger.metadata} ->> 'price_id' = ${priceId}`);
  }

  const rows = await db
    .select({ id: organizationCreditLedger.id })
    .from(organizationCreditLedger)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}

export interface CreditLedgerEntry {
  id: string;
  organizationId: string;
  delta: number;
  reason: string;
  performedBy: string | null;
  jobId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export async function listCreditLedger(organizationId: string, limit = 50): Promise<CreditLedgerEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(organizationCreditLedger)
    .where(eq(organizationCreditLedger.organizationId, organizationId))
    .orderBy(desc(organizationCreditLedger.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    delta: row.delta,
    reason: row.reason,
    performedBy: row.performedBy ?? null,
    jobId: row.jobId ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
  }));
}
