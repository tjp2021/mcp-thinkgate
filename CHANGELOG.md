# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-28

### Added

- Input validation (max length, type checking, whitespace-only rejection)
- LRU cache for classification results (500 entries, 5min TTL)
- Anthropic client singleton (reuse across calls)
- Configurable tier-to-model and tier-to-effort mappings
- Structured JSON logger (stderr)
- Extracted handler utilities for testability
- Vitest test suite with 50+ fixtures and benchmark
- ESLint 9 flat config + Prettier
- GitHub Actions CI (Node 18/20/22 matrix)
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
- Issue and PR templates

### Changed

- README tier table: corrected effort values (none/medium/max)

### Fixed

- Server version mismatch (was 0.1.0, now matches package.json)
- Indentation bug in index.ts output formatting

## [0.1.1] - 2026-02-19

### Added

- Rule-based fallback classification (no API key required)
- `mode` field on `ClassificationResult` (`'ai' | 'rules'`)
- `mcpName` for official MCP registry
- `server.json` for MCP registry
- `smithery.yaml` for Smithery registry

## [0.1.0] - 2026-02-19

### Added

- Initial release
- MCP server with `classify_complexity` tool
- AI-powered classification via Haiku
- Three-tier system: fast / think / ultrathink
- Library export (`classifyPrompt`)
