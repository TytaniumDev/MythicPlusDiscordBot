import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import discord

# Add project root to sys.path to allow imports from core
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.issues import BadGroupIssueModal, report_bad_group  # noqa: E402, I001
from core.models import WoWGroup, WoWPlayer  # noqa: E402, I001


class TestBadGroup(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # Create dummy players and groups
        self.p1 = WoWPlayer.create("Player1", ["Tank"])
        self.p2 = WoWPlayer.create("Player2", ["Healer"])
        self.p3 = WoWPlayer.create("Player3", ["DPS"])
        self.p4 = WoWPlayer.create("Player4", ["DPS"])
        self.p5 = WoWPlayer.create("Player5", ["DPS"])

        self.players = [self.p1, self.p2, self.p3, self.p4, self.p5]
        self.group = WoWGroup(
            tank=self.p1, healer=self.p2, dps=[self.p3, self.p4, self.p5]
        )

        self.last_results = {"players": self.players, "groups": [self.group]}

    async def test_report_bad_group_function(self):
        # Mock user
        mock_user = MagicMock(spec=discord.Member)
        mock_user.global_name = "TestUser"
        mock_user.id = 12345

        with patch(
            "core.issues.create_github_issue", new_callable=AsyncMock
        ) as mock_create:
            mock_create.return_value = {"html_url": "http://url"}

            result = await report_bad_group(
                mock_user, self.last_results, "Bad Algo", "Too many melee"
            )

            mock_create.assert_called_once()
            args, _ = mock_create.call_args
            title, body, labels = args

            self.assertEqual(title, "[Bad Group] Bad Algo")
            self.assertIn("Too many melee", body)
            self.assertIn('WoWPlayer.create("Player1"', body)
            self.assertEqual(labels, ["bug", "jules", "bad-group"])
            self.assertEqual(result["html_url"], "http://url")

    async def test_bad_group_modal_submission(self):
        # Mock interaction and user
        mock_interaction = AsyncMock(spec=discord.Interaction)
        mock_interaction.user.global_name = "TestUser"
        mock_interaction.user.name = "testuser"
        mock_interaction.user.id = 12345
        mock_interaction.response = AsyncMock()
        mock_interaction.followup = AsyncMock()

        modal = BadGroupIssueModal(self.last_results)

        # Simulate user input
        modal.issue_title._value = "Bad Algo"  # pyright: ignore[reportPrivateUsage]
        modal.description._value = "Too many melee"  # pyright: ignore[reportPrivateUsage]

        # Mock report_bad_group
        with patch(
            "core.issues.report_bad_group", new_callable=AsyncMock
        ) as mock_report:
            mock_report.return_value = {"html_url": "http://url"}

            await modal.on_submit(mock_interaction)

            mock_report.assert_called_once_with(
                mock_interaction.user, self.last_results, "Bad Algo", "Too many melee"
            )

            mock_interaction.followup.send.assert_called_with(
                "✅ Bad group reported successfully: http://url", ephemeral=True
            )


if __name__ == "__main__":
    unittest.main()
