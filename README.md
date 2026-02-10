# MythicPlusDiscordBot 💎

[![Build Status](https://github.com/tytaniumdev/MythicPlusDiscordBot/actions/workflows/deploy.yml/badge.svg)](https://github.com/tytaniumdev/MythicPlusDiscordBot/actions)
[![Lint](https://github.com/tytaniumdev/MythicPlusDiscordBot/actions/workflows/lint.yml/badge.svg)](https://github.com/tytaniumdev/MythicPlusDiscordBot/actions/workflows/lint.yml)
[![Tests](https://github.com/tytaniumdev/MythicPlusDiscordBot/actions/workflows/test.yml/badge.svg)](https://github.com/tytaniumdev/MythicPlusDiscordBot/actions/workflows/test.yml)
[![Activity](https://github.com/tytaniumdev/MythicPlusDiscordBot/actions/workflows/verify-activity.yml/badge.svg)](https://github.com/tytaniumdev/MythicPlusDiscordBot/actions/workflows/verify-activity.yml)
[![Covered by Argos Visual Testing](https://argos-ci.com/badge.svg)](https://app.argos-ci.com/tytaniumdev/MythicPlusDiscordBot/reference)

### [ 🚀 Launch App ](https://tytaniumdev.github.io/MythicPlusDiscordBot/)  |  [ 📖 Documentation ](#documentation-map)  |  [ 🐞 Report Bug ](https://github.com/tytaniumdev/MythicPlusDiscordBot/issues/new?template=bug_report.md)

> **The "Front Door" for your guild's Mythic+ groups.**
> Seamlessly organize, calculate, and announce Mythic+ groups directly in Discord with interactive activities.

---

## 📸 Preview

![Hero Visual](https://placehold.co/600x400?text=App+Screenshot+Coming+Soon)

## ⚡ Quick Start (Local Development)

Get up and running in less than 5 minutes.

1.  **Clone the repo**
    ```bash
    git clone https://github.com/TytaniumDev/MythicPlusDiscordBot.git
    cd MythicPlusDiscordBot
    ```

2.  **Install Dependencies**
    We recommend using [uv](https://github.com/astral-sh/uv) for fast, reliable dependency management.
    ```bash
    uv sync
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory:
    ```bash
    echo "BOT_TOKEN=your_token_here" > .env
    ```

4.  **Run the Bot**
    ```bash
    uv run python bot.py
    ```

## ✨ Key Features

*   **Group Organization**: Automatically calculate balanced Mythic+ groups based on player roles and key levels.
*   **Discord Activity**: Interactive "Wheel of Fate" for selecting keys or players, integrated directly into Discord voice channels.
*   **GitHub Integration**: Report bugs and request features directly from Discord using `/bug` and `/featurerequest`.

## 🗺️ Documentation Map <a id="documentation-map"></a>

*   **🏗️ Architecture**: [Read `ARCHITECTURE.md`](./ARCHITECTURE.md) - Understanding the core logic and services.
*   **🚀 Deployment**: [Read `DEPLOYMENT.md`](./DEPLOYMENT.md) - Docker, Raspberry Pi, and GitHub Actions setup.
*   **🎮 Activity Setup**: [Read `ACTIVITY_SETUP.md`](./ACTIVITY_SETUP.md) - Configuring the Discord Activity and Frontend.
*   **🔥 Firebase Setup**: [Read `FIREBASE_SETUP.md`](./FIREBASE_SETUP.md) - Database and Auth configuration.
*   **👨‍💻 Contributing**: [Read `CONTRIBUTING.md`](./CONTRIBUTING.md) - Setup and guidelines.

## 🤝 Contributing

We welcome contributions! Please check `CONTRIBUTING.md` for setup instructions and `AGENTS.md` for development standards.

1.  **Install Pre-commit Hooks**
    ```bash
    pre-commit install
    ```
2.  **Verify Changes**
    ```bash
    ./scripts/verify.sh
    ```
3.  **Activity visual changes:** If you change the activity frontend in ways that affect how pages look, run `cd activity && npx playwright test --update-snapshots` and commit any updated files under `activity/tests/visual-baselines/`.

---

_Maintained by TytaniumDev_
