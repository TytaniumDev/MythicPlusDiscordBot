import aiohttp
import discord
from discord import ui

from . import config


class GitHubError(Exception):
    """Raised when GitHub API calls fail."""

    pass


async def create_github_issue(
    title: str, body: str, labels: list[str]
) -> dict[str, object]:
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
    def __init__(self, issue_type: str) -> None:
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
            print(f"Error creating GitHub issue: {e}")
            await interaction.followup.send(
                f"❌ Failed to create issue: {e}",
                ephemeral=True,
            )
