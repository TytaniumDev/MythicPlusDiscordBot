"""Unit tests for SessionService and FirebaseService (mocked)."""

import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.models import WoWGroup  # noqa: E402
from services.session_service import SessionService  # noqa: E402
from tests.prebuilt_classes import (  # noqa: E402
    HealerPriest,
    Mage,
    Rogue,
    TankPaladin,
    Warrior,
)


class TestSessionServiceGetOrCreateSession(unittest.IsolatedAsyncioTestCase):
    """Tests for SessionService.get_or_create_session."""

    @patch("services.session_service.FirebaseService")
    async def test_get_or_create_session_success(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.is_available.return_value = True
        mock_firebase.get_or_create_session = AsyncMock(
            return_value="1"
        )  # guild_id as string
        mock_firebase.listen_to_session.return_value = None
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.loop = MagicMock()

        ctx = MagicMock()
        ctx.guild.id = 1
        ctx.guild.voice_channels = []  # Mock voice channels for initial sync
        ctx.author.voice.channel.id = 99  # Voice channel the user is in

        service = SessionService(bot)
        result = await service.get_or_create_session(ctx)

        self.assertEqual(result, "1")
        self.assertEqual(service.active_sessions[1], "1")
        mock_firebase.get_or_create_session.assert_called_once_with(
            1, debug=False, selected_channel_id="99"
        )

        mock_firebase.listen_to_session.assert_called_once()
        listen_args = mock_firebase.listen_to_session.call_args[0]
        self.assertEqual(listen_args[0], "1")

    @patch("services.session_service.FirebaseService")
    async def test_get_or_create_session_firebase_unavailable(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.is_available.return_value = False
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        ctx = MagicMock()
        ctx.guild.id = 1

        service = SessionService(bot)
        result = await service.get_or_create_session(ctx)

        self.assertIsNone(result)
        mock_firebase.get_or_create_session.assert_not_called()


class TestSessionServiceUpdateGuildVoiceStates(unittest.IsolatedAsyncioTestCase):
    """Tests for SessionService.update_guild_voice_states."""

    @patch("services.session_service.FirebaseService")
    @patch("services.session_service.get_player_list")
    async def test_update_guild_voice_states_updates_firestore(
        self,
        mock_get_player_list: MagicMock,
        mock_firebase_cls: MagicMock,
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_sessions[1] = "1"
        service.guild_states[1] = {"selectedChannelId": "42"}

        guild = MagicMock()
        guild.id = 1

        import discord

        vc1 = MagicMock(spec=discord.VoiceChannel)
        vc1.id = 42
        vc1.name = "VC1"
        member1 = MagicMock()
        member1.bot = False
        vc1.members = [member1]

        vc2 = MagicMock(spec=discord.VoiceChannel)
        vc2.id = 43
        vc2.name = "VC2"
        vc2.members = []

        guild.voice_channels = [vc1, vc2]
        guild.get_channel.return_value = vc1

        players = [TankPaladin("Tank")]
        mock_get_player_list.return_value = players

        await service.update_guild_voice_states(guild)

        # check update_session call
        mock_firebase.update_session.assert_called_once()
        call_args = mock_firebase.update_session.call_args
        self.assertEqual(call_args[0][0], "1")
        data = call_args[0][1]

        self.assertEqual(len(data["voiceChannels"]), 1)  # Only VC1 has users
        self.assertEqual(data["voiceChannels"][0]["id"], "42")
        self.assertEqual(data["voiceChannels"][0]["userCount"], 1)

        self.assertIn("players", data)  # Because selectedChannelId is set
        self.assertEqual(len(data["players"]), 1)


class TestSessionServiceProcessSpinRequest(unittest.IsolatedAsyncioTestCase):
    """Tests for SessionService._process_spin_request."""

    @patch("services.session_service.FirebaseService")
    @patch("services.session_service.create_mythic_plus_groups")
    @patch("services.session_service.get_player_list")
    async def test_process_spin_request_calculates_and_updates(
        self,
        mock_get_player_list: MagicMock,
        mock_create_groups: MagicMock,
        mock_firebase_cls: MagicMock,
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        guild = MagicMock()
        guild.id = 1
        bot.get_guild.return_value = guild

        import discord

        channel = MagicMock(spec=discord.VoiceChannel)
        channel.id = 42
        member1 = MagicMock()
        member1.bot = False
        channel.members = [member1]

        # Mock get_channel to return our channel when asked for selectedChannelId
        guild.get_channel.return_value = channel

        service = SessionService(bot)
        # service.active_sessions is not strictly needed for this internal method but good to have context

        players = [
            TankPaladin("Tank"),
            HealerPriest("Healer"),
            Warrior("Dps1"),
            Mage("Dps2"),
            Rogue("Dps3"),
        ]
        mock_get_player_list.return_value = players

        groups = [
            WoWGroup(tank=players[0], healer=players[1], dps=players[2:5]),
        ]
        mock_create_groups.return_value = groups

        bot.group_service = MagicMock()
        bot.group_service.last_results = {}

        await service._process_spin_request(  # pyright: ignore[reportPrivateUsage]
            "session-xyz", 1, {"status": "request_spin", "selectedChannelId": "42"}
        )

        guild.get_channel.assert_called_with(42)
        mock_get_player_list.assert_called_once()
        mock_create_groups.assert_called_once_with(players, debug=False)

        mock_firebase.update_session.assert_called_once()
        update_args = mock_firebase.update_session.call_args[0]
        self.assertEqual(update_args[0], "session-xyz")
        update_data = update_args[1]
        self.assertEqual(update_data["status"], "spinning")
        self.assertEqual(len(update_data["groups"]), 1)

    @patch("services.session_service.FirebaseService")
    async def test_process_spin_request_no_selected_channel(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        guild = MagicMock()
        bot.get_guild.return_value = guild

        service = SessionService(bot)

        await service._process_spin_request(  # pyright: ignore[reportPrivateUsage]
            "session-xyz",
            1,
            {"status": "request_spin"},  # missing selectedChannelId
        )

        mock_firebase.update_session.assert_not_called()
