/**
 * PromptAnalyzer — rule-based prompt compression engine.
 *
 * Design principles:
 * - Deterministic: same input → same output (no LLM involvement)
 * - Fast: < 10ms synchronous, no I/O
 * - Conservative: only removes obvious redundancy, never alters meaning
 * - Ordered: patterns applied in order of impact (highest savings first)
 *
 * Phase 4 — Prompt Optimization
 */

import { estimateTokens } from './PromptClassifier.js';

// ============================================
// Types
// ============================================

export interface PromptIssue {
  type:
    | 'repeated_instruction'
    | 'courtesy_padding'
    | 'context_redundancy'
    | 'verbose_negation'
    | 'redundant_list_intro';
  description: string;
  originalSnippet: string;
  fixedSnippet: string;
  tokensSaved: number;
}

export interface PromptAnalysis {
  originalTokens: number;
  estimatedCompressedTokens: number;
  compressionRatio: number; // 0.0–1.0, lower = more compressible
  issues: PromptIssue[];
  compressedPrompt: string;
}

// ============================================
// Pattern 1: Courtesy Padding
// ============================================

/**
 * Phrases that add no information to the prompt.
 * Sorted by length descending so longer matches are found first.
 */
const COURTESY_PHRASES: readonly string[] = [
  'i would really appreciate it if you could',
  'i would appreciate it if you could',
  'i would appreciate if you could',
  'if you could please be so kind as to',
  'would it be possible for you to',
  'i was wondering if you could',
  'i would like you to please',
  'could you please be so kind as to',
  'it would be great if you could',
  'thank you very much in advance',
  'thank you so much in advance',
  'i would be grateful if you',
  'could you kindly',
  'could you please',
  'would you kindly',
  'would you please',
  'please kindly',
  'thank you in advance',
  'thanks in advance',
  'i appreciate your help',
  'thank you for your help',
  'if you don\'t mind',
  'if it\'s not too much trouble',
] as const;

function removeCourtesyPadding(text: string): { text: string; issues: PromptIssue[] } {
  const issues: PromptIssue[] = [];
  let result = text;

  for (const phrase of COURTESY_PHRASES) {
    const regex = new RegExp(escapeRegex(phrase) + '[.,;!?]*\\s*', 'gi');
    const matches = result.match(regex);
    if (matches) {
      for (const match of matches) {
        const before = estimateTokens(match);
        issues.push({
          type: 'courtesy_padding',
          description: `Removed courtesy phrase: "${match.trim()}"`,
          originalSnippet: match.trim(),
          fixedSnippet: '',
          tokensSaved: before,
        });
      }
      result = result.replace(regex, '');
    }
  }

  // Clean up double spaces left after removals
  result = result.replace(/\s{2,}/g, ' ').trim();

  return { text: result, issues };
}

// ============================================
// Pattern 2: Verbose Negation
// ============================================

const VERBOSE_NEGATIONS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bdo not under any circumstances\b/gi, replacement: 'Never' },
  { pattern: /\bunder no circumstances should you\b/gi, replacement: 'Never' },
  { pattern: /\bunder no circumstances\b/gi, replacement: 'Never' },
  { pattern: /\byou must not ever\b/gi, replacement: 'Never' },
  { pattern: /\byou should never ever\b/gi, replacement: 'Never' },
  { pattern: /\byou must never ever\b/gi, replacement: 'Never' },
  { pattern: /\bdo not ever\b/gi, replacement: 'Never' },
  { pattern: /\byou absolutely must not\b/gi, replacement: 'Never' },
  { pattern: /\bit is absolutely essential that you do not\b/gi, replacement: 'Never' },
  { pattern: /\bit is critical that you do not\b/gi, replacement: 'Never' },
  { pattern: /\bit is important that you do not\b/gi, replacement: 'Do not' },
  { pattern: /\bmake sure you do not\b/gi, replacement: 'Do not' },
  { pattern: /\bensure that you do not\b/gi, replacement: 'Do not' },
  { pattern: /\bplease make sure to never\b/gi, replacement: 'Never' },
  { pattern: /\bplease ensure you never\b/gi, replacement: 'Never' },
];

function compressNegations(text: string): { text: string; issues: PromptIssue[] } {
  const issues: PromptIssue[] = [];
  let result = text;

  for (const { pattern, replacement } of VERBOSE_NEGATIONS) {
    const matches = result.match(pattern);
    if (matches) {
      for (const match of matches) {
        const savedTokens = estimateTokens(match) - estimateTokens(replacement);
        if (savedTokens > 0) {
          issues.push({
            type: 'verbose_negation',
            description: `Simplified negation: "${match}" → "${replacement}"`,
            originalSnippet: match,
            fixedSnippet: replacement,
            tokensSaved: savedTokens,
          });
        }
      }
      result = result.replace(pattern, replacement);
    }
  }

  return { text: result, issues };
}

// ============================================
// Pattern 3: Redundant List Introductions
// ============================================

const LIST_INTRO_PATTERNS: RegExp[] = [
  /(?:here is a list of|the following is a list of|below is a list of|here are the|the following are the|listed below are the|below are the)\s*(?:items|things|elements|points|steps)?:?\s*\n/gi,
  /(?:here is the list|the list is as follows|as follows):?\s*\n/gi,
];

function removeRedundantListIntros(text: string): { text: string; issues: PromptIssue[] } {
  const issues: PromptIssue[] = [];
  let result = text;

  for (const pattern of LIST_INTRO_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = result.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Only remove if followed by a numbered/bulleted list
        const afterMatch = result.slice(result.indexOf(match) + match.length);
        if (/^\s*(?:\d+[.)]\s|[-*•]\s)/.test(afterMatch)) {
          const savedTokens = estimateTokens(match);
          issues.push({
            type: 'redundant_list_intro',
            description: `Removed redundant list introduction: "${match.trim()}"`,
            originalSnippet: match.trim(),
            fixedSnippet: '',
            tokensSaved: savedTokens,
          });
        }
      }
      // Only replace if followed by list markers
      result = result.replace(pattern, (match, offset) => {
        const after = result.slice(offset + match.length);
        if (/^\s*(?:\d+[.)]\s|[-*•]\s)/.test(after)) {
          return '\n';
        }
        return match;
      });
    }
  }

  return { text: result, issues };
}

// ============================================
// Pattern 4: Repeated Instructions
// ============================================

/**
 * Detect repeated instructions by splitting on sentence boundaries
 * and comparing normalized forms. If two sentences convey the same
 * instruction, keep only the shorter one.
 */
function removeRepeatedInstructions(text: string): { text: string; issues: PromptIssue[] } {
  const issues: PromptIssue[] = [];

  // Split into sentences (rough heuristic)
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length < 2) {
    return { text, issues };
  }

  // Normalize sentence for comparison
  const normalize = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const seen = new Map<string, { original: string; index: number }>();
  const toRemove = new Set<number>();

  for (let i = 0; i < sentences.length; i++) {
    const normalized = normalize(sentences[i]!);
    if (normalized.length < 10) continue; // Skip very short sentences

    // Extract "key words" (stop words removed) for fuzzy matching
    const keywords = extractKeywords(normalized);
    if (keywords.length < 3) continue;
    const keyStr = keywords.join(' ');

    const existing = seen.get(keyStr);
    if (existing) {
      // Duplicate found — keep the shorter one
      const existingSentence = existing.original;
      const currentSentence = sentences[i]!;

      if (currentSentence.length <= existingSentence.length) {
        // Current is shorter — remove the earlier one
        toRemove.add(existing.index);
        seen.set(keyStr, { original: currentSentence, index: i });

        issues.push({
          type: 'repeated_instruction',
          description: `Removed repeated instruction (kept shorter version)`,
          originalSnippet: existingSentence,
          fixedSnippet: '',
          tokensSaved: estimateTokens(existingSentence),
        });
      } else {
        // Existing is shorter — remove the current one
        toRemove.add(i);
        issues.push({
          type: 'repeated_instruction',
          description: `Removed repeated instruction (kept shorter version)`,
          originalSnippet: currentSentence,
          fixedSnippet: '',
          tokensSaved: estimateTokens(currentSentence),
        });
      }
    } else {
      seen.set(keyStr, { original: sentences[i]!, index: i });
    }
  }

  if (toRemove.size === 0) {
    return { text, issues };
  }

  const result = sentences
    .filter((_, i) => !toRemove.has(i))
    .join(' ');

  return { text: result, issues };
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'to', 'of', 'in',
  'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'this', 'that', 'these',
  'those', 'it', 'its', 'and', 'but', 'or', 'not', 'no', 'so', 'if',
  'then', 'than', 'too', 'very', 'just', 'about', 'also', 'please',
  'you', 'your', 'i', 'me', 'my', 'we', 'our',
]);

function extractKeywords(normalized: string): string[] {
  return normalized
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .sort();
}

// ============================================
// Pattern 5: Context Redundancy (system vs user)
// ============================================

/**
 * Detect when the same block of text (>20 tokens) appears 
 * in both the system prompt and the user prompt.
 * Only applicable when the prompt is a concatenation: "system user".
 * 
 * For SDK usage, the prompt comes pre-concatenated as "system user".
 * We look for repeated blocks within the text.
 */
function removeContextRedundancy(text: string): { text: string; issues: PromptIssue[] } {
  const issues: PromptIssue[] = [];

  // Find long repeated substrings (>20 tokens = roughly >80 chars)
  const MIN_BLOCK_CHARS = 80;
  const words = text.split(/\s+/);

  if (words.length < 40) {
    // Too short for meaningful redundancy detection
    return { text, issues };
  }

  // Sliding window approach: build n-grams (window of 10 words)
  const WINDOW_SIZE = 10;
  const ngramPositions = new Map<string, number[]>();

  for (let i = 0; i <= words.length - WINDOW_SIZE; i++) {
    const ngram = words.slice(i, i + WINDOW_SIZE).join(' ').toLowerCase();
    const positions = ngramPositions.get(ngram);
    if (positions) {
      positions.push(i);
    } else {
      ngramPositions.set(ngram, [i]);
    }
  }

  // Find duplicate ngrams that are far apart (different parts of the prompt)
  const duplicateRanges: Array<{ start: number; end: number }> = [];

  for (const [, positions] of ngramPositions) {
    if (positions.length < 2) continue;

    // Only consider duplicates that are far apart (>30% of text apart)
    const minDistance = Math.floor(words.length * 0.3);
    for (let i = 0; i < positions.length - 1; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        if (Math.abs(positions[j]! - positions[i]!) >= minDistance) {
          // Try to extend the duplicate block
          let start1 = positions[i]!;
          let start2 = positions[j]!;
          let len = WINDOW_SIZE;

          while (
            start1 + len < words.length &&
            start2 + len < words.length &&
            words[start1 + len]?.toLowerCase() === words[start2 + len]?.toLowerCase()
          ) {
            len++;
          }

          const blockText = words.slice(start2, start2 + len).join(' ');
          if (blockText.length >= MIN_BLOCK_CHARS) {
            duplicateRanges.push({ start: start2, end: start2 + len });
          }
        }
      }
    }
  }

  if (duplicateRanges.length === 0) {
    return { text, issues };
  }

  // Merge overlapping ranges
  const sorted = duplicateRanges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]!;
    const curr = sorted[i]!;
    if (curr.start <= last.end) {
      last.end = Math.max(last.end, curr.end);
    } else {
      merged.push(curr);
    }
  }

  // Remove the second occurrence (keep the first)
  const removeIndices = new Set<number>();
  for (const range of merged) {
    for (let i = range.start; i < range.end; i++) {
      removeIndices.add(i);
    }
  }

  const removedText = words
    .filter((_, i) => removeIndices.has(i))
    .join(' ');
  const savedTokens = estimateTokens(removedText);

  if (savedTokens > 0) {
    issues.push({
      type: 'context_redundancy',
      description: `Removed ${savedTokens} redundant tokens duplicated across prompt sections`,
      originalSnippet: removedText.slice(0, 100) + (removedText.length > 100 ? '...' : ''),
      fixedSnippet: '',
      tokensSaved: savedTokens,
    });
  }

  const result = words
    .filter((_, i) => !removeIndices.has(i))
    .join(' ');

  return { text: result, issues };
}

// ============================================
// Main Analyzer
// ============================================

/**
 * Analyze and optionally compress a prompt.
 *
 * Applies compression rules in order of impact:
 * 1. Repeated instructions (highest token savings)
 * 2. Courtesy padding
 * 3. Context redundancy
 * 4. Verbose negations
 * 5. Redundant list introductions
 *
 * Performance: < 10ms on typical prompts, synchronous, no I/O.
 */
export function analyze(prompt: string): PromptAnalysis {
  if (!prompt || prompt.trim().length === 0) {
    return {
      originalTokens: 0,
      estimatedCompressedTokens: 0,
      compressionRatio: 1.0,
      issues: [],
      compressedPrompt: '',
    };
  }

  const originalTokens = estimateTokens(prompt);
  const allIssues: PromptIssue[] = [];

  // Apply patterns in order
  let current = prompt;

  // 1. Repeated instructions
  const r1 = removeRepeatedInstructions(current);
  current = r1.text;
  allIssues.push(...r1.issues);

  // 2. Courtesy padding
  const r2 = removeCourtesyPadding(current);
  current = r2.text;
  allIssues.push(...r2.issues);

  // 3. Context redundancy
  const r3 = removeContextRedundancy(current);
  current = r3.text;
  allIssues.push(...r3.issues);

  // 4. Verbose negations
  const r4 = compressNegations(current);
  current = r4.text;
  allIssues.push(...r4.issues);

  // 5. Redundant list introductions
  const r5 = removeRedundantListIntros(current);
  current = r5.text;
  allIssues.push(...r5.issues);

  // Final cleanup
  current = current.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  const estimatedCompressedTokens = estimateTokens(current);
  const compressionRatio =
    originalTokens > 0 ? estimatedCompressedTokens / originalTokens : 1.0;

  return {
    originalTokens,
    estimatedCompressedTokens,
    compressionRatio,
    issues: allIssues,
    compressedPrompt: current,
  };
}

// ============================================
// Helpers
// ============================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
