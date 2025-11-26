import { CostEstimationService } from '../../src/services/CostEstimationService';

describe('CostEstimationService', () => {
  describe('getModelPricing', () => {
    let service: CostEstimationService;
    let mockRuntime: any;
    let mockStore: any;

    beforeEach(() => {
      mockRuntime = {};
      mockStore = {
        getAllExecutions: jest.fn().mockResolvedValue([]),
        getCosts: jest.fn().mockResolvedValue([]),
      };
      service = new CostEstimationService(mockRuntime, mockStore);
    });

    it('returns pricing for GPT-4', () => {
      const pricing = service.getModelPricing('gpt-4');
      expect(pricing.model).toBe('gpt-4');
      expect(pricing.provider).toBe('openai');
      expect(pricing.inputCostPer1K).toBeGreaterThan(0);
      expect(pricing.outputCostPer1K).toBeGreaterThan(0);
      expect(pricing.currency).toBe('USD');
    });

    it('returns pricing for Claude models', () => {
      const pricing = service.getModelPricing('claude-3-5-sonnet-20241022');
      expect(pricing.model).toBe('claude-3-5-sonnet-20241022');
      expect(pricing.provider).toBe('anthropic');
      expect(pricing.inputCostPer1K).toBeGreaterThan(0);
      expect(pricing.outputCostPer1K).toBeGreaterThan(0);
    });

    it('returns zero cost for unknown/local models', () => {
      const pricing = service.getModelPricing('llama-3.2:1b');
      expect(pricing.provider).toBe('ollama');
      expect(pricing.inputCostPer1K).toBe(0);
      expect(pricing.outputCostPer1K).toBe(0);
    });

    it('falls back to default pricing for unknown GPT models', () => {
      const pricing = service.getModelPricing('gpt-unknown-model');
      expect(pricing.provider).toBe('openai');
      expect(pricing.inputCostPer1K).toBeGreaterThan(0);
    });

    it('handles o1 models as OpenAI provider', () => {
      const pricing = service.getModelPricing('o1-preview');
      expect(pricing.provider).toBe('openai');
    });
  });

  describe('cost calculation', () => {
    let service: CostEstimationService;
    let mockRuntime: any;
    let mockStore: any;

    beforeEach(() => {
      mockRuntime = {};
      mockStore = {
        getAllExecutions: jest.fn().mockResolvedValue([]),
        getCosts: jest.fn().mockResolvedValue([]),
      };
      service = new CostEstimationService(mockRuntime, mockStore);
    });

    it('calculates cost correctly based on token usage', () => {
      const pricing = service.getModelPricing('gpt-4');
      const inputTokens = 1000;
      const outputTokens = 500;

      const inputCost = (inputTokens / 1000) * pricing.inputCostPer1K;
      const outputCost = (outputTokens / 1000) * pricing.outputCostPer1K;
      const totalCost = inputCost + outputCost;

      expect(totalCost).toBeGreaterThan(0);
      expect(inputCost).toBeGreaterThan(0);
      expect(outputCost).toBeGreaterThan(0);
    });

    it('scales cost with token count', () => {
      const pricing = service.getModelPricing('gpt-4');
      
      const smallCost = (100 / 1000) * pricing.inputCostPer1K + (50 / 1000) * pricing.outputCostPer1K;
      const largeCost = (10000 / 1000) * pricing.inputCostPer1K + (5000 / 1000) * pricing.outputCostPer1K;

      expect(largeCost).toBeGreaterThan(smallCost);
      expect(largeCost).toBeGreaterThan(smallCost * 90);
    });

    it('different models have different pricing', () => {
      const gpt4Pricing = service.getModelPricing('gpt-4');
      const claudePricing = service.getModelPricing('claude-3-5-sonnet-20241022');
      const ollamaPricing = service.getModelPricing('llama-3.2:1b');

      expect(gpt4Pricing.inputCostPer1K).not.toBe(claudePricing.inputCostPer1K);
      expect(ollamaPricing.inputCostPer1K).toBe(0);
      expect(ollamaPricing.outputCostPer1K).toBe(0);
    });
  });

  describe('historical data handling', () => {
    it('returns null when no historical data available', async () => {
      const mockRuntime = {};
      const mockStore = {
        getAllExecutions: jest.fn().mockResolvedValue([]),
        getCosts: jest.fn().mockResolvedValue([]),
      };
      const service = new CostEstimationService(mockRuntime, mockStore);

      const result = await (service as any).getHistoricalTokenAverage('test-workflow');
      expect(result).toBeNull();
    });

    it('calculates average from historical costs', async () => {
      const mockRuntime = {};
      const mockStore = {
        getAllExecutions: jest.fn().mockResolvedValue([{}, {}]),
        getCosts: jest.fn().mockResolvedValue([
          { tokens: { promptTokens: 1000, completionTokens: 500 } },
          { tokens: { promptTokens: 2000, completionTokens: 1000 } },
        ]),
      };
      const service = new CostEstimationService(mockRuntime, mockStore);

      const result = await (service as any).getHistoricalTokenAverage('test-workflow');
      
      expect(result).not.toBeNull();
      expect(result.promptTokens).toBe(1500);
      expect(result.completionTokens).toBe(750);
      expect(result.totalTokens).toBe(2250);
    });

    it('handles errors gracefully', async () => {
      const mockRuntime = {};
      const mockStore = {
        getAllExecutions: jest.fn().mockRejectedValue(new Error('DB error')),
        getCosts: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      const service = new CostEstimationService(mockRuntime, mockStore);

      const result = await (service as any).getHistoricalTokenAverage('test-workflow');
      expect(result).toBeNull();
    });
  });
});
