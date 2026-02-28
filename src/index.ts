#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { classifyPrompt } from './classifier.js';
import { formatClassificationOutput, validateToolRequest } from './handlers.js';
import { log } from './logger.js';

// Re-export for library consumers
export { classifyPrompt, clearCache } from './classifier.js';
export type { ClassificationResult, ClassifierOptions, Tier, Effort } from './classifier.js';

// Only start the MCP server when run directly (not when imported as a library)
if (require.main === module) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    process.stderr.write(
      'mcp-thinkgate: No ANTHROPIC_API_KEY found — running in rule-based mode.\n' +
        'Add your key to enable AI-powered classification (more accurate).\n' +
        'Get a key at https://console.anthropic.com\n',
    );
  }

  const server = new Server(
    { name: 'mcp-thinkgate', version: '0.2.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'classify_complexity',
        description:
          "Classify a prompt's complexity to determine the optimal Claude thinking mode. Returns the recommended tier (fast/think/ultrathink), effort level for the Anthropic API, suggested model, and the reasoning behind the classification.",
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt or task to classify',
            },
          },
          required: ['prompt'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const prompt = validateToolRequest(
      request.params.name,
      request.params.arguments as Record<string, unknown> | undefined,
    );
    const result = await classifyPrompt(prompt, ANTHROPIC_API_KEY);
    const output = formatClassificationOutput(result);

    return {
      content: [{ type: 'text', text: output }],
    };
  });

  const main = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('info', 'mcp-thinkgate running');
  };

  main().catch((err) => {
    process.stderr.write(`Fatal error: ${err}\n`);
    process.exit(1);
  });
}
