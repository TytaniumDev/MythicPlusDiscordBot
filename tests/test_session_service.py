"""Unit tests for SessionService and FirebaseService (mocked)."""

import os
import sys
import unittest
from typing import Any
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


class TestSessionServiceCreateSession(unittest.IsolatedAsyncioTestCase):
    """Tests for SessionService.create_session."""

    @patch("services.session_service.FirebaseService")
    async def test_create_session_success(self, mock_firebase_cls: MagicMock) -> None:
        mock_firebase = MagicMock()
        mock_firebase.is_available.return_value = True
        mock_firebase.create_session = AsyncMock(return_value="session-123")
        mock_firebase.listen_to_session.return_value = None
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.loop = MagicMock()

        ctx = MagicMock()
        ctx.guild.id = 1
        ctx.author.voice.channel.id = 2
        players = [TankPaladin("Tank"), HealerPriest("Healer"), Warrior("Dps")]

        service = SessionService(bot)
        result = await service.create_session(ctx, players)

        self.assertEqual(result, "session-123")
        self.assertEqual(service.active_sessions[2], "session-123")
        mock_firebase.create_session.assert_called_once()
        call_args = mock_firebase.create_session.call_args[0]
        self.assertEqual(call_args[0], 1)
        self.assertEqual(call_args[1], 2)
        self.assertEqual(len(call_args[2]), 3)
        mock_firebase.listen_to_session.assert_called_once()
        listen_args = mock_firebase.listen_to_session.call_args[0]
        self.assertEqual(listen_args[0], "session-123")

    @patch("services.session_service.FirebaseService")
    async def test_create_session_firebase_unavailable(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.is_available.return_value = False
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        ctx = MagicMock()
        ctx.guild.id = 1
        ctx.author.voice.channel.id = 2
        players = [TankPaladin("Tank")]

        service = SessionService(bot)
        result = await service.create_session(ctx, players)

        self.assertIsNone(result)
        mock_firebase.create_session.assert_not_called()

    @patch("services.session_service.FirebaseService")
    async def test_create_session_no_voice_channel(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.is_available.return_value = True
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        ctx = MagicMock()
        ctx.guild.id = 1
        ctx.author.voice = None
        players = [TankPaladin("Tank")]

        service = SessionService(bot)
        result = await service.create_session(ctx, players)

        self.assertIsNone(result)
        mock_firebase.create_session.assert_not_called()


class TestSessionServiceUpdateLobbyPlayers(unittest.IsolatedAsyncioTestCase):
    """Tests for SessionService.update_lobby_players."""

    @patch("services.session_service.FirebaseService")
    @patch("services.session_service.getPlayerList")
    async def test_update_lobby_players_updates_firestore(
        self,
        mock_get_player_list: MagicMock,
        mock_firebase_cls: MagicMock,
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.update_session = AsyncMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_sessions[42] = "session-abc"

        players = [TankPaladin("Tank"), HealerPriest("Healer")]
        mock_get_player_list.return_value = players
        members: list[Any] = [MagicMock(), MagicMock()]

        await service.update_lobby_players(42, members)  # type: ignore[arg-type]

        mock_get_player_list.assert_called_once_with(members)
        mock_firebase.update_session.assert_called_once_with(
            "session-abc", {"players": [p.to_dict() for p in players]}
        )

    @patch("services.session_service.FirebaseService")
    async def test_update_lobby_players_no_session(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        service = SessionService(bot)
        service.active_sessions.clear()

        await service.update_lobby_players(999, [])

        mock_firebase.update_session.assert_not_called()


class TestSessionServiceProcessSpinRequest(unittest.IsolatedAsyncioTestCase):
    """Tests for SessionService._process_spin_request."""

    @patch("services.session_service.FirebaseService")
    @patch("services.session_service.create_mythic_plus_groups")
    @patch("services.session_service.getPlayerList")
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
        channel = MagicMock()
        channel.id = 42
        channel.guild = MagicMock()
        channel.guild.id = 1
        member1 = MagicMock()
        member1.bot = False
        member2 = MagicMock()
        member2.bot = False
        channel.members = [member1, member2]
        bot.get_channel.return_value = channel

        service = SessionService(bot)
        service.active_sessions[42] = "session-xyz"

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
            "session-xyz", 42, {"status": "request_spin"}
        )

        mock_get_player_list.assert_called_once()
        mock_create_groups.assert_called_once_with(players, debug=False)
        mock_firebase.update_session.assert_called_once()
        update_args = mock_firebase.update_session.call_args[0]
        self.assertEqual(update_args[0], "session-xyz")
        update_data = update_args[1]
        self.assertEqual(update_data["status"], "spinning")
        self.assertEqual(len(update_data["groups"]), 1)

    @patch("services.session_service.FirebaseService")
    async def test_process_spin_request_channel_not_found(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.get_channel.return_value = None

        service = SessionService(bot)
        service.active_sessions[42] = "session-xyz"

        await service._process_spin_request(  # pyright: ignore[reportPrivateUsage]
            "session-xyz", 42, {"status": "request_spin"}
        )

        mock_firebase.update_session.assert_not_called()


class TestSessionServiceCompletionNoCleanup(unittest.IsolatedAsyncioTestCase):
    """When status is 'completed', only announce; do not run cleanup."""

    @patch("services.session_service.SessionService._cleanup_session_immediately")
    @patch(
        "services.session_service.SessionService._announce_completion",
        new_callable=AsyncMock,
    )
    async def test_handle_update_completed_does_not_cleanup(
        self,
        mock_announce: AsyncMock,
        mock_cleanup: MagicMock,
    ) -> None:
        bot = MagicMock()
        bot.loop = MagicMock()
        service = SessionService(bot)
        service._handle_update("session-123", 42, {"status": "completed", "groups": []})
        mock_cleanup.assert_not_called()


class TestSessionServiceReplacePreviousSession(unittest.IsolatedAsyncioTestCase):
    """When create_session is called for a channel that already has a session, clean up the old one first."""

    @patch("services.session_service.FirebaseService")
    async def test_create_session_replaces_previous_in_same_channel(
        self, mock_firebase_cls: MagicMock
    ) -> None:
        mock_firebase = MagicMock()
        mock_firebase.is_available.return_value = True
        mock_firebase.create_session = AsyncMock(return_value="new-session-456")
        mock_firebase.delete_session = AsyncMock()
        mock_firebase.listen_to_session.return_value = None
        mock_firebase_cls.return_value = mock_firebase

        bot = MagicMock()
        bot.loop = MagicMock()

        ctx = MagicMock()
        ctx.guild.id = 1
        ctx.author.voice.channel.id = 2
        players = [TankPaladin("Tank"), HealerPriest("Healer")]

        service = SessionService(bot)
        service.active_sessions[2] = "old-session-123"
        service.listeners["old-session-123"] = MagicMock()

        result = await service.create_session(ctx, players)

        self.assertEqual(result, "new-session-456")
        mock_firebase.delete_session.assert_called_once_with("old-session-123")
        mock_firebase.create_session.assert_called_once()
        self.assertEqual(service.active_sessions[2], "new-session-456")
        self.assertNotIn("old-session-123", service.active_sessions)
        self.assertNotIn("old-session-123", service.listeners)
