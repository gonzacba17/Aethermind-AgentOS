import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  json,
  jsonb,
  decimal,
  index,
  inet,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================
// ORGANIZATIONS TABLE
// ============================================
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  apiKeyHash: varchar('api_key_hash', { length: 255 }).notNull().unique(),
  apiKeyPrefix: varchar('api_key_prefix', { length: 16 }),
  plan: varchar('plan', { length: 50 }).default('FREE').notNull(),
  rateLimitPerMin: integer('rate_limit_per_min').default(100).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, precision: 6 }),
}, (table) => ({
  apiKeyIdx: index('idx_organizations_api_key').on(table.apiKeyHash),
  apiKeyPrefixIdx: index('idx_organizations_api_key_prefix').on(table.apiKeyPrefix),
  planIdx: index('idx_organizations_plan').on(table.plan),
  deletedAtIdx: index('idx_organizations_deleted_at').on(table.deletedAt),
}));

// ============================================
// USERS TABLE
// ============================================
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  name: varchar('name', { length: 255 }),
  googleId: varchar('google_id', { length: 255 }).unique(),
  githubId: varchar('github_id', { length: 255 }).unique(),
  apiKeyHash: varchar('api_key_hash', { length: 255 }).notNull().unique(),
  plan: varchar('plan', { length: 50 }).default('free').notNull(),
  usageLimit: integer('usage_limit').default(100).notNull(),
  usageCount: integer('usage_count').default(0).notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).unique(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  emailVerified: boolean('email_verified').default(false).notNull(),
  verificationToken: varchar('verification_token', { length: 255 }),
  verificationExpiry: timestamp('verification_expiry', { withTimezone: true, precision: 6 }),
  resetToken: varchar('reset_token', { length: 255 }),
  resetTokenExpiry: timestamp('reset_token_expiry', { withTimezone: true, precision: 6 }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  
  // Onboarding Tracking
  hasCompletedOnboarding: boolean('has_completed_onboarding').default(false).notNull(),
  onboardingStep: varchar('onboarding_step', { length: 50 }).default('welcome'),
  
  // Trial Management
  trialStartedAt: timestamp('trial_started_at', { withTimezone: true, precision: 6 }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true, precision: 6 }),
  
  // Subscription Status
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('free').notNull(),
  
  // Login Tracking
  lastLoginAt: timestamp('last_login_at', { withTimezone: true, precision: 6 }),
  firstLoginAt: timestamp('first_login_at', { withTimezone: true, precision: 6 }),
  
  // Free Tier Limits
  maxAgents: integer('max_agents').default(3).notNull(),
  logRetentionDays: integer('log_retention_days').default(30).notNull(),

  // Soft Delete
  deletedAt: timestamp('deleted_at', { withTimezone: true, precision: 6 }),
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  apiKeyHashIdx: index('idx_users_api_key_hash').on(table.apiKeyHash),
  planIdx: index('idx_users_plan').on(table.plan),
  googleIdIdx: index('idx_users_google_id').on(table.googleId),
  githubIdIdx: index('idx_users_github_id').on(table.githubId),
  orgIdIdx: index('idx_users_organization_id').on(table.organizationId),
  deletedAtIdx: index('idx_users_deleted_at').on(table.deletedAt),
}));

// ============================================
// AGENTS TABLE
// ============================================
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  model: varchar('model', { length: 255 }).notNull(),
  config: json('config').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, precision: 6 }),
}, (table) => ({
  userIdIdx: index('idx_agents_user_id').on(table.userId),
  deletedAtIdx: index('idx_agents_deleted_at').on(table.deletedAt),
}));

// ============================================
// EXECUTIONS TABLE
// ============================================
export const executions = pgTable('executions', {
  id: uuid('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).notNull(),
  input: json('input'),
  output: json('output'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true, precision: 6 }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true, precision: 6 }),
  durationMs: integer('duration_ms'),
  traceId: varchar('trace_id', { length: 64 }),
  deletedAt: timestamp('deleted_at', { withTimezone: true, precision: 6 }),
}, (table) => ({
  userIdIdx: index('idx_executions_user_id').on(table.userId),
  agentIdIdx: index('idx_executions_agent_id').on(table.agentId),
  statusIdx: index('idx_executions_status').on(table.status),
  startedAtIdx: index('idx_executions_started_at').on(table.startedAt),
  agentStatusIdx: index('idx_executions_agent_status').on(table.agentId, table.status),
  traceIdIdx: index('idx_executions_trace_id').on(table.traceId),
  deletedAtIdx: index('idx_executions_deleted_at').on(table.deletedAt),
}));

// ============================================
// LOGS TABLE
// ============================================
export const logs = pgTable('logs', {
  id: uuid('id').primaryKey(),
  executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' }),
  level: varchar('level', { length: 20 }).notNull(),
  message: text('message').notNull(),
  metadata: json('metadata'),
  timestamp: timestamp('timestamp', { withTimezone: true, precision: 6 }).defaultNow(),
}, (table) => ({
  executionIdIdx: index('idx_logs_execution_id').on(table.executionId),
  agentIdIdx: index('idx_logs_agent_id').on(table.agentId),
  timestampIdx: index('idx_logs_timestamp').on(table.timestamp),
  levelIdx: index('idx_logs_level').on(table.level),
  execTimeIdx: index('idx_logs_exec_time').on(table.executionId, table.timestamp),
  agentTimestampIdx: index('idx_logs_agent_timestamp').on(table.agentId, table.timestamp),
}));

// ============================================
// TRACES TABLE
// ============================================
export const traces = pgTable('traces', {
  id: uuid('id').primaryKey(),
  executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'cascade' }),
  treeData: json('tree_data').notNull(),
  metadata: json('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow(),
}, (table) => ({
  executionIdIdx: index('idx_traces_execution_id').on(table.executionId),
}));

// ============================================
// COSTS TABLE
// ============================================
export const costs = pgTable('costs', {
  id: uuid('id').primaryKey(),
  executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'cascade' }),
  model: varchar('model', { length: 255 }).notNull(),
  promptTokens: integer('prompt_tokens').default(0).notNull(),
  completionTokens: integer('completion_tokens').default(0).notNull(),
  totalTokens: integer('total_tokens').default(0).notNull(),
  cost: decimal('cost', { precision: 10, scale: 6 }).default('0').notNull(),
  currency: varchar('currency', { length: 10 }).default('USD'),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow(),
}, (table) => ({
  executionIdIdx: index('idx_costs_execution_id').on(table.executionId),
  modelIdx: index('idx_costs_model').on(table.model),
  createdAtIdx: index('idx_costs_created_at').on(table.createdAt),
  modelDateIdx: index('idx_costs_model_date').on(table.model, table.createdAt),
}));

// ============================================
// WORKFLOWS TABLE
// ============================================
export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  definition: json('definition').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_workflows_user_id').on(table.userId),
}));

// ============================================
// BUDGETS TABLE
// ============================================
export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  limitAmount: decimal('limit_amount', { precision: 10, scale: 2 }).notNull(),
  period: varchar('period', { length: 20 }).notNull(),
  scope: varchar('scope', { length: 50 }).notNull(),
  scopeId: varchar('scope_id', { length: 255 }),
  currentSpend: decimal('current_spend', { precision: 10, scale: 6 }).default('0').notNull(),
  hardLimit: boolean('hard_limit').default(true).notNull(),
  alertAt: integer('alert_at').default(80).notNull(),
  alert80Sent: boolean('alert_80_sent').default(false).notNull(),
  alert100Sent: boolean('alert_100_sent').default(false).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_budgets_user_id').on(table.userId),
  statusIdx: index('idx_budgets_status').on(table.status),
  scopeIdx: index('idx_budgets_scope').on(table.scope, table.scopeId),
}));

// ============================================
// ALERT LOGS TABLE
// ============================================
export const alertLogs = pgTable('alert_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  budgetId: uuid('budget_id').notNull(),
  alertType: varchar('alert_type', { length: 50 }).notNull(),
  channel: varchar('channel', { length: 50 }).notNull(),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  message: text('message').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  success: boolean('success').default(true).notNull(),
  error: text('error'),
}, (table) => ({
  budgetIdIdx: index('idx_alert_logs_budget_id').on(table.budgetId),
  sentAtIdx: index('idx_alert_logs_sent_at').on(table.sentAt),
}));

// ============================================
// USER API KEYS TABLE
// Stores encrypted API keys that users configure
// ============================================
export const userApiKeys = pgTable('user_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 50 }).notNull(), // openai, anthropic, cohere, etc.
  name: varchar('name', { length: 100 }).notNull(), // User-friendly name
  encryptedKey: text('encrypted_key').notNull(), // AES-256 encrypted
  maskedKey: varchar('masked_key', { length: 20 }).notNull(), // sk-...abc
  isValid: boolean('is_valid').default(true).notNull(),
  lastValidated: timestamp('last_validated', { withTimezone: true, precision: 6 }),
  lastUsed: timestamp('last_used', { withTimezone: true, precision: 6 }),
  usageCount: integer('usage_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_user_api_keys_user_id').on(table.userId),
  providerIdx: index('idx_user_api_keys_provider').on(table.provider),
  userProviderIdx: index('idx_user_api_keys_user_provider').on(table.userId, table.provider),
}));

// ============================================
// TELEMETRY EVENTS TABLE
// ============================================
export const telemetryEvents = pgTable('telemetry_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp', { withTimezone: true, precision: 6 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  model: varchar('model', { length: 255 }).notNull(),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  cost: decimal('cost', { precision: 10, scale: 6 }).notNull(),
  latency: integer('latency').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  error: text('error'),
  agentId: varchar('agent_id', { length: 255 }),
  sessionId: varchar('session_id', { length: 255 }),
  // Phase 2 — Model Routing fields
  originalModel: varchar('original_model', { length: 255 }),
  routedModel: varchar('routed_model', { length: 255 }),
  fallbackUsed: boolean('fallback_used').default(false),
  providerFallback: boolean('provider_fallback').default(false),
  fallbackProvider: varchar('fallback_provider', { length: 50 }),
  // Phase 2 — Quality feedback (infrastructure for Phase 5)
  qualityRating: varchar('quality_rating', { length: 10 }),
  // Phase 3 — Semantic caching fields
  cacheHit: boolean('cache_hit').default(false),
  cacheSavedUsd: decimal('cache_saved_usd', { precision: 10, scale: 6 }),
  // Phase 4 — Prompt compression fields (all nullable — don't break existing ingestion)
  compressionApplied: boolean('compression_applied'),
  originalTokens: integer('original_tokens'),
  compressedTokens: integer('compressed_tokens'),
  tokensSaved: integer('tokens_saved'),
  // Multi-agent tracing fields
  traceId: varchar('trace_id', { length: 64 }),
  agentName: varchar('agent_name', { length: 255 }),
  workflowId: varchar('workflow_id', { length: 255 }),
  workflowStep: integer('workflow_step'),
  parentAgentId: varchar('parent_agent_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  orgTimeIdx: index('idx_telemetry_org_time').on(table.organizationId, table.timestamp),
  providerModelIdx: index('idx_telemetry_provider_model').on(table.provider, table.model),
  statusIdx: index('idx_telemetry_status').on(table.status),
  createdAtIdx: index('idx_telemetry_created_at').on(table.createdAt),
  agentIdIdx: index('idx_telemetry_agent_id').on(table.agentId),
  sessionIdIdx: index('idx_telemetry_session_id').on(table.sessionId),
  routedModelIdx: index('idx_telemetry_routed_model').on(table.routedModel),
  traceIdIdx: index('idx_telemetry_trace_id').on(table.traceId),
  workflowIdIdx: index('idx_telemetry_workflow_id').on(table.workflowId),
}));

// ============================================
// SUBSCRIPTION LOGS TABLE
// ============================================
export const subscriptionLogs = pgTable('subscription_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  event: varchar('event', { length: 100 }).notNull(),
  metadata: json('metadata'),
  timestamp: timestamp('timestamp', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_subscription_logs_user_id').on(table.userId),
  timestampIdx: index('idx_subscription_logs_timestamp').on(table.timestamp),
  eventIdx: index('idx_subscription_logs_event').on(table.event),
}));

// ============================================
// SPANS TABLE (Distributed Tracing)
// ============================================
export const spans = pgTable('spans', {
  id: uuid('id').primaryKey().defaultRandom(),
  traceId: varchar('trace_id', { length: 64 }).notNull(),
  spanId: varchar('span_id', { length: 32 }).notNull(),
  parentSpanId: varchar('parent_span_id', { length: 32 }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  kind: varchar('kind', { length: 50 }).notNull(), // 'llm', 'tool', 'chain', 'agent', 'internal'
  startTime: timestamp('start_time', { withTimezone: true, precision: 6 }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true, precision: 6 }),
  durationMs: integer('duration_ms'),
  status: varchar('status', { length: 20 }).default('ok').notNull(), // 'ok', 'error', 'unset'
  statusMessage: text('status_message'),
  attributes: json('attributes').default({}),
  events: json('events').default([]),
  links: json('links').default([]),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  traceIdIdx: index('idx_spans_trace_id').on(table.traceId),
  parentIdIdx: index('idx_spans_parent_id').on(table.parentSpanId),
  orgTimeIdx: index('idx_spans_org_time').on(table.organizationId, table.startTime),
  kindIdx: index('idx_spans_kind').on(table.kind),
}));

// ============================================
// AUDIT LOGS TABLE (Security & Compliance)
// ============================================
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 255 }),
  oldValues: json('old_values'),
  newValues: json('new_values'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_audit_logs_org').on(table.organizationId, table.timestamp),
  userIdx: index('idx_audit_logs_user').on(table.userId, table.timestamp),
  entityIdx: index('idx_audit_logs_entity').on(table.entityType, table.entityId),
  actionIdx: index('idx_audit_logs_action').on(table.action),
}));

// ============================================
// BACKUP HISTORY TABLE
// ============================================
export const backupHistory = pgTable('backup_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: varchar('filename', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(),
  backupType: varchar('backup_type', { length: 50 }).notNull(), // 'full', 'incremental'
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'failed', 'in_progress'
  storageLocation: varchar('storage_location', { length: 500 }),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true, precision: 6 }),
  expiresAt: timestamp('expires_at', { withTimezone: true, precision: 6 }),
}, (table) => ({
  statusIdx: index('idx_backup_history_status').on(table.status),
  startedAtIdx: index('idx_backup_history_started_at').on(table.startedAt),
}));

// ============================================
// CLIENTS TABLE (B2B Beta Access)
// ============================================
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  accessToken: varchar('access_token', { length: 80 }).notNull().unique(),
  sdkApiKey: varchar('sdk_api_key', { length: 255 }).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  rateLimitPerMin: integer('rate_limit_per_min').default(100).notNull(),
  isActive: boolean('is_active').default(true),
  webhookUrl: varchar('webhook_url', { length: 500 }),
  // Token expiration: null = never expires (legacy), set = expires at this time
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true, precision: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  notes: text('notes'),
}, (table) => ({
  accessTokenIdx: index('idx_clients_access_token').on(table.accessToken),
  sdkApiKeyIdx: index('idx_clients_sdk_api_key').on(table.sdkApiKey),
  orgIdIdx: index('idx_clients_organization_id').on(table.organizationId),
  tokenExpiresIdx: index('idx_clients_token_expires_at').on(table.tokenExpiresAt),
}));

// ============================================
// CLIENT BUDGETS TABLE (Phase 1 — Cost Control)
// ============================================
export const clientBudgets = pgTable('client_budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // 'monthly' | 'daily'
  limitUsd: decimal('limit_usd', { precision: 10, scale: 2 }).notNull(),
  alertThresholds: jsonb('alert_thresholds').default([80, 90, 100]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index('idx_client_budgets_client_id').on(table.clientId),
  typeIdx: index('idx_client_budgets_type').on(table.type),
}));

// ============================================
// ALERT EVENTS TABLE (Phase 1 — Budget Alerts)
// ============================================
export const alertEvents = pgTable('alert_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  budgetId: uuid('budget_id').notNull().references(() => clientBudgets.id, { onDelete: 'cascade' }),
  threshold: integer('threshold').notNull(), // 80, 90, 100
  triggeredAt: timestamp('triggered_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  notifiedAt: timestamp('notified_at', { withTimezone: true, precision: 6 }),
}, (table) => ({
  clientIdIdx: index('idx_alert_events_client_id').on(table.clientId),
  budgetIdIdx: index('idx_alert_events_budget_id').on(table.budgetId),
  uniqueThresholdIdx: index('idx_alert_events_unique').on(table.budgetId, table.threshold, table.triggeredAt),
}));

// ============================================
// ALERT RULES TABLE (User-defined alert rules)
// ============================================
export const alertRules = pgTable('alert_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  enabled: boolean('enabled').default(true).notNull(),
  priority: integer('priority').default(0).notNull(),
  budgetId: uuid('budget_id'),
  trigger: varchar('trigger', { length: 100 }).notNull(), // 'threshold_exceeded' | 'anomaly_detected' | etc.
  conditions: jsonb('conditions').default([]).notNull(),   // Array<{field, operator, value}>
  actions: jsonb('actions').default([]).notNull(),          // Array<{type, config, delayMs?, retryOnFailure?}>
  cooldownMinutes: integer('cooldown_minutes').default(60).notNull(),
  maxExecutionsPerDay: integer('max_executions_per_day').default(10).notNull(),
  lastExecutedAt: timestamp('last_executed_at', { withTimezone: true, precision: 6 }),
  executionCount: integer('execution_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index('idx_alert_rules_client_id').on(table.clientId),
  orgIdIdx: index('idx_alert_rules_org_id').on(table.organizationId),
  enabledIdx: index('idx_alert_rules_enabled').on(table.enabled),
}));

// ============================================
// ROUTING RULES TABLE (Phase 2 — Model Routing)
// ============================================
export const routingRules = pgTable('routing_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }).unique(),
  enabled: boolean('enabled').default(false).notNull(),
  simpleModel: varchar('simple_model', { length: 255 }).default('gpt-4o-mini').notNull(),
  mediumModel: varchar('medium_model', { length: 255 }).default('gpt-4o-mini').notNull(),
  complexModel: varchar('complex_model', { length: 255 }).default('gpt-4o').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index('idx_routing_rules_client_id').on(table.clientId),
}));

// ============================================
// PROVIDER HEALTH TABLE (Phase 2 — Provider Routing)
// ============================================
export const providerHealth = pgTable('provider_health', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 50 }).notNull().unique(), // 'openai' | 'anthropic' | 'ollama'
  status: varchar('status', { length: 20 }).default('ok').notNull(), // 'ok' | 'degraded' | 'down'
  latencyMs: integer('latency_ms'),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true, precision: 6 }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  providerIdx: index('idx_provider_health_provider').on(table.provider),
  statusIdx: index('idx_provider_health_status').on(table.status),
}));

// ============================================
// SEMANTIC CACHE TABLE (Phase 3)
// ============================================
export const semanticCache = pgTable('semantic_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  promptHash: varchar('prompt_hash', { length: 64 }).notNull(),
  promptEmbedding: jsonb('prompt_embedding'),
  prompt: text('prompt').notNull(),
  response: text('response').notNull(),
  model: varchar('model', { length: 255 }).notNull(),
  tokensUsed: integer('tokens_used').notNull(),
  costUsd: decimal('cost_usd', { precision: 10, scale: 6 }).notNull(),
  hitCount: integer('hit_count').default(0).notNull(),
  isDeterministic: boolean('is_deterministic').default(false).notNull(),
  ttlExpiresAt: timestamp('ttl_expires_at', { withTimezone: true, precision: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  clientHashIdx: index('idx_semantic_cache_client_hash').on(table.clientId, table.promptHash),
  clientIdIdx: index('idx_semantic_cache_client_id').on(table.clientId),
  deterministicIdx: index('idx_semantic_cache_deterministic').on(table.isDeterministic),
}));

// ============================================
// CACHE SETTINGS TABLE (Phase 3)
// ============================================
export const cacheSettings = pgTable('cache_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }).unique(),
  enabled: boolean('enabled').default(false).notNull(),
  similarityThreshold: decimal('similarity_threshold', { precision: 3, scale: 2 }).default('0.90').notNull(),
  ttlSeconds: integer('ttl_seconds').default(86400).notNull(),
  deterministicTtlSeconds: integer('deterministic_ttl_seconds'),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
});

// ============================================
// PROMPT COMPRESSION LOG TABLE (Phase 4)
// ============================================
export const promptCompressionLog = pgTable('prompt_compression_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  originalTokens: integer('original_tokens').notNull(),
  compressedTokens: integer('compressed_tokens').notNull(),
  savedTokens: integer('saved_tokens').notNull(),
  savedUsd: decimal('saved_usd', { precision: 10, scale: 6 }).default('0').notNull(),
  compressionApplied: boolean('compression_applied').default(false).notNull(),
  model: varchar('model', { length: 255 }).notNull(),
  agentId: varchar('agent_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index('idx_compression_log_client_id').on(table.clientId),
  createdAtIdx: index('idx_compression_log_created_at').on(table.createdAt),
  clientCreatedIdx: index('idx_compression_log_client_created').on(table.clientId, table.createdAt),
}));

// ============================================
// OPTIMIZATION SETTINGS TABLE (Phase 4)
// ============================================
export const optimizationSettings = pgTable('optimization_settings', {
  clientId: uuid('client_id').primaryKey().references(() => clients.id, { onDelete: 'cascade' }),
  compressionEnabled: boolean('compression_enabled').default(false).notNull(),
  minCompressionRatio: decimal('min_compression_ratio', { precision: 3, scale: 2 }).default('0.15').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
});

// ============================================
// CLIENT INSIGHTS TABLE (Phase 5 — Learning Engine)
// ============================================
export const clientInsights = pgTable('client_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // peak_hours | underutilized_agent | overloaded_agent | similar_agents | routing_suggestion | cache_suggestion
  data: jsonb('data').notNull(),
  estimatedSavingsUsd: decimal('estimated_savings_usd', { precision: 10, scale: 2 }),
  acknowledged: boolean('acknowledged').default(false).notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true, precision: 6 }),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true, precision: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  clientIdIdx: index('idx_client_insights_client_id').on(table.clientId),
  typeIdx: index('idx_client_insights_type').on(table.type),
  clientTypeIdx: index('idx_client_insights_client_type').on(table.clientId, table.type),
  createdAtIdx: index('idx_client_insights_created_at').on(table.createdAt),
}));

// ============================================
// PLATFORM BENCHMARKS TABLE (Phase 5 — Learning Engine)
// ============================================
export const platformBenchmarks = pgTable('platform_benchmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  calculatedAt: timestamp('calculated_at', { withTimezone: true, precision: 6 }).notNull(),
  avgCostPerRequest: decimal('avg_cost_per_request', { precision: 10, scale: 6 }).notNull(),
  p50CostPerRequest: decimal('p50_cost_per_request', { precision: 10, scale: 6 }).notNull(),
  p90CostPerRequest: decimal('p90_cost_per_request', { precision: 10, scale: 6 }).notNull(),
  avgCacheHitRate: decimal('avg_cache_hit_rate', { precision: 5, scale: 4 }).notNull(),
  avgCompressionRatio: decimal('avg_compression_ratio', { precision: 5, scale: 4 }).notNull(),
  sampleSize: integer('sample_size').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  calculatedAtIdx: index('idx_platform_benchmarks_calculated_at').on(table.calculatedAt),
}));

// ============================================
// AGENT TRACES TABLE (Multi-agent tracing)
// ============================================
export const agentTraces = pgTable('agent_traces', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  traceId: varchar('trace_id', { length: 64 }).notNull(),
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  agentName: varchar('agent_name', { length: 255 }),
  parentAgentId: varchar('parent_agent_id', { length: 255 }),
  workflowId: varchar('workflow_id', { length: 255 }),
  workflowStep: integer('workflow_step'),
  model: varchar('model', { length: 255 }),
  provider: varchar('provider', { length: 50 }),
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  costUsd: decimal('cost_usd', { precision: 10, scale: 6 }).default('0').notNull(),
  latencyMs: integer('latency_ms'),
  status: varchar('status', { length: 20 }).default('success').notNull(),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true, precision: 6 }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true, precision: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  traceIdIdx: index('idx_agent_traces_trace_id').on(table.organizationId, table.traceId),
  workflowIdIdx: index('idx_agent_traces_workflow_id').on(table.organizationId, table.workflowId),
  agentIdIdx: index('idx_agent_traces_agent_id').on(table.organizationId, table.agentId),
  createdAtIdx: index('idx_agent_traces_created_at').on(table.createdAt),
}));

// ============================================
// TYPESCRIPT TYPE EXPORTS
// ============================================
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;

export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;

export type Trace = typeof traces.$inferSelect;
export type NewTrace = typeof traces.$inferInsert;

export type Cost = typeof costs.$inferSelect;
export type NewCost = typeof costs.$inferInsert;

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type AlertLog = typeof alertLogs.$inferSelect;
export type NewAlertLog = typeof alertLogs.$inferInsert;

export type TelemetryEvent = typeof telemetryEvents.$inferSelect;
export type NewTelemetryEvent = typeof telemetryEvents.$inferInsert;

export type SubscriptionLog = typeof subscriptionLogs.$inferSelect;
export type NewSubscriptionLog = typeof subscriptionLogs.$inferInsert;

export type UserApiKey = typeof userApiKeys.$inferSelect;
export type NewUserApiKey = typeof userApiKeys.$inferInsert;

export type Span = typeof spans.$inferSelect;
export type NewSpan = typeof spans.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type BackupHistory = typeof backupHistory.$inferSelect;
export type NewBackupHistory = typeof backupHistory.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type ClientBudget = typeof clientBudgets.$inferSelect;
export type NewClientBudget = typeof clientBudgets.$inferInsert;

export type AlertEvent = typeof alertEvents.$inferSelect;
export type NewAlertEvent = typeof alertEvents.$inferInsert;

export type RoutingRule = typeof routingRules.$inferSelect;
export type NewRoutingRule = typeof routingRules.$inferInsert;

export type ProviderHealth = typeof providerHealth.$inferSelect;
export type NewProviderHealth = typeof providerHealth.$inferInsert;

export type SemanticCacheEntry = typeof semanticCache.$inferSelect;
export type NewSemanticCacheEntry = typeof semanticCache.$inferInsert;

export type CacheSettingsEntry = typeof cacheSettings.$inferSelect;
export type NewCacheSettingsEntry = typeof cacheSettings.$inferInsert;

export type PromptCompressionLogEntry = typeof promptCompressionLog.$inferSelect;
export type NewPromptCompressionLogEntry = typeof promptCompressionLog.$inferInsert;

export type OptimizationSettingsEntry = typeof optimizationSettings.$inferSelect;
export type NewOptimizationSettingsEntry = typeof optimizationSettings.$inferInsert;

export type ClientInsight = typeof clientInsights.$inferSelect;
export type NewClientInsight = typeof clientInsights.$inferInsert;

export type PlatformBenchmark = typeof platformBenchmarks.$inferSelect;
export type NewPlatformBenchmark = typeof platformBenchmarks.$inferInsert;

export type AlertRule = typeof alertRules.$inferSelect;
export type NewAlertRule = typeof alertRules.$inferInsert;

export type AgentTrace = typeof agentTraces.$inferSelect;
export type NewAgentTrace = typeof agentTraces.$inferInsert;
