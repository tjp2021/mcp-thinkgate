import type { Effort, Tier } from './classifier.js';

export type ProfileName = 'claude' | 'openrouter-cost' | 'openrouter-balanced';

export interface TierProfile {
  name: ProfileName;
  tierToModel: Record<Tier, string>;
  tierToEffort: Record<Tier, Effort>;
  /** Human label for logging / MCP output */
  description: string;
}

/**
 * Default Anthropic-native IDs (Claude Code / direct Anthropic).
 * Identical to ThinkGate 0.2.0 behavior.
 */
export const CLAUDE_PROFILE: TierProfile = {
  name: 'claude',
  description: 'Anthropic native model IDs (haiku / sonnet / opus)',
  tierToModel: {
    fast: 'claude-haiku-4-5-20251001',
    think: 'claude-sonnet-4-6',
    ultrathink: 'claude-opus-4-6',
  },
  tierToEffort: {
    fast: 'none',
    think: 'medium',
    ultrathink: 'max',
  },
};

/**
 * OpenRouter cost-first stack for coding agents.
 *
 * Pricing snapshot (OR, $/token, Jul 2026):
 * - gemini-2.5-flash: $0.30/$2.50 per 1M  (mechanical / short edits)
 * - claude-sonnet-4.5: $3/$15 per 1M     (real coding judgment)
 * - claude-opus-4.6: $5/$25 per 1M       (rare heavy architecture only)
 *
 * Napkin vs always-on grok-4.5 ($2/$6 + fat cache reads on long sessions):
 * most turns should land on flash or haiku-equivalent bins.
 */
export const OPENROUTER_COST_PROFILE: TierProfile = {
  name: 'openrouter-cost',
  description:
    'OpenRouter cost-first (qwen thinking → grok-4.20 → kimi-k3).',
  tierToModel: {
    // Live OR Jul 2026 pricing snapshot
    fast: 'qwen/qwen3-next-80b-a3b-thinking', // ~$0.10/$0.78 — cheap reasoner
    think: 'x-ai/grok-4.20', // ~$1.25/$2.50 — mid agentic
    ultrathink: 'moonshotai/kimi-k3', // ~$3/$15 — top agentic when needed
  },
  tierToEffort: {
    fast: 'none', // host maps thinking level separately; model is already a thinker
    think: 'medium',
    ultrathink: 'high',
  },
};

/**
 * Safer coding quality on cheap bins: Haiku for fast (better tools than flash),
 * Sonnet for think, Opus only for ultrathink.
 */
export const OPENROUTER_BALANCED_PROFILE: TierProfile = {
  name: 'openrouter-balanced',
  description: 'OpenRouter balanced coding (haiku → sonnet → opus)',
  tierToModel: {
    fast: 'anthropic/claude-haiku-4.5',
    think: 'anthropic/claude-sonnet-4.5',
    ultrathink: 'anthropic/claude-opus-4.6',
  },
  tierToEffort: {
    fast: 'none',
    think: 'medium',
    ultrathink: 'high',
  },
};

const PROFILES: Record<ProfileName, TierProfile> = {
  claude: CLAUDE_PROFILE,
  'openrouter-cost': OPENROUTER_COST_PROFILE,
  'openrouter-balanced': OPENROUTER_BALANCED_PROFILE,
};

export function listProfiles(): ProfileName[] {
  return Object.keys(PROFILES) as ProfileName[];
}

export function resolveProfile(name?: string | null): TierProfile {
  if (!name) return CLAUDE_PROFILE;
  const key = name.trim().toLowerCase() as ProfileName;
  return PROFILES[key] ?? CLAUDE_PROFILE;
}

export function profileFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): TierProfile {
  const name = env.THINKGATE_PROFILE ?? env.THINKGATE_MODEL_PROFILE;
  const base = resolveProfile(name);

  const tierToModel = { ...base.tierToModel };
  const tierToEffort = { ...base.tierToEffort };

  if (env.THINKGATE_FAST_MODEL) tierToModel.fast = env.THINKGATE_FAST_MODEL;
  if (env.THINKGATE_THINK_MODEL) tierToModel.think = env.THINKGATE_THINK_MODEL;
  if (env.THINKGATE_ULTRA_MODEL) tierToModel.ultrathink = env.THINKGATE_ULTRA_MODEL;

  const efforts = ['none', 'medium', 'high', 'max'] as const;
  const parseEffort = (raw: string | undefined, fallback: Effort): Effort => {
    if (!raw) return fallback;
    const v = raw.trim().toLowerCase();
    return (efforts as readonly string[]).includes(v) ? (v as Effort) : fallback;
  };

  tierToEffort.fast = parseEffort(env.THINKGATE_FAST_EFFORT, tierToEffort.fast);
  tierToEffort.think = parseEffort(env.THINKGATE_THINK_EFFORT, tierToEffort.think);
  tierToEffort.ultrathink = parseEffort(
    env.THINKGATE_ULTRA_EFFORT,
    tierToEffort.ultrathink,
  );

  return {
    ...base,
    tierToModel,
    tierToEffort,
  };
}
