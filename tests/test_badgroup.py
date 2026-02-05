import os
import sys
import unittest
from unittest.mock import AsyncMock, patch

import discord

# Add project root to sys.path to allow imports from core
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.issues import BadGroupIssueModal  # noqa: E402, I001
from core.models import WoWGroup, WoWPlayer  # noqa: E402, I001


class TestBadGroup(unittest.IsolatedAsyncioTestCase):
    async def test_bad_group_modal_submission(self):
        # Mock interaction and user
        mock_interaction = AsyncMock(spec=discord.Interaction)
        mock_interaction.user.global_name = "TestUser"
        mock_interaction.user.name = "testuser"
        mock_interaction.user.id = 12345
        mock_interaction.response = AsyncMock()
        mock_interaction.followup = AsyncMock()

        # Create dummy players and groups
        p1 = WoWPlayer.create("Player1", ["Tank"])
        p2 = WoWPlayer.create("Player2", ["Healer"])
        p3 = WoWPlayer.create("Player3", ["DPS"])
        p4 = WoWPlayer.create("Player4", ["DPS"])
        p5 = WoWPlayer.create("Player5", ["DPS"])

        players = [p1, p2, p3, p4, p5]
        group = WoWGroup(tank=p1, healer=p2, dps=[p3, p4, p5])

        last_results = {"players": players, "groups": [group]}

        modal = BadGroupIssueModal(last_results)

        # Simulate user input
        modal.issue_title._value = "Bad Algo"  # pyright: ignore[reportPrivateUsage]
        modal.description._value = "Too many melee"  # pyright: ignore[reportPrivateUsage]

        # Mock config and create_github_issue
        with patch(
            "core.issues.create_github_issue", new_callable=AsyncMock
        ) as mock_create:
            mock_create.return_value = {"html_url": "http://url"}

            await modal.on_submit(mock_interaction)

            mock_create.assert_called_once()
            args, _ = mock_create.call_args
            title, body, labels = args

            self.assertEqual(title, "[Bad Group] Bad Algo")
            self.assertIn("Too many melee", body)
            self.assertIn("Input Players:", body)
            self.assertIn("Resulting Groups:", body)
            self.assertIn('WoWPlayer.create("Player1"', body)
            self.assertIn('WoWGroup(Tank="Player1"', body)
            self.assertEqual(labels, ["bug", "jules", "bad-group"])

            mock_interaction.followup.send.assert_called_with(
                "✅ Bad group reported successfully: http://url", ephemeral=True
            )


if __name__ == "__main__":
    unittest.main()
