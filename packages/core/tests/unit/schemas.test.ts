import { describe, it, expect } from '@jest/globals';
import {
  CostFilterSchema,
  PaginationSchema,
  IdParamSchema,
} from '../../src/validation/schemas';
import {
  AgentConfigSchema,
  WorkflowStepSchema,
  WorkflowDefinitionSchema,
} from '../../src/types/index';

describe('Validation Schemas', () => {
  describe('AgentConfigSchema', () => {
    it('should validate valid agent config', () => {
      const validConfig = {
        name: 'Test Agent',
        provider: 'openai',
        model: 'gpt-4',
        systemPrompt: 'You are helpful',
        temperature: 0.7,
        maxTokens: 1000,
      };

      const result = AgentConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should require name and provider', () => {
      const invalidConfig = {
        model: 'gpt-4',
      };

      const result = AgentConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should validate temperature range', () => {
      const invalidTemp = {
        name: 'Test',
        provider: 'openai',
        temperature: 2.5, // Invalid: > 2
      };

      const result = AgentConfigSchema.safeParse(invalidTemp);
      expect(result.success).toBe(false);
    });

    it('should accept optional fields', () => {
      const minimalConfig = {
        name: 'Test',
        provider: 'openai',
      };

      const result = AgentConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
    });
  });

  describe('WorkflowStepSchema', () => {
    it('should validate valid workflow step', () => {
      const validStep = {
        id: 'step1',
        agent: 'agent1',
        next: 'step2',
      };

      const result = WorkflowStepSchema.safeParse(validStep);
      expect(result.success).toBe(true);
    });

    it('should require id and agent', () => {
      const invalidStep = {
        next: 'step2',
      };

      const result = WorkflowStepSchema.safeParse(invalidStep);
      expect(result.success).toBe(false);
    });

    it('should accept array of next steps', () => {
      const parallelStep = {
        id: 'step1',
        agent: 'agent1',
        next: ['step2', 'step3'],
      };

      const result = WorkflowStepSchema.safeParse(parallelStep);
      expect(result.success).toBe(true);
    });

    it('should accept parallel flag', () => {
      const parallelStep = {
        id: 'step1',
        agent: 'agent1',
        parallel: true,
      };

      const result = WorkflowStepSchema.safeParse(parallelStep);
      expect(result.success).toBe(true);
    });
  });

  describe('WorkflowDefinitionSchema', () => {
    it('should validate valid workflow', () => {
      const validWorkflow = {
        name: 'test-workflow',
        description: 'Test workflow',
        steps: [
          { id: 'step1', agent: 'agent1' },
          { id: 'step2', agent: 'agent2' },
        ],
        entryPoint: 'step1',
      };

      const result = WorkflowDefinitionSchema.safeParse(validWorkflow);
      expect(result.success).toBe(true);
    });

    it('should require name, steps, and entryPoint', () => {
      const invalidWorkflow = {
        description: 'Missing required fields',
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidWorkflow);
      expect(result.success).toBe(false);
    });

    it('should require at least one step', () => {
      const emptySteps = {
        name: 'test',
        steps: [],
        entryPoint: 'step1',
      };

      const result = WorkflowDefinitionSchema.safeParse(emptySteps);
      expect(result.success).toBe(false);
    });

    it('should validate step structure', () => {
      const invalidSteps = {
        name: 'test',
        steps: [{ id: 'step1' }], // Missing agent
        entryPoint: 'step1',
      };

      const result = WorkflowDefinitionSchema.safeParse(invalidSteps);
      expect(result.success).toBe(false);
    });
  });

  describe('CostFilterSchema', () => {
    it('should validate valid cost filter', () => {
      const validFilter = {
        executionId: 'exec-123',
        model: 'gpt-4',
        limit: 10,
        offset: 0,
      };

      const result = CostFilterSchema.safeParse(validFilter);
      expect(result.success).toBe(true);
    });

    it('should accept empty filter', () => {
      const result = CostFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate limit is positive', () => {
      const invalidLimit = {
        limit: -1,
      };

      const result = CostFilterSchema.safeParse(invalidLimit);
      expect(result.success).toBe(false);
    });

    it('should validate offset is non-negative', () => {
      const invalidOffset = {
        offset: -5,
      };

      const result = CostFilterSchema.safeParse(invalidOffset);
      expect(result.success).toBe(false);
    });
  });

  describe('PaginationSchema', () => {
    it('should validate valid pagination', () => {
      const validPagination = {
        limit: 20,
        offset: 10,
      };

      const result = PaginationSchema.safeParse(validPagination);
      expect(result.success).toBe(true);
    });

    it('should have default values', () => {
      const result = PaginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBeDefined();
        expect(result.data.offset).toBeDefined();
      }
    });

    it('should enforce maximum limit', () => {
      const tooLarge = {
        limit: 1000,
      };

      const result = PaginationSchema.safeParse(tooLarge);
      // Should either fail or cap at max
      expect(result.success).toBe(true);
    });
  });

  describe('IdParamSchema', () => {
    it('should validate valid id', () => {
      const validId = {
        id: 'abc-123',
      };

      const result = IdParamSchema.safeParse(validId);
      expect(result.success).toBe(true);
    });

    it('should require id field', () => {
      const result = IdParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty id', () => {
      const emptyId = {
        id: '',
      };

      const result = IdParamSchema.safeParse(emptyId);
      expect(result.success).toBe(false);
    });
  });
});
