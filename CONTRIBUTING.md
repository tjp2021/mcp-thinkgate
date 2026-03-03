# Contributing to ThinkGate

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Development Setup

```bash
git clone https://github.com/tjp2021/mcp-thinkgate
cd mcp-thinkgate
npm install
```

## Commands

| Command                 | What it does                                  |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | Run the MCP server directly (no build needed) |
| `npm run build`         | Compile TypeScript to `dist/`                 |
| `npm run typecheck`     | Type-check without emitting                   |
| `npm run lint`          | Run ESLint                                    |
| `npm run lint:fix`      | Run ESLint with auto-fix                      |
| `npm run format`        | Format code with Prettier                     |
| `npm run format:check`  | Check formatting without writing              |
| `npm test`              | Run tests with Vitest                         |
| `npm run test:coverage` | Run tests with coverage report                |

## Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add or update tests as needed
4. Run `npm run lint && npm run typecheck && npm test` to verify
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
6. Open a pull request

## Conventional Commits

We use conventional commit messages:

- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — maintenance (deps, CI, configs)
- `test:` — adding or updating tests
- `docs:` — documentation only
- `refactor:` — code change that neither fixes a bug nor adds a feature

Examples:

```
feat: add prompt length validation
fix: handle empty string input gracefully
chore: update vitest to v3.1
test: add edge case fixtures for ultrathink tier
```

## Pull Request Process

1. Fill out the PR template completely
2. Ensure CI passes (lint, typecheck, tests, build)
3. Keep PRs focused — one logical change per PR
4. Update `CHANGELOG.md` under the `Unreleased` section

## Code Style

- TypeScript strict mode
- ESLint + Prettier enforced in CI
- 2-space indentation
- Single quotes, trailing commas

## Questions?

Open an issue or reach out at engineering@iteachyouai.com.
