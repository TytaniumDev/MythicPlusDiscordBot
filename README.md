# MythicPlusDiscordBot 💎

[![Build Status](https://github.com/tytaniumdev/MythicPlusDiscordBot/actions/workflows/deploy.yml/badge.svg)](https://github.com/tytaniumdev/MythicPlusDiscordBot/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Covered by Argos Visual Testing](https://argos-ci.com/badge.svg)](https://app.argos-ci.com/tytaniumdev/MythicPlusDiscordBot/reference)

### [ 🚀 Launch App ](https://tytaniumdev.github.io/MythicPlusDiscordBot/)  |  [ 📖 Documentation ](ARCHITECTURE.md)  |  [ 🐞 Report Bug ](https://github.com/tytaniumdev/MythicPlusDiscordBot/issues/new?template=bug_report.md)

> **The "Front Door" for your guild's Mythic+ groups.**
> Seamlessly organize, calculate, and announce Mythic+ groups directly in Discord with voice integration and interactive activities.

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

3.  **Run the Bot**
    ```bash
    # Ensure you have your BOT_TOKEN set in your environment
    export BOT_TOKEN="your_token_here"
    uv run python bot.py
    ```

## ✨ Key Features

*   **Group Organization**: Automatically calculate balanced Mythic+ groups based on player roles and key levels.
*   **Discord Activity**: Interactive "Wheel of Fate" for selecting keys or players, integrated directly into Discord voice channels.
*   **Voice Integration**: The bot joins voice channels to announce results and play sound effects.
*   **GitHub Integration**: Report bugs and request features directly from Discord using `/bug` and `/featurerequest`.

## 🗺️ Documentation Map

*   **🏗️ Architecture**: [Read `ARCHITECTURE.md`](./ARCHITECTURE.md) - Understanding the core logic and services.
*   **🚀 Deployment**: [Read `DEPLOYMENT.md`](./DEPLOYMENT.md) - Docker, Raspberry Pi, and GitHub Actions setup.
*   **🎮 Activity Setup**: [Read `ACTIVITY_SETUP.md`](./ACTIVITY_SETUP.md) - Configuring the Discord Activity and Frontend.
*   **🔥 Firebase Setup**: [Read `FIREBASE_SETUP.md`](./FIREBASE_SETUP.md) - Database and Auth configuration.
*   **👨‍💻 Contributing**: [Read `AGENTS.md`](./AGENTS.md) - Development standards and guidelines.

## 🤝 Contributing

We welcome contributions! Please check `AGENTS.md` for development standards and guidelines.

1.  **Install Pre-commit Hooks**
    ```bash
    pre-commit install
    ```
2.  **Verify Changes**
    ```bash
    ./scripts/verify.sh
    ```

---

_Maintained by TytaniumDev_
