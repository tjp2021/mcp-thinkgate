# ThinkGate

An MCP server that automatically classifies prompt complexity and routes to the right Claude thinking mode.

Stop manually deciding when to use extended thinking. ThinkGate uses a fast Haiku call to read your prompt and recommend the right tier — before your expensive model runs.

## How it works

```
Your prompt → Haiku classifier (200ms, ~$0.0001) → tier decision → Claude runs with the right effort level
```

Three tiers:

| Tier | Effort | Use when |
|------|--------|----------|
| `fast` | `low` | Factual, conversational, simple edits |
| `think` | `medium` | Architecture, debugging, multi-step analysis |
| `ultrathink` | `high` | System design, proofs, complex open-ended problems |

---

## Setup

### Requirements

- Node.js 18+
- An Anthropic API key

### Claude Code (global)

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "thinkgate": {
      "command": "npx",
      "args": ["-y", "mcp-thinkgate"],
      "env": {
        "ANTHROPIC_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Restart Claude Code.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "thinkgate": {
      "command": "npx",
      "args": ["-y", "mcp-thinkgate"],
      "env": {
        "ANTHROPIC_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Restart Claude Desktop.

---

## Usage as MCP tool

Once installed, Claude has access to the `classify_complexity` tool.

**Example:**
> "Before answering, classify the complexity of this task: Design a rate limiter for a public API"

**Example output:**
```
Tier: think
Effort: medium
Suggested model: claude-sonnet-4-6
Confidence: 92%
Why: Requires structured design reasoning and trade-off analysis, but has well-defined scope.

Anthropic API params:
{ "thinking": { "type": "enabled", "effort": "medium" } }
```

---

## Usage as a library (programmatic)

Import the classifier directly into your own agent framework:

```typescript
import { classifyPrompt } from 'mcp-thinkgate/classifier';

const result = await classifyPrompt(userMessage, process.env.ANTHROPIC_API_KEY!);
console.log(result.tier);    // 'fast' | 'think' | 'ultrathink'
console.log(result.effort);  // 'none' | 'medium' | 'max'
```

---

## Reference implementation: TinyClaw integration

[TinyClaw](https://github.com/tjp2021/tinyclaw) is an open-source multi-agent framework for Claude. ThinkGate is integrated into its `invokeAgent` function as a reference for how to wire selective reasoning into any Claude-based agent.

The integration adds ~200ms and ~$0.0001 to each message in exchange for automatically routing every prompt to the right thinking mode. For agents handling a mix of simple and complex tasks (which is most of them), this saves tokens on easy messages and unlocks full reasoning on hard ones.

See [`src/lib/invoke.ts`](https://github.com/tjp2021/tinyclaw/blob/main/src/lib/invoke.ts) for the full implementation.

---

## Why this exists

Claude's extended thinking is powerful but costly. Using it on simple questions wastes time and money. Skipping it on complex problems gives worse answers.

The research is clear: there are three performance regimes. Simple tasks where thinking *hurts*, medium tasks where it helps, and hard tasks where you need maximum reasoning budget. ThinkGate puts the classification on autopilot using a model that costs almost nothing to run.

---

## Local development

```bash
git clone https://github.com/tjp2021/mcp-thinkgate
cd mcp-thinkgate
npm install
ANTHROPIC_API_KEY=your-key npm start
```

## License

MIT
