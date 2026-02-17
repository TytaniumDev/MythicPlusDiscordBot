import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.config import ROLE_BREZ, ROLE_DPS, ROLE_HEALER, ROLE_LUST, ROLE_TANK
from core.group_ui import announce_group, build_group_embed
from core.models import WoWGroup, WoWPlayer


class TestGroupUI(unittest.IsolatedAsyncioTestCase):
    async def test_announce_group_debug(self):
        ctx = AsyncMock()
        channel = AsyncMock()

        tank = WoWPlayer.create("TankPlayer", [ROLE_TANK])
        healer = WoWPlayer.create("HealerPlayer", [ROLE_HEALER])
        dps1 = WoWPlayer.create("DPS1", [ROLE_DPS])
        dps2 = WoWPlayer.create("DPS2", [ROLE_DPS])
        dps3 = WoWPlayer.create("DPS3", [ROLE_DPS])

        group = WoWGroup(tank=tank, healer=healer, dps=[dps1, dps2, dps3])

        await announce_group(ctx, channel, group, 1, debug=True)

        # Verify ctx.send called once with an embed
        ctx.send.assert_called_once()
        _, kwargs = ctx.send.call_args
        embed = kwargs.get("embed")
        self.assertIsNotNone(embed)
        self.assertEqual(embed.title, "Group 1")

        # Verify fields (names should be visible in debug)
        fields = {f.name: f.value for f in embed.fields}
        self.assertEqual(fields["Tank"], "TankPlayer")
        self.assertEqual(fields["Healer"], "HealerPlayer")

    @patch("core.group_ui.get_masked_name", side_effect=lambda n: "?" * len(n))  # pyright: ignore[reportUnknownLambdaType]
    @patch("core.group_ui.show_short_typing", new_callable=AsyncMock)
    async def test_announce_group_normal(
        self, mock_typing: AsyncMock, mock_get_masked_name: MagicMock
    ):
        ctx = AsyncMock()
        channel = AsyncMock()

        # Mock the message returned by ctx.send
        message_mock = AsyncMock()
        ctx.send.return_value = message_mock
        # Important: message.edit returns the message (or a new one), so we must chain it
        message_mock.edit.return_value = message_mock

        tank = WoWPlayer.create("TankPlayer", [ROLE_TANK])
        healer = WoWPlayer.create("HealerPlayer", [ROLE_HEALER])
        dps1 = WoWPlayer.create("DPS1", [ROLE_DPS])
        dps2 = WoWPlayer.create("DPS2", [ROLE_DPS])
        dps3 = WoWPlayer.create("DPS3", [ROLE_DPS])

        group = WoWGroup(tank=tank, healer=healer, dps=[dps1, dps2, dps3])

        await announce_group(ctx, channel, group, 1, debug=False)

        # Verify that we called get_masked_name for each player
        # This confirms we went down the non-debug path
        self.assertTrue(mock_get_masked_name.called)
        self.assertGreaterEqual(mock_get_masked_name.call_count, 5)

        # Verify initial send was called
        ctx.send.assert_called_once()

        # Verify typing was called multiple times (5 times for roles)
        self.assertEqual(mock_typing.call_count, 5)

        # Verify edits happened (5 edits for roles + 2 for utils = 7 edits?)
        # Let's count logic:
        # 1. Edit Tank
        # 2. Edit Healer
        # 3. Edit DPS 1
        # 4. Edit DPS 2
        # 5. Edit DPS 3
        # 6. Edit Brez
        # 7. Edit Lust
        self.assertEqual(message_mock.edit.call_count, 7)


class TestBuildGroupEmbed(unittest.TestCase):
    def test_build_group_embed_has_all_fields(self):
        tank = WoWPlayer.create("TankPlayer", [ROLE_TANK, ROLE_BREZ])
        healer = WoWPlayer.create("HealerPlayer", [ROLE_HEALER, ROLE_LUST])
        dps1 = WoWPlayer.create("DPS1", [ROLE_DPS])
        dps2 = WoWPlayer.create("DPS2", [ROLE_DPS])
        dps3 = WoWPlayer.create("DPS3", [ROLE_DPS])

        group = WoWGroup(tank=tank, healer=healer, dps=[dps1, dps2, dps3])
        embed = build_group_embed(group, 1)

        self.assertEqual(embed.title, "Group 1")
        fields = {f.name: f.value for f in embed.fields}
        self.assertEqual(fields["Tank"], "TankPlayer")
        self.assertEqual(fields["Healer"], "HealerPlayer")
        self.assertEqual(fields["DPS"], "DPS1, DPS2, DPS3")
        self.assertEqual(fields["Battle Res"], "TankPlayer")
        self.assertEqual(fields["Bloodlust"], "HealerPlayer")

    def test_build_group_embed_no_utilities(self):
        tank = WoWPlayer.create("Tank", [ROLE_TANK])
        healer = WoWPlayer.create("Healer", [ROLE_HEALER])
        dps1 = WoWPlayer.create("DPS1", [ROLE_DPS])

        group = WoWGroup(tank=tank, healer=healer, dps=[dps1])
        embed = build_group_embed(group, 2)

        fields = {f.name: f.value for f in embed.fields}
        self.assertEqual(fields["Battle Res"], "None")
        self.assertEqual(fields["Bloodlust"], "None")


if __name__ == "__main__":
    unittest.main()
