# WoW Addon Roadmap — MythicPlusWheel

> **Phase 0 (Scaffolding)** is complete. This document tracks all remaining work.

---

## Phase 1: Core Functionality

### 1.1 Session Management Polish
- [ ] Add `SavedVariables` persistence via `MythicPlusWheelDB` — save last session results across reloads
- [ ] Implement proper `OnInitialize` with `AceDB` for profile-based saved variables
- [ ] Add session timeout (auto-end after configurable idle period)
- [ ] Handle edge case: host disconnects mid-session (transfer host or end gracefully)
- [ ] Add `/mpw status` command to show current session info in chat

### 1.2 Player Join Flow
- [ ] Auto-detect offspecs: let players toggle which offspecs they want to offer (not just all non-main specs)
- [ ] Add a role-selection dropdown in the lobby UI so players can override auto-detected role
- [ ] Handle realm-name stripping consistently (cross-realm guild members)
- [ ] Validate that joined players are actually in the guild
- [ ] Add a "Leave Session" button for participants

### 1.3 AceComm Messaging
- [ ] Handle message chunking for large payloads (AceComm has a ~255-byte limit per message)
- [ ] Add version handshake — warn if addon versions mismatch between host and participants
- [ ] Broadcast full player list (not just count) so non-hosts see the lobby roster
- [ ] Add message throttling to avoid flooding guild comms during rapid state changes
- [ ] Test with `AceSerializer` for complex nested group data

### 1.4 GroupCreator Algorithm Verification
- [ ] Run the busted tests and fix any Lua-specific issues in the port (1-indexed arrays, etc.)
- [ ] Verify parity with TypeScript version using identical test fixtures from `packages/bot/tests/`
- [ ] Port the `setLastGroups` / duplicate-avoidance logic and write tests for it
- [ ] Add `math.randomseed(time())` initialization for proper shuffle randomness

---

## Phase 2: UI Polish

### 2.1 MainFrame
- [ ] Add minimize/maximize behavior
- [ ] Persist frame position across sessions (`SavedVariables`)
- [ ] Add a minimap button (LibDBIcon) to toggle the frame
- [ ] Make frame resizable with min/max constraints
- [ ] Add keybinding support (Key Bindings UI integration)

### 2.2 Lobby View
- [ ] Show class-colored names (use `RAID_CLASS_COLORS`)
- [ ] Add class icons alongside role icons
- [ ] Show player count by role (e.g., "2 Tanks, 3 Healers, 8 DPS")
- [ ] Add a "Ready" check system before spinning
- [ ] Indicate which players have brez/lust with tooltip details
- [ ] Add scroll support for 20+ player lobbies
- [ ] Add host controls: kick player, lock lobby

### 2.3 Wheel Animation
- [ ] Replace placeholder fade-in with an actual spinning wheel visual (rotating texture)
- [ ] Add WoW-native sounds: use `SOUNDKIT` constants appropriate for the reveal drama
- [ ] Add per-player reveal within each group (not just per-group)
- [ ] Add confetti/particle effect on completion using WoW's `Model` widget
- [ ] Make animation speed configurable
- [ ] Add "Re-spin" option (goes back to lobby with same players)

### 2.4 Group Display
- [ ] Add tooltip on hover showing player's full spec, offspecs, and utilities
- [ ] Add "Post to Guild Chat" button using `Helpers:PostToGuildChat()`
- [ ] Add "Copy to Clipboard" for sharing outside WoW
- [ ] Color-code group completeness (green for 5/5, yellow for 4/5, red for <4)
- [ ] Show group composition quality score (has brez? has lust? has ranged?)

---

## Phase 3: Testing & Quality

### 3.1 Unit Tests (busted)
- [ ] Fix test stubs — `LibStub` mock needs to return proper AceAddon object with `:NewAddon()`
- [ ] Add tests for `SpecService:DetectLocalPlayer()` with mocked WoW APIs
- [ ] Add tests for serialization round-trips (Player/Group `ToDict`/`FromDict`)
- [ ] Add edge case tests: 0 players, 1 player, all same role, no tanks, no healers
- [ ] Port test fixtures from `packages/bot/tests/prebuiltClasses.ts` to Lua equivalents
- [ ] Add tests for `GuildService:GetOnlineGuildMembers()` with mocked roster API
- [ ] Achieve test parity with TypeScript algorithm tests

### 3.2 Linting
- [ ] Run luacheck and fix all warnings (may need `.luacheckrc` adjustments for WoW globals)
- [ ] Add `BackdropTemplateMixin` and any missing WoW 12.x API globals to `.luacheckrc`
- [ ] Verify no `_G` pollution beyond the addon namespace

### 3.3 Integration Testing
- [ ] Test in-game with at least 2 clients (host + participant) via addon comms
- [ ] Test with 5, 10, 15, 20+ players
- [ ] Test session recovery after `/reload`
- [ ] Test with cross-realm guild members
- [ ] Verify `.pkgmeta` produces a valid package (test with BigWigsMods packager or CurseForge upload)

---

## Phase 4: Distribution & CI

### 4.1 CI Pipeline
- [ ] Verify luacheck step works in GitHub Actions (Lua 5.1 + luarocks install)
- [ ] Verify busted step works in GitHub Actions
- [ ] Add addon CI caching for luarocks installs (speed up CI)
- [ ] Consider a separate `ci-addon.yml` if Lua toolchain install slows down the Node.js jobs significantly

### 4.2 CurseForge / Wago.io Packaging
- [ ] Test `.pkgmeta` with the [BigWigsMods/packager](https://github.com/BigWigsMods/packager) GitHub Action
- [ ] Add `@project-version@` token replacement in `.toc` file (handled by packager)
- [ ] Add `changelog.md` or auto-generate from git tags
- [ ] Set up CurseForge project and get project ID
- [ ] Set up Wago.io project and get project ID
- [ ] Add release workflow: on git tag push, package and upload to both platforms
- [ ] Add `CURSEFORGE_API_TOKEN` and `WAGO_API_TOKEN` to repo secrets

### 4.3 Ace3 Library Management
- [ ] Verify `.pkgmeta` externals resolve correctly (LibStub, AceAddon, AceEvent, AceComm, AceSerializer)
- [ ] Add `AceDB-3.0` external for saved variables management
- [ ] Add `LibDBIcon-1.0` external for minimap button
- [ ] Consider `AceGUI-3.0` or `AceConfig-3.0` for settings panel

---

## Phase 5: Future Enhancements

### 5.1 Settings Panel
- [ ] Add WoW Interface Options panel using `AceConfig-3.0`
- [ ] Settings: animation speed, auto-join, sound toggle, minimap button visibility
- [ ] Per-character offspec preferences (which offspecs to offer)

### 5.2 Integration with Discord Bot
- [ ] Consider a bridge: addon sends groups to a web endpoint → bot posts to Discord
- [ ] Share group history between addon and Discord bot (via Firebase or a lightweight API)
- [ ] Display QR code or link to the web activity UI from within the addon

### 5.3 Advanced Features
- [ ] Inspect-based offspec detection (query other players' specs via `NotifyInspect`)
- [ ] M+ rating display from Raider.IO addon data (if installed)
- [ ] Group history log (last N sessions)
- [ ] "Favorites" — preferred teammates weighting
- [ ] Support for non-guild groups (party/raid-based sessions instead of guild-based)

---

## File Reference

```
addon/
├── MythicPlusWheel.toc          # Addon manifest (Interface 120001)
├── .pkgmeta                     # CurseForge/Wago packaging
├── .luacheckrc                  # Lua linter config
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
│   └── test_group_creator.lua   # Algorithm tests
```

### CI Integration
- Luacheck runs in `CI / Lint` job
- Busted runs in `CI / Test` job
- Local: `./scripts/verify-addon.sh`
