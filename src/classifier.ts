import Anthropic from '@anthropic-ai/sdk';
import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import { log } from './logger.js';
import { CLAUDE_PROFILE, profileFromEnv, resolveProfile, type ProfileName } from './profiles.js';

export type Tier = 'fast' | 'think' | 'ultrathink';
/** none | medium | high | max — high added for OpenRouter / pi thinking ladders */
export type Effort = 'none' | 'medium' | 'high' | 'max';

export interface ClassificationResult {
  tier: Tier;
  effort: Effort;
  model_suggestion: string;
  confidence: number;
  reasoning: string;
  mode: 'ai' | 'rules';
  profile?: ProfileName | string;
}

export interface ClassifierOptions {
  tierToModel?: Partial<Record<Tier, string>>;
  tierToEffort?: Partial<Record<Tier, Effort>>;
  /** Named cost/quality profile (claude | openrouter-cost | openrouter-balanced) */
  profile?: ProfileName | string;
  /** Prefer profileFromEnv() defaults when true (default: true) */
  useEnvProfile?: boolean;
  cache?: boolean;
  maxPromptLength?: number;
}

const DEFAULT_TIER_TO_EFFORT: Record<Tier, Effort> = {
  ...CLAUDE_PROFILE.tierToEffort,
};

const DEFAULT_TIER_TO_MODEL: Record<Tier, string> = {
  ...CLAUDE_PROFILE.tierToModel,
};

const DEFAULT_MAX_PROMPT_LENGTH = 50_000;

const CLASSIFIER_SYSTEM_PROMPT = `You are a reasoning complexity classifier for coding-agent traffic. Decide how much model + thinking capacity a prompt needs.

Classify into exactly one tier:

FAST — Cheap model, no extended reasoning. Mechanical or narrow work.
Examples: status checks, "what time is it", fix a typo, run tests, grep/find/ls, install deps, format JSON, summarize a short error, rename a symbol, reply to a one-line clarification, paste the user already solved, cost/usage lookup.

THINK — Mid model + medium reasoning. Real analysis or multi-step coding judgment.
Examples: debug a non-trivial bug, design a small API, compare approaches with tradeoffs, review a module, write a real test suite, implement a focused feature across a few files, refactor with behavior at risk.

ULTRATHINK — Expensive model + deep reasoning. Rare. Only for high-stakes open-ended architecture.
Examples: design a multi-tenant production system from scratch, prove asymptotic bounds, map second-order failure modes of a distributed design, migrate a whole platform with irreversible data risk.

Rules:
- Prefer FAST when local tools / commands can answer and the ask is mechanical
- Long pasted checklists are ONE unit — classify intent, not length
- Do NOT upgrade to THINK only because the paste is long
- When in doubt between FAST and THINK, choose THINK only if missing judgment would burn more redo cost than the model upgrade
- When in doubt between THINK and ULTRATHINK, choose THINK
- Only ULTRATHINK for genuinely hard, open-ended, high-stakes problems
- Ignore politeness and formatting — focus on cognitive complexity and cost of being wrong

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

function resolveMappings(options?: ClassifierOptions): {
  tierToModel: Record<Tier, string>;
  tierToEffort: Record<Tier, Effort>;
  profileName: string;
} {
  const useEnv = options?.useEnvProfile !== false;
  const fromEnv = useEnv ? profileFromEnv() : CLAUDE_PROFILE;
  const named = options?.profile ? resolveProfile(options.profile) : fromEnv;

  return {
    tierToModel: {
      ...DEFAULT_TIER_TO_MODEL,
      ...named.tierToModel,
      ...options?.tierToModel,
    },
    tierToEffort: {
      ...DEFAULT_TIER_TO_EFFORT,
      ...named.tierToEffort,
      ...options?.tierToEffort,
    },
    profileName: options?.profile
      ? resolveProfile(options.profile).name
      : named.name,
  };
}

function countWords(text: string): number {
  const parts = text.trim().split(/\s+/);
  return parts[0] === '' ? 0 : parts.length;
}

function hitAny(haystack: string, needles: readonly string[]): string | undefined {
  return needles.find((n) => haystack.includes(n));
}

/** Whole-prompt equality against short ack vocabulary (avoid substring false positives). */
function isShortAck(lower: string): boolean {
  const normalized = lower.replace(/[!?.,]+$/g, '').trim();
  const acks = new Set([
    'yes',
    'yep',
    'yeah',
    'ok',
    'okay',
    'k',
    'kk',
    'lgtm',
    'ship it',
    'do that',
    'continue',
    'go',
    'go ahead',
    'proceed',
    'stop',
    'cheap',
    'thanks',
    'thank you',
    'ty',
    'nl',
    'same',
    'cool',
    'perfect',
    'done',
  ]);
  return acks.has(normalized);
}

// --- Rule-based classifier ---
/**
 * Cost-aware rule router.
 *
 * Important change vs 0.2.0: long pastes no longer auto-upgrade to THINK.
 * Length alone is a weak complexity signal for Tim's multi-line checklists.
 */
/**
 * Explicit user overrides (highest priority, both rules and AI paths).
 * Returns a result on override hit, null otherwise.
 */
export function detectOverride(
  prompt: string,
  tierToModel: Record<Tier, string>,
  tierToEffort: Record<Tier, Effort>,
  profileName = 'claude',
): ClassificationResult | null {
  const lower = prompt.toLowerCase().trim();

  if (
    /\b(ultrathink|think\s*hard|deep\s*reason|max\s*effort)\b/.test(lower) ||
    lower.includes('use opus') ||
    lower.includes('/thinkgate ultra')
  ) {
    return {
      tier: 'ultrathink',
      effort: tierToEffort.ultrathink,
      model_suggestion: tierToModel.ultrathink,
      confidence: 0.95,
      mode: 'rules',
      profile: profileName,
      reasoning: 'Rule-based: explicit ultrathink/opus override',
    };
  }

  if (
    /\b(no thinking|think off|fast only|cheap mode|use haiku|use flash)\b/.test(lower) ||
    lower.includes('/thinkgate fast')
  ) {
    return {
      tier: 'fast',
      effort: tierToEffort.fast,
      model_suggestion: tierToModel.fast,
      confidence: 0.95,
      mode: 'rules',
      profile: profileName,
      reasoning: 'Rule-based: explicit cheap/fast override',
    };
  }

  return null;
}

export function ruleBasedClassify(
  prompt: string,
  tierToModel: Record<Tier, string>,
  tierToEffort: Record<Tier, Effort>,
  profileName = 'claude',
): ClassificationResult {
  const lower = prompt.toLowerCase().trim();
  const wordCount = countWords(lower);
  const lineCount = lower.split(/\n/).length;

  // Explicit user overrides (highest priority)
  const override = detectOverride(prompt, tierToModel, tierToEffort, profileName);
  if (override) return override;

  const ultrathinkSignals = [
    'architect a',
    'architecture for',
    'distributed system',
    'production-grade',
    'from scratch',
    'failure mode',
    'multi-tenant',
    'prove that',
    'theorem',
    'second-order',
    'end-to-end system',
    '10 million',
    '100 million',
    'at scale',
    'complete system design',
    'platform migration',
    'irreversible',
    'security threat model',
  ] as const;

  const thinkSignals = [
    'debug',
    'analyze',
    'analyse',
    'compare',
    'refactor',
    'code review',
    'review this',
    'design an',
    'design a',
    'implement',
    'trade-off',
    'tradeoff',
    'test suite',
    'optimize',
    'strategy for',
    'how should i',
    'why does this',
    'root cause',
    'walk me through',
    'help me understand',
    'build a feature',
    'write a pr',
    'architecture decision',
    'race condition',
    'deadlock',
    'production incident',
    'improve ',
    'implement ',
    'wire up',
    'wire ',
    'fix the ',
    'routing',
    'refactor ',
  ] as const;

  // Mechanical / local-tool / status traffic → stay FAST
  // NOTE: do not put bare tokens like "ok" / "yes" here — use isShortAck().
  const fastSignals = [
    'git status',
    'git diff',
    'git log',
    'npm test',
    'npm run ',
    'pytest',
    'vitest',
    'cargo test',
    'typecheck',
    'run the tests',
    'run tests',
    'npm install',
    'pnpm install',
    'yarn install',
    'what time',
    'status only',
    'how much did',
    'how much money',
    'session cost',
    'cost of this session',
    'openrouter credits',
    'openrouter usage',
    'fix typo',
    'format this json',
    'json pretty',
    'translate this to',
    'summarize this error',
    'what does this error mean',
    'read file',
    'open the file',
    'show me the file',
    'print the path',
    'list files',
    'healthcheck',
    'health check',
  ] as const;

  const ultraHit = hitAny(lower, ultrathinkSignals);
  if (ultraHit) {
    return {
      tier: 'ultrathink',
      effort: tierToEffort.ultrathink,
      model_suggestion: tierToModel.ultrathink,
      confidence: 0.78,
      mode: 'rules',
      profile: profileName,
      reasoning: `Rule-based: ultrathink signal "${ultraHit}"`,
    };
  }

  const thinkHit = hitAny(lower, thinkSignals);
  if (thinkHit) {
    return {
      tier: 'think',
      effort: tierToEffort.think,
      model_suggestion: tierToModel.think,
      confidence: 0.8,
      mode: 'rules',
      profile: profileName,
      reasoning: `Rule-based: analytical signal "${thinkHit}"`,
    };
  }

  if (isShortAck(lower) || (wordCount <= 3 && !thinkHit)) {
    return {
      tier: 'fast',
      effort: tierToEffort.fast,
      model_suggestion: tierToModel.fast,
      confidence: 0.9,
      mode: 'rules',
      profile: profileName,
      reasoning: isShortAck(lower)
        ? 'Rule-based: short ack'
        : 'Rule-based: very short prompt',
    };
  }

  const fastHit = hitAny(lower, fastSignals);
  if (fastHit) {
    return {
      tier: 'fast',
      effort: tierToEffort.fast,
      model_suggestion: tierToModel.fast,
      confidence: 0.8,
      mode: 'rules',
      profile: profileName,
      reasoning: `Rule-based: mechanical/fast signal "${fastHit}"`,
    };
  }

  // Multi-question analytical paste (not mere checklist length)
  const questionMarks = (lower.match(/\?/g) || []).length;
  if (questionMarks >= 3 && wordCount > 40) {
    return {
      tier: 'think',
      effort: tierToEffort.think,
      model_suggestion: tierToModel.think,
      confidence: 0.72,
      mode: 'rules',
      profile: profileName,
      reasoning: 'Rule-based: multi-question analytical paste',
    };
  }

  // Huge single blob with zero questions and no signals → still FAST
  // (long status dumps / logs / checklists)
  if (wordCount > 200 || lineCount > 40) {
    return {
      tier: 'fast',
      effort: tierToEffort.fast,
      model_suggestion: tierToModel.fast,
      confidence: 0.65,
      mode: 'rules',
      profile: profileName,
      reasoning: 'Rule-based: long paste without analytical signals — classify intent not length',
    };
  }

  // Medium multi-line with no signals: stay FAST (checklists, fragments)
  if (lineCount >= 3 && wordCount <= 120) {
    return {
      tier: 'fast',
      effort: tierToEffort.fast,
      model_suggestion: tierToModel.fast,
      confidence: 0.68,
      mode: 'rules',
      profile: profileName,
      reasoning: 'Rule-based: multi-line paste without cognitive signals',
    };
  }

  // Default mid-length prose → FAST. Old ">25 words => think" burned money.
  return {
    tier: 'fast',
    effort: tierToEffort.fast,
    model_suggestion: tierToModel.fast,
    confidence: 0.7,
    mode: 'rules',
    profile: profileName,
    reasoning: 'Rule-based: default fast (no strong analytical signals)',
  };
}

// --- Main entry point ---
export async function classifyPrompt(
  prompt: string,
  apiKey?: string,
  options?: ClassifierOptions,
): Promise<ClassificationResult> {
  const { tierToModel, tierToEffort, profileName } = resolveMappings(options);
  const maxLength = options?.maxPromptLength ?? DEFAULT_MAX_PROMPT_LENGTH;
  const useCache = options?.cache !== false;

  const cleaned = validatePrompt(prompt, maxLength);
  const mappingHash = createHash('sha256')
    .update(JSON.stringify({ tierToModel, tierToEffort, profileName }))
    .digest('hex')
    .slice(0, 12);

  // Rule-based path (no API key)
  if (!apiKey) {
    const ruleKey = cacheKey(`rules:${mappingHash}`, cleaned);
    if (useCache) {
      const cached = cache.get(ruleKey);
      if (cached) {
        log('debug', 'cache hit', { namespace: 'rules', tier: cached.tier });
        return cached;
      }
    }

    const result = ruleBasedClassify(cleaned, tierToModel, tierToEffort, profileName);
    if (useCache) cache.set(ruleKey, result);
    log('info', 'classified', { mode: 'rules', tier: result.tier, profile: profileName });
    return result;
  }

  // AI path — explicit overrides still win (and skip the Haiku call entirely)
  const override = detectOverride(cleaned, tierToModel, tierToEffort, profileName);
  if (override) {
    if (useCache) cache.set(cacheKey(`ai:${mappingHash}`, cleaned), override);
    log('info', 'classified', { mode: 'rules', tier: override.tier, profile: profileName, reason: 'explicit override' });
    return override;
  }

  const aiKey = cacheKey(`ai:${mappingHash}`, cleaned);
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
      const fallback = ruleBasedClassify(cleaned, tierToModel, tierToEffort, profileName);
      if (useCache) cache.set(cacheKey(`rules:${mappingHash}`, cleaned), fallback);
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
      profile: profileName,
    };

    if (useCache) cache.set(aiKey, result);
    log('info', 'classified', {
      mode: 'ai',
      tier: result.tier,
      confidence: result.confidence,
      profile: profileName,
    });
    return result;
  } catch (err) {
    log('error', 'AI classification failed, falling back to rules', {
      error: err instanceof Error ? err.message : String(err),
    });
    const fallback = ruleBasedClassify(cleaned, tierToModel, tierToEffort, profileName);
    if (useCache) cache.set(cacheKey(`rules:${mappingHash}`, cleaned), fallback);
    return fallback;
  }
}
