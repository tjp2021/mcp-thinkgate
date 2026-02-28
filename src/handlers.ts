import type { ClassificationResult } from './classifier.js';

export function formatClassificationOutput(result: ClassificationResult): string {
  const lines = [
    `**Tier:** ${result.tier}`,
    `**Effort:** ${result.effort}`,
    `**Suggested model:** ${result.model_suggestion}`,
    `**Confidence:** ${Math.round(result.confidence * 100)}%`,
    `**Why:** ${result.reasoning}`,
    ``,
    `**Classifier:** ${result.mode === 'ai' ? 'AI (Haiku)' : 'Rule-based (no API key)'}`,
    `**Anthropic API params:**`,
    result.effort === 'none'
      ? '```json\n{ "thinking": { "type": "disabled" } }\n```'
      : `\`\`\`json\n{ "thinking": { "type": "enabled", "effort": "${result.effort}" } }\n\`\`\``,
  ];

  return lines.join('\n');
}

export function validateToolRequest(
  name: string,
  args: Record<string, unknown> | undefined,
): string {
  if (name !== 'classify_complexity') {
    throw new Error(`Unknown tool: ${name}`);
  }

  const prompt = args?.prompt;
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('prompt must be a non-empty string');
  }

  return prompt;
}
