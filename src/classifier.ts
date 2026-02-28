import Anthropic from '@anthropic-ai/sdk';
import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import { log } from './logger.js';

export type Tier = 'fast' | 'think' | 'ultrathink';
export type Effort = 'none' | 'medium' | 'max';

export interface ClassificationResult {
  tier: Tier;
  effort: Effort;
  model_suggestion: string;
  confidence: number;
  reasoning: string;
  mode: 'ai' | 'rules';
}

export interface ClassifierOptions {
  tierToModel?: Partial<Record<Tier, string>>;
  tierToEffort?: Partial<Record<Tier, Effort>>;
  cache?: boolean;
  maxPromptLength?: number;
}

const DEFAULT_TIER_TO_EFFORT: Record<Tier, Effort> = {
  fast: 'none',
  think: 'medium',
  ultrathink: 'max',
};

const DEFAULT_TIER_TO_MODEL: Record<Tier, string> = {
  fast: 'claude-haiku-4-5-20251001',
  think: 'claude-sonnet-4-6',
  ultrathink: 'claude-opus-4-6',
};

const DEFAULT_MAX_PROMPT_LENGTH = 50_000;

const CLASSIFIER_SYSTEM_PROMPT = `You are a reasoning complexity classifier. Your job is to read a prompt and decide how much thinking it needs.

Classify into exactly one tier:

FAST — No extended reasoning needed. Simple, direct, or conversational.
Examples: "What's the capital of France?", "Fix this typo", "Translate this to Spanish", "Summarize this paragraph", "What does this error mean?", "Write a short bio", "Format this JSON"

THINK — Benefits from structured reasoning. Analytical, design-oriented, or multi-step.
Examples: "Debug why this algorithm is slow", "Design an API for a todo app", "Compare these two approaches", "Write a comprehensive test suite", "Explain the trade-offs of X vs Y", "Refactor this module", "Review this code for issues"

ULTRATHINK — Requires deep, extended reasoning. Highly complex, open-ended, or architecturally significant.
Examples: "Architect a system handling 10M users", "Prove this is O(n log n)", "Design a complete auth system from scratch", "Analyze all failure modes of this distributed design", "Build a production-grade pipeline for X", "What are the second-order effects of Y on Z"

Rules:
- When in doubt between FAST and THINK, choose THINK
- When in doubt between THINK and ULTRATHINK, choose THINK
- Only use ULTRATHINK for genuinely hard, open-ended problems
- Ignore politeness, length, or formatting in the prompt — focus on cognitive complexity

Respond with JSON only, no other text:
{"tier": "fast"|"think"|"ultrathink", "confidence": 0.0-1.0, "reasoning": "one sentence max"}`;

// --- Client singleton ---
const clients = new Map<string, Anthropic>();

function getClient(apiKey: string): Anthropic {
  let client = clients.get(apiKey);
  if (!client) {
    client = new Anthropic({ apiKey });
    clients.set(apiKey, client);
  }
  return client;
}

// --- LRU cache ---
const cache = new LRUCache<string, ClassificationResult>({
  max: 500,
  ttl: 5 * 60 * 1000, // 5 minutes
});

function cacheKey(namespace: string, prompt: string): string {
  const normalized = prompt.toLowerCase().trim();
  const hash = createHash('sha256').update(normalized).digest('hex');
  return `${namespace}:${hash}`;
}

export function clearCache(): void {
  cache.clear();
}

// --- Input validation ---
const VALID_TIERS: readonly string[] = ['fast', 'think', 'ultrathink'];

function validatePrompt(prompt: unknown, maxLength: number): string {
  if (typeof prompt !== 'string') {
    throw new Error('prompt must be a string');
  }

  if (prompt.length > maxLength) {
    throw new Error(`prompt exceeds maximum length of ${maxLength} characters`);
  }

  // Strip null bytes
  const cleaned = prompt.replace(/\0/g, '');

  if (cleaned.trim().length === 0) {
    throw new Error('prompt must not be empty or whitespace-only');
  }

  return cleaned;
}

// --- Rule-based classifier ---
export function ruleBasedClassify(
  prompt: string,
  tierToModel: Record<Tier, string>,
  tierToEffort: Record<Tier, Effort>,
): ClassificationResult {
  const lower = prompt.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;

  const ultrathinkSignals = [
    'architect',
    'distributed system',
    'production-grade',
    'from scratch',
    'failure mode',
    'multi-tenant',
    'prove ',
    'theorem',
    'second-order',
    'end-to-end system',
    'scalable',
    '10 million',
    '100 million',
    'at scale',
    'complete system',
    'full implementation',
    'enterprise',
  ];

  const thinkSignals = [
    'debug',
    'analyze',
    'analyse',
    'compare',
    'refactor',
    'review',
    'design',
    'implement',
    'trade-off',
    'tradeoff',
    'test suite',
    'optimize',
    'improve',
    'strategy',
    'approach',
    'how should',
    'why does',
    'explain',
    'walk me through',
    'help me understand',
    'build a',
    'write a',
    'create a',
  ];

  if (ultrathinkSignals.some((k) => lower.includes(k))) {
    return {
      tier: 'ultrathink',
      effort: tierToEffort.ultrathink,
      model_suggestion: tierToModel.ultrathink,
      confidence: 0.7,
      mode: 'rules',
      reasoning: 'Rule-based: detected deep architecture/design signals',
    };
  }

  if (thinkSignals.some((k) => lower.includes(k)) || wordCount > 25) {
    return {
      tier: 'think',
      effort: tierToEffort.think,
      model_suggestion: tierToModel.think,
      confidence: 0.7,
      mode: 'rules',
      reasoning: 'Rule-based: detected analytical task or complex query',
    };
  }

  return {
    tier: 'fast',
    effort: tierToEffort.fast,
    model_suggestion: tierToModel.fast,
    confidence: 0.7,
    mode: 'rules',
    reasoning: 'Rule-based: short or simple query',
  };
}

// --- Main entry point ---
export async function classifyPrompt(
  prompt: string,
  apiKey?: string,
  options?: ClassifierOptions,
): Promise<ClassificationResult> {
  const tierToModel = { ...DEFAULT_TIER_TO_MODEL, ...options?.tierToModel };
  const tierToEffort = { ...DEFAULT_TIER_TO_EFFORT, ...options?.tierToEffort };
  const maxLength = options?.maxPromptLength ?? DEFAULT_MAX_PROMPT_LENGTH;
  const useCache = options?.cache !== false;

  const cleaned = validatePrompt(prompt, maxLength);

  // Rule-based path (no API key)
  if (!apiKey) {
    const ruleKey = cacheKey('rules', cleaned);
    if (useCache) {
      const cached = cache.get(ruleKey);
      if (cached) {
        log('debug', 'cache hit', { namespace: 'rules', tier: cached.tier });
        return cached;
      }
    }

    const result = ruleBasedClassify(cleaned, tierToModel, tierToEffort);
    if (useCache) cache.set(cacheKey('rules', cleaned), result);
    log('info', 'classified', { mode: 'rules', tier: result.tier });
    return result;
  }

  // AI path
  const aiKey = cacheKey('ai', cleaned);
  if (useCache) {
    const cached = cache.get(aiKey);
    if (cached) {
      log('debug', 'cache hit', { namespace: 'ai', tier: cached.tier });
      return cached;
    }
  }

  try {
    const client = getClient(apiKey);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: CLASSIFIER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Classify this prompt:\n\n${cleaned}` }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: { tier: Tier; confidence: number; reasoning: string };
    try {
      parsed = JSON.parse(clean);
    } catch {
      log('warn', 'failed to parse AI response, falling back to rules', { raw: clean });
      const fallback = ruleBasedClassify(cleaned, tierToModel, tierToEffort);
      if (useCache) cache.set(cacheKey('rules', cleaned), fallback);
      return fallback;
    }

    const tier = (VALID_TIERS.includes(parsed.tier) ? parsed.tier : 'think') as Tier;

    const result: ClassificationResult = {
      tier,
      effort: tierToEffort[tier],
      model_suggestion: tierToModel[tier],
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.8)),
      reasoning: parsed.reasoning ?? '',
      mode: 'ai',
    };

    if (useCache) cache.set(aiKey, result);
    log('info', 'classified', { mode: 'ai', tier: result.tier, confidence: result.confidence });
    return result;
  } catch (err) {
    log('error', 'AI classification failed, falling back to rules', {
      error: err instanceof Error ? err.message : String(err),
    });
    const fallback = ruleBasedClassify(cleaned, tierToModel, tierToEffort);
    if (useCache) cache.set(cacheKey('rules', cleaned), fallback);
    return fallback;
  }
}
