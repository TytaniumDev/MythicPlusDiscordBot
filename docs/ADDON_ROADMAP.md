# WoW Addon Roadmap — MythicPlusWheel

> **Phase 0 (Scaffolding)** is complete. This document tracks all remaining work.

---

## Phase 1: Core Functionality

### 1.1 Session Management Polish
- [x] Add `SavedVariables` persistence via `MythicPlusWheelDB` — save last session results across reloads
- [x] Implement proper `OnInitialize` with `AceDB` for profile-based saved variables
- [x] Add session timeout (auto-end after configurable idle period)
- [x] Handle edge case: host disconnects mid-session (transfer host or end gracefully)
- [x] Add `/mpw status` command to show current session info in chat

### 1.2 Player Join Flow
- [x] Auto-detect offspecs: let players toggle which offspecs they want to offer (not just all non-main specs)
- [x] Add a role-selection dropdown in the lobby UI so players can override auto-detected role
- [x] Handle realm-name stripping consistently (cross-realm guild members)
- [x] Validate that joined players are actually in the guild
- [x] Add a "Leave Session" button for participants

### 1.3 AceComm Messaging
- [x] Handle message chunking for large payloads (AceComm has a ~255-byte limit per message)
- [x] Add version handshake — warn if addon versions mismatch between host and participants
- [x] Broadcast full player list (not just count) so non-hosts see the lobby roster
- [x] Add message throttling to avoid flooding guild comms during rapid state changes
- [x] Test with `AceSerializer` for complex nested group data

### 1.4 GroupCreator Algorithm Verification
- [x] Run the busted tests and fix any Lua-specific issues in the port (1-indexed arrays, etc.)
- [x] Verify parity with TypeScript version using identical test fixtures from `packages/bot/tests/`
- [x] Port the `setLastGroups` / duplicate-avoidance logic and write tests for it
- [x] Add `math.randomseed(time())` initialization for proper shuffle randomness

---

## Phase 2: UI Polish

### 2.1 MainFrame
- [x] Add minimize/maximize behavior
- [x] Persist frame position across sessions (`SavedVariables`)
- [x] Add a minimap button (LibDBIcon) to toggle the frame
- [x] Make frame resizable with min/max constraints
- [x] Add keybinding support (Key Bindings UI integration)

### 2.2 Lobby View
- [x] Show class-colored names (use `RAID_CLASS_COLORS`)
- [x] Add class icons alongside role icons
- [x] Show player count by role (e.g., "2 Tanks, 3 Healers, 8 DPS")
- [x] Add a "Ready" check system before spinning
- [x] Indicate which players have brez/lust with tooltip details
- [x] Add scroll support for 20+ player lobbies
- [x] Add host controls: kick player, lock lobby

### 2.3 Wheel Animation
- [x] Replace placeholder fade-in with an actual spinning wheel visual (rotating texture)
- [x] Add WoW-native sounds: use `SOUNDKIT` constants appropriate for the reveal drama
- [x] Add per-player reveal within each group (not just per-group)
- [x] Add confetti/particle effect on completion using WoW's `Model` widget
- [x] Make animation speed configurable
- [x] Add "Re-spin" option (goes back to lobby with same players)

### 2.4 Group Display
- [x] Add tooltip on hover showing player's full spec, offspecs, and utilities
- [x] Add "Post to Guild Chat" button using `Helpers:PostToGuildChat()`
- [x] Add "Copy to Clipboard" for sharing outside WoW
- [x] Color-code group completeness (green for 5/5, yellow for 4/5, red for <4)
- [x] Show group composition quality score (has brez? has lust? has ranged?)

---

## Phase 3: Testing & Quality

### 3.1 Unit Tests (busted)
- [x] Fix test stubs — `LibStub` mock needs to return proper AceAddon object with `:NewAddon()`
- [x] Add tests for serialization round-trips (Player/Group `ToDict`/`FromDict`)
- [x] Add edge case tests: 0 players, 1 player, all same role, no tanks, no healers
- [x] Port test fixtures from `packages/bot/tests/prebuiltClasses.ts` to Lua equivalents
- [x] Achieve test parity with TypeScript algorithm tests
- [x] Add tests for `SpecService:DetectLocalPlayer()` with mocked WoW APIs
- [x] Add tests for `GuildService:GetOnlineGuildMembers()` with mocked roster API

### 3.2 Linting
- [x] Run luacheck and fix all warnings (may need `.luacheckrc` adjustments for WoW globals)
- [x] Add `BackdropTemplateMixin` and any missing WoW 12.x API globals to `.luacheckrc`
- [x] Verify no `_G` pollution beyond the addon namespace

### 3.3 Integration Testing
- [ ] Test in-game with at least 2 clients (host + participant) via addon comms
- [ ] Test with 5, 10, 15, 20+ players
- [ ] Test session recovery after `/reload`
- [ ] Test with cross-realm guild members
- [ ] Verify `.pkgmeta` produces a valid package (test with BigWigsMods packager or CurseForge upload)

> **Note:** Integration testing requires a live WoW client and cannot be automated in CI.

---

## Phase 4: Distribution & CI

### 4.1 CI Pipeline
- [x] Verify luacheck step works in GitHub Actions (Lua 5.1 + luarocks install)
- [x] Verify busted step works in GitHub Actions
- [x] Add addon CI caching for luarocks installs (speed up CI)
- [x] Consider a separate `ci-addon.yml` if Lua toolchain install slows down the Node.js jobs significantly

### 4.2 CurseForge / Wago.io Packaging
- [x] Test `.pkgmeta` with the [BigWigsMods/packager](https://github.com/BigWigsMods/packager) GitHub Action
- [x] Add `@project-version@` token replacement in `.toc` file (handled by packager)
- [x] Add `changelog.md` or auto-generate from git tags
- [ ] Set up CurseForge project and get project ID
- [ ] Set up Wago.io project and get project ID
- [x] Add release workflow: on git tag push, package and upload to both platforms
- [ ] Add `CURSEFORGE_API_TOKEN` and `WAGO_API_TOKEN` to repo secrets

> **Note:** CurseForge/Wago.io project setup and API token secrets require manual account access.

### 4.3 Ace3 Library Management
- [x] Verify `.pkgmeta` externals resolve correctly (LibStub, AceAddon, AceEvent, AceComm, AceSerializer)
- [x] Add `AceDB-3.0` external for saved variables management
- [x] Add `LibDBIcon-1.0` external for minimap button
- [x] Consider `AceGUI-3.0` or `AceConfig-3.0` for settings panel

---

## Phase 5: Future Enhancements

### 5.1 Settings Panel
- [x] Add WoW Interface Options panel using `AceConfig-3.0`
- [x] Settings: animation speed, auto-join, sound toggle, minimap button visibility
- [x] Per-character offspec preferences (which offspecs to offer)

### 5.2 Integration with Discord Bot
- [ ] Consider a bridge: addon sends groups to a web endpoint → bot posts to Discord
- [ ] Share group history between addon and Discord bot (via Firebase or a lightweight API)
- [ ] Display QR code or link to the web activity UI from within the addon

> **Note:** Discord bot integration requires API endpoint design and is a future project.

### 5.3 Advanced Features
- [ ] Inspect-based offspec detection (query other players' specs via `NotifyInspect`)
- [ ] M+ rating display from Raider.IO addon data (if installed)
- [x] Group history log (last N sessions)
- [ ] "Favorites" — preferred teammates weighting
- [ ] Support for non-guild groups (party/raid-based sessions instead of guild-based)

> **Note:** Inspect-based detection and Raider.IO integration require in-game testing with other addons.

---

## File Reference

```
addon/
├── MythicPlusWheel.toc          # Addon manifest (Interface 120001)
├── .pkgmeta                     # CurseForge/Wago packaging
├── .luacheckrc                  # Lua linter config
├── .busted                      # Busted test runner config
├── CHANGELOG.md                 # Release changelog
├── libs/                        # Ace3 libraries (gitignored, fetched by packager)
│   └── .gitkeep
├── src/
│   ├── Config.lua               # Constants, spec→role map, class→utility map
│   ├── Models.lua               # MPWPlayer, MPWGroup (port of shared/models.ts)
│   ├── GroupCreator.lua          # Algorithm (port of shared/parallelGroupCreator.ts)
│   ├── Core.lua                 # Lifecycle, slash commands, session mgmt, comms
│   ├── UI/
│   │   ├── MainFrame.xml        # WoW XML frame definition
│   │   ├── MainFrame.lua        # View controller
│   │   ├── Lobby.lua            # Player list + spin button
│   │   ├── Wheel.lua            # Group reveal animation
│   │   └── GroupDisplay.lua     # Final results + invite button
│   ├── Services/
│   │   ├── SpecService.lua      # Auto-detect role from WoW API
│   │   ├── GuildService.lua     # Guild roster queries
│   │   └── PartyService.lua     # Party invite management
│   └── Utils/
│       └── Helpers.lua          # Formatting, chat output, color helpers
├── tests/
│   ├── test_models.lua          # Player/Group model tests
│   ├── test_group_creator.lua   # Algorithm tests
│   ├── test_spec_service.lua    # SpecService tests with mocked WoW APIs
│   └── test_guild_service.lua   # GuildService tests with mocked roster API
```

### CI Integration
- Luacheck runs in `CI / Lint` job
- Busted runs in `CI / Test` job
- Local: `./scripts/verify-addon.sh`
- Release: `.github/workflows/release-addon.yml` (on `addon-v*` tag push)
