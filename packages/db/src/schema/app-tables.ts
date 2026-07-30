import {
  bigint,
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./auth-tables.js";

export const organizationsExt = pgTable("organizations_ext", {
  orgId: text("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providerConnections = pgTable("provider_connections", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  baseUrl: text("base_url"),
  credentialsEncrypted: text("credentials_encrypted").notNull(),
  credentialsMeta: jsonb("credentials_meta")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const models = pgTable(
  "models",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    connectionId: text("connection_id").references(() => providerConnections.id, {
      onDelete: "set null",
    }),
    providerKind: text("provider_kind").notNull(),
    modelId: text("model_id").notNull(),
    displayName: text("display_name").notNull(),
    modelRef: text("model_ref").notNull(),
    capabilities: jsonb("capabilities")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({ streaming: true }),
    isEnabled: boolean("is_enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Per-offering rates; null falls back to model_prices pattern table. */
    inputUsdPer1m: numeric("input_usd_per_1m", { precision: 12, scale: 6 }),
    outputUsdPer1m: numeric("output_usd_per_1m", {
      precision: 12,
      scale: 6,
    }),
  },
  (t) => [uniqueIndex("models_org_ref_uidx").on(t.orgId, t.modelRef)],
);

export const modelAllowlists = pgTable(
  "model_allowlists",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    modelRef: text("model_ref").notNull(),
    role: text("role"),
  },
  (t) => [uniqueIndex("model_allowlists_uidx").on(t.orgId, t.modelRef, t.role)],
);

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  instructions: text("instructions"),
  defaultModelRef: text("default_model_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  title: text("title"),
  titleSource: text("title_source"),
  modelRef: text("model_ref"),
  activeLeafId: text("active_leaf_id"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  parentMessageId: text("parent_message_id"),
  role: text("role").notNull(),
  content: jsonb("content").$type<unknown[]>().notNull(),
  status: text("status").notNull(),
  modelRef: text("model_ref"),
  tokenUsage: jsonb("token_usage").$type<Record<string, unknown> | null>(),
  error: jsonb("error").$type<Record<string, unknown> | null>(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  messageId: text("message_id").references(() => messages.id, {
    onDelete: "set null",
  }),
  uploaderUserId: text("uploader_user_id")
    .notNull()
    .references(() => users.id),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  sha256: text("sha256"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customInstructions = pgTable("custom_instructions", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  aboutUser: text("about_user"),
  preferredResponse: text("preferred_response"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageEvents = pgTable("usage_events", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  conversationId: text("conversation_id"),
  messageId: text("message_id"),
  modelRef: text("model_ref").notNull(),
  providerKind: text("provider_kind").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costMicros: bigint("cost_micros", { mode: "number" }),
  latencyMs: integer("latency_ms"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  orgId: text("org_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  actorUserId: text("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messageFeedback = pgTable(
  "message_feedback",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: text("rating").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("message_feedback_uidx").on(t.messageId, t.userId)],
);

export const modelPrices = pgTable("model_prices", {
  id: text("id").primaryKey(),
  orgId: text("org_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  providerKind: text("provider_kind").notNull(),
  modelIdPattern: text("model_id_pattern").notNull(),
  inputUsdPer1m: numeric("input_usd_per_1m", { precision: 12, scale: 6 }).notNull(),
  outputUsdPer1m: numeric("output_usd_per_1m", {
    precision: 12,
    scale: 6,
  }).notNull(),
  currency: text("currency").notNull().default("USD"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ssoConfigs = pgTable("sso_configs", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  provider: text("provider"),
  issuerUrl: text("issuer_url"),
  clientId: text("client_id"),
  clientSecretEncrypted: text("client_secret_encrypted"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
