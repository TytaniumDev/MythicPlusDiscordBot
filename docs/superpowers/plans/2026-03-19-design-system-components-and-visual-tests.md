# Design System Components & Visual Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract reusable design system components from the Pencil designs (FsLLs), integrate them into the 5 page views, and create comprehensive Playwright visual tests at 3 viewport sizes matching the designs.

**Architecture:** Components are extracted from the .pen design file's component library into dedicated React files under `activity/src/components/ui/`. Pages already work — we refactor to use new components and add the inline PlayerCard layout for the lobby. Visual tests cover each page at desktop (1280x800), tablet (1101x838), and mobile (393x852) viewports, plus isolated component tests.

**Tech Stack:** React, TypeScript, CSS (index.css), Playwright (Docker-only visual tests), Vite

---

## File Structure

### New Component Files (design system primitives)
- `activity/src/components/ui/IconButton.tsx` — Back button, icon-only actions
- `activity/src/components/ui/PrimaryCTA.tsx` — Gold gradient call-to-action button
- `activity/src/components/ui/SecondaryButton.tsx` — Outlined secondary actions
- `activity/src/components/ui/Divider.tsx` — Horizontal separator
- `activity/src/components/ui/CountBadge.tsx` — Small numeric badge
- `activity/src/components/ui/Checkbox.tsx` — Styled checkbox with label
- `activity/src/components/ui/ToggleButton.tsx` — Selectable toggle option
- `activity/src/components/ui/TextInput.tsx` — Labeled text input field
- `activity/src/components/ui/MultiPicker.tsx` — Labeled row of toggle options
- `activity/src/components/ui/RoleSectionHeader.tsx` — Role section with icon, label, count
- `activity/src/components/ui/index.ts` — Barrel export

### New Composed Components
- `activity/src/components/HeaderBar.tsx` — Unified header bar for all views
- `activity/src/components/CharacterHeader.tsx` — Character info header with gradient
- `activity/src/components/PlayerCard.tsx` — Inline player editing card (replaces modal in lobby layout)

### Modified Files
- `activity/src/components/Layout.tsx` — Remove inline header, use HeaderBar
- `activity/src/components/ChannelCard.tsx` — Use CountBadge
- `activity/src/views/HomeView.tsx` — Use HeaderBar, PrimaryCTA
- `activity/src/views/ChannelsView.tsx` — Use HeaderBar, IconButton, SecondaryButton
- `activity/src/views/LobbyView.tsx` — Use HeaderBar, RoleSectionHeader, PrimaryCTA, inline PlayerCard
- `activity/src/views/WheelsView.tsx` — Use HeaderBar, PrimaryCTA, Checkbox
- `activity/src/views/ResultsView.tsx` — Use HeaderBar, SecondaryButton
- `activity/src/index.css` — Add styles for new components, lobby inline PlayerCard layout

### New Test Files
- `activity/tests/components.spec.ts` — Visual tests for isolated components
- `activity/tests/pages.spec.ts` — Visual tests for all 5 pages at 3 viewport sizes

---

## Task 1: Create UI Primitive Components

**Files:**
- Create: `activity/src/components/ui/IconButton.tsx`
- Create: `activity/src/components/ui/PrimaryCTA.tsx`
- Create: `activity/src/components/ui/SecondaryButton.tsx`
- Create: `activity/src/components/ui/Divider.tsx`
- Create: `activity/src/components/ui/CountBadge.tsx`
- Create: `activity/src/components/ui/Checkbox.tsx`
- Create: `activity/src/components/ui/ToggleButton.tsx`
- Create: `activity/src/components/ui/TextInput.tsx`
- Create: `activity/src/components/ui/MultiPicker.tsx`
- Create: `activity/src/components/ui/RoleSectionHeader.tsx`
- Create: `activity/src/components/ui/index.ts`
- Modify: `activity/src/index.css`

- [ ] **Step 1:** Create all UI primitive component files with proper TypeScript interfaces
- [ ] **Step 2:** Add CSS styles for new components to index.css
- [ ] **Step 3:** Create barrel export in index.ts
- [ ] **Step 4:** Run `npm -w packages/shared run typecheck && cd activity && npm run typecheck` to verify types
- [ ] **Step 5:** Commit

## Task 2: Create HeaderBar Component

**Files:**
- Create: `activity/src/components/HeaderBar.tsx`
- Modify: `activity/src/index.css`

- [ ] **Step 1:** Create HeaderBar component with back button (optional), Wheelson icon, title/subtitle, commit hash
- [ ] **Step 2:** Add CSS styles matching the design (AweHQ component from .pen file)
- [ ] **Step 3:** Run typecheck to verify
- [ ] **Step 4:** Commit

## Task 3: Create CharacterHeader and PlayerCard Components

**Files:**
- Create: `activity/src/components/CharacterHeader.tsx`
- Create: `activity/src/components/PlayerCard.tsx`
- Modify: `activity/src/index.css`

- [ ] **Step 1:** Create CharacterHeader with gradient background, avatar placeholder, name, class
- [ ] **Step 2:** Create PlayerCard composing CharacterHeader + TextInput + MultiPicker + SecondaryButton
- [ ] **Step 3:** Add CSS styles matching designs (DgJNl, YaZRr from .pen)
- [ ] **Step 4:** Run typecheck to verify
- [ ] **Step 5:** Commit

## Task 4: Refactor Layout and HomeView

**Files:**
- Modify: `activity/src/components/Layout.tsx`
- Modify: `activity/src/views/HomeView.tsx`
- Modify: `activity/src/index.css`

- [ ] **Step 1:** Update Layout.tsx — keep as shell but delegate header rendering to individual views via HeaderBar
- [ ] **Step 2:** Update HomeView to use HeaderBar with title="Recent Guilds", no back button, no subtitle
- [ ] **Step 3:** Replace "Start Demo" button with PrimaryCTA component
- [ ] **Step 4:** Run typecheck and ensure app builds: `cd activity && npm run build`
- [ ] **Step 5:** Commit

## Task 5: Refactor ChannelsView

**Files:**
- Modify: `activity/src/views/ChannelsView.tsx`
- Modify: `activity/src/components/ChannelCard.tsx`

- [ ] **Step 1:** Update ChannelsView to use HeaderBar with back button, title="Select a Voice Channel"
- [ ] **Step 2:** Update ChannelCard to use CountBadge for user count
- [ ] **Step 3:** Use SecondaryButton for Refresh button
- [ ] **Step 4:** Run typecheck and build
- [ ] **Step 5:** Commit

## Task 6: Refactor LobbyView with Inline PlayerCard

**Files:**
- Modify: `activity/src/views/LobbyView.tsx`
- Modify: `activity/src/index.css`

- [ ] **Step 1:** Update LobbyView to use HeaderBar with back button, title="Players", subtitle with player count
- [ ] **Step 2:** Replace inline role section headers with RoleSectionHeader component
- [ ] **Step 3:** Add inline PlayerCard to lobby layout (right side on desktop, top on mobile)
- [ ] **Step 4:** Use PrimaryCTA for SPIN button
- [ ] **Step 5:** Add CSS for lobby split layout (player list left, PlayerCard right on desktop; PlayerCard top, list bottom on mobile)
- [ ] **Step 6:** Run typecheck and build
- [ ] **Step 7:** Commit

## Task 7: Refactor WheelsView and ResultsView

**Files:**
- Modify: `activity/src/views/WheelsView.tsx`
- Modify: `activity/src/views/ResultsView.tsx`

- [ ] **Step 1:** Update WheelsView to use HeaderBar, PrimaryCTA, Checkbox component
- [ ] **Step 2:** Update ResultsView to use HeaderBar with gold "All Groups Formed!" title, SecondaryButton components
- [ ] **Step 3:** Run typecheck and build
- [ ] **Step 4:** Commit

## Task 8: Create Page Visual Tests

**Files:**
- Create: `activity/tests/pages.spec.ts`

Design viewport sizes:
- Desktop: 1280x800
- Tablet: 1101x838
- Mobile: 393x852

- [ ] **Step 1:** Create pages.spec.ts with tests for all 5 pages at all 3 viewports:
  - Home View (with recent guilds + empty state)
  - Channels View (with channels)
  - Lobby View (with players + empty + sitting out)
  - Wheels View (static wheels + spinning ready)
  - Results View (with groups)
- [ ] **Step 2:** Run `./scripts/playwright-docker.sh --update-snapshots` to generate baseline screenshots
- [ ] **Step 3:** Run `./scripts/playwright-docker.sh` to verify tests pass against baselines
- [ ] **Step 4:** Commit

## Task 9: Create Component Visual Tests

**Files:**
- Create: `activity/tests/components.spec.ts`

- [ ] **Step 1:** Create components.spec.ts with a test page that renders isolated components
- [ ] **Step 2:** Add visual tests for: IconButton, PrimaryCTA, SecondaryButton, ToggleButton, Checkbox, TextInput, CountBadge, RoleSectionHeader, GuildCard, ChannelCard, GroupCard, PlayerChip, HeaderBar, PlayerCard
- [ ] **Step 3:** Run `./scripts/playwright-docker.sh --update-snapshots` to generate baselines
- [ ] **Step 4:** Run `./scripts/playwright-docker.sh` to verify tests pass
- [ ] **Step 5:** Commit

## Task 10: Update Existing Visual Tests

**Files:**
- Modify: `activity/tests/visual.spec.ts`

- [ ] **Step 1:** Update existing visual tests if any selectors changed due to refactoring
- [ ] **Step 2:** Run `./scripts/playwright-docker.sh --update-snapshots` to regenerate all snapshots
- [ ] **Step 3:** Run `./scripts/playwright-docker.sh` to verify all tests pass
- [ ] **Step 4:** Commit

## Task 11: Final Verification & PR

- [ ] **Step 1:** Run full verification: `./scripts/verify-activity.sh`
- [ ] **Step 2:** Run `./scripts/verify-ts.sh`
- [ ] **Step 3:** Create feature branch and PR
- [ ] **Step 4:** Wait for CI, address review comments, merge
