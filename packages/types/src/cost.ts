export interface CostSummary {
  total: number;
  totalTokens: number;
  executionCount: number;
  byModel: Record<string, { count: number; tokens: number; cost: number }>;
}

export interface CostEstimate {
  workflowName: string;
  estimatedCost: number;
  currency: string;
  breakdown: StepCostEstimate[];
  tokenCount: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  confidence: 'high' | 'medium' | 'low';
  basedOn: 'historical' | 'heuristic';
  timestamp: string;
}

export interface StepCostEstimate {
  stepId: string;
  agentName: string;
  model: string;
  estimatedTokens: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  estimatedCost: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface CostInfo {
  id: string;
  executionId: string;
  agentId?: string;
  agentName?: string;
  workflowName?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: string;
}
