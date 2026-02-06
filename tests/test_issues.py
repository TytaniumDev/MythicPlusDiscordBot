import os
import sys
import unittest
from unittest.mock import AsyncMock, mock_open, patch

import discord

# Add project root to sys.path to allow imports from core
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.issues import GitHubError, GitHubIssueModal, create_github_issue


class TestIssues(unittest.IsolatedAsyncioTestCase):
    async def test_create_github_issue_success(self):
        # Mock config values
        with (
            patch("core.config.GITHUB_TOKEN", "fake_token"),
            patch("core.config.GITHUB_REPO_OWNER", "owner"),
            patch("core.config.GITHUB_REPO_NAME", "repo"),
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
            patch("core.config.GITHUB_TOKEN", "fake_token"),
            patch("core.config.GITHUB_REPO_OWNER", "owner"),
            patch("core.config.GITHUB_REPO_NAME", "repo"),
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
        modal.include_logs._value = "Yes"  # pyright: ignore[reportPrivateUsage]

        # Mock config and create_github_issue
        with (
            patch("core.issues.create_github_issue", new_callable=AsyncMock) as mock_create,
            patch("core.config.GIT_SHA", "abc123456"),
            patch("core.config.GITHUB_REPO_OWNER", "owner"),
            patch("core.config.GITHUB_REPO_NAME", "repo"),
        ):
            mock_create.return_value = {"html_url": "http://url"}

            await modal.on_submit(mock_interaction)

            mock_create.assert_called_once()
            args, _ = mock_create.call_args
            title, body, labels = args

            self.assertEqual(title, "Bug Title")
            self.assertIn("Bug Description", body)
            self.assertIn("Steps", body)
            self.assertEqual(labels, ["bug", "jules"])

            # Verify version string
            expected_version = "[`abc1234`](https://github.com/owner/repo/commit/abc123456)"
            self.assertIn(f"**Version:** {expected_version}", body)

            mock_interaction.followup.send.assert_called_with(
                "✅ Issue created successfully: http://url", ephemeral=True
            )

    async def test_modal_submission_failure(self):
        # Mock interaction
        mock_interaction = AsyncMock(spec=discord.Interaction)
        mock_interaction.user.global_name = "TestUser"
        mock_interaction.user.name = "testuser"
        mock_interaction.user.id = 12345
        mock_interaction.response = AsyncMock()
        mock_interaction.followup = AsyncMock()

        modal = GitHubIssueModal(issue_type="bug")
        # Simulate user input
        modal.issue_title._value = "Bug Title"  # pyright: ignore[reportPrivateUsage]
        modal.description._value = "Bug Description"  # pyright: ignore[reportPrivateUsage]
        modal.extra_info._value = "Steps"  # pyright: ignore[reportPrivateUsage]
        modal.include_logs._value = "Yes"  # pyright: ignore[reportPrivateUsage]

        with patch(
            "core.issues.create_github_issue", side_effect=Exception("Test Error")
        ):
            await modal.on_submit(mock_interaction)

            mock_interaction.followup.send.assert_called_with(
                "❌ Failed to create issue: Test Error", ephemeral=True
            )

    async def test_modal_submission_with_logs(self):
        # Mock interaction and user
        mock_interaction = AsyncMock(spec=discord.Interaction)
        mock_interaction.user.global_name = "TestUser"
        mock_interaction.user.name = "testuser"
        mock_interaction.user.id = 12345
        mock_interaction.response = AsyncMock()
        mock_interaction.followup = AsyncMock()

        modal = GitHubIssueModal(issue_type="bug")

        # Simulate user input
        modal.issue_title._value = "Bug Title"  # pyright: ignore[reportPrivateUsage]
        modal.description._value = "Bug Description"  # pyright: ignore[reportPrivateUsage]
        modal.extra_info._value = "Steps"  # pyright: ignore[reportPrivateUsage]
        modal.include_logs._value = "Yes"  # pyright: ignore[reportPrivateUsage]

        # Mock config and create_github_issue
        with (
            patch(
                "core.issues.create_github_issue", new_callable=AsyncMock
            ) as mock_create,
            patch("os.path.exists", return_value=True),
            patch("builtins.open", mock_open(read_data="Line 1\nLine 2\nLine 3")),
        ):
            mock_create.return_value = {"html_url": "http://url"}

            await modal.on_submit(mock_interaction)

            mock_create.assert_called_once()
            args, _ = mock_create.call_args
            title, body, labels = args

            self.assertEqual(title, "Bug Title")
            self.assertEqual(labels, ["bug", "jules"])
            self.assertIn("Recent Logs:", body)
            self.assertIn("Line 1", body)
            self.assertIn("Line 3", body)

    async def test_modal_submission_without_logs(self):
        # Mock interaction and user
        mock_interaction = AsyncMock(spec=discord.Interaction)
        mock_interaction.user.global_name = "TestUser"
        mock_interaction.user.name = "testuser"
        mock_interaction.user.id = 12345
        mock_interaction.response = AsyncMock()
        mock_interaction.followup = AsyncMock()

        modal = GitHubIssueModal(issue_type="bug")

        # Simulate user input
        modal.issue_title._value = "Bug Title"  # pyright: ignore[reportPrivateUsage]
        modal.description._value = "Bug Description"  # pyright: ignore[reportPrivateUsage]
        modal.extra_info._value = "Steps"  # pyright: ignore[reportPrivateUsage]
        modal.include_logs._value = "No"  # pyright: ignore[reportPrivateUsage]

        # Mock config and create_github_issue
        with (
            patch(
                "core.issues.create_github_issue", new_callable=AsyncMock
            ) as mock_create,
            patch("os.path.exists", return_value=True),
            patch("builtins.open", mock_open(read_data="Line 1\nLine 2\nLine 3")),
        ):
            mock_create.return_value = {"html_url": "http://url"}

            await modal.on_submit(mock_interaction)

            mock_create.assert_called_once()
            args, _ = mock_create.call_args
            _, body, _ = args

            self.assertNotIn("Recent Logs:", body)
