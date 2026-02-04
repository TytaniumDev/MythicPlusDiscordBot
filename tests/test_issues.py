import unittest
from unittest.mock import AsyncMock, patch

import discord

from issues import GitHubError, GitHubIssueModal, create_github_issue


class TestIssues(unittest.IsolatedAsyncioTestCase):
    async def test_create_github_issue_success(self):
        # Mock config values
        with (
            patch("config.GITHUB_TOKEN", "fake_token"),
            patch("config.GITHUB_REPO_OWNER", "owner"),
            patch("config.GITHUB_REPO_NAME", "repo"),
        ):
            with patch("aiohttp.ClientSession.post") as mock_post:
                mock_response = AsyncMock()
                mock_response.status = 201
                mock_response.json.return_value = {
                    "html_url": "http://github.com/issue/1"
                }
                mock_post.return_value.__aenter__.return_value = mock_response

                result = await create_github_issue("Title", "Body", ["bug"])
                self.assertEqual(result["html_url"], "http://github.com/issue/1")

    async def test_create_github_issue_failure(self):
        with (
            patch("config.GITHUB_TOKEN", "fake_token"),
            patch("config.GITHUB_REPO_OWNER", "owner"),
            patch("config.GITHUB_REPO_NAME", "repo"),
        ):
            with patch("aiohttp.ClientSession.post") as mock_post:
                mock_response = AsyncMock()
                mock_response.status = 401
                mock_response.text.return_value = "Unauthorized"
                mock_post.return_value.__aenter__.return_value = mock_response

                with self.assertRaises(GitHubError):
                    await create_github_issue("Title", "Body", ["bug"])

    async def test_modal_submission(self):
        # Mock interaction and user
        mock_interaction = AsyncMock(spec=discord.Interaction)
        mock_interaction.user.global_name = "TestUser"
        mock_interaction.user.name = "testuser"
        mock_interaction.user.id = 12345
        mock_interaction.response = AsyncMock()
        mock_interaction.followup = AsyncMock()

        modal = GitHubIssueModal(issue_type="bug")

        # Simulate user input (accessing _value is necessary for testing discord.py modals)
        modal.issue_title._value = "Bug Title"  # pyright: ignore[reportPrivateUsage]
        modal.description._value = "Bug Description"  # pyright: ignore[reportPrivateUsage]
        modal.extra_info._value = "Steps"  # pyright: ignore[reportPrivateUsage]

        # Mock config and create_github_issue
        with patch("issues.create_github_issue", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = {"html_url": "http://url"}

            await modal.on_submit(mock_interaction)

            mock_create.assert_called_once()
            args, _ = mock_create.call_args
            title, body, labels = args

            self.assertEqual(title, "Bug Title")
            self.assertIn("Bug Description", body)
            self.assertIn("Steps", body)
            self.assertEqual(labels, ["bug", "jules"])

            mock_interaction.followup.send.assert_called_with(
                "✅ Issue created successfully: http://url", ephemeral=True
            )
