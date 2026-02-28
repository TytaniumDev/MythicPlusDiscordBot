"""Unit tests for SessionService and FirebaseService (mocked)."""

import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import discord

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
            1,
            debug=False,
            selected_channel_id="99",
            guild_name=ctx.guild.name,
            guild_icon_url=str(ctx.guild.icon.url),
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


class TestDetectPlayersAlreadyInChannel(unittest.IsolatedAsyncioTestCase):
    """Tests for detecting players already in voice channel when /activity starts."""

    def _make_member(self, name: str, *, is_bot: bool = False) -> MagicMock:
        member = MagicMock(spec=discord.Member)
        member.bot = is_bot
        member.name = name
        member.nick = name
        return member

    def _make_voice_channel(
        self, channel_id: int, name: str, members: list[MagicMock] | None = None
    ) -> MagicMock:
        vc = MagicMock(spec=discord.VoiceChannel)
        vc.id = channel_id
        vc.name = name
        vc.members = members or []
        return vc

    # --- Core flow tests ---

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_fresh_session_syncs_existing_players(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """Full get_or_create_session with 5 players -> update includes players."""
        mock_firebase = MagicMock()
        mock_firebase.is_available.return_value = True
        mock_firebase.get_or_create_session = AsyncMock(return_value="session-1")
        mock_firebase.listen_to_session.return_value = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.loop = MagicMock()

        members = [self._make_member(f"Player{i}") for i in range(5)]
        vc = self._make_voice_channel(42, "Raid", members)

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc]
        guild.get_channel.return_value = vc

        ctx = MagicMock()
        ctx.guild = guild
        ctx.author.voice.channel.id = 42

        players = [
            TankPaladin("P0"),
            HealerPriest("P1"),
            Warrior("P2"),
            Mage("P3"),
            Rogue("P4"),
        ]
        mock_get_player_list.return_value = players

        service = SessionService(bot)
        result = await service.get_or_create_session(ctx)

        self.assertEqual(result, "session-1")
        mock_firebase.update_session.assert_called_once()
        update_data = mock_firebase.update_session.call_args[0][1]
        self.assertIn("players", update_data)
        self.assertEqual(len(update_data["players"]), 5)

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_fresh_session_players_data_matches_channel_members(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """Verifies exact player data serialization."""
        mock_firebase = MagicMock()
        mock_firebase.is_available.return_value = True
        mock_firebase.get_or_create_session = AsyncMock(return_value="session-1")
        mock_firebase.listen_to_session.return_value = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.loop = MagicMock()

        members = [self._make_member("Tank1"), self._make_member("Healer1")]
        vc = self._make_voice_channel(42, "Raid", members)

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc]
        guild.get_channel.return_value = vc

        ctx = MagicMock()
        ctx.guild = guild
        ctx.author.voice.channel.id = 42

        tank = TankPaladin("Tank1")
        healer = HealerPriest("Healer1")
        mock_get_player_list.return_value = [tank, healer]

        service = SessionService(bot)
        await service.get_or_create_session(ctx)

        update_data = mock_firebase.update_session.call_args[0][1]
        player_names = [p["name"] for p in update_data["players"]]
        self.assertEqual(player_names, ["Tank1", "Healer1"])
        self.assertEqual(update_data["players"][0], tank.to_dict())

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_existing_session_rerun_syncs_players(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """Session exists, /activity re-run -> still syncs players."""
        mock_firebase = MagicMock()
        mock_firebase.is_available.return_value = True
        mock_firebase.get_or_create_session = AsyncMock(return_value="session-1")
        mock_firebase.listen_to_session.return_value = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.loop = MagicMock()

        members = [self._make_member("Player1")]
        vc = self._make_voice_channel(42, "Raid", members)

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc]
        guild.get_channel.return_value = vc

        ctx = MagicMock()
        ctx.guild = guild
        ctx.author.voice.channel.id = 42

        mock_get_player_list.return_value = [Warrior("Player1")]

        service = SessionService(bot)
        service.active_sessions[1] = "session-1"

        await service.get_or_create_session(ctx)

        mock_firebase.update_session.assert_called_once()
        update_data = mock_firebase.update_session.call_args[0][1]
        self.assertIn("players", update_data)
        self.assertEqual(len(update_data["players"]), 1)

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_existing_session_listener_already_attached_still_syncs(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """Listener already set up -> update_guild_voice_states still runs."""
        mock_firebase = MagicMock()
        mock_firebase.is_available.return_value = True
        mock_firebase.get_or_create_session = AsyncMock(return_value="session-1")
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.loop = MagicMock()

        members = [self._make_member("Player1")]
        vc = self._make_voice_channel(42, "Raid", members)

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc]
        guild.get_channel.return_value = vc

        ctx = MagicMock()
        ctx.guild = guild
        ctx.author.voice.channel.id = 42

        mock_get_player_list.return_value = [Mage("Player1")]

        service = SessionService(bot)
        service.active_sessions[1] = "session-1"
        service.listeners["session-1"] = MagicMock()  # Already attached

        await service.get_or_create_session(ctx)

        mock_firebase.listen_to_session.assert_not_called()
        mock_firebase.update_session.assert_called_once()
        update_data = mock_firebase.update_session.call_args[0][1]
        self.assertIn("players", update_data)

    # --- Voice state update tests ---

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_voice_state_update_player_joins(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """New player joins -> player list grows."""
        mock_firebase = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_sessions[1] = "session-1"
        service.guild_states[1] = {"selectedChannelId": "42"}

        members = [self._make_member(f"P{i}") for i in range(3)]
        vc = self._make_voice_channel(42, "Raid", members)

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc]
        guild.get_channel.return_value = vc

        mock_get_player_list.return_value = [Warrior(f"P{i}") for i in range(3)]

        await service.update_guild_voice_states(guild)

        update_data = mock_firebase.update_session.call_args[0][1]
        self.assertEqual(len(update_data["players"]), 3)

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_voice_state_update_player_leaves(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """Player leaves -> player list shrinks."""
        mock_firebase = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_sessions[1] = "session-1"
        service.guild_states[1] = {"selectedChannelId": "42"}

        members = [self._make_member("P0")]
        vc = self._make_voice_channel(42, "Raid", members)

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc]
        guild.get_channel.return_value = vc

        mock_get_player_list.return_value = [Warrior("P0")]

        await service.update_guild_voice_states(guild)

        update_data = mock_firebase.update_session.call_args[0][1]
        self.assertEqual(len(update_data["players"]), 1)

    # --- Edge case tests ---

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_multiple_voice_channels_only_selected_synced(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """3 channels, only selected channel's players in update."""
        mock_firebase = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_sessions[1] = "session-1"
        service.guild_states[1] = {"selectedChannelId": "42"}

        m1, m2, m3 = (
            self._make_member("Tank1"),
            self._make_member("DPS1"),
            self._make_member("DPS2"),
        )
        vc1 = self._make_voice_channel(42, "Raid", [m1, m2])
        vc2 = self._make_voice_channel(43, "PvP", [m3])
        vc3 = self._make_voice_channel(44, "AFK", [])

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc1, vc2, vc3]

        def get_channel_side_effect(channel_id: int) -> MagicMock | None:
            return {42: vc1, 43: vc2, 44: vc3}.get(channel_id)

        guild.get_channel.side_effect = get_channel_side_effect

        mock_get_player_list.return_value = [TankPaladin("Tank1"), Warrior("DPS1")]

        await service.update_guild_voice_states(guild)

        mock_get_player_list.assert_called_once()
        call_members = mock_get_player_list.call_args[0][0]
        self.assertEqual(len(call_members), 2)

        update_data = mock_firebase.update_session.call_args[0][1]
        self.assertEqual(len(update_data["players"]), 2)
        # voiceChannels includes channels with users only
        self.assertEqual(len(update_data["voiceChannels"]), 2)

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_channel_with_bots_only_humans_included(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """Bots filtered from counts and player lists."""
        mock_firebase = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_sessions[1] = "session-1"
        service.guild_states[1] = {"selectedChannelId": "42"}

        human = self._make_member("Human1")
        bot_member = self._make_member("BotUser", is_bot=True)
        vc = self._make_voice_channel(42, "Raid", [human, bot_member])

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc]
        guild.get_channel.return_value = vc

        mock_get_player_list.return_value = [Warrior("Human1")]

        await service.update_guild_voice_states(guild)

        update_data = mock_firebase.update_session.call_args[0][1]
        self.assertEqual(update_data["voiceChannels"][0]["userCount"], 1)
        self.assertEqual(len(update_data["players"]), 1)

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_selected_channel_becomes_empty(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """All leave -> players is []."""
        mock_firebase = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_sessions[1] = "session-1"
        service.guild_states[1] = {"selectedChannelId": "42"}

        vc = self._make_voice_channel(42, "Raid", [])

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc]
        guild.get_channel.return_value = vc

        mock_get_player_list.return_value = []

        await service.update_guild_voice_states(guild)

        update_data = mock_firebase.update_session.call_args[0][1]
        self.assertEqual(update_data["players"], [])

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_selected_channel_invalid_id(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """Channel gone -> players is []."""
        mock_firebase = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_sessions[1] = "session-1"
        service.guild_states[1] = {"selectedChannelId": "999"}

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = []
        guild.get_channel.return_value = None

        await service.update_guild_voice_states(guild)

        update_data = mock_firebase.update_session.call_args[0][1]
        self.assertEqual(update_data["players"], [])

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_no_selected_channel_no_players_key(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """No selection -> no 'players' key in update."""
        mock_firebase = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_sessions[1] = "session-1"
        service.guild_states[1] = {}

        members = [self._make_member("P1")]
        vc = self._make_voice_channel(42, "Raid", members)

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc]

        await service.update_guild_voice_states(guild)

        update_data = mock_firebase.update_session.call_args[0][1]
        self.assertNotIn("players", update_data)
        self.assertIn("voiceChannels", update_data)

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_voice_channels_sorted_by_user_count_desc(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """Sort ordering: most users first."""
        mock_firebase = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_sessions[1] = "session-1"
        service.guild_states[1] = {}

        vc1 = self._make_voice_channel(42, "Small", [self._make_member("P1")])
        vc2 = self._make_voice_channel(
            43, "Big", [self._make_member(f"P{i}") for i in range(5)]
        )
        vc3 = self._make_voice_channel(
            44, "Medium", [self._make_member(f"Q{i}") for i in range(3)]
        )

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc1, vc2, vc3]

        await service.update_guild_voice_states(guild)

        update_data = mock_firebase.update_session.call_args[0][1]
        channels = update_data["voiceChannels"]
        self.assertEqual(len(channels), 3)
        self.assertEqual(channels[0]["name"], "Big")
        self.assertEqual(channels[0]["userCount"], 5)
        self.assertEqual(channels[1]["name"], "Medium")
        self.assertEqual(channels[1]["userCount"], 3)
        self.assertEqual(channels[2]["name"], "Small")
        self.assertEqual(channels[2]["userCount"], 1)

    # --- Race condition / bug-exposing tests (expected to FAIL before fix) ---

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_listener_callback_does_not_clobber_selected_channel(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """Simulate on_snapshot firing with selectedChannelId: None during
        _start_listening. guild_states should still have the correct value."""
        mock_firebase = MagicMock()
        mock_firebase.is_available.return_value = True
        mock_firebase.get_or_create_session = AsyncMock(return_value="session-1")
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        # Simulate Firestore listener firing immediately with selectedChannelId: None
        def fire_listener_with_null(session_id: str, callback: object) -> MagicMock:
            change = MagicMock()
            change.type.name = "ADDED"
            change.document.to_dict.return_value = {
                "selectedChannelId": None,
                "status": "lobby",
            }
            callback(None, [change], None)  # type: ignore[operator]
            return MagicMock()

        mock_firebase.listen_to_session.side_effect = fire_listener_with_null

        bot = MagicMock()
        bot.loop = MagicMock()

        members = [self._make_member("Player1")]
        vc = self._make_voice_channel(42, "Raid", members)

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc]
        guild.get_channel.return_value = vc

        ctx = MagicMock()
        ctx.guild = guild
        ctx.author.voice.channel.id = 42

        mock_get_player_list.return_value = [Warrior("Player1")]

        service = SessionService(bot)
        await service.get_or_create_session(ctx)

        self.assertEqual(
            service.guild_states[1]["selectedChannelId"],
            "42",
            "Listener callback clobbered selectedChannelId to None",
        )

        update_data = mock_firebase.update_session.call_args[0][1]
        self.assertIn(
            "players",
            update_data,
            "Players not synced because selectedChannelId was clobbered",
        )

    @patch("services.session_service.FirebaseService")
    async def test_handle_update_preserves_selected_channel_when_null(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        """_handle_update with None channel should NOT overwrite non-None."""
        mock_firebase = MagicMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.loop = MagicMock()

        service = SessionService(bot)
        service.guild_states[1] = {"selectedChannelId": "42"}

        service._handle_update(  # pyright: ignore[reportPrivateUsage]
            "session-1",
            1,
            {"selectedChannelId": None, "status": "lobby"},
            is_initial=True,
        )

        self.assertEqual(
            service.guild_states[1]["selectedChannelId"],
            "42",
            "_handle_update overwrote non-None selectedChannelId with None",
        )


class TestNewRoundPlayerSync(unittest.IsolatedAsyncioTestCase):
    """Tests for 'New Round' flow where frontend clears selectedChannelId."""

    @patch("services.session_service.FirebaseService")
    def test_new_round_clears_selected_channel(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        """MODIFIED event with selectedChannelId: None clears guild_states."""
        mock_firebase = MagicMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.loop = MagicMock()

        service = SessionService(bot)
        service.guild_states[1] = {"selectedChannelId": "42"}

        service._handle_update(  # pyright: ignore[reportPrivateUsage]
            "session-1",
            1,
            {"selectedChannelId": None, "status": "lobby"},
            is_initial=False,
        )

        self.assertIsNone(
            service.guild_states[1]["selectedChannelId"],
            "MODIFIED event should clear selectedChannelId to None",
        )

    @patch("services.session_service.asyncio.run_coroutine_threadsafe")
    @patch("services.session_service.FirebaseService")
    def test_new_round_reselect_same_channel_triggers_sync(
        self, mock_firebase_cls: MagicMock, mock_run_coro: MagicMock
    ) -> None:
        """After clearing, re-selecting same channel triggers player sync."""
        mock_firebase = MagicMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.loop = MagicMock()

        service = SessionService(bot)
        service.guild_states[1] = {"selectedChannelId": "42"}

        # Step 1: "New Round" clears the channel (MODIFIED)
        service._handle_update(  # pyright: ignore[reportPrivateUsage]
            "session-1",
            1,
            {"selectedChannelId": None, "status": "lobby"},
            is_initial=False,
        )
        self.assertIsNone(service.guild_states[1]["selectedChannelId"])
        mock_run_coro.reset_mock()

        # Step 2: User re-selects channel "42" (MODIFIED)
        service._handle_update(  # pyright: ignore[reportPrivateUsage]
            "session-1",
            1,
            {"selectedChannelId": "42", "status": "lobby"},
            is_initial=False,
        )

        self.assertEqual(service.guild_states[1]["selectedChannelId"], "42")
        # Since old was None and new is "42", sync should be triggered
        mock_run_coro.assert_called_once()

    @patch("services.session_service.get_player_list")
    @patch("services.session_service.FirebaseService")
    async def test_new_round_full_flow_resyncs_players(
        self, mock_firebase_cls: MagicMock, mock_get_player_list: MagicMock
    ) -> None:
        """Integration: clear -> re-select -> update_guild_voice_states has players."""
        mock_firebase = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.loop = MagicMock()

        service = SessionService(bot)
        service.active_sessions[1] = "session-1"
        service.guild_states[1] = {"selectedChannelId": "42"}

        # Step 1: "New Round" clears state (MODIFIED)
        service._handle_update(  # pyright: ignore[reportPrivateUsage]
            "session-1",
            1,
            {"selectedChannelId": None, "status": "lobby", "players": [], "groups": []},
            is_initial=False,
        )
        self.assertIsNone(service.guild_states[1]["selectedChannelId"])

        # Step 2: Re-select channel "42"
        service.guild_states[1]["selectedChannelId"] = "42"

        # Step 3: Sync voice states
        member = MagicMock(spec=discord.Member)
        member.bot = False
        member.name = "Tank1"

        vc = MagicMock(spec=discord.VoiceChannel)
        vc.id = 42
        vc.name = "Raid"
        vc.members = [member]

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc]
        guild.get_channel.return_value = vc

        mock_get_player_list.return_value = [TankPaladin("Tank1")]

        await service.update_guild_voice_states(guild)

        update_data = mock_firebase.update_session.call_args[0][1]
        self.assertIn("players", update_data)
        self.assertEqual(len(update_data["players"]), 1)
        self.assertEqual(update_data["players"][0]["name"], "Tank1")


class TestAnnounceCompletion(unittest.IsolatedAsyncioTestCase):
    """Tests for SessionService._announce_completion."""

    def _make_service(self) -> tuple[SessionService, MagicMock]:
        mock_firebase = MagicMock()
        with patch(
            "services.session_service.FirebaseService", return_value=mock_firebase
        ):
            bot = MagicMock()
            service = SessionService(bot)
        return service, bot

    def _make_voice_channel(self) -> MagicMock:
        vc = MagicMock(spec=discord.VoiceChannel)
        vc.name = "Raid"
        vc.send = AsyncMock()
        return vc

    @patch("services.session_service.build_group_embed")
    async def test_announce_uses_last_results(self, mock_build: MagicMock) -> None:
        """When last_results has groups, use them directly."""
        service, bot = self._make_service()

        tank = TankPaladin("Tank1")
        healer = HealerPriest("Healer1")
        dps = [Warrior("D1"), Mage("D2"), Rogue("D3")]
        group = WoWGroup(tank=tank, healer=healer, dps=dps)

        bot.group_service.last_results = {1: {"players": [], "groups": [group]}}

        vc = self._make_voice_channel()
        guild = MagicMock()
        guild.get_channel.return_value = vc
        bot.get_guild.return_value = guild

        mock_embed = MagicMock()
        mock_build.return_value = mock_embed

        await service._announce_completion(  # pyright: ignore[reportPrivateUsage]
            1, {"selectedChannelId": "42", "groups": []}
        )

        mock_build.assert_called_once_with(group, 1)
        vc.send.assert_called_once_with(embed=mock_embed)

    @patch("services.session_service.build_group_embed")
    async def test_announce_falls_back_to_firestore_data(
        self, mock_build: MagicMock
    ) -> None:
        """When last_results is empty, reconstruct from Firestore dict data."""
        service, bot = self._make_service()

        # No last_results
        bot.group_service.last_results = {}

        tank = TankPaladin("Tank1")
        healer = HealerPriest("Healer1")
        group = WoWGroup(tank=tank, healer=healer, dps=[Warrior("D1")])
        group_dict = group.to_dict()

        vc = self._make_voice_channel()
        guild = MagicMock()
        guild.get_channel.return_value = vc
        bot.get_guild.return_value = guild

        mock_embed = MagicMock()
        mock_build.return_value = mock_embed

        await service._announce_completion(  # pyright: ignore[reportPrivateUsage]
            1, {"selectedChannelId": "42", "groups": [group_dict]}
        )

        mock_build.assert_called_once()
        # Verify the reconstructed group has the right tank
        reconstructed = mock_build.call_args[0][0]
        self.assertIsNotNone(reconstructed.tank)
        self.assertEqual(reconstructed.tank.name, "Tank1")
        vc.send.assert_called_once()

    async def test_announce_empty_groups_sends_fallback(self) -> None:
        """When no groups exist, send a plain text fallback."""
        service, bot = self._make_service()

        bot.group_service.last_results = {}

        vc = self._make_voice_channel()
        guild = MagicMock()
        guild.get_channel.return_value = vc
        bot.get_guild.return_value = guild

        await service._announce_completion(  # pyright: ignore[reportPrivateUsage]
            1, {"selectedChannelId": "42", "groups": []}
        )

        vc.send.assert_called_once_with("No groups were formed this round.")

    async def test_announce_no_selected_channel_skips(self) -> None:
        """When no selectedChannelId, nothing is sent."""
        service, bot = self._make_service()

        await service._announce_completion(  # pyright: ignore[reportPrivateUsage]
            1, {"groups": []}
        )

        bot.get_guild.assert_not_called()

    @patch("services.session_service.build_group_embed")
    async def test_announce_multiple_groups(self, mock_build: MagicMock) -> None:
        """Multiple groups each get their own embed."""
        service, bot = self._make_service()

        group1 = WoWGroup(
            tank=TankPaladin("T1"), healer=HealerPriest("H1"), dps=[Warrior("D1")]
        )
        group2 = WoWGroup(
            tank=TankPaladin("T2"), healer=HealerPriest("H2"), dps=[Mage("D2")]
        )

        bot.group_service.last_results = {
            1: {"players": [], "groups": [group1, group2]}
        }

        vc = self._make_voice_channel()
        guild = MagicMock()
        guild.get_channel.return_value = vc
        bot.get_guild.return_value = guild

        mock_embed = MagicMock()
        mock_build.return_value = mock_embed

        await service._announce_completion(  # pyright: ignore[reportPrivateUsage]
            1, {"selectedChannelId": "42", "groups": []}
        )

        self.assertEqual(mock_build.call_count, 2)
        mock_build.assert_any_call(group1, 1)
        mock_build.assert_any_call(group2, 2)
        self.assertEqual(vc.send.call_count, 2)
