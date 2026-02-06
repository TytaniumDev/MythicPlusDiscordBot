# Verifier's Journal

## 2024-05-22 - [Mocking Discord Voice Interactions]
**Challenge:** Testing `join_voice_channel` required simulating different states of the bot's voice connection (connected vs disconnected, same channel vs different channel).
**Solution:** used `AsyncMock` for `ctx`, `ctx.author.voice.channel` and `ctx.voice_client`. controlled the flow by setting `ctx.voice_client` to `None` (disconnected) or a mock object (connected). Verified `connect()` vs `move_to()` calls.
**Guideline:** When testing voice state changes, always verify side effects (method calls) on the mock objects rather than return values, as `join_voice_channel` returns the client which might be a mock.
