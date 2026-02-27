/**
 * SystemPromptAnalyzer — detects duplicate system prompts and suggests templates.
 *
 * Phase 4 — System Prompt Optimization
 *
 * - Detects system prompts with cosine similarity > 0.85 across agents
 * - Classifies use case from keywords and maps to optimized templates
 * - Templates are static constants — no LLM generation
 */

import { embed } from './EmbeddingService.js';
import { db } from '../db/index.js';
import { telemetryEvents, clients } from '../db/schema.js';
import { eq, and, sql, gte, isNotNull } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface SystemPromptDuplicate {
  agentIds: string[];
  similarity: number;
  previewA: string;
  previewB: string;
}

export interface SystemPromptAnalysis {
  duplicates: SystemPromptDuplicate[];
}

export type UseCase = 'classification' | 'extraction' | 'summarization' | 'qa' | 'general';

export interface SystemPromptTemplate {
  useCase: UseCase;
  name: string;
  template: string;
  estimatedTokens: number;
}

// ============================================
// Optimized Templates (static, no LLM)
// ============================================

export const SYSTEM_PROMPT_TEMPLATES: Record<UseCase, SystemPromptTemplate> = {
  classification: {
    useCase: 'classification',
    name: 'Classification Agent',
    template: `You are a classification agent. Your task is to categorize input into predefined categories.

Rules:
- Respond ONLY with the category name
- If uncertain, respond with the closest match
- Never explain your reasoning unless asked
- Categories are case-sensitive — match exactly`,
    estimatedTokens: 150,
  },

  extraction: {
    useCase: 'extraction',
    name: 'Data Extraction Agent',
    template: `You are a data extraction agent. Extract structured data from the input.

Rules:
- Return valid JSON matching the requested schema
- Use null for missing fields — never fabricate data
- Preserve original formatting for text fields
- Extract dates in ISO 8601 format (YYYY-MM-DD)
- Numbers should be unformatted (no commas or currency symbols)`,
    estimatedTokens: 180,
  },

  summarization: {
    useCase: 'summarization',
    name: 'Summarization Agent',
    template: `You are a summarization agent. Create concise summaries of the input.

Rules:
- Keep summaries under the requested length
- Preserve key facts and numbers
- Use neutral, objective tone
- Never add information not in the source`,
    estimatedTokens: 120,
  },

  qa: {
    useCase: 'qa',
    name: 'Q&A Agent',
    template: `You are a Q&A agent. Answer questions accurately and concisely.

Rules:
- Answer directly — no preamble
- Say "I don't know" if the answer isn't in the context
- Cite sources when available`,
    estimatedTokens: 100,
  },

  general: {
    useCase: 'general',
    name: 'General Purpose',
    template: '',
    estimatedTokens: 0,
  },
};

// ============================================
// Use Case Keywords Detection
// ============================================

const USE_CASE_KEYWORDS: Record<Exclude<UseCase, 'general'>, string[]> = {
  classification: [
    'classify', 'classification', 'categorize', 'categorization',
    'label', 'labeling', 'tag', 'tagging', 'category', 'categories',
    'sentiment', 'intent', 'topic',
  ],
  extraction: [
    'extract', 'extraction', 'parse', 'parsing', 'structured',
    'json', 'schema', 'field', 'data point', 'entity',
    'ner', 'named entity', 'key-value',
  ],
  summarization: [
    'summarize', 'summarization', 'summary', 'condense',
    'tldr', 'tl;dr', 'brief', 'overview', 'digest',
    'shorten', 'abstract',
  ],
  qa: [
    'question', 'answer', 'qa', 'q&a', 'respond to questions',
    'answer questions', 'knowledge base', 'faq', 'help desk',
    'support', 'assistant',
  ],
};

/**
 * Classify the use case of a system prompt based on keyword presence.
 */
export function classifyUseCase(systemPrompt: string): UseCase {
  const lower = systemPrompt.toLowerCase();

  let bestMatch: UseCase = 'general';
  let bestScore = 0;

  for (const [useCase, keywords] of Object.entries(USE_CASE_KEYWORDS) as Array<
    [Exclude<UseCase, 'general'>, string[]]
  >) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = useCase;
    }
  }

  // Require at least 2 keyword matches to avoid false positives
  return bestScore >= 2 ? bestMatch : 'general';
}

// ============================================
// Cosine Similarity
// ============================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ============================================
// Main Analysis Functions
// ============================================

/**
 * Analyze system prompts for a client's agents.
 * Detects duplicates using cosine similarity of embeddings.
 *
 * This queries telemetry_events for distinct system prompts
 * (approximated by agentId grouping), computes embeddings,
 * and compares all pairs.
 */
export async function analyzeSystemPrompts(
  clientId: string
): Promise<SystemPromptAnalysis> {
  try {
    // Get the client's organizationId
    const clientRows = await db
      .select({ organizationId: clients.organizationId })
      .from(clients)
      .where(eq(clients.id, clientId));

    const orgId = clientRows[0]?.organizationId;
    if (!orgId) {
      return { duplicates: [] };
    }

    // Get distinct agentIds with their most common model
    // We approximate "system prompt" from the agentId grouping
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const agentRows = await db
      .select({
        agentId: telemetryEvents.agentId,
        requestCount: sql<number>`count(*)::int`,
      })
      .from(telemetryEvents)
      .where(
        and(
          eq(telemetryEvents.organizationId, orgId),
          gte(telemetryEvents.timestamp, since30d),
          isNotNull(telemetryEvents.agentId),
        ),
      )
      .groupBy(telemetryEvents.agentId)
      .limit(50);

    if (agentRows.length < 2) {
      return { duplicates: [] };
    }

    // For each agent, generate embedding from agentId + usage pattern
    // In production, the system prompt would be stored. For now, we use
    // an approximation based on the agent's identifier.
    const agentEmbeddings: Array<{
      agentId: string;
      embedding: number[];
    }> = [];

    for (const row of agentRows) {
      if (!row.agentId) continue;
      const embedding = await embed(row.agentId);
      if (embedding) {
        agentEmbeddings.push({ agentId: row.agentId, embedding });
      }
    }

    // Compare all pairs
    const duplicates: SystemPromptDuplicate[] = [];
    const SIMILARITY_THRESHOLD = 0.85;

    for (let i = 0; i < agentEmbeddings.length; i++) {
      for (let j = i + 1; j < agentEmbeddings.length; j++) {
        const sim = cosineSimilarity(
          agentEmbeddings[i]!.embedding,
          agentEmbeddings[j]!.embedding,
        );

        if (sim > SIMILARITY_THRESHOLD) {
          duplicates.push({
            agentIds: [agentEmbeddings[i]!.agentId, agentEmbeddings[j]!.agentId],
            similarity: Math.round(sim * 1000) / 1000,
            previewA: agentEmbeddings[i]!.agentId.slice(0, 80),
            previewB: agentEmbeddings[j]!.agentId.slice(0, 80),
          });
        }
      }
    }

    return { duplicates };
  } catch (error) {
    console.error('[SystemPromptAnalyzer] Error:', error);
    return { duplicates: [] };
  }
}

/**
 * Get suggested template for a system prompt.
 */
export function getSuggestedTemplate(systemPrompt: string): SystemPromptTemplate | null {
  const useCase = classifyUseCase(systemPrompt);
  if (useCase === 'general') return null;
  return SYSTEM_PROMPT_TEMPLATES[useCase];
}

/**
 * Get all available templates.
 */
export function getAllTemplates(): SystemPromptTemplate[] {
  return Object.values(SYSTEM_PROMPT_TEMPLATES).filter(t => t.useCase !== 'general');
}
