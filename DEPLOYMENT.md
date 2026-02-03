# Deployment Guide for MythicPlusDiscordBot

This guide explains how to set up the enhanced MythicPlusDiscordBot with Voice, Sound, and Activities on your Raspberry Pi.

## 1. Raspberry Pi Setup (using Docker)

The easiest way to run the bot is using Docker, which handles all dependencies including `ffmpeg` and `PyNaCl`.

1.  **Install Docker and Docker Compose** on your Raspberry Pi if you haven't already.
2.  **Clone the repository** to your Pi.
3.  **Configure Environment Variables**:
    You have two main options for managing secrets:

    ### Option A: Use Host Environment Variables (Recommended)
    You can set the environment variables directly in your shell or your user's profile (`~/.bashrc` or `~/.profile`):
    ```bash
    export BOT_TOKEN=your_discord_bot_token
    export DISCORD_APPLICATION_ID=your_discord_application_id
    ```
    Docker Compose will automatically pick these up from your environment.

    ### Option B: Use a `.env` file
    Create a `.env` file in the root directory:
    ```env
    BOT_TOKEN=your_discord_bot_token
    DISCORD_APPLICATION_ID=your_discord_application_id
    ```

4.  **Using GitHub Secrets (CI/CD)**:
    If you use GitHub Actions to deploy to your Raspberry Pi, you can store these as **GitHub Secrets** and inject them during deployment.

    Example GitHub Action snippet for deployment via SSH:
    ```yaml
    - name: Deploy to Pi
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.PI_HOST }}
        username: ${{ secrets.PI_USER }}
        key: ${{ secrets.PI_SSH_KEY }}
        script: |
          cd ~/MythicPlusDiscordBot
          git pull
          export BOT_TOKEN=${{ secrets.BOT_TOKEN }}
          export DISCORD_APPLICATION_ID=${{ secrets.DISCORD_APPLICATION_ID }}
          docker-compose up -d --build
    ```

5.  **Start the Bot**:
    ```bash
    docker-compose up -d --build
    ```
    *Note: The Docker build process will automatically run `setup_assets.py` to download sound effects and generate the spinning wheel GIF.*

## 2. Discord Developer Portal (for Activities)

To enable the `!activity` command, you need to configure your bot as a Discord Activity.

1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Select your Application.
3.  Go to **Activities** -> **Getting Started**.
4.  Set up the **URL Mapping**:
    - Set the origin to your GitHub Pages URL (see below).
5.  Note your **Application ID** and ensure it's in the `.env` file as `DISCORD_APPLICATION_ID`.

## 3. Hosting the Activity (GitHub Pages)

The Discord Activity is a static web app located in the `activity/` folder.

1.  Create a new repository on GitHub.
2.  Upload the contents of the `activity/` folder (`index.html`, `style.css`, `script.js`) to the repository.
3.  Enable **GitHub Pages** in the repository settings (Settings -> Pages).
4.  Once deployed, you will get a URL like `https://yourusername.github.io/your-repo/`.
5.  Use this URL in the Discord Developer Portal for URL Mapping.

## 5. Bot Commands

- `!wheel`: The classic text-based reveal.
- `!newwheel`: Enhanced UI with Voice Channel integration, sound effects, and a spinning wheel GIF.
- `!activity`: Everything in `!newwheel` plus an invite to join the Discord Activity for a synchronized wheel experience.

## 6. Troubleshooting

- **Audio not working**: Ensure the bot has "Connect" and "Speak" permissions in the voice channel.
- **Activity not starting**: Ensure the `DISCORD_APPLICATION_ID` is correct and the URL mapping in the Discord Developer Portal is properly configured.
- **Docker issues**: Check logs with `docker-compose logs -f`.
- **Manual Asset Setup**: If you are not using Docker, you can run `python3 setup_assets.py` manually to prepare the sounds and GIF.
