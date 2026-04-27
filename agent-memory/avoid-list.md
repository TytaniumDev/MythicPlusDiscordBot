# Avoid list

Things tried and failed. Entries dated within the last 7 days are active. Older entries are pruned by the historian.

Format: `- <YYYY-MM-DD>: <what was tried> failed because <reason>. PR: #<N>.`

- 2026-04-27: Top-level `overrides` for `protobufjs`/`flatted`/`picomatch` failed because npm silently omitted vitest's transitive deps `obug` (vitest 4.x) and `strip-literal` (vitest 3.x) from the install tree, breaking `vite build` and `vitest run` in CI. Reverted entirely. PR: #460. Re-attempts must use per-workspace overrides or wait for upstream firebase-admin/firebase-functions/vitest bumps.
- 2026-04-27: Sed-driven `catch (e) → catch (err)` rename on `packages/bot/src` and `packages/functions/src` failed because bare `e` references inside catch blocks (template strings, `e instanceof Error`, `String(e)` in `core/storage.ts`) require coordinated renames inside each block. Need a real codemod (ts-morph or ESLint rule) rather than sed. Branch was deleted before push.
- 2026-04-27: Tightening `GroupsContext.send` from `Promise<any>` to a `Promise<SentMessage>` interface failed because `wrapMessage` in `main.ts` returns a struct without `id` and the actual `send` accepts a wider `string | { embed }` content type. The wider `Promise<any>` is intentional given the wrapping pattern. Don't re-attempt without first tightening `wrapMessage`.
