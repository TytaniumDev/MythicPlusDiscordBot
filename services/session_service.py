import asyncio
import logging
from typing import Any, cast

import discord
from discord.ext import commands

from core.firebase_service import FirebaseService
from core.models import WoWPlayer
from core.parallel_group_creator import create_mythic_plus_groups
from core.utils import get_player_list

logger = logging.getLogger(__name__)


class SessionService:
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.firebase = FirebaseService()
        self.active_sessions: dict[int, str] = {}  # guild_id -> session_id
        self.listeners: dict[str, Any] = {}  # session_id -> watch object
        self.guild_states: dict[
            int, dict[str, Any]
        ] = {}  # guild_id -> local cache of session state
        self._collection_watch: Any = None

    async def get_or_create_session(
        self,
        ctx: commands.Context[commands.Bot],
        debug: bool = False,
    ) -> str | None:
        """Gets or creates a persistent session for the guild and sets up listeners."""
        if not self.firebase.is_available():
            return None

        if ctx.guild is None:
            return None

        guild_id = ctx.guild.id

        # Determine the voice channel to pre-select
        voice_channel_id: str | None = None
        if ctx.author.voice and ctx.author.voice.channel:
            voice_channel_id = str(ctx.author.voice.channel.id)

        # Get or create the session with the selected channel
        session_id = await self.firebase.get_or_create_session(
            guild_id, debug=debug, selected_channel_id=voice_channel_id
        )

        self.active_sessions[guild_id] = session_id

        # Start listening if not already
        if session_id not in self.listeners:
            self._start_listening(session_id, guild_id)

        # Set guild state AFTER attaching the listener so the initial snapshot
        # callback cannot clobber the value we're about to set
        if voice_channel_id:
            if guild_id not in self.guild_states:
                self.guild_states[guild_id] = {}
            self.guild_states[guild_id]["selectedChannelId"] = voice_channel_id

        # Always sync voice states (populates players for the selected channel)
        await self.update_guild_voice_states(ctx.guild)

        return session_id

    def start_collection_listener(self) -> None:
        """Watches the sessions collection for new docs created by the frontend."""
        if self._collection_watch is not None:
            return
        if not self.firebase.is_available():
            return

        def on_collection_snapshot(
            col_snapshot: Any, changes: Any, read_time: Any
        ) -> None:
            for change in changes:
                if change.type.name != "ADDED":
                    continue

                doc = change.document
                data = doc.to_dict()
                session_id = doc.id
                guild_id_str = data.get("guildId")
                if not guild_id_str:
                    continue

                try:
                    guild_id = int(guild_id_str)
                except (ValueError, TypeError):
                    continue

                # Skip if already tracked
                if guild_id in self.active_sessions:
                    continue

                # Validate that the bot is in this guild
                guild = self.bot.get_guild(guild_id)
                if not guild:
                    continue

                logger.info(
                    "Auto-discovered session %s for guild %s", session_id, guild_id
                )
                self.active_sessions[guild_id] = session_id
                self._start_listening(session_id, guild_id)

                # Sync voice states on the bot's event loop
                asyncio.run_coroutine_threadsafe(
                    self.update_guild_voice_states(guild), self.bot.loop
                )

        self._collection_watch = self.firebase.listen_to_collection(
            "sessions", on_collection_snapshot
        )

    def _start_listening(self, session_id: str, guild_id: int) -> None:
        """Internal method to attach the Firestore listener."""

        def on_snapshot(col_snapshot: Any, changes: Any, read_time: Any) -> None:
            for change in changes:
                if change.type.name == "MODIFIED" or change.type.name == "ADDED":
                    doc = change.document
                    data = doc.to_dict()
                    is_initial = change.type.name == "ADDED"
                    self._handle_update(
                        session_id, guild_id, data, is_initial=is_initial
                    )

        watch = self.firebase.listen_to_session(session_id, on_snapshot)
        self.listeners[session_id] = watch

    def _handle_update(
        self,
        session_id: str,
        guild_id: int,
        data: dict[str, Any],
        *,
        is_initial: bool = False,
    ) -> None:
        """
        Handles updates from Firestore.
        Executed in a separate thread by the Firestore SDK.
        """
        # Update local cache
        if guild_id not in self.guild_states:
            self.guild_states[guild_id] = {}

        old_selected = self.guild_states[guild_id].get("selectedChannelId")
        new_selected = data.get("selectedChannelId")
        # During initial ADDED snapshot, don't let a stale None clobber a
        # locally-set value (race condition with get_or_create_session).
        # During real MODIFIED updates (e.g. "new round"), always trust Firestore.
        if is_initial:
            if new_selected is not None or old_selected is None:
                self.guild_states[guild_id]["selectedChannelId"] = new_selected
        else:
            self.guild_states[guild_id]["selectedChannelId"] = new_selected

        status = data.get("status")

        if status == "request_spin":
            # The UI requested a spin. We need to calculate groups.
            asyncio.run_coroutine_threadsafe(
                self._process_spin_request(session_id, guild_id, data), self.bot.loop
            )

        elif status == "completed":
            asyncio.run_coroutine_threadsafe(
                self._announce_completion(guild_id, data), self.bot.loop
            )

        # If selected channel changed, we need to sync players immediately
        if new_selected != old_selected and new_selected:
            asyncio.run_coroutine_threadsafe(
                self._sync_players_for_selected_channel(guild_id, new_selected),
                self.bot.loop,
            )

    async def _sync_players_for_selected_channel(
        self, guild_id: int, channel_id_str: str
    ):
        """Syncs players from the newly selected channel."""
        guild = self.bot.get_guild(guild_id)
        if not guild:
            return

        # We can just run the full update logic
        await self.update_guild_voice_states(guild)

    async def _process_spin_request(
        self, session_id: str, guild_id: int, data: dict[str, Any]
    ) -> None:
        """Calculates groups and updates Firestore."""
        logger.info(f"Processing spin request for session {session_id}")

        guild = self.bot.get_guild(guild_id)
        if not guild:
            logger.error(f"Guild {guild_id} not found.")
            return

        is_debug = data.get("isDebug", False)
        selected_channel_id = data.get("selectedChannelId")

        if is_debug:
            # For debug sessions, use players already stored in the session
            # (In the new flow, players might be populated by debug logic in frontend or backend mock)
            # If the players list is empty, we might fallback to a default mock list?
            players_data = data.get("players", [])
            players = [WoWPlayer.from_dict(p) for p in players_data]
            logger.info(f"Using {len(players)} debug players from session data.")
        else:
            if not selected_channel_id:
                logger.warning("No channel selected for spin.")
                return

            channel = guild.get_channel(int(selected_channel_id))
            if not channel or not isinstance(channel, discord.VoiceChannel):
                logger.warning(
                    f"Selected channel {selected_channel_id} not found or invalid."
                )
                return

            # 1. Get Players from Channel
            members = [m for m in channel.members if not m.bot]
            if not members:
                logger.warning("No players found in channel during spin request.")
                # We should probably still spin (result in 0 groups) or error?
                # Let's proceed with empty list

            # 2. Parse Players
            players = get_player_list(members)

        if not players and not is_debug:
            logger.warning("No valid players found.")
            # Ensure we update firestore to spinning with empty groups so frontend doesn't hang?
            # Or maybe just return and let frontend handle timeout?
            # Better to finish the spin with 0 groups.
            groups = []
        else:
            # 3. Calculate Groups
            groups = create_mythic_plus_groups(players, debug=is_debug)

        # 4. Save results to Bot's GroupService (for !badgroup support)
        # Note: We need a way to map this back to the channel where /activity might have been run?
        # Or just store it under guild_id.
        if hasattr(self.bot, "group_service"):
            self.bot.group_service.last_results[guild_id] = {
                "players": list(players),
                "groups": list(groups),
            }

        # 5. Update Firestore
        groups_data = [g.to_dict() for g in groups]

        await self.firebase.update_session(
            session_id, {"status": "spinning", "groups": groups_data}
        )

    async def _announce_completion(self, guild_id: int, data: dict[str, Any]) -> None:
        """Announces results to the 'selected' channel's text chat (if possible) or the last context?"""
        # We don't have the original ctx here.
        # But we can try to find the voice channel and send to its associated text channel if it exists?
        # Or we can just log it. The requirement said "Silently happen and update the UI".
        # But the old code announced it.
        # "Does that mean the bot can't just pre-determine all groups... The frontend somehow needs to ask the bot for the groups on demand and spin the wheels to show that result."
        # The user said: "Silently happen and update the UI" regarding channel switching.
        # But for completion, the bot used to post an Embed.
        # I'll keep the embed behavior if I can find a channel to post to.
        # If we can't determine a channel, we skip.

        selected_channel_id = data.get("selectedChannelId")
        if not selected_channel_id:
            return

        guild = self.bot.get_guild(guild_id)
        if not guild:
            return

        channel = guild.get_channel(int(selected_channel_id))
        if not channel:
            return

        # Attempt to find a place to send.
        # If it's a voice channel, we can send to it (modern Discord).
        if isinstance(channel, discord.VoiceChannel):
            target_channel = channel
        else:
            return

        groups = data.get("groups") or []
        if not groups:
            await target_channel.send(
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

        try:
            await target_channel.send(embed=embed)
        except Exception as e:
            logger.warning(
                f"Could not send completion embed to channel {channel.name}: {e}"
            )

    async def update_guild_voice_states(self, guild: discord.Guild):
        """
        Scans all voice channels in the guild.
        Updates 'voiceChannels' in Firestore.
        If a channel is selected, syncs its players.
        """
        session_id = self.active_sessions.get(guild.id)
        if not session_id:
            # Maybe the session exists but we aren't tracking it yet?
            # We should probably check if we need to start tracking?
            # For now, assume we only track if /activity was run once.
            return

        # 1. Build Voice Channels List
        voice_channels_data: list[dict[str, Any]] = []
        for vc in guild.voice_channels:
            # Count non-bot members
            count = len([m for m in vc.members if not m.bot])
            if count > 0:
                voice_channels_data.append(
                    {"id": str(vc.id), "name": vc.name, "userCount": count}
                )

        # Sort by user count desc
        voice_channels_data.sort(key=lambda x: cast(int, x["userCount"]), reverse=True)

        update_data = {"voiceChannels": voice_channels_data}

        # 2. Check selected channel
        selected_id = self.guild_states.get(guild.id, {}).get("selectedChannelId")
        if selected_id:
            # Sync players
            channel = guild.get_channel(int(selected_id))
            if channel and isinstance(channel, discord.VoiceChannel):
                members = [m for m in channel.members if not m.bot]
                players = get_player_list(members)
                update_data["players"] = [p.to_dict() for p in players]
            else:
                # Selected channel invalid or empty?
                # If invalid, maybe clear selected?
                # For now, just send empty players
                update_data["players"] = []

        await self.firebase.update_session(session_id, update_data)
