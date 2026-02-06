# MythicPlusDiscordBot 💎

[![Discord](https://img.shields.io/discord/1234567890?color=5865F2&label=Discord&logo=discord&logoColor=white)](https://github.com/TytaniumDev/MythicPlusDiscordBot)
[![Build Status](https://github.com/TytaniumDev/MythicPlusDiscordBot/actions/workflows/deploy.yml/badge.svg)](https://github.com/TytaniumDev/MythicPlusDiscordBot/actions)
[![License](https://img.shields.io/github/license/TytaniumDev/MythicPlusDiscordBot)](LICENSE)

> **The "Front Door" for your guild's Mythic+ groups.**
> Seamlessly organize, calculate, and announce Mythic+ groups directly in Discord with voice integration and interactive activities.

---

### 🚀 [Launch App](https://tytaniumdev.github.io/MythicPlusDiscordBot/) | 📖 [Documentation](#-documentation-map) | 🐞 [Report Bug](https://github.com/TytaniumDev/MythicPlusDiscordBot/issues/new?template=bug_report.md)

---

## ✨ Key Features

*   **Group Organization**: Automatically calculate balanced Mythic+ groups based on player roles and key levels.
*   **Discord Activity**: Interactive "Wheel of Fate" for selecting keys or players, integrated directly into Discord voice channels.
*   **Voice Integration**: The bot joins voice channels to announce results and play sound effects.
*   **GitHub Integration**: Report bugs and request features directly from Discord using `/bug` and `/featurerequest`.

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
    ```bash
    # Using uv (recommended)
    uv pip install -r requirements-dev.txt

    # OR using standard pip
    pip install -r requirements-dev.txt
    ```

3.  **Run the Bot**
    ```bash
    # Ensure you have your BOT_TOKEN set in your environment
    export BOT_TOKEN="your_token_here"
    python bot.py
    ```

## 🗺️ Documentation Map

*   **🏗️ Architecture**: [Read `ARCHITECTURE.md`](./ARCHITECTURE.md) - Understanding the core logic and services.
*   **🚀 Deployment**: [Read `DEPLOYMENT.md`](./DEPLOYMENT.md) - Docker, Raspberry Pi, and GitHub Actions setup.
*   **🎮 Activity Setup**: [Read `ACTIVITY_SETUP.md`](./ACTIVITY_SETUP.md) - Configuring the Discord Activity and Frontend.
*   **🔥 Firebase Setup**: [Read `FIREBASE_SETUP.md`](./FIREBASE_SETUP.md) - Database and Auth configuration.

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
