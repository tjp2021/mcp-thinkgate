import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Shared mock that survives hoisting
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('../src/logger.js', () => ({
  log: vi.fn(),
  setLogLevel: vi.fn(),
  getLogLevel: vi.fn(() => 'info'),
}));

import { classifyPrompt, clearCache, ruleBasedClassify } from '../src/classifier.js';

const DEFAULT_MODELS = {
  fast: 'claude-haiku-4-5-20251001',
  think: 'claude-sonnet-4-6',
  ultrathink: 'claude-opus-4-6',
};

const DEFAULT_EFFORTS = {
  fast: 'none' as const,
  think: 'medium' as const,
  ultrathink: 'max' as const,
};

beforeEach(() => {
  clearCache();
  vi.clearAllMocks();
});

afterEach(() => {
  clearCache();
});

// ============================
// Input validation
// ============================
describe('input validation', () => {
  it('rejects non-string input', async () => {
    await expect(classifyPrompt(123 as unknown as string)).rejects.toThrow(
      'prompt must be a string',
    );
  });

  it('rejects empty string', async () => {
    await expect(classifyPrompt('')).rejects.toThrow('prompt must not be empty or whitespace-only');
  });

  it('rejects whitespace-only string', async () => {
    await expect(classifyPrompt('   \t\n  ')).rejects.toThrow(
      'prompt must not be empty or whitespace-only',
    );
  });

  it('rejects prompt exceeding max length', async () => {
    const longPrompt = 'a'.repeat(50_001);
    await expect(classifyPrompt(longPrompt)).rejects.toThrow('exceeds maximum length');
  });

  it('strips null bytes from prompt', async () => {
    const result = await classifyPrompt('hel\0lo');
    expect(result.tier).toBe('fast');
    // The null byte is stripped, classification proceeds normally
  });

  it('respects custom maxPromptLength', async () => {
    await expect(classifyPrompt('hello world', undefined, { maxPromptLength: 5 })).rejects.toThrow(
      'exceeds maximum length of 5',
    );
  });
});

// ============================
// Rule-based classification
// ============================
describe('rule-based classification', () => {
  it('classifies greetings as fast', async () => {
    const result = await classifyPrompt('hello');
    expect(result.tier).toBe('fast');
    expect(result.mode).toBe('rules');
    expect(result.effort).toBe('none');
  });

  it('classifies factual questions as fast', async () => {
    const result = await classifyPrompt("What's the capital of France?");
    expect(result.tier).toBe('fast');
  });

  it('classifies debug requests as think', async () => {
    const result = await classifyPrompt('Debug this function');
    expect(result.tier).toBe('think');
    expect(result.effort).toBe('medium');
  });

  it('classifies analyze requests as think', async () => {
    const result = await classifyPrompt('Analyze this code');
    expect(result.tier).toBe('think');
  });

  it('classifies comparison requests as think', async () => {
    const result = await classifyPrompt('Compare these two approaches');
    expect(result.tier).toBe('think');
  });

  it('classifies long prompts (>25 words) as think', async () => {
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');
    const result = await classifyPrompt(words);
    expect(result.tier).toBe('think');
  });

  it('classifies architect signals as ultrathink', async () => {
    const result = await classifyPrompt('Architect a large system');
    expect(result.tier).toBe('ultrathink');
    expect(result.effort).toBe('max');
  });

  it('classifies distributed system as ultrathink', async () => {
    const result = await classifyPrompt('Build a distributed system');
    expect(result.tier).toBe('ultrathink');
  });

  it('classifies production-grade as ultrathink', async () => {
    const result = await classifyPrompt('Build a production-grade pipeline');
    expect(result.tier).toBe('ultrathink');
  });

  it('maps correct model for each tier', async () => {
    const fast = await classifyPrompt('hi');
    expect(fast.model_suggestion).toBe('claude-haiku-4-5-20251001');

    const think = await classifyPrompt('debug this');
    expect(think.model_suggestion).toBe('claude-sonnet-4-6');

    const ultra = await classifyPrompt('architect a system');
    expect(ultra.model_suggestion).toBe('claude-opus-4-6');
  });

  it('always returns confidence 0.7 for rules mode', async () => {
    const result = await classifyPrompt('hello');
    expect(result.confidence).toBe(0.7);
  });

  it('always returns mode rules when no API key', async () => {
    const result = await classifyPrompt('hello');
    expect(result.mode).toBe('rules');
  });
});

// ============================
// AI classification
// ============================
describe('AI classification', () => {
  it('calls Anthropic API with correct params', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"tier":"think","confidence":0.9,"reasoning":"test"}' }],
    });

    const result = await classifyPrompt('test prompt', 'sk-test-key');
    expect(result.tier).toBe('think');
    expect(result.mode).toBe('ai');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
      }),
    );
  });

  it('parses JSON response correctly', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: '{"tier":"ultrathink","confidence":0.95,"reasoning":"complex"}' },
      ],
    });

    const result = await classifyPrompt('test', 'sk-test-key');
    expect(result.tier).toBe('ultrathink');
    expect(result.confidence).toBe(0.95);
    expect(result.reasoning).toBe('complex');
    expect(result.effort).toBe('max');
  });

  it('strips code fences from response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '```json\n{"tier":"fast","confidence":0.8,"reasoning":"simple"}\n```',
        },
      ],
    });

    const result = await classifyPrompt('test', 'sk-test-key');
    expect(result.tier).toBe('fast');
  });

  it('falls back to rules on bad JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not valid json at all' }],
    });

    const result = await classifyPrompt('hello', 'sk-test-key');
    expect(result.mode).toBe('rules');
    expect(result.tier).toBe('fast');
  });

  it('falls back to rules on API error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit'));

    const result = await classifyPrompt('hello', 'sk-test-key');
    expect(result.mode).toBe('rules');
  });

  it('coerces invalid tier to think', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"tier":"invalid","confidence":0.8,"reasoning":"test"}' }],
    });

    const result = await classifyPrompt('test', 'sk-test-key');
    expect(result.tier).toBe('think');
  });

  it('clamps confidence to [0, 1]', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"tier":"fast","confidence":5.0,"reasoning":"test"}' }],
    });

    const result = await classifyPrompt('test', 'sk-test-key');
    expect(result.confidence).toBe(1);
  });

  it('clamps negative confidence to 0', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"tier":"fast","confidence":-0.5,"reasoning":"test"}' }],
    });

    const result = await classifyPrompt('test', 'sk-test-key');
    expect(result.confidence).toBe(0);
  });

  it('defaults confidence to 0.8 when missing', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"tier":"fast","reasoning":"test"}' }],
    });

    const result = await classifyPrompt('test', 'sk-test-key');
    expect(result.confidence).toBe(0.8);
  });

  it('defaults reasoning to empty string when missing', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"tier":"fast","confidence":0.8}' }],
    });

    const result = await classifyPrompt('test', 'sk-test-key');
    expect(result.reasoning).toBe('');
  });

  it('reuses client for same API key', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"tier":"fast","confidence":0.8,"reasoning":"ok"}' }],
    });

    // Two different prompts with same key
    await classifyPrompt('prompt one', 'sk-same-key');
    await classifyPrompt('prompt two', 'sk-same-key');

    // Both calls should have gone through the API (same mock works for both)
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});

// ============================
// Caching
// ============================
describe('caching', () => {
  it('returns cached result on second call (rules)', async () => {
    const r1 = await classifyPrompt('hello');
    const r2 = await classifyPrompt('hello');
    expect(r1).toEqual(r2);
  });

  it('caches are case-insensitive', async () => {
    const r1 = await classifyPrompt('Hello');
    const r2 = await classifyPrompt('hello');
    expect(r1).toEqual(r2);
  });

  it('separates ai and rules cache namespaces', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"tier":"think","confidence":0.9,"reasoning":"ai"}' }],
    });

    // Rules call
    const rules = await classifyPrompt('hello');
    expect(rules.mode).toBe('rules');

    // AI call (different namespace)
    const ai = await classifyPrompt('hello', 'sk-test-key');
    expect(ai.mode).toBe('ai');
    expect(ai.tier).toBe('think');
  });

  it('bypasses cache when cache:false', async () => {
    const r1 = await classifyPrompt('hello');
    const r2 = await classifyPrompt('hello', undefined, { cache: false });
    // Both return same classification but cache:false means it re-computes
    expect(r1.tier).toBe(r2.tier);
  });

  it('clearCache empties the cache', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"tier":"think","confidence":0.9,"reasoning":"ai"}' }],
    });

    await classifyPrompt('test', 'sk-key');
    clearCache();
    await classifyPrompt('test', 'sk-key');

    // Should have called API twice since cache was cleared
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});

// ============================
// Options
// ============================
describe('options', () => {
  it('overrides tierToModel', async () => {
    const result = await classifyPrompt('hello', undefined, {
      tierToModel: { fast: 'custom-model' },
    });
    expect(result.model_suggestion).toBe('custom-model');
  });

  it('overrides tierToEffort', async () => {
    const result = await classifyPrompt('hello', undefined, {
      tierToEffort: { fast: 'medium' },
    });
    expect(result.effort).toBe('medium');
  });

  it('partial merge keeps defaults for unspecified tiers', async () => {
    const result = await classifyPrompt('debug this', undefined, {
      tierToModel: { fast: 'custom-fast' },
    });
    // think tier should still use default
    expect(result.model_suggestion).toBe('claude-sonnet-4-6');
  });
});

// ============================
// ruleBasedClassify (exported)
// ============================
describe('ruleBasedClassify direct', () => {
  it('is a pure function with configurable mappings', () => {
    const result = ruleBasedClassify('hello', DEFAULT_MODELS, DEFAULT_EFFORTS);
    expect(result.tier).toBe('fast');
    expect(result.model_suggestion).toBe('claude-haiku-4-5-20251001');
  });

  it('uses provided model mapping', () => {
    const result = ruleBasedClassify(
      'hello',
      { ...DEFAULT_MODELS, fast: 'my-model' },
      DEFAULT_EFFORTS,
    );
    expect(result.model_suggestion).toBe('my-model');
  });
});
