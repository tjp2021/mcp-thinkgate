import type { ClassificationResult, Effort } from './classifier.js';

function anthropicThinkingBlock(effort: Effort): string {
  if (effort === 'none') {
    return '```json\n{ "thinking": { "type": "disabled" } }\n```';
  }
  // Anthropic adaptive + effort OR legacy enabled+effort depending on host.
  return `\`\`\`json\n{ "thinking": { "type": "enabled", "effort": "${effort}" } }\n\`\`\``;
}

export function formatClassificationOutput(result: ClassificationResult): string {
  const lines = [
    `**Tier:** ${result.tier}`,
    `**Effort:** ${result.effort}`,
    `**Suggested model:** ${result.model_suggestion}`,
    `**Confidence:** ${Math.round(result.confidence * 100)}%`,
    `**Why:** ${result.reasoning}`,
    ``,
    `**Classifier:** ${result.mode === 'ai' ? 'AI (Haiku)' : 'Rule-based (no API key)'}`,
    result.profile ? `**Profile:** ${result.profile}` : undefined,
    `**Anthropic API params:**`,
    anthropicThinkingBlock(result.effort),
  ].filter((line): line is string => line !== undefined);

  return lines.join('\n');
}

export function validateToolRequest(
  name: string,
  args: Record<string, unknown> | undefined,
): { prompt: string; profile?: string } {
  if (name !== 'classify_complexity') {
    throw new Error(`Unknown tool: ${name}`);
  }

  const prompt = args?.prompt;
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('prompt must be a non-empty string');
  }

  const profile = args?.profile;
  if (profile !== undefined && typeof profile !== 'string') {
    throw new Error('profile must be a string when provided');
  }

  return { prompt, profile };
}
