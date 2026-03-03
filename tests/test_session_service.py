"""Unit tests for SessionService with guild + channel document model."""

import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import discord

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.models import WoWGroup  # noqa: E402
from services.session_service import ActiveChannel, SessionService  # noqa: E402
from tests.prebuilt_classes import (  # noqa: E402
    HealerPriest,
    Mage,
    Rogue,
    TankPaladin,
    Warrior,
)


def _make_member(name: str, *, is_bot: bool = False) -> MagicMock:
    member = MagicMock(spec=discord.Member)
    member.bot = is_bot
    member.name = name
    member.nick = name
    return member


def _make_voice_channel(
    channel_id: int, name: str, members: list[MagicMock] | None = None
) -> MagicMock:
    vc = MagicMock(spec=discord.VoiceChannel)
    vc.id = channel_id
    vc.name = name
    vc.members = members or []
    return vc


class TestSessionServiceGetOrCreateSession(unittest.IsolatedAsyncioTestCase):
    """Tests for SessionService.get_or_create_session."""

    @patch("services.session_service.FirebaseService")
    async def test_get_or_create_session_success(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.is_available.return_value = True
        mock_firebase.get_or_create_guild_doc = AsyncMock(return_value="1")
        mock_firebase.get_or_create_channel_doc = AsyncMock(return_value="99")
        mock_firebase.update_guild_doc = AsyncMock()
        mock_firebase.update_channel_doc = AsyncMock()
        mock_firebase.listen_to_channel_doc.return_value = MagicMock()
        mock_firebase.listen_to_guild_doc.return_value = MagicMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.loop = MagicMock()

        vc = _make_voice_channel(99, "Raid", [_make_member("P1")])

        ctx = MagicMock()
        ctx.guild.id = 1
        ctx.guild.name = "Test Guild"
        ctx.guild.icon.url = "http://icon"
        ctx.guild.voice_channels = [vc]
        ctx.author.voice.channel.id = 99
        ctx.author.voice.channel.name = "Raid"

        service = SessionService(bot)

        with patch("services.session_service.get_player_list", return_value=[]):
            result = await service.get_or_create_session(ctx)

        self.assertIsNotNone(result)
        guild_id, channel_id = result  # type: ignore[misc]
        self.assertEqual(guild_id, "1")
        self.assertEqual(channel_id, "99")
        self.assertIn(1, service.active_guilds)
        self.assertIn(99, service.active_channels)

        mock_firebase.get_or_create_guild_doc.assert_called_once_with(
            1, guild_name="Test Guild", guild_icon_url="http://icon"
        )
        mock_firebase.get_or_create_channel_doc.assert_called_once_with(
            99, 1, "Raid", debug=False
        )

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


class TestSessionServiceUpdateChannelPlayers(unittest.IsolatedAsyncioTestCase):
    """Tests for SessionService.update_channel_players."""

    @patch("services.session_service.FirebaseService")
    @patch("services.session_service.get_player_list")
    async def test_update_channel_players_writes_to_channel_doc(
        self,
        mock_get_player_list: MagicMock,
        mock_firebase_cls: MagicMock,
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.update_channel_doc = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_channels[42] = ActiveChannel(doc_id="42", guild_id=1)

        vc = _make_voice_channel(42, "Raid", [_make_member("Tank1")])
        guild = MagicMock()
        guild.id = 1
        guild.get_channel.return_value = vc

        players = [TankPaladin("Tank1")]
        mock_get_player_list.return_value = players

        await service.update_channel_players(42, guild)

        mock_firebase.update_channel_doc.assert_called_once()
        call_args = mock_firebase.update_channel_doc.call_args
        self.assertEqual(call_args[0][0], "42")
        data = call_args[0][1]
        self.assertIn("players", data)
        self.assertEqual(len(data["players"]), 1)

    @patch("services.session_service.FirebaseService")
    @patch("services.session_service.get_player_list")
    async def test_update_channel_players_untracked_channel_skips(
        self,
        mock_get_player_list: MagicMock,
        mock_firebase_cls: MagicMock,
    ) -> None:
        """If channel is not in active_channels, nothing happens."""
        mock_firebase = MagicMock()
        mock_firebase.update_channel_doc = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        # No active channels

        guild = MagicMock()
        guild.id = 1

        await service.update_channel_players(42, guild)

        mock_firebase.update_channel_doc.assert_not_called()

    @patch("services.session_service.FirebaseService")
    @patch("services.session_service.get_player_list")
    async def test_update_channel_players_invalid_channel(
        self,
        mock_get_player_list: MagicMock,
        mock_firebase_cls: MagicMock,
    ) -> None:
        """Channel gone -> writes empty players."""
        mock_firebase = MagicMock()
        mock_firebase.update_channel_doc = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_channels[42] = ActiveChannel(doc_id="42", guild_id=1)

        guild = MagicMock()
        guild.id = 1
        guild.get_channel.return_value = None

        await service.update_channel_players(42, guild)

        data = mock_firebase.update_channel_doc.call_args[0][1]
        self.assertEqual(data["players"], [])


class TestRefreshGuildVoiceChannels(unittest.IsolatedAsyncioTestCase):
    """Tests for SessionService.refresh_guild_voice_channels."""

    @patch("services.session_service.FirebaseService")
    async def test_refresh_writes_voice_channels_to_guild_doc(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.update_guild_doc = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)

        vc1 = _make_voice_channel(42, "Raid", [_make_member("P1"), _make_member("P2")])
        vc2 = _make_voice_channel(43, "AFK", [])

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc1, vc2]

        await service.refresh_guild_voice_channels(guild)

        mock_firebase.update_guild_doc.assert_called_once()
        call_args = mock_firebase.update_guild_doc.call_args
        self.assertEqual(call_args[0][0], "1")
        channels = call_args[0][1]["voiceChannels"]
        # Only vc1 has users
        self.assertEqual(len(channels), 1)
        self.assertEqual(channels[0]["id"], "42")
        self.assertEqual(channels[0]["userCount"], 2)

    @patch("services.session_service.FirebaseService")
    async def test_refresh_sorts_by_user_count_desc(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.update_guild_doc = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)

        vc1 = _make_voice_channel(42, "Small", [_make_member("P1")])
        vc2 = _make_voice_channel(43, "Big", [_make_member(f"P{i}") for i in range(5)])
        vc3 = _make_voice_channel(
            44, "Medium", [_make_member(f"Q{i}") for i in range(3)]
        )

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc1, vc2, vc3]

        await service.refresh_guild_voice_channels(guild)

        channels = mock_firebase.update_guild_doc.call_args[0][1]["voiceChannels"]
        self.assertEqual(len(channels), 3)
        self.assertEqual(channels[0]["name"], "Big")
        self.assertEqual(channels[0]["userCount"], 5)
        self.assertEqual(channels[1]["name"], "Medium")
        self.assertEqual(channels[2]["name"], "Small")

    @patch("services.session_service.FirebaseService")
    async def test_refresh_filters_bots(self, mock_firebase_cls: MagicMock) -> None:
        mock_firebase = MagicMock()
        mock_firebase.update_guild_doc = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)

        human = _make_member("Human")
        bot_member = _make_member("Bot", is_bot=True)
        vc = _make_voice_channel(42, "Raid", [human, bot_member])

        guild = MagicMock()
        guild.id = 1
        guild.voice_channels = [vc]

        await service.refresh_guild_voice_channels(guild)

        channels = mock_firebase.update_guild_doc.call_args[0][1]["voiceChannels"]
        self.assertEqual(channels[0]["userCount"], 1)


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
        mock_firebase.update_channel_doc = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        guild = MagicMock()
        guild.id = 1
        bot.get_guild.return_value = guild

        channel = MagicMock(spec=discord.VoiceChannel)
        channel.id = 42
        member1 = MagicMock()
        member1.bot = False
        channel.members = [member1]
        guild.get_channel.return_value = channel

        service = SessionService(bot)

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
            "42", 42, 1, {"status": "request_spin"}
        )

        guild.get_channel.assert_called_with(42)
        mock_get_player_list.assert_called_once()
        mock_create_groups.assert_called_once_with(players, debug=False)

        mock_firebase.update_channel_doc.assert_called_once()
        update_args = mock_firebase.update_channel_doc.call_args[0]
        self.assertEqual(update_args[0], "42")
        update_data = update_args[1]
        self.assertEqual(update_data["status"], "spinning")
        self.assertEqual(len(update_data["groups"]), 1)

    @patch("services.session_service.FirebaseService")
    async def test_process_spin_request_no_guild(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.update_channel_doc = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.get_guild.return_value = None

        service = SessionService(bot)

        await service._process_spin_request(  # pyright: ignore[reportPrivateUsage]
            "42", 42, 999, {"status": "request_spin"}
        )

        mock_firebase.update_channel_doc.assert_not_called()


class TestCleanupChannel(unittest.IsolatedAsyncioTestCase):
    """Tests for SessionService.cleanup_channel."""

    @patch("services.session_service.FirebaseService")
    async def test_cleanup_channel_removes_tracking_and_deletes_doc(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.delete_channel_doc = AsyncMock()
        mock_firebase.delete_guild_doc = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)

        mock_watch = MagicMock()
        service.active_channels[42] = ActiveChannel(doc_id="42", guild_id=1)
        service.active_guilds.add(1)
        service.channel_listeners["42"] = mock_watch
        service.guild_listeners[1] = MagicMock()

        await service.cleanup_channel(42)

        self.assertNotIn(42, service.active_channels)
        self.assertNotIn("42", service.channel_listeners)
        mock_watch.unsubscribe.assert_called_once()
        mock_firebase.delete_channel_doc.assert_called_once_with("42")

        # Last channel for guild -> guild also cleaned up
        self.assertNotIn(1, service.active_guilds)
        mock_firebase.delete_guild_doc.assert_called_once_with("1")

    @patch("services.session_service.FirebaseService")
    async def test_cleanup_channel_keeps_guild_if_other_channels_exist(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.delete_channel_doc = AsyncMock()
        mock_firebase.delete_guild_doc = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)

        service.active_channels[42] = ActiveChannel(doc_id="42", guild_id=1)
        service.active_channels[43] = ActiveChannel(doc_id="43", guild_id=1)
        service.active_guilds.add(1)
        service.channel_listeners["42"] = MagicMock()

        await service.cleanup_channel(42)

        self.assertNotIn(42, service.active_channels)
        self.assertIn(43, service.active_channels)
        self.assertIn(1, service.active_guilds)
        mock_firebase.delete_guild_doc.assert_not_called()

    @patch("services.session_service.FirebaseService")
    async def test_cleanup_nonexistent_channel_is_noop(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.delete_channel_doc = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)

        await service.cleanup_channel(999)

        mock_firebase.delete_channel_doc.assert_not_called()


class TestGetActiveChannelIdsForGuild(unittest.TestCase):
    """Tests for SessionService.get_active_channel_ids_for_guild."""

    @patch("services.session_service.FirebaseService")
    def test_returns_matching_channels(self, mock_firebase_cls: MagicMock) -> None:
        mock_firebase_cls.return_value = MagicMock()
        bot = MagicMock()
        service = SessionService(bot)

        service.active_channels[42] = ActiveChannel(doc_id="42", guild_id=1)
        service.active_channels[43] = ActiveChannel(doc_id="43", guild_id=1)
        service.active_channels[99] = ActiveChannel(doc_id="99", guild_id=2)

        result = service.get_active_channel_ids_for_guild(1)
        self.assertCountEqual(result, [42, 43])

    @patch("services.session_service.FirebaseService")
    def test_returns_empty_for_unknown_guild(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase_cls.return_value = MagicMock()
        bot = MagicMock()
        service = SessionService(bot)

        result = service.get_active_channel_ids_for_guild(999)
        self.assertEqual(result, [])


class TestCollectionListenerRemoved(unittest.TestCase):
    """Tests for collection listener REMOVED event cleaning up tracking."""

    @patch("services.session_service.FirebaseService")
    def test_removed_event_cleans_up_tracking(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase_cls.return_value = MagicMock()
        bot = MagicMock()
        service = SessionService(bot)

        mock_watch = MagicMock()
        service.active_channels[42] = ActiveChannel(doc_id="42", guild_id=1)
        service.active_guilds.add(1)
        service.channel_listeners["42"] = mock_watch

        # Simulate REMOVED change
        change = MagicMock()
        change.type.name = "REMOVED"
        change.document.id = "42"
        change.document.to_dict.return_value = {
            "channelId": "42",
            "guildId": "1",
        }

        service._handle_collection_removed(change)  # pyright: ignore[reportPrivateUsage]

        self.assertNotIn(42, service.active_channels)
        self.assertNotIn("42", service.channel_listeners)
        mock_watch.unsubscribe.assert_called_once()
        # Guild also cleaned up (last channel)
        self.assertNotIn(1, service.active_guilds)

    @patch("services.session_service.FirebaseService")
    def test_removed_event_handles_empty_doc_data(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        """Deleted doc data may be None; handler uses doc.id instead."""
        mock_firebase_cls.return_value = MagicMock()
        bot = MagicMock()
        service = SessionService(bot)

        mock_watch = MagicMock()
        service.active_channels[42] = ActiveChannel(doc_id="42", guild_id=1)
        service.active_guilds.add(1)
        service.channel_listeners["42"] = mock_watch

        change = MagicMock()
        change.type.name = "REMOVED"
        change.document.id = "42"
        change.document.to_dict.return_value = None  # Deleted doc has no data

        service._handle_collection_removed(change)  # pyright: ignore[reportPrivateUsage]

        self.assertNotIn(42, service.active_channels)
        mock_watch.unsubscribe.assert_called_once()

    @patch("services.session_service.FirebaseService")
    def test_removed_event_keeps_guild_with_other_channels(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        """Guild tracking stays if other channels exist for same guild."""
        mock_firebase_cls.return_value = MagicMock()
        bot = MagicMock()
        service = SessionService(bot)

        service.active_channels[42] = ActiveChannel(doc_id="42", guild_id=1)
        service.active_channels[43] = ActiveChannel(doc_id="43", guild_id=1)
        service.active_guilds.add(1)
        service.channel_listeners["42"] = MagicMock()

        change = MagicMock()
        change.type.name = "REMOVED"
        change.document.id = "42"
        change.document.to_dict.return_value = None

        service._handle_collection_removed(change)  # pyright: ignore[reportPrivateUsage]

        self.assertNotIn(42, service.active_channels)
        self.assertIn(43, service.active_channels)
        self.assertIn(1, service.active_guilds)


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
            42, 1, {"groups": []}
        )

        mock_build.assert_called_once_with(group, 1)
        vc.send.assert_called_once_with(embed=mock_embed)

    @patch("services.session_service.build_group_embed")
    async def test_announce_falls_back_to_firestore_data(
        self, mock_build: MagicMock
    ) -> None:
        """When last_results is empty, reconstruct from Firestore dict data."""
        service, bot = self._make_service()

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
            42, 1, {"groups": [group_dict]}
        )

        mock_build.assert_called_once()
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
            42, 1, {"groups": []}
        )

        vc.send.assert_called_once_with("No groups were formed this round.")

    async def test_announce_no_guild_skips(self) -> None:
        """When guild not found, nothing is sent."""
        service, bot = self._make_service()

        bot.get_guild.return_value = None

        await service._announce_completion(  # pyright: ignore[reportPrivateUsage]
            42, 1, {"groups": []}
        )

        bot.get_guild.assert_called_once_with(1)

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
            42, 1, {"groups": []}
        )

        self.assertEqual(mock_build.call_count, 2)
        mock_build.assert_any_call(group1, 1)
        mock_build.assert_any_call(group2, 2)
        self.assertEqual(vc.send.call_count, 2)
