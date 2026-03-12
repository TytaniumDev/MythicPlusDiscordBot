# WoW Addon Roadmap — MythicPlusWheel

> Phases 1–3 (Core Functionality, UI Polish, Unit Tests & Linting) and Phase 4.1 (CI Pipeline) are **complete**.
> This document tracks only remaining open work.

---

## Integration Testing

- [ ] Test in-game with at least 2 clients (host + participant) via addon comms
- [ ] Test with 5, 10, 15, 20+ players
- [ ] Test session recovery after `/reload`
- [ ] Test with cross-realm guild members
- [ ] Verify `.pkgmeta` produces a valid package (test with BigWigsMods packager or CurseForge upload)

> **Note:** Integration testing requires a live WoW client and cannot be automated in CI.

---

## Distribution

### CurseForge / Wago.io Publishing
- [ ] Set up CurseForge project and get project ID
- [ ] Set up Wago.io project and get project ID
- [ ] Add `CURSEFORGE_API_TOKEN` and `WAGO_API_TOKEN` to repo secrets

> **Note:** Requires manual account access on each platform.

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
