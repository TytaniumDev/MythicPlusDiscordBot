import asyncio
import logging
import os
from collections import deque
from typing import Any

import aiohttp
import discord
from discord import ui

from . import config

logger = logging.getLogger(__name__)


class GitHubError(Exception):
    """Raised when GitHub API calls fail."""

    pass


async def _get_recent_logs() -> str | None:
    """Helper to read the last 50 lines of the log file."""
    if os.path.exists(config.LOG_FILE):
        try:

            def read_last_logs():
                with open(config.LOG_FILE, encoding="utf-8") as f:
                    return "".join(deque(f, maxlen=50))

            return await asyncio.to_thread(read_last_logs)
        except Exception as e:
            logger.error("Failed to read logs: %s", e)
    return None


async def create_github_issue(
    title: str, body: str, labels: list[str]
) -> dict[str, Any]:
    if (
        not config.GITHUB_TOKEN
        or not config.GITHUB_REPO_OWNER
        or not config.GITHUB_REPO_NAME
    ):
        raise GitHubError(
            "GitHub configuration is missing. Please check your .env file."
        )

    url = f"https://api.github.com/repos/{config.GITHUB_REPO_OWNER}/{config.GITHUB_REPO_NAME}/issues"
    headers = {
        "Authorization": f"token {config.GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }
    data = {"title": title, "body": body, "labels": labels}

    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=data) as response:
            if response.status == 201:
                return await response.json()
            else:
                error_text = await response.text()
                raise GitHubError(
                    f"Failed to create issue: {response.status} - {error_text}"
                )


class GitHubIssueModal(ui.Modal):
    def __init__(self, issue_type: str, include_logs: bool = True) -> None:
        self.issue_type = issue_type
        modal_title = "Feature Request" if issue_type == "feature" else "Bug Report"
        super().__init__(title=modal_title)

        self.issue_title = ui.TextInput(
            label="Title", placeholder="Short summary...", required=True, max_length=100
        )
        self.add_item(self.issue_title)

        self.description = ui.TextInput(
            label="Description",
            style=discord.TextStyle.paragraph,
            placeholder="Detailed description...",
            required=True,
        )
        self.add_item(self.description)

        if issue_type == "bug":
            self.extra_info = ui.TextInput(
                label="Reproduction Steps",
                style=discord.TextStyle.paragraph,
                placeholder="1. Do this\n2. Do that...",
                required=False,
            )
        else:
            self.extra_info = ui.TextInput(
                label="Benefit / Impact",
                style=discord.TextStyle.paragraph,
                placeholder="How will this help?",
                required=False,
            )
        self.add_item(self.extra_info)

        if issue_type == "bug":
            self.include_logs = ui.TextInput(
                label="Include Logs? (Type 'Yes' or 'No')",
                default="Yes" if include_logs else "No",
                placeholder="Yes",
                min_length=2,
                max_length=3,
                required=True,
            )
            self.add_item(self.include_logs)

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        title = self.issue_title.value
        description = self.description.value
        extra = self.extra_info.value

        # Format reporter name safely
        reporter = interaction.user.global_name or interaction.user.name

        body = f"**Reporter:** {reporter} (`{interaction.user.id}`)\n\n**Description:**\n{description}\n"

        if extra:
            section_title = (
                "Reproduction Steps" if self.issue_type == "bug" else "Benefit/Impact"
            )
            body += f"\n**{section_title}:**\n{extra}\n"

        if self.issue_type == "bug":
            should_include_logs = self.include_logs.value.lower().startswith("y")
            if should_include_logs:
                last_lines = await _get_recent_logs()
                if last_lines:
                    body += f"\n**Recent Logs:**\n```log\n{last_lines}\n```\n"

        # Add Jules label for automation
        labels = ["bug"] if self.issue_type == "bug" else ["enhancement"]
        labels.append("jules")

        try:
            issue = await create_github_issue(title, body, labels)
            await interaction.followup.send(
                f"✅ Issue created successfully: {issue['html_url']}", ephemeral=True
            )
        except Exception as e:
            # Log the error for the admin/bot owner
            logger.error("Error creating GitHub issue: %s", e)
            await interaction.followup.send(
                f"❌ Failed to create issue: {e}",
                ephemeral=True,
            )


async def report_bad_group(
    user: discord.User | discord.Member,
    last_results: dict[str, Any],
    title: str,
    description: str,
    include_logs: bool = True,
) -> dict[str, Any]:
    """Helper function to format and create a GitHub issue for a bad group."""
    formatted_title = f"[Bad Group] {title}"

    # Format reporter name safely
    reporter = user.global_name or user.name

    players = last_results.get("players", [])
    groups = last_results.get("groups", [])

    # Format the reproduction data
    repro_info = (
        "**Input Players:**\n```python\n["
        + ", ".join(p.toTestString() for p in players)
        + "]\n```\n"
    )
    repro_info += (
        "**Resulting Groups:**\n```python\n["
        + ", ".join(g.toTestString() for g in groups)
        + "]\n```\n"
    )

    body = (
        f"**Reporter:** {reporter} (`{user.id}`)\n\n"
        f"**Description:**\n{description}\n\n"
        f"{repro_info}"
    )

    # Include recent logs as well
    if include_logs:
        last_lines = await _get_recent_logs()
        if last_lines:
            body += f"\n**Recent Logs:**\n```log\n{last_lines}\n```\n"

    # Add labels for automation and categorization
    labels = ["bug", "bad-group"]

    return await create_github_issue(formatted_title, body, labels)


class BadGroupIssueModal(ui.Modal):
    def __init__(self, last_results: dict[str, Any]) -> None:
        super().__init__(title="Bad Group Report")
        self.last_results = last_results

        self.issue_title = ui.TextInput(
            label="Title",
            placeholder="What's the issue? (e.g. Too many melee in Group 1)",
            required=True,
            max_length=100,
        )
        self.add_item(self.issue_title)

        self.description = ui.TextInput(
            label="Detailed Description",
            style=discord.TextStyle.paragraph,
            placeholder="Please explain why these groups are not ideal...",
            required=True,
        )
        self.add_item(self.description)

        self.include_logs = ui.TextInput(
            label="Include Logs? (Type 'Yes' or 'No')",
            default="Yes",
            placeholder="Yes",
            min_length=2,
            max_length=3,
            required=True,
        )
        self.add_item(self.include_logs)

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        should_include_logs = self.include_logs.value.lower().startswith("y")

        try:
            issue = await report_bad_group(
                interaction.user,
                self.last_results,
                self.issue_title.value,
                self.description.value,
                include_logs=should_include_logs,
            )
            await interaction.followup.send(
                f"✅ Bad group reported successfully: {issue['html_url']}",
                ephemeral=True,
            )
        except Exception as e:
            # Log the error for the admin/bot owner
            logger.error("Error creating GitHub issue: %s", e)
            await interaction.followup.send(
                f"❌ Failed to create issue: {e}",
                ephemeral=True,
            )
