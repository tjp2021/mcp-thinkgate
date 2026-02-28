import { describe, it, expect } from 'vitest';
import { formatClassificationOutput, validateToolRequest } from '../src/handlers.js';
import type { ClassificationResult } from '../src/classifier.js';

describe('formatClassificationOutput', () => {
  it('formats a fast/rules result', () => {
    const result: ClassificationResult = {
      tier: 'fast',
      effort: 'none',
      model_suggestion: 'claude-haiku-4-5-20251001',
      confidence: 0.7,
      reasoning: 'Rule-based: short or simple query',
      mode: 'rules',
    };
    const output = formatClassificationOutput(result);
    expect(output).toContain('**Tier:** fast');
    expect(output).toContain('**Effort:** none');
    expect(output).toContain('**Confidence:** 70%');
    expect(output).toContain('Rule-based (no API key)');
    expect(output).toContain('"type": "disabled"');
  });

  it('formats a think/ai result', () => {
    const result: ClassificationResult = {
      tier: 'think',
      effort: 'medium',
      model_suggestion: 'claude-sonnet-4-6',
      confidence: 0.92,
      reasoning: 'Requires structured reasoning',
      mode: 'ai',
    };
    const output = formatClassificationOutput(result);
    expect(output).toContain('**Tier:** think');
    expect(output).toContain('**Effort:** medium');
    expect(output).toContain('**Confidence:** 92%');
    expect(output).toContain('AI (Haiku)');
    expect(output).toContain('"effort": "medium"');
  });

  it('formats an ultrathink result with max effort', () => {
    const result: ClassificationResult = {
      tier: 'ultrathink',
      effort: 'max',
      model_suggestion: 'claude-opus-4-6',
      confidence: 0.85,
      reasoning: 'Deep architecture problem',
      mode: 'ai',
    };
    const output = formatClassificationOutput(result);
    expect(output).toContain('**Tier:** ultrathink');
    expect(output).toContain('"effort": "max"');
  });
});

describe('validateToolRequest', () => {
  it('returns prompt for valid request', () => {
    const result = validateToolRequest('classify_complexity', { prompt: 'hello' });
    expect(result).toBe('hello');
  });

  it('throws for unknown tool name', () => {
    expect(() => validateToolRequest('unknown_tool', { prompt: 'hello' })).toThrow(
      'Unknown tool: unknown_tool',
    );
  });

  it('throws for missing prompt', () => {
    expect(() => validateToolRequest('classify_complexity', {})).toThrow(
      'prompt must be a non-empty string',
    );
  });

  it('throws for non-string prompt', () => {
    expect(() => validateToolRequest('classify_complexity', { prompt: 123 })).toThrow(
      'prompt must be a non-empty string',
    );
  });

  it('throws for undefined args', () => {
    expect(() => validateToolRequest('classify_complexity', undefined)).toThrow(
      'prompt must be a non-empty string',
    );
  });
});
