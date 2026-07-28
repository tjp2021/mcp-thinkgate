#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { classifyPrompt } from './classifier.js';
import { formatClassificationOutput, validateToolRequest } from './handlers.js';
import { log } from './logger.js';
import { listProfiles, profileFromEnv } from './profiles.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json') as { version: string };

// Re-export for library consumers
export { classifyPrompt, clearCache, ruleBasedClassify } from './classifier.js';
export type { ClassificationResult, ClassifierOptions, Tier, Effort } from './classifier.js';
export {
  profileFromEnv,
  resolveProfile,
  listProfiles,
  CLAUDE_PROFILE,
  OPENROUTER_COST_PROFILE,
  OPENROUTER_BALANCED_PROFILE,
} from './profiles.js';
export type { ProfileName, TierProfile } from './profiles.js';
export { setLogLevel } from './logger.js';
export type { LogLevel } from './logger.js';

export function createServer(apiKey?: string): Server {
  const activeProfile = profileFromEnv();

  const server = new Server(
    { name: 'mcp-thinkgate', version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'classify_complexity',
        description:
          "Classify a prompt's complexity and return the optimal model tier + thinking effort. " +
          `Active profile: ${activeProfile.name} (${activeProfile.description}). ` +
          `Profiles: ${listProfiles().join(', ')}. ` +
          'Returns tier (fast/think/ultrathink), effort, suggested model, confidence, and reasoning.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt or task to classify',
            },
            profile: {
              type: 'string',
              description:
                'Optional tier profile override: claude | openrouter-cost | openrouter-balanced',
              enum: listProfiles(),
            },
          },
          required: ['prompt'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { prompt, profile } = validateToolRequest(
      request.params.name,
      request.params.arguments as Record<string, unknown> | undefined,
    );
    const result = await classifyPrompt(prompt, apiKey, profile ? { profile } : undefined);
    const output = formatClassificationOutput(result);

    return {
      content: [{ type: 'text', text: output }],
    };
  });

  return server;
}

// Only start when run directly (not when imported as a library)
if (require.main === module) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const active = profileFromEnv();

  if (!ANTHROPIC_API_KEY) {
    process.stderr.write(
      'mcp-thinkgate: No ANTHROPIC_API_KEY found — running in rule-based mode.\n' +
        'Add your key to enable AI-powered classification (more accurate).\n' +
        'Get a key at https://console.anthropic.com\n',
    );
  }

  process.stderr.write(
    `mcp-thinkgate: profile=${active.name} ` +
      `fast=${active.tierToModel.fast} think=${active.tierToModel.think} ` +
      `ultra=${active.tierToModel.ultrathink}\n`,
  );

  const main = async () => {
    const server = createServer(ANTHROPIC_API_KEY);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('info', 'mcp-thinkgate running', { profile: active.name, version });
  };

  main().catch((err) => {
    process.stderr.write(`Fatal error: ${err}\n`);
    process.exit(1);
  });
}
