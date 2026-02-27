/**
 * Tests for PromptClassifier
 * Covers all three complexity levels with 3+ cases each, including edge cases.
 */
import {
  classifyPrompt,
  estimateTokens,
  countReasoningKeywords,
  countInstructions,
} from '../PromptClassifier.js';

describe('PromptClassifier', () => {
  // ============================================
  // SIMPLE prompts
  // ============================================
  describe('classifyPrompt → simple', () => {
    it('should classify a short, simple question as simple', () => {
      expect(classifyPrompt('What is the capital of France?')).toBe('simple');
    });

    it('should classify a short command as simple', () => {
      expect(classifyPrompt('Translate "hello" to Spanish.')).toBe('simple');
    });

    it('should classify an empty string as simple', () => {
      expect(classifyPrompt('')).toBe('simple');
    });

    it('should classify whitespace-only input as simple', () => {
      expect(classifyPrompt('   \n\t  ')).toBe('simple');
    });

    it('should classify null-like inputs as simple', () => {
      // Edge: might receive undefined cast to string
      expect(classifyPrompt(undefined as any)).toBe('simple');
    });

    it('should classify a short greeting as simple', () => {
      expect(classifyPrompt('Say hello in 3 languages')).toBe('simple');
    });
  });

  // ============================================
  // MEDIUM prompts
  // ============================================
  describe('classifyPrompt → medium', () => {
    it('should classify a prompt with 1 reasoning keyword as medium', () => {
      expect(classifyPrompt('Compare the two products and give me a recommendation.')).toBe('medium');
    });

    it('should classify a moderately long prompt without reasoning keywords as medium', () => {
      // > 200 tokens but < 800 tokens, no reasoning keywords
      const words = Array(180).fill('word').join(' ');
      expect(classifyPrompt(words)).toBe('medium');
    });

    it('should classify prompt with 2 reasoning keywords as medium', () => {
      expect(classifyPrompt(
        'Please evaluate this code and assess its performance. Make it better.'
      )).toBe('medium');
    });

    it('should classify prompt with negated keywords as noted but still counts them', () => {
      // "do NOT analyze" still contains "analyze" — this is intentional:
      // the heuristic doesn't do semantic negation detection
      expect(classifyPrompt('Do NOT analyze this. Just summarize briefly.')).toBe('medium');
    });
  });

  // ============================================
  // COMPLEX prompts
  // ============================================
  describe('classifyPrompt → complex', () => {
    it('should classify a very long prompt (> 800 tokens) as complex', () => {
      const words = Array(700).fill('word').join(' ');
      expect(classifyPrompt(words)).toBe('complex');
    });

    it('should classify prompt with 3+ reasoning keywords as complex', () => {
      expect(classifyPrompt(
        'Analyze the data, compare algorithms, evaluate their trade-offs, and justify your recommendation.'
      )).toBe('complex');
    });

    it('should classify multi-step numbered instructions as complex', () => {
      const prompt = `
        1. Gather all user data from the database
        2. Clean and normalize the records
        3. Generate a summary report
        4. Send the report via email
      `;
      expect(classifyPrompt(prompt)).toBe('complex');
    });

    it('should classify bullet-point instructions as complex', () => {
      const prompt = `Please do the following:
- Extract the key metrics
- Create a visualization
- Write a summary paragraph
- Send it to the team`;
      expect(classifyPrompt(prompt)).toBe('complex');
    });

    it('should classify prompt with sequential markers as complex', () => {
      expect(classifyPrompt(
        'First gather the data, then process it, next validate the results, finally generate the report.'
      )).toBe('complex');
    });

    it('should classify prompt in another language with reasoning keywords as based on keywords found', () => {
      // Mixed language: Spanish text with some English reasoning words
      expect(classifyPrompt(
        'Analyze the sistema, compare the resultados, evaluate the performance and reason about improvements.'
      )).toBe('complex');
    });
  });

  // ============================================
  // Helper function tests
  // ============================================
  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should estimate tokens roughly correctly', () => {
      // "Hello world" = 2 words × 1.3 ≈ 3
      expect(estimateTokens('Hello world')).toBeGreaterThanOrEqual(2);
      expect(estimateTokens('Hello world')).toBeLessThan(10);
    });

    it('should scale with text length', () => {
      const short = 'Hello';
      const long = Array(100).fill('Hello').join(' ');
      expect(estimateTokens(long)).toBeGreaterThan(estimateTokens(short));
    });
  });

  describe('countReasoningKeywords', () => {
    it('should return 0 for text without keywords', () => {
      expect(countReasoningKeywords('Hello, how are you?')).toBe(0);
    });

    it('should count multiple distinct keywords', () => {
      expect(countReasoningKeywords('Analyze and compare these results')).toBe(2);
    });

    it('should be case insensitive', () => {
      // "REASONING" matches both "reason" and "reasoning" keywords (substring match)
      expect(countReasoningKeywords('ANALYZE the REASONING')).toBe(3);
    });
  });

  describe('countInstructions', () => {
    it('should return 0 for plain text', () => {
      expect(countInstructions('Just a simple question please')).toBe(0);
    });

    it('should count numbered steps', () => {
      expect(countInstructions('1. Do A\n2. Do B\n3. Do C')).toBe(3);
    });

    it('should count bullet points', () => {
      expect(countInstructions('- Item A\n- Item B\n- Item C')).toBe(3);
    });
  });

  // ============================================
  // Performance test
  // ============================================
  describe('performance', () => {
    it('should classify in under 5ms', () => {
      const longPrompt = Array(1000).fill('This is a test sentence with some words.').join(' ');
      const start = performance.now();
      classifyPrompt(longPrompt);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(5);
    });
  });
});
