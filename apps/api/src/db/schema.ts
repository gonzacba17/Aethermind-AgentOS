import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  timestamp, 
  boolean, 
  integer, 
  json,
  decimal,
  index,
} from 'drizzle-orm/pg-core';

// ============================================
// ORGANIZATIONS TABLE
// ============================================
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  apiKeyHash: varchar('api_key_hash', { length: 255 }).notNull().unique(),
  plan: varchar('plan', { length: 50 }).default('FREE').notNull(),
  rateLimitPerMin: integer('rate_limit_per_min').default(100).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  apiKeyIdx: index('idx_organizations_api_key').on(table.apiKeyHash),
  planIdx: index('idx_organizations_plan').on(table.plan),
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
  apiKey: varchar('api_key', { length: 255 }).notNull().unique(),
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
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  apiKeyIdx: index('idx_users_api_key').on(table.apiKey),
  planIdx: index('idx_users_plan').on(table.plan),
  googleIdIdx: index('idx_users_google_id').on(table.googleId),
  githubIdIdx: index('idx_users_github_id').on(table.githubId),
  orgIdIdx: index('idx_users_organization_id').on(table.organizationId),
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
}, (table) => ({
  userIdIdx: index('idx_agents_user_id').on(table.userId),
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
}, (table) => ({
  userIdIdx: index('idx_executions_user_id').on(table.userId),
  agentIdIdx: index('idx_executions_agent_id').on(table.agentId),
  statusIdx: index('idx_executions_status').on(table.status),
  startedAtIdx: index('idx_executions_started_at').on(table.startedAt),
  agentStatusIdx: index('idx_executions_agent_status').on(table.agentId, table.status),
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
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => ({
  orgTimeIdx: index('idx_telemetry_org_time').on(table.organizationId, table.timestamp),
  providerModelIdx: index('idx_telemetry_provider_model').on(table.provider, table.model),
  statusIdx: index('idx_telemetry_status').on(table.status),
  createdAtIdx: index('idx_telemetry_created_at').on(table.createdAt),
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
