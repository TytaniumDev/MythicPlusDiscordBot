# Addon CI/CD: CurseForge & Wago.io Auto-Deploy

## Overview

Automatically package and deploy the WoW addon (`addon/`) to CurseForge and Wago.io on every push to `main` that changes addon files. Uses the BigWigs packager action for packaging, library resolution, and uploading.

## Trigger

- Push to `main` with changes in `addon/**`
- Manual dispatch (`workflow_dispatch`) as escape hatch
- Concurrency group `addon-release` with `cancel-in-progress: false` to prevent racing deploys

## Versioning

Date-based: `YYYY.MM.DD.N` where N increments for same-day releases (starting at 1).

- Workflow generates the version from UTC date + existing tag count for that date
- Creates a git tag `addon-v2026.03.12.1` and pushes it
- BigWigs packager detects the tag and replaces `@project-version@` in `.toc` with the tag name
- Note: In-game version will display as `addon-v2026.03.12.1` (full tag name). The `addon-v` prefix is intentional for tag namespacing.

## Workflow

**Replaces** the existing `.github/workflows/release-addon.yml` (which triggered on `addon-v*` tags and had incorrect `-g addon-v` flag). New file: `.github/workflows/deploy-addon.yml`.

### Jobs

1. **CI gate** — calls `ci-shared.yml` (lint, build, test — includes luacheck + busted)
2. **deploy-addon** (needs CI) — packages and uploads the addon

### deploy-addon steps

1. Checkout repo (with `fetch-depth: 0` for tag history + `token: GITHUB_TOKEN` with write permissions)
2. Load Doppler secrets (`CURSEFORGE_API_KEY`, `WAGO_API_KEY`)
3. Generate date-based version string from UTC date + existing tag count
4. Create + push annotated git tag (`addon-vYYYY.MM.DD.N`)
5. Run BigWigs packager action (`BigWigsMods/packager@v2`) with:
   - Args: `-t addon` (tells packager the addon root is in the `addon/` subdirectory)
   - No `-g` flag (game version auto-detected from `## Interface:` in `.toc`)
   - Packager reads `addon/.pkgmeta`, resolves externals, replaces tokens
   - Project IDs read from `.toc` file (`## X-Curse-Project-ID:`, `## X-Wago-ID:`)
   - Env vars: `CF_API_KEY` (mapped from Doppler's `CURSEFORGE_API_KEY`), `WAGO_API_TOKEN` (mapped from Doppler's `WAGO_API_KEY`), `GITHUB_OAUTH` (built-in `${{ secrets.GITHUB_TOKEN }}`, no Doppler mapping needed)

### Secrets (stored in Doppler)

| Doppler Key | Env Var for Packager | Purpose |
|-------------|---------------------|---------|
| `CURSEFORGE_API_KEY` | `CF_API_KEY` | CurseForge upload API token |
| `WAGO_API_KEY` | `WAGO_API_TOKEN` | Wago.io upload API token |

Loaded via the same Doppler pattern used in `deploy.yml`. The Doppler key names match what the user added; the env var names are what the BigWigs packager expects.

### Permissions

- `contents: write` — needed to push git tags

## File Changes

### New: `.github/workflows/deploy-addon.yml`

Full workflow file implementing the above.

### Deleted: `.github/workflows/release-addon.yml`

Replaced by `deploy-addon.yml`. The old workflow triggered on `addon-v*` tags and used incorrect `-g addon-v` flag (which sets game version, not tag prefix).

### Modified: `addon/.pkgmeta`

- Update externals paths from repo-root-relative (`addon/libs/...`) to addon-directory-relative (`libs/...`), since the packager runs with `-t addon`

### Modified: `addon/MythicPlusWheel.toc`

- Add `## X-Curse-Project-ID: 1484744`
- Add `## X-Wago-ID: wheelson`

(These are the standard BigWigs packager directives for project IDs — they go in the `.toc`, not `.pkgmeta`.)

## Manual Setup (already done)

- `CURSEFORGE_API_KEY` added to Doppler
- `WAGO_API_KEY` added to Doppler

## Design Decisions

- **Path filter on `addon/**`**: Avoids publishing unchanged addon when only bot/activity code changes.
- **Date-based versioning**: No state file to manage; deterministic from date + tag count.
- **`addon-v` tag prefix**: Distinguishes addon tags from potential future bot/activity tags.
- **`-t addon` flag**: Tells BigWigs packager to treat `addon/` as the addon root directory, enabling monorepo support.
- **Project IDs in `.toc`**: Standard BigWigs convention (`## X-Curse-Project-ID:`, `## X-Wago-ID:`), preferred over CLI flags or `.pkgmeta`.
- **Doppler for secrets**: Consistent with existing secret management across all deploy workflows.
- **Concurrency group**: Prevents racing deploys if multiple addon changes merge quickly.
- **Tag before packaging**: If packaging fails, an orphaned tag remains. This is acceptable — tags are cheap, failures are rare, and the alternative (tagging after upload) would mean `@project-version@` can't be replaced.
- **Replace `release-addon.yml`**: Avoids double-publishing since the old workflow triggered on the same `addon-v*` tags this workflow creates.
