import { z } from 'zod';

export const CreateAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  model: z.string().min(1, 'Model is required'),
  provider: z.enum(['openai', 'anthropic', 'google', 'ollama'], {
    errorMap: () => ({ message: 'Provider must be one of: openai, anthropic, google, ollama' }),
  }),
  config: z.record(z.unknown()).optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0, 'Temperature must be >= 0').max(2, 'Temperature must be <= 2').optional(),
  maxTokens: z.number().int('Max tokens must be an integer').positive('Max tokens must be positive').optional(),
});

export const UpdateAgentSchema = CreateAgentSchema.partial();

export const PaginationSchema = z.object({
  offset: z.coerce.number().int().min(0, 'Offset must be >= 0').default(0),
  limit: z.coerce.number().int().min(1, 'Limit must be >= 1').max(1000, 'Limit must be <= 1000').default(100),
});

export const ExecuteAgentSchema = z.object({
  input: z.unknown(),
  context: z.record(z.unknown()).optional(),
  stream: z.boolean().optional(),
});

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().optional(),
  steps: z.array(
    z.object({
      id: z.string().min(1, 'Step ID is required'),
      agent: z.string().min(1, 'Agent name is required'),
      input: z.unknown().optional(),
      dependsOn: z.array(z.string()).optional(),
    })
  ).min(1, 'At least one step is required'),
  config: z.record(z.unknown()).optional(),
});

export const UpdateWorkflowSchema = CreateWorkflowSchema.partial().extend({
  steps: z.array(
    z.object({
      id: z.string().min(1),
      agent: z.string().min(1),
      input: z.unknown().optional(),
      dependsOn: z.array(z.string()).optional(),
    })
  ).optional(),
});

export const LogFilterSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  agentId: z.string().optional(),
  executionId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export const CostFilterSchema = z.object({
  executionId: z.string().optional(),
  model: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export const IdParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type ExecuteAgentInput = z.infer<typeof ExecuteAgentSchema>;
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowSchema>;
export type LogFilter = z.infer<typeof LogFilterSchema>;
export type CostFilter = z.infer<typeof CostFilterSchema>;
export type IdParam = z.infer<typeof IdParamSchema>;
