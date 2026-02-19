#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { classifyPrompt } from './classifier.js';

// Re-export classifier for programmatic use (library mode)
export { classifyPrompt } from './classifier.js';
export type { ClassificationResult, Tier, Effort } from './classifier.js';

// Only start the MCP server when run directly (not when imported as a library)
if (require.main === module) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    process.stderr.write(
      'mcp-thinkgate: No ANTHROPIC_API_KEY found — running in rule-based mode.\n' +
      'Add your key to enable AI-powered classification (more accurate).\n' +
      'Get a key at https://console.anthropic.com\n'
    );
  }

  const server = new Server(
    { name: 'mcp-thinkgate', version: '0.1.0' },
    { capabilities: { tools: {} } }
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
    if (request.params.name !== 'classify_complexity') {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const { prompt } = request.params.arguments as { prompt: string };

    if (!prompt || typeof prompt !== 'string') {
      throw new Error('prompt must be a non-empty string');
    }

    const result = await classifyPrompt(prompt, ANTHROPIC_API_KEY);

    const output = [
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
    ].join('\n');

    return {
      content: [{ type: 'text', text: output }],
    };
  });

  const main = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write('mcp-thinkgate running\n');
  };

  main().catch((err) => {
    process.stderr.write(`Fatal error: ${err}\n`);
    process.exit(1);
  });
}
