# AGENTS.md

Development guidelines for agentic coding agents working in this repository.

## Build Commands

```bash
# Install dependencies
bun install

# Build the plugin
bun run build

# Install plugin locally
bun run plugin:install
```

## Lint/Format Commands

```bash
# Type check
bun run typecheck

# Lint (check only)
bun run lint

# Lint and fix
bun run lint:fix

# Format (write)
bun run format

# Format check (no write)
bun run format:check

# Combined check (lint + format)
bun run check

# Combined fix
bun run check:fix
```

## Test Commands

```bash
# Run all unit tests
bun test

# Run tests in watch mode
bun run test:watch

# Run single test file
bun test src/plugin/index.test.ts

# Run single test with pattern
bun test -t "isEnabled"

# Run E2E/integration tests
bun run test:integration

# Run specific E2E test
bun test src/e2e/yolo-mode.test.ts
```

## Project Overview

OpenCode YOLO Mode Plugin - Automatically approves all permissions when `OPENCODE_YOLO_ENABLE=true` environment variable is set.

- Main entry: `src/plugin/index.ts`
- Plugin architecture using `@opencode-ai/plugin` SDK
- E2E tests use mock OpenAI server and spawn actual opencode processes

## Code Style Guidelines

### Imports

- Use ES modules with `.js` extension for local imports:
  ```typescript
  import { handleQuestionAsked } from "./handlers/handle-question-asked.js";
  ```
- Type imports should use `import type`:
  ```typescript
  import type { Plugin } from "@opencode-ai/plugin";
  import type { Event, PermissionActionConfig } from "@opencode-ai/sdk/v2";
  ```
- Group imports: external packages first, then local imports

### Formatting (Biome)

- Indent style: 2 spaces
- Line width: 100 characters
- No semicolons at end of statements
- Format with errors: disabled

### TypeScript

- Strict mode enabled
- Target: ES2022
- Module: ES2022 with bundler resolution
- Always use explicit return types for exported functions
- Prefer `async/await` over `.then()` chains

### Naming Conventions

- Files: kebab-case (`handle-question-asked.ts`)
- Functions: camelCase (`isEnabled`, `handleQuestionAsked`)
- Constants: SCREAMING_SNAKE_CASE for module-level constants (`YOLO_SYSTEM_PROMPT`)
- Types/Interfaces: PascalCase (`OpencodeProcessOptions`, `MockRequestRecord`)

### Error Handling

- Throw `Error` objects with descriptive messages:
  ```typescript
  throw new Error(`Failed to reject question: ${response.status}`);
  ```
- Use early returns for error conditions
- Clean up resources in `finally` blocks

### Testing

- Use Bun's built-in test framework (`bun:test`)
- Import test utilities at the top:
  ```typescript
  import { afterEach, beforeEach, describe, expect, test } from "bun:test";
  ```
- Use `beforeEach`/`afterEach` for setup/teardown
- Mock global resources like `fetch` when testing external calls
- Store original values in `beforeEach`, restore in `afterEach`

### File Organization

```
src/
├── plugin/           # Main plugin code
│   ├── index.ts      # Plugin entry point
│   └── handlers/     # Event handlers
├── testing/          # Test utilities
│   ├── mock-openai-server.ts
│   ├── mock-openai-responses.ts
│   └── opencode-process.ts
└── e2e/              # End-to-end tests
```

### Asynchronous Patterns

- Use `async/await` consistently
- Prefer `Promise<T>` wrapper types over callbacks
- Use `void` return for fire-and-forget async operations in handlers

### Environment Variables

- Check environment with explicit string comparison:
  ```typescript
  process.env.OPENCODE_YOLO_ENABLE === "true"
  ```

### Plugin Development

- Plugins export an async function receiving context
- Return an object with hook handlers (`config`, `event`, etc.)
- Use SDK types from `@opencode-ai/sdk/v2` for v2 API features