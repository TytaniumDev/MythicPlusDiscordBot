# Addon CI/CD: CurseForge & Wago.io Auto-Deploy

## Overview

Automatically package and deploy the WoW addon (`addon/`) to CurseForge and Wago.io on every push to `main` that changes addon files. Uses the BigWigs packager action for packaging, library resolution, and uploading.

## Trigger

- Push to `main` with changes in `addon/**`
- Manual dispatch (`workflow_dispatch`) as escape hatch

## Versioning

Date-based: `YYYY.MM.DD.N` where N increments for same-day releases (starting at 1).

- Workflow generates the version from UTC date + existing tag count
- Creates a git tag `addon-vYYYY.MM.DD.N` and pushes it
- BigWigs packager replaces `@project-version@` in `.toc` with the tag name

## Workflow: `deploy-addon.yml`

### Jobs

1. **CI gate** — calls `ci-shared.yml` (lint, build, test — includes luacheck + busted)
2. **deploy-addon** (needs CI) — packages and uploads the addon

### deploy-addon steps

1. Checkout repo (with `fetch-depth: 0` for tag history)
2. Load Doppler secrets (`CF_API_KEY`, `WAGO_API_TOKEN`)
3. Generate date-based version string
4. Create + push git tag (`addon-vYYYY.MM.DD.N`)
5. Run BigWigs packager action (`BigWigsMods/packager@v2`)
   - Reads `.pkgmeta` from `addon/`
   - Resolves externals (Ace3, LibStub, LibDBIcon, LibDataBroker)
   - Replaces `@project-version@` token in `.toc`
   - Packages addon into zip
   - Uploads to CurseForge (project ID: 1484744) and Wago.io (project ID: wheelson)

### Secrets (stored in Doppler)

| Secret | Purpose |
|--------|---------|
| `CF_API_KEY` | CurseForge upload API token |
| `WAGO_API_TOKEN` | Wago.io upload API token |

Loaded via the same Doppler pattern used in `deploy.yml`.

### Permissions

- `contents: write` — needed to push git tags

## File Changes

### New: `.github/workflows/deploy-addon.yml`

Full workflow file implementing the above.

### Modified: `addon/.pkgmeta`

- Update externals paths from repo-root-relative (`addon/libs/...`) to addon-directory-relative (`libs/...`)
- Add `curseforge-project-id: 1484744`
- Add `wago-project-id: wheelson`

## Manual Setup Required

1. Add `CF_API_KEY` to Doppler (CurseForge API token)
2. Add `WAGO_API_TOKEN` to Doppler (Wago.io API token)

## Design Decisions

- **Path filter on `addon/**`**: Avoids publishing unchanged addon when only bot/activity code changes.
- **Date-based versioning**: No state file to manage; deterministic from date + tag count.
- **`addon-v` tag prefix**: Distinguishes addon tags from potential future bot/activity tags.
- **Doppler for secrets**: Consistent with existing secret management across all deploy workflows.
- **BigWigs packager action**: Industry standard for WoW addon CI/CD; handles `.pkgmeta`, externals, token replacement, and platform uploads in one step.
- **GitHub Secrets `contents: write`**: Minimal permission needed to push tags; no broader access required.
