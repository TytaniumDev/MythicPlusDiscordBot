# Agent Instructions: MythicPlusDiscordBot (Bot Package)

This file provides the necessary context and operational standards for AI agents working specifically on the `@mythicplus/bot` package.

## Mandatory Development Standards

### 1. discord.js Implementation
- All bot commands, events, and API interactions must be implemented using `async/await` syntax.
- Extract complex UI generation logic (embeds, etc.) into dedicated UI modules (e.g., `roleUi.ts`) to decouple presentation from business logic.
