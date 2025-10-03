import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  index,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const providerEnum = pgEnum("provider", ["veo", "fal"]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "running", "completed", "failed"]);
export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "member"]);
export const jobAssetKindEnum = pgEnum("job_asset_kind", ["video", "thumbnail", "render_log"]);
export const ratioEnum = pgEnum("aspect_ratio", ["9:16", "16:9"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").notNull().primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").notNull().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    plan: text("plan"),
    subscriptionStatus: text("subscription_status"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    billingEmail: text("billing_email"),
    credits: integer("credits").notNull().default(0),
    autoTopUpEnabled: boolean("auto_top_up_enabled").notNull().default(false),
    autoTopUpThreshold: integer("auto_top_up_threshold").notNull().default(15),
    autoTopUpPackageId: text("auto_top_up_package_id").default("starter"),
    seatsLimit: integer("seats_limit").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("organizations_slug_idx").on(table.slug),
  }),
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").notNull().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull().default("member"),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueMember: uniqueIndex("organization_members_user_org_idx").on(table.organizationId, table.userId),
  }),
);

export const organizationInvites = pgTable(
  "organization_invites",
  {
    id: uuid("id").notNull().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: orgRoleEnum("role").notNull().default("member"),
    token: text("token").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    orgEmailIdx: uniqueIndex("organization_invites_org_email_idx").on(
      table.organizationId,
      table.email,
    ),
  }),
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").notNull().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    provider: providerEnum("provider").notNull(),
    engine: text("engine").notNull(),
    prompt: text("prompt").notNull(),
    ratio: ratioEnum("ratio").notNull(),
    durationSeconds: smallint("duration_seconds").notNull(),
    withAudio: boolean("with_audio").notNull().default(true),
    quantity: smallint("quantity").notNull().default(1),
    presetId: text("preset_id"),
    status: jobStatusEnum("status").notNull().default("pending"),
    progress: smallint("progress").notNull().default(0),
    costEstimateCents: integer("cost_estimate_cents").notNull().default(0),
    costActualCents: integer("cost_actual_cents"),
    durationActualSeconds: smallint("duration_actual_seconds"),
    externalJobId: text("external_job_id"),
    outputUrl: text("output_url"),
    thumbnailUrl: text("thumbnail_url"),
    archiveUrl: text("archive_url"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgStatusIdx: index("jobs_org_status_idx").on(table.organizationId, table.status, table.createdAt),
  }),
);

export const organizationCreditLedger = pgTable(
  "organization_credit_ledger",
  {
    id: uuid("id").notNull().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    performedBy: uuid("performed_by").references(() => users.id, { onDelete: "set null" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgCreatedIdx: index("organization_credit_ledger_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  }),
);

export const jobEvents = pgTable(
  "job_events",
  {
    id: uuid("id").notNull().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: jobStatusEnum("status").notNull(),
    progress: smallint("progress").notNull().default(0),
    message: text("message"),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const jobAssets = pgTable(
  "job_assets",
  {
    id: uuid("id").notNull().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    kind: jobAssetKindEnum("kind").notNull(),
    url: text("url").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const usageSnapshots = pgTable(
  "usage_snapshots",
  {
    id: uuid("id").notNull().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: providerEnum("provider").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    secondsGenerated: integer("seconds_generated").notNull().default(0),
    clipsGenerated: integer("clips_generated").notNull().default(0),
    costCents: integer("cost_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    usagePeriodIdx: uniqueIndex("usage_snapshots_period_idx").on(
      table.organizationId,
      table.provider,
      table.periodStart,
      table.periodEnd,
    ),
  }),
);

export const presets = pgTable("presets", {
  id: text("id").notNull().primaryKey(),
  provider: providerEnum("provider").notNull(),
  engine: text("engine").notNull(),
  ratio: ratioEnum("ratio").notNull(),
  durationSeconds: smallint("duration_seconds").notNull(),
  withAudio: boolean("with_audio").notNull().default(true),
  seed: integer("seed"),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
  jobs: many(jobs),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  jobs: many(jobs),
  usageSnapshots: many(usageSnapshots),
  usageEvents: many(usageEvents),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").notNull().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    meter: text("meter").notNull(),
    quantity: numeric("quantity").notNull(),
    engine: text("engine").notNull(),
    provider: providerEnum("provider").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    meterIdx: index("usage_events_meter_created_idx").on(table.meter, table.createdAt.desc()),
    orgIdx: index("usage_events_org_created_idx").on(table.organizationId, table.createdAt.desc()),
  }),
);

export const organizationInvitesRelations = relations(organizationInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationInvites.organizationId],
    references: [organizations.id],
  }),
  invitedByUser: one(users, {
    fields: [organizationInvites.invitedBy],
    references: [users.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [jobs.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [jobs.createdBy],
    references: [users.id],
  }),
  events: many(jobEvents),
  assets: many(jobAssets),
  usageEvents: many(usageEvents),
}));

export const jobEventsRelations = relations(jobEvents, ({ one }) => ({
  job: one(jobs, {
    fields: [jobEvents.jobId],
    references: [jobs.id],
  }),
}));

export const jobAssetsRelations = relations(jobAssets, ({ one }) => ({
  job: one(jobs, {
    fields: [jobAssets.jobId],
    references: [jobs.id],
  }),
}));

export const usageSnapshotsRelations = relations(usageSnapshots, ({ one }) => ({
  organization: one(organizations, {
    fields: [usageSnapshots.organizationId],
    references: [organizations.id],
  }),
}));

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [usageEvents.organizationId],
    references: [organizations.id],
  }),
  job: one(jobs, {
    fields: [usageEvents.jobId],
    references: [jobs.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobEvent = typeof jobEvents.$inferSelect;
export type JobAsset = typeof jobAssets.$inferSelect;
export type UsageSnapshot = typeof usageSnapshots.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type Preset = typeof presets.$inferSelect;
