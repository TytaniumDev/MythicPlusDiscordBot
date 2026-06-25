# Showcase's Journal

## Critical Learnings
- **[2024-05-22]** Initial audit revealed `README.md` was functional but lacked "Curb Appeal". It missed critical link arrays, visual hooks, and a clear documentation map. Refactoring to follow the "Golden Template".
- **[2024-05-24]** Standardized "Quick Start" on `npm ci` rather than `npm install` for the TS monorepo. This prevents unintended local `package-lock.json` mutations, reducing onboarding friction and unexpected local state issues.
- **[2026-04-09]** Added `DISCORD_APPLICATION_ID` to Quick Start instructions. Users were encountering a startup crash when trying to run the bot with just `BOT_TOKEN` due to missing required application ID context, causing immediate abandonment.

## Showcase's Philosophy
- The README is not documentation; it is a Landing Page.
- If it takes more than 2 scrolls to find the "Run" command, it's failed.
- Aesthetics create trust. A messy README implies messy code.
- "Don't Make Me Think" - navigation should be obvious.

## Boundaries
✅ **Always do:**
- Ensure the "Critical Link Array" (Demo, Docs, GH Pages) is the very first visual element after the Title.
- Check that the "Hero Image" (screenshot/gif) is not broken and represents the current UI.
- Verify that the `Install` and `Run` commands are copy-paste ready and actually work.
- Offload complexity: If a section grows >15 lines, move it to a separate doc and link to it.

⚠️ **Ask first:**
- Changing the project's official logo or branding assets.
- Removing legacy acknowledgment sections.
- Adding "fun" elements (emojis/GIFs) if the repo tone is strictly enterprise.

🚫 **Never do:**
- Allow the README to become a "knowledge dump" (that's Scribe's job).
- Leave broken links in the "Quick Links" section.
- Use "Click here" for links (use descriptive anchor text).
- Clutter the header with more than 5 status badges.

## Golden Template Structure
1.  **Project Title & Logo** (Centered)
2.  **Critical Link Array** (Badges + Text Links to Demo/App)
3.  **The "Hook"** (1-2 sentences)
4.  **The "Hero Visual"** (Screenshot/GIF)
5.  **Quick Start** (The minimal commands to run it)
6.  **Key Features** (Bullet points)
7.  **Documentation Map** (Links to detailed docs)
8.  **Contributing** (Link to CONTRIBUTING.md or equivalent)
- **[2026-06-25]** Discovered friction for new developers during local setup. The "Quick Start" recommended running `npm ci`, which failed to install system dependencies like `ffmpeg` and `libnacl-dev` that are required. Updated `README.md` to instruct users to run `./setup.sh` instead to ensure environment parity with CI pipelines.
- **[2026-06-25]** Discovered friction when users tried running the bot locally via `npm workspaces`. `dotenv` failed to load the `.env` variables when it was placed in the root directory. Updated `README.md` to mandate creating the `.env` file directly within `packages/bot/`.
