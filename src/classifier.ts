import Anthropic from '@anthropic-ai/sdk';

export type Tier = 'fast' | 'think' | 'ultrathink';
export type Effort = 'none' | 'medium' | 'max';

export interface ClassificationResult {
  tier: Tier;
  effort: Effort;
  model_suggestion: string;
  confidence: number;
  reasoning: string;
}

const TIER_TO_EFFORT: Record<Tier, Effort> = {
  fast: 'none',
  think: 'medium',
  ultrathink: 'max',
};

const TIER_TO_MODEL: Record<Tier, string> = {
  fast: 'claude-haiku-4-5-20251001',
  think: 'claude-sonnet-4-6',
  ultrathink: 'claude-opus-4-6',
};

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

export async function classifyPrompt(
  prompt: string,
  apiKey: string
): Promise<ClassificationResult> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: CLASSIFIER_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Classify this prompt:\n\n${prompt}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  let parsed: { tier: Tier; confidence: number; reasoning: string };
  try {
    // Strip markdown code fences if present (e.g. ```json ... ```)
    const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    // Fallback if Haiku returns something unexpected
    parsed = { tier: 'think', confidence: 0.5, reasoning: 'Classification failed, defaulting to think mode' };
  }

  const tier = (['fast', 'think', 'ultrathink'].includes(parsed.tier) ? parsed.tier : 'think') as Tier;

  return {
    tier,
    effort: TIER_TO_EFFORT[tier],
    model_suggestion: TIER_TO_MODEL[tier],
    confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.8)),
    reasoning: parsed.reasoning ?? '',
  };
}
