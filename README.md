# ThinkGate

[![CI](https://github.com/tjp2021/mcp-thinkgate/actions/workflows/ci.yml/badge.svg)](https://github.com/tjp2021/mcp-thinkgate/actions/workflows/ci.yml)

**Automatic reasoning mode selection for Claude agents.**

---

## The problem

You built an AI agent. It handles everything — status checks, quick lookups, complex architecture questions, deep debugging sessions. But under the hood it runs every single message through the same model with the same thinking settings.

That means you're burning extended thinking tokens on "what time is it in Tokyo?" and getting shallow answers on "help me design the entire auth system."

You could manually tag requests — `ULTRATHINK:` before the hard ones. But you forget. Your users definitely won't do it. And if you're building agents for other people, you can't train every end user to manage thinking modes.

**ThinkGate fixes this at the infrastructure layer.** It sits between the incoming message and your model call, classifies the complexity in ~200ms, and returns exactly which model and thinking depth to use. Automatically. Every time.

---

## Who this is for

- **Agent builders** running Claude on a mix of simple and complex tasks who are tired of one-size-fits-all model settings
- **Teams running 24/7 agents** (WhatsApp bots, Slack assistants, Telegram agents) where message complexity varies wildly and cost/latency actually matters
- **Anyone who's ever typed `ULTRATHINK` manually** and thought: this should just happen on its own

---

## How it works

```
Incoming message
      ↓
  Haiku call (~200ms, ~$0.0001)
  "How complex is this?"
      ↓
  fast → no extended thinking
  think → medium effort
  ultrathink → max effort
      ↓
  Claude runs with the right settings
```

A cheap, fast Haiku call reads your prompt and decides which tier it needs. Then your main Claude call runs with the right effort level. You pay almost nothing for the classification, and save real money (and latency) on the 60%+ of messages that don't need extended reasoning.

The classifier is the IP here — not which model runs it. Three tiers. A system prompt trained on the boundary between "this needs thinking" and "this doesn't." Works out of the box.

---

## Tiers

| Tier         | Claude effort | When                                         |
| ------------ | ------------- | -------------------------------------------- |
| `fast`       | `none`        | Factual, conversational, simple edits        |
| `think`      | `medium`      | Architecture, debugging, multi-step analysis |
| `ultrathink` | `max`         | System design, proofs, open-ended complexity |

---

## Use as an MCP tool (Claude Desktop / Claude Code)

Add to `~/.claude/settings.json` (Claude Code) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Claude Desktop):

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

Restart Claude. Now you can ask it to classify before it answers:

> "Before responding, classify the complexity of this task: design a rate limiter for a public API"

```
Tier: think
Effort: medium
Suggested model: claude-sonnet-4-6
Confidence: 92%
Why: Requires structured design reasoning and trade-off analysis, but has well-defined scope.
```

---

## Use as a library (agent frameworks)

Install:

```bash
npm install mcp-thinkgate
```

Import and use:

```typescript
import { classifyPrompt, setLogLevel } from 'mcp-thinkgate';

// Optional: silence logs (default level is 'info', writes to stderr)
setLogLevel('error');

const result = await classifyPrompt(userMessage, process.env.ANTHROPIC_API_KEY!);

// result.tier       → 'fast' | 'think' | 'ultrathink'
// result.effort     → 'none' | 'medium' | 'max'
// result.confidence → 0.0 - 1.0
// result.reasoning  → one sentence explanation

// Works without an API key too (rule-based fallback):
const quickResult = await classifyPrompt(userMessage);
```

---

## Reference implementation: TinyClaw

[TinyClaw](https://github.com/tjp2021/tinyclaw) is an open-source multi-agent framework for Claude. ThinkGate is wired into its `invokeAgent()` function — every message is automatically classified before the Claude CLI runs, and `--effort` is set accordingly.

Three lines added. Zero config required. Every agent in every team automatically gets the right thinking depth.

See the integration at [`src/lib/invoke.ts`](https://github.com/tjp2021/tinyclaw/blob/main/src/lib/invoke.ts).

---

## Requirements

- Node.js 20+
- Anthropic API key (optional — falls back to rule-based classification)

## Local development

```bash
git clone https://github.com/tjp2021/mcp-thinkgate
cd mcp-thinkgate
npm install
npm test
npm run build
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, commands, and PR process.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

MIT — see [LICENSE](LICENSE)
