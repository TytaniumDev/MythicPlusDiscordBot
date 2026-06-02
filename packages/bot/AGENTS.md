# Agent Instructions: @mythicplus/bot

This file provides specific operational standards and context for AI agents working within the `@mythicplus/bot` workspace.

## TypeScript Conventions
- Use strict TypeScript typing for all function arguments, return values, and interfaces.
- Avoid `any` whenever possible.
- Ensure all new features or logic changes are accompanied by Vitest unit tests.

## discord.js Implementation
- All bot commands, events, and API interactions must be implemented using `async/await` syntax.
- Extract complex UI generation logic (embeds, etc.) into dedicated UI modules (e.g., `roleUi.ts`) to decouple presentation from business logic.
