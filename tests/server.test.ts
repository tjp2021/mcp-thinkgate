import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/index.js';

// Logger mock to keep test output clean
import { vi } from 'vitest';
vi.mock('../src/logger.js', () => ({
  log: vi.fn(),
  setLogLevel: vi.fn(),
  getLogLevel: vi.fn(() => 'info'),
}));

async function setupClientServer(apiKey?: string) {
  const server = createServer(apiKey);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
  await client.connect(clientTransport);

  return { client, server };
}

describe('MCP server integration', () => {
  let client: Client;

  beforeEach(async () => {
    const setup = await setupClientServer(); // no API key = rule-based
    client = setup.client;
  });

  afterEach(async () => {
    await client.close();
  });

  describe('list_tools', () => {
    it('returns classify_complexity tool', async () => {
      const result = await client.listTools();
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('classify_complexity');
    });

    it('tool has correct input schema', async () => {
      const result = await client.listTools();
      const tool = result.tools[0];
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        properties: { prompt: { type: 'string' } },
        required: ['prompt'],
      });
    });
  });

  describe('classify_complexity tool', () => {
    it('classifies a simple prompt and returns text content', async () => {
      const result = await client.callTool({
        name: 'classify_complexity',
        arguments: { prompt: 'hello' },
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toMatchObject({ type: 'text' });

      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('**Tier:**');
      expect(text).toContain('**Effort:**');
      expect(text).toContain('**Suggested model:**');
      expect(text).toContain('**Confidence:**');
      expect(text).toContain('**Classifier:** Rule-based');
    });

    it('returns fast tier for greeting', async () => {
      const result = await client.callTool({
        name: 'classify_complexity',
        arguments: { prompt: 'hello' },
      });
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('**Tier:** fast');
      expect(text).toContain('"type": "disabled"');
    });

    it('returns think tier for analytical prompt', async () => {
      const result = await client.callTool({
        name: 'classify_complexity',
        arguments: { prompt: 'debug this function' },
      });
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('**Tier:** think');
      expect(text).toContain('"effort": "medium"');
    });

    it('returns ultrathink tier for architecture prompt', async () => {
      const result = await client.callTool({
        name: 'classify_complexity',
        arguments: { prompt: 'architect a distributed system from scratch' },
      });
      const text = (result.content[0] as { type: 'text'; text: string }).text;
      expect(text).toContain('**Tier:** ultrathink');
      expect(text).toContain('"effort": "max"');
    });

    it('throws on unknown tool name', async () => {
      await expect(
        client.callTool({ name: 'nonexistent_tool', arguments: { prompt: 'hello' } }),
      ).rejects.toThrow();
    });

    it('throws on missing prompt argument', async () => {
      await expect(
        client.callTool({ name: 'classify_complexity', arguments: {} }),
      ).rejects.toThrow();
    });
  });
});
