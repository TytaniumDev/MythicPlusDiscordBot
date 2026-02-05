import asyncio
import logging
from typing import Any

import discord

from core.firebase_service import FirebaseService
from core.models import WoWPlayer
from core.parallel_group_creator import create_mythic_plus_groups
from core.utils import getPlayerList

logger = logging.getLogger(__name__)

# Delay (seconds) before removing a completed session and unsubscribing its listener.
SESSION_CLEANUP_DELAY_SECONDS = 90


class SessionService:
    def __init__(self, bot):
        self.bot = bot
        self.firebase = FirebaseService()
        self.active_sessions: dict[int, str] = {}  # channel_id -> session_id
        self.listeners: dict[str, Any] = {}  # session_id -> watch object

    async def create_session(self, ctx, players: list[WoWPlayer]) -> str | None:
        """Creates a session and sets up listeners."""
        if not self.firebase.is_available():
            return None

        guild_id = ctx.guild.id
        channel_id = ctx.author.voice.channel.id if ctx.author.voice else 0

        if not channel_id:
            return None

        # Convert players to serializable format
        players_data = [p.to_dict() for p in players]

        session_id = await self.firebase.create_session(
            guild_id, channel_id, players_data
        )

        self.active_sessions[channel_id] = session_id

        # Start listening to this session
        self._start_listening(session_id, channel_id)

        return session_id

    def _start_listening(self, session_id: str, channel_id: int):
        """Internal method to attach the Firestore listener."""

        def on_snapshot(col_snapshot, changes, read_time):
            for change in changes:
                if change.type.name == "MODIFIED":
                    doc = change.document
                    data = doc.to_dict()
                    self._handle_update(session_id, channel_id, data)

        watch = self.firebase.listen_to_session(session_id, on_snapshot)
        self.listeners[session_id] = watch

    def _handle_update(self, session_id: str, channel_id: int, data: dict):
        """
        Handles updates from Firestore.
        Executed in a separate thread by the Firestore SDK, so we must be careful with async.
        """
        status = data.get("status")

        if status == "request_spin":
            # The UI requested a spin. We need to calculate groups.
            # We must schedule this back onto the main loop.
            asyncio.run_coroutine_threadsafe(
                self._process_spin_request(session_id, channel_id, data), self.bot.loop
            )

        elif status == "completed":
            asyncio.run_coroutine_threadsafe(
                self._announce_completion(channel_id, data), self.bot.loop
            )
            asyncio.run_coroutine_threadsafe(
                self._cleanup_session_after_delay(session_id), self.bot.loop
            )

    async def _process_spin_request(self, session_id: str, channel_id: int, data: dict):
        """Calculates groups and updates Firestore."""
        logger.info(f"Processing spin request for session {session_id}")

        channel = self.bot.get_channel(channel_id)
        if not channel:
            logger.error(f"Channel {channel_id} not found.")
            return

        # 1. Get Players from Channel
        members = [m for m in channel.members if not m.bot]
        if not members:
            # Update status to error?
            logger.warning("No players found in channel during spin request.")
            return

        # 2. Parse Players (using existing util)
        players = getPlayerList(members)
        if not players:
            logger.warning("No valid players found.")
            return

        # 3. Calculate Groups
        # Note: We aren't handling "debug" mode here, assuming production for the Activity.
        groups = create_mythic_plus_groups(players, debug=False)

        # 4. Save results to Bot's GroupService (for !badgroup support)
        if hasattr(self.bot, "group_service") and channel.guild:
            self.bot.group_service.last_results[channel.guild.id] = {
                "players": list(players),
                "groups": list(groups),
            }

        # 5. Update Firestore
        # We need to serialize groups
        groups_data = [g.to_dict() for g in groups]

        await self.firebase.update_session(
            session_id, {"status": "spinning", "groups": groups_data}
        )

    async def _announce_completion(self, channel_id: int, data: dict):
        """Announces results to the channel with an embed listing each group."""
        channel = self.bot.get_channel(channel_id)
        if not channel:
            return

        groups = data.get("groups") or []
        if not groups:
            await channel.send(
                "🎉 Groups have been formed! Check the Activity for details."
            )
            return

        embed = discord.Embed(
            title="🎉 Groups Formed!",
            description="Check the Activity for the full experience.",
            color=discord.Color.gold(),
        )
        for i, g in enumerate(groups, 1):
            tank = (g.get("tank") or {}).get("name") or "None"
            healer = (g.get("healer") or {}).get("name") or "None"
            dps_list = g.get("dps") or []
            dps_names = ", ".join((p.get("name") or "?") for p in dps_list)
            value = f"**Tank:** {tank}\n**Healer:** {healer}\n**DPS:** {dps_names}"
            embed.add_field(name=f"Group {i}", value=value, inline=True)
        await channel.send(embed=embed)

    async def update_lobby_players(
        self, channel_id: int, member_list: list[discord.Member]
    ):
        """Called when voice state changes."""
        session_id = self.active_sessions.get(channel_id)
        if not session_id:
            return

        # Parse players
        players = getPlayerList(member_list)
        # Even if empty, we sync it so the UI shows empty lobby.

        players_data = [p.to_dict() for p in players]
        await self.firebase.update_session(session_id, {"players": players_data})

    async def _cleanup_session_after_delay(self, session_id: str):
        """Removes the session and unsubscribes its Firestore listener after a delay."""
        await asyncio.sleep(SESSION_CLEANUP_DELAY_SECONDS)
        channel_id = None
        for ch_id, sess_id in list(self.active_sessions.items()):
            if sess_id == session_id:
                channel_id = ch_id
                break
        if channel_id is not None:
            del self.active_sessions[channel_id]
        watch = self.listeners.pop(session_id, None)
        if watch is not None and hasattr(watch, "unsubscribe"):
            watch.unsubscribe()
        logger.debug("Cleaned up session %s", session_id)
