# Verifier's Journal

## 2024-05-22 - [Mocking Discord Voice Interactions]
**Challenge:** Testing `join_voice_channel` required simulating different states of the bot's voice connection (connected vs disconnected, same channel vs different channel).
**Solution:** used `AsyncMock` for `ctx`, `ctx.author.voice.channel` and `ctx.voice_client`. controlled the flow by setting `ctx.voice_client` to `None` (disconnected) or a mock object (connected). Verified `connect()` vs `move_to()` calls.
**Guideline:** When testing voice state changes, always verify side effects (method calls) on the mock objects rather than return values, as `join_voice_channel` returns the client which might be a mock.

## 2025-02-07 - [Testing Discord.py Cog Commands]
**Challenge:** Testing `discord.py` commands defined within a `Cog` proved difficult because accessing `self.cog.command_name(ctx)` invoked the wrapped `Command` object which failed due to unbound `self`.
**Solution:** Directly accessed the underlying callback via `self.cog.command_name.callback` and manually passed the cog instance (`self.cog`) and the mock context (`ctx`) as arguments: `await self.cog.command_name.callback(self.cog, ctx)`.
**Guideline:** When unit testing `discord.py` commands inside a `Cog` without a full bot runtime, bypass the command wrapper and invoke the callback directly with the cog instance.

## 2025-02-14 - [Mocking File I/O for Corrupt Data]
**Challenge:** Testing `load_preferences` error handling required simulating a corrupt file without writing to disk to avoid side effects.
**Solution:** Used `patch("builtins.open", mock_open(read_data="{invalid json"))` to mock the file content directly.
**Guideline:** Always use `mock_open` for testing file read/write operations to keep tests fast and isolated.

## 2024-05-18 - Mocking Firestore Helpers in Service Methods
**Challenge:** Testing the internal wrapper methods for Firestore (`_readFirestorePref`, `_writeFirestorePref`, etc.) within `PreferenceService` required avoiding a live DB connection, while still asserting correctly on the payload format and handling `inGameName`.
**Solution:** Rather than trying to instantiate a full `Firestore` mock from the SDK, create nested mock objects (`mockDb`, `mockCollectionRef`, `mockDocRef`) and assign them to the `db` property of a custom mocked `FirebaseService` instance. Provide `get()`, `set()`, and `delete()` spies to `mockDocRef` to easily assert arguments.
**Guideline:** When testing Firestore adapter wrappers, construct a minimal mock structure of the SDK (`db.collection().doc()`) using Vitest's `vi.fn()` and inject it manually, ensuring no external network calls are made.
