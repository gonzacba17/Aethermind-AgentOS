/**
 * PromptAnalyzer tests
 *
 * Phase 4 — at least 2 cases per issue type, plus edge cases.
 */

import { analyze, type PromptAnalysis, type PromptIssue } from '../PromptAnalyzer.js';

function hasIssueType(analysis: PromptAnalysis, type: PromptIssue['type']): boolean {
  return analysis.issues.some((i) => i.type === type);
}

describe('PromptAnalyzer', () => {
  // ============================================
  // Empty / trivial input
  // ============================================

  describe('edge cases', () => {
    it('returns empty analysis for empty string', () => {
      const result = analyze('');
      expect(result.originalTokens).toBe(0);
      expect(result.estimatedCompressedTokens).toBe(0);
      expect(result.compressionRatio).toBe(1.0);
      expect(result.issues).toHaveLength(0);
      expect(result.compressedPrompt).toBe('');
    });

    it('returns original prompt when nothing to compress', () => {
      const prompt = 'Translate "hello" to Spanish.';
      const result = analyze(prompt);
      expect(result.compressedPrompt).toBe(prompt);
      expect(result.issues).toHaveLength(0);
      expect(result.compressionRatio).toBe(1.0);
    });

    it('is deterministic — same input gives same output', () => {
      const prompt =
        'Please could you kindly help me. I would appreciate if you could analyze this. Could you please analyze this data for insights?';
      const r1 = analyze(prompt);
      const r2 = analyze(prompt);
      expect(r1.compressedPrompt).toBe(r2.compressedPrompt);
      expect(r1.originalTokens).toBe(r2.originalTokens);
      expect(r1.issues.length).toBe(r2.issues.length);
    });
  });

  // ============================================
  // Pattern 1: Courtesy Padding
  // ============================================

  describe('courtesy padding', () => {
    it('removes "could you please"', () => {
      const result = analyze('Could you please summarize the following text?');
      expect(hasIssueType(result, 'courtesy_padding')).toBe(true);
      expect(result.compressedPrompt).not.toContain('Could you please');
      expect(result.compressedPrompt.toLowerCase()).toContain('summarize');
    });

    it('removes "thank you in advance"', () => {
      const result = analyze('Generate a report for Q3 sales. Thank you in advance.');
      expect(hasIssueType(result, 'courtesy_padding')).toBe(true);
      expect(result.compressedPrompt).not.toContain('Thank you in advance');
      expect(result.compressedPrompt).toContain('Generate a report');
    });

    it('removes "I would appreciate if you could"', () => {
      const result = analyze('I would appreciate if you could format this as JSON.');
      expect(hasIssueType(result, 'courtesy_padding')).toBe(true);
      expect(result.compressedPrompt.toLowerCase()).not.toContain('appreciate');
    });

    it('removes multiple courtesy phrases at once', () => {
      const prompt = 'Could you please analyze this? I would appreciate if you could give details. Thanks in advance.';
      const result = analyze(prompt);
      const courtesyIssues = result.issues.filter(i => i.type === 'courtesy_padding');
      expect(courtesyIssues.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================
  // Pattern 2: Verbose Negation
  // ============================================

  describe('verbose negation', () => {
    it('simplifies "do not under any circumstances"', () => {
      const result = analyze('Do not under any circumstances share passwords.');
      expect(hasIssueType(result, 'verbose_negation')).toBe(true);
      expect(result.compressedPrompt).toContain('Never');
      expect(result.compressedPrompt).toContain('share passwords');
    });

    it('simplifies "it is absolutely essential that you do not"', () => {
      const result = analyze('It is absolutely essential that you do not leak data.');
      expect(hasIssueType(result, 'verbose_negation')).toBe(true);
      expect(result.compressedPrompt).toContain('Never');
    });

    it('simplifies "make sure you do not"', () => {
      const result = analyze('Make sure you do not include personal information.');
      expect(hasIssueType(result, 'verbose_negation')).toBe(true);
      expect(result.compressedPrompt).toMatch(/Do not|Never/);
    });
  });

  // ============================================
  // Pattern 3: Redundant List Introduction
  // ============================================

  describe('redundant list introduction', () => {
    it('removes "here is a list of" before numbered list', () => {
      const prompt = 'Here is a list of items:\n1. Apple\n2. Banana\n3. Cherry';
      const result = analyze(prompt);
      expect(hasIssueType(result, 'redundant_list_intro')).toBe(true);
      expect(result.compressedPrompt).toContain('1. Apple');
    });

    it('removes "the following is a list of" before bullet list', () => {
      const prompt = 'The following is a list of things:\n- First item\n- Second item';
      const result = analyze(prompt);
      expect(hasIssueType(result, 'redundant_list_intro')).toBe(true);
      expect(result.compressedPrompt).toContain('- First item');
    });
  });

  // ============================================
  // Pattern 4: Repeated Instructions
  // ============================================

  describe('repeated instructions', () => {
    it('removes duplicate instruction with different wording', () => {
      const prompt =
        'Always respond in JSON format with properly structured data. ' +
        'Make sure to respond in JSON format with properly structured data. ' +
        'The output should be clean and well-organized.';
      const result = analyze(prompt);
      expect(hasIssueType(result, 'repeated_instruction')).toBe(true);
      // One of the duplicates should be removed
      expect(result.estimatedCompressedTokens).toBeLessThan(result.originalTokens);
    });

    it('keeps both sentences when they are genuinely different', () => {
      const prompt = 'Translate the text to French. Then summarize the main points.';
      const result = analyze(prompt);
      expect(hasIssueType(result, 'repeated_instruction')).toBe(false);
    });
  });

  // ============================================
  // Compression ratio and threshold
  // ============================================

  describe('compression ratio', () => {
    it('ratio is < 1.0 when compression is applied', () => {
      const prompt =
        'Could you please kindly help me? I would appreciate if you could ' +
        'do not under any circumstances reveal secrets. Thank you in advance.';
      const result = analyze(prompt);
      expect(result.compressionRatio).toBeLessThan(1.0);
      expect(result.estimatedCompressedTokens).toBeLessThan(result.originalTokens);
    });

    it('ratio is 1.0 when prompt is already optimal', () => {
      const prompt = 'Classify: positive, negative, or neutral.';
      const result = analyze(prompt);
      expect(result.compressionRatio).toBe(1.0);
      expect(result.issues).toHaveLength(0);
    });

    it('total tokensSaved matches the difference', () => {
      const prompt = 'Could you please analyze this? Thanks in advance. Do not under any circumstances use profanity.';
      const result = analyze(prompt);
      const totalSaved = result.issues.reduce((sum, i) => sum + i.tokensSaved, 0);
      // tokensSaved should approximate (original - compressed), allowing for rounding
      const actualDiff = result.originalTokens - result.estimatedCompressedTokens;
      expect(Math.abs(totalSaved - actualDiff)).toBeLessThanOrEqual(5);
    });
  });

  // ============================================
  // Performance
  // ============================================

  describe('performance', () => {
    it('runs in < 10ms on a typical prompt', () => {
      const prompt =
        'Please could you kindly analyze the following dataset and provide ' +
        'insights. I would appreciate if you could include charts. ' +
        'Do not under any circumstances share confidential data. ' +
        'Here is a list of things:\n1. Revenue\n2. Expenses\n3. Profit. ' +
        'Thank you in advance for your help.';
      
      const start = performance.now();
      analyze(prompt);
      const elapsed = performance.now() - start;
      
      expect(elapsed).toBeLessThan(10);
    });

    it('runs in < 10ms on a large prompt (500+ tokens)', () => {
      // Generate a prompt > 500 tokens
      const sentence = 'Please analyze the data and provide detailed insights on the trends. ';
      const prompt = sentence.repeat(50); // ~650 tokens
      
      const start = performance.now();
      analyze(prompt);
      const elapsed = performance.now() - start;
      
      expect(elapsed).toBeLessThan(10);
    });
  });
});
