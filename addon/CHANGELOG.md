# Changelog

All notable changes to MythicPlusWheel will be documented in this file.

## [Unreleased]

### Added
- Core addon scaffolding with Ace3 framework (AceAddon, AceEvent, AceComm, AceSerializer, AceDB)
- Session management with SavedVariables persistence
- Session timeout with configurable idle period (default 30 minutes)
- Host disconnect handling with graceful session end
- `/mpw status` command showing session info with role composition
- `/mpw last` command to display saved results from previous session
- Player join flow with offspec toggling and role override dropdown
- Cross-realm name stripping for consistent guild member handling
- Guild membership validation on join requests
- Leave session support for non-host participants
- AceComm messaging with message throttling for rapid state changes
- Version handshake warning on addon version mismatch
- Full player list broadcasting to non-host participants
- GroupCreator algorithm (port of TypeScript parallelGroupCreator)
- Duplicate-avoidance logic via `SetLastGroups`/`GetLastGroups`
- Proper shuffle randomness via `math.randomseed`
- MainFrame with minimize/maximize, resizable with constraints, position persistence
- Minimap button via LibDBIcon
- Keybinding support via Key Bindings UI integration
- Lobby view with class-colored names, role icons, player count by role
- Ready check system, brez/lust tooltip indicators, scroll support for 20+ players
- Host controls: kick player, lock lobby
- Wheel animation with spinning texture, SOUNDKIT sounds, per-player reveal
- Confetti particle effect on completion
- Configurable animation speed and re-spin option
- Group display with hover tooltips, "Post to Guild Chat" and "Copy to Clipboard" buttons
- Color-coded group completeness and quality score indicators
- Settings panel via AceConfig-3.0 (animation speed, auto-join, sound toggle, minimap visibility)
- Per-character offspec preferences
- Comprehensive unit tests (100 passing) for models, algorithm, services
- Luacheck linting with 0 warnings
- CI pipeline with luarocks caching for luacheck and busted
- `.pkgmeta` for CurseForge/Wago.io packaging with all Ace3 externals
