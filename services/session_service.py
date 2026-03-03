import asyncio
import logging
from dataclasses import dataclass
from typing import Any, cast

import discord
from discord.ext import commands

from core.firebase_service import FirebaseService
from core.group_ui import build_group_embed
from core.models import WoWGroup, WoWPlayer
from core.parallel_group_creator import create_mythic_plus_groups
from core.utils import get_player_list

logger = logging.getLogger(__name__)


@dataclass
class ActiveChannel:
    doc_id: str
    guild_id: int


class SessionService:
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.firebase = FirebaseService()
        self.active_guilds: set[int] = set()
        self.active_channels: dict[int, ActiveChannel] = {}  # channel_id -> info
        self.channel_listeners: dict[str, Any] = {}  # doc_id -> watch
        self.guild_listeners: dict[int, Any] = {}  # guild_id -> watch
        self._collection_watch: Any = None
        self._guild_collection_watch: Any = None

    def _run_async(self, coro: Any) -> None:
        """Schedules a coroutine on the bot loop with error logging."""
        future = asyncio.run_coroutine_threadsafe(coro, self.bot.loop)
        future.add_done_callback(self._log_future_exception)

    @staticmethod
    def _log_future_exception(future: Any) -> None:
        exc = future.exception()
        if exc:
            logger.error("Async task failed: %s", exc)

    async def get_or_create_session(
        self,
        ctx: commands.Context[commands.Bot],
        debug: bool = False,
    ) -> tuple[str, str] | None:
        """Creates guild + channel docs and sets up listeners. Returns (guild_id, channel_id) or None."""
        if not self.firebase.is_available():
            return None

        if ctx.guild is None:
            return None

        guild_id = ctx.guild.id
        guild_name = ctx.guild.name
        guild_icon_url = str(ctx.guild.icon.url) if ctx.guild.icon else None

        # Create/update guild doc
        guild_doc_id = await self.firebase.get_or_create_guild_doc(
            guild_id,
            guild_name=guild_name,
            guild_icon_url=guild_icon_url,
        )
        self.active_guilds.add(guild_id)

        # Refresh voice channels in guild doc
        await self.refresh_guild_voice_channels(ctx.guild)

        # Start guild doc listener for refresh requests
        if guild_id not in self.guild_listeners:
            self._start_guild_listener(guild_id)

        # Determine the voice channel
        voice_channel_id: int | None = None
        voice_channel_name = ""
        if ctx.author.voice and ctx.author.voice.channel:
            voice_channel_id = ctx.author.voice.channel.id
            voice_channel_name = ctx.author.voice.channel.name

        if voice_channel_id is None:
            return None

        # Create/update channel doc
        channel_doc_id = await self.firebase.get_or_create_channel_doc(
            voice_channel_id,
            guild_id,
            voice_channel_name,
            debug=debug,
        )

        self.active_channels[voice_channel_id] = ActiveChannel(
            doc_id=channel_doc_id, guild_id=guild_id
        )

        # Start channel doc listener
        if channel_doc_id not in self.channel_listeners:
            self._start_channel_listener(channel_doc_id, voice_channel_id, guild_id)

        # Sync players for this channel
        await self.update_channel_players(voice_channel_id, ctx.guild)

        return (guild_doc_id, channel_doc_id)

    def start_collection_listener(self) -> None:
        """Watches the channels collection to auto-discover new and existing channel docs."""
        if self._collection_watch is not None:
            return
        if not self.firebase.is_available():
            return

        def on_collection_snapshot(
            col_snapshot: Any, changes: Any, read_time: Any
        ) -> None:
            for change in changes:
                if change.type.name == "ADDED":
                    self._handle_collection_added(change)
                elif change.type.name == "REMOVED":
                    self._handle_collection_removed(change)

        self._collection_watch = self.firebase.listen_to_collection(
            "channels", on_collection_snapshot
        )

    def _handle_collection_added(self, change: Any) -> None:
        """Handle a new channel doc appearing in the collection."""
        doc = change.document
        data = doc.to_dict()
        doc_id = doc.id
        channel_id_str = data.get("channelId")
        guild_id_str = data.get("guildId")
        if not channel_id_str or not guild_id_str:
            return

        try:
            channel_id = int(channel_id_str)
            guild_id = int(guild_id_str)
        except (ValueError, TypeError):
            return

        # Skip if already tracked
        if channel_id in self.active_channels:
            return

        # Validate that the bot is in this guild
        guild = self.bot.get_guild(guild_id)
        if not guild:
            return

        logger.info("Auto-discovered channel %s for guild %s", doc_id, guild_id)
        self.active_channels[channel_id] = ActiveChannel(
            doc_id=doc_id, guild_id=guild_id
        )
        self._start_channel_listener(doc_id, channel_id, guild_id)

        # Track the guild and ensure guild doc exists
        if guild_id not in self.active_guilds:
            self.active_guilds.add(guild_id)
            self._run_async(
                self.firebase.get_or_create_guild_doc(guild_id, guild_name=guild.name),
            )
            if guild_id not in self.guild_listeners:
                self._start_guild_listener(guild_id)

        # Sync players
        self._run_async(self.update_channel_players(channel_id, guild))

    def _handle_collection_removed(self, change: Any) -> None:
        """Handle a channel doc being deleted from the collection."""
        doc = change.document
        doc_id = doc.id

        # Use doc.id directly — deleted doc data may be None or empty
        try:
            channel_id = int(doc_id)
        except (ValueError, TypeError):
            return

        if channel_id in self.active_channels:
            active = self.active_channels.pop(channel_id)
            if doc_id in self.channel_listeners:
                watch = self.channel_listeners.pop(doc_id)
                watch.unsubscribe()
            logger.info("Channel %s removed from tracking", channel_id)

            # If no more channels for this guild, clean up guild tracking
            self._cleanup_guild_if_empty(active.guild_id)

    def start_guild_collection_listener(self) -> None:
        """Watches the guilds collection to auto-discover frontend-created guild docs."""
        if self._guild_collection_watch is not None:
            return
        if not self.firebase.is_available():
            return

        def on_guild_collection_snapshot(
            col_snapshot: Any, changes: Any, read_time: Any
        ) -> None:
            for change in changes:
                if change.type.name == "ADDED":
                    self._handle_guild_collection_added(change)
                elif change.type.name == "REMOVED":
                    self._handle_guild_collection_removed(change)

        self._guild_collection_watch = self.firebase.listen_to_collection(
            "guilds", on_guild_collection_snapshot
        )

    def _handle_guild_collection_added(self, change: Any) -> None:
        """Handle a new guild doc appearing in the collection."""
        doc = change.document
        data = doc.to_dict()
        doc_id = doc.id

        guild_id_str = data.get("guildId") or doc_id
        try:
            guild_id = int(guild_id_str)
        except (ValueError, TypeError):
            return

        # Skip if already tracked
        if guild_id in self.active_guilds:
            return

        # Validate that the bot is in this guild
        guild = self.bot.get_guild(guild_id)
        if not guild:
            return

        logger.info("Auto-discovered guild %s from collection", guild_id)
        self.active_guilds.add(guild_id)

        # Start per-guild listener for refresh requests
        if guild_id not in self.guild_listeners:
            self._start_guild_listener(guild_id)

        # If the doc has a refreshRequest, populate guild metadata + voice channels
        if data.get("refreshRequest"):
            self._run_async(self._initialize_guild_from_frontend(guild_id, guild, data))

    def _handle_guild_collection_removed(self, change: Any) -> None:
        """Handle a guild doc being deleted from the collection."""
        doc_id = change.document.id
        try:
            guild_id = int(doc_id)
        except (ValueError, TypeError):
            return

        if guild_id in self.active_guilds:
            self.active_guilds.discard(guild_id)
            if guild_id in self.guild_listeners:
                watch = self.guild_listeners.pop(guild_id)
                if watch:
                    watch.unsubscribe()
            logger.info("Guild %s removed from tracking", guild_id)

    async def _initialize_guild_from_frontend(
        self, guild_id: int, guild: discord.Guild, data: dict[str, Any]
    ) -> None:
        """Populates guild metadata and voice channels for a frontend-created guild doc."""
        guild_id_str = str(guild_id)
        guild_icon_url = str(guild.icon.url) if guild.icon else None

        try:
            await self.refresh_guild_voice_channels(guild)
            update: dict[str, Any] = {
                "guildName": guild.name,
                "refreshRequest": None,
            }
            if guild_icon_url:
                update["guildIconUrl"] = guild_icon_url
            await self.firebase.update_guild_doc(guild_id_str, update)
        except Exception as e:
            logger.error("Failed to initialize guild %s: %s", guild_id, e)
            # Still clear refreshRequest so the frontend doesn't hang
            try:
                await self.firebase.update_guild_doc(
                    guild_id_str, {"refreshRequest": None}
                )
            except Exception:
                pass

    def _start_guild_listener(self, guild_id: int) -> None:
        """Listens to a guild doc for refreshRequest field changes."""

        def on_snapshot(col_snapshot: Any, changes: Any, read_time: Any) -> None:
            for change in changes:
                if change.type.name != "MODIFIED":
                    continue
                data = change.document.to_dict()
                if data.get("refreshRequest"):
                    guild = self.bot.get_guild(guild_id)
                    if guild:
                        self._run_async(
                            self._handle_refresh_request(guild_id, guild),
                        )

        watch = self.firebase.listen_to_guild_doc(str(guild_id), on_snapshot)
        self.guild_listeners[guild_id] = watch

    async def _handle_refresh_request(
        self, guild_id: int, guild: discord.Guild
    ) -> None:
        """Handles a refresh request from the frontend."""
        try:
            await self.refresh_guild_voice_channels(guild)
        finally:
            # Always clear refreshRequest so the frontend button re-enables
            await self.firebase.update_guild_doc(
                str(guild_id), {"refreshRequest": None}
            )

    def _start_channel_listener(
        self, doc_id: str, channel_id: int, guild_id: int
    ) -> None:
        """Attaches a Firestore listener for a channel document."""

        def on_snapshot(col_snapshot: Any, changes: Any, read_time: Any) -> None:
            for change in changes:
                if change.type.name in ("MODIFIED", "ADDED"):
                    doc = change.document
                    data = doc.to_dict()
                    self._handle_channel_update(doc_id, channel_id, guild_id, data)

        watch = self.firebase.listen_to_channel_doc(doc_id, on_snapshot)
        self.channel_listeners[doc_id] = watch

    def _handle_channel_update(
        self,
        doc_id: str,
        channel_id: int,
        guild_id: int,
        data: dict[str, Any],
    ) -> None:
        """Handles updates from a channel Firestore document."""
        status = data.get("status")

        if status == "request_spin":
            self._run_async(
                self._process_spin_request(doc_id, channel_id, guild_id, data),
            )

        elif status == "completed":
            if data.get("announceResults", True):
                self._run_async(
                    self._announce_completion(channel_id, guild_id, data),
                )

    async def _process_spin_request(
        self,
        doc_id: str,
        channel_id: int,
        guild_id: int,
        data: dict[str, Any],
    ) -> None:
        """Calculates groups and updates Firestore."""
        logger.info("Processing spin request for channel %s", channel_id)

        guild = self.bot.get_guild(guild_id)
        if not guild:
            logger.error("Guild %d not found.", guild_id)
            return

        is_debug = data.get("isDebug", False)

        if is_debug:
            players_data = data.get("players", [])
            players = [WoWPlayer.from_dict(p) for p in players_data]
            logger.info("Using %d debug players from channel data.", len(players))
        else:
            channel = guild.get_channel(channel_id)
            if not channel or not isinstance(channel, discord.VoiceChannel):
                logger.warning(
                    "Channel %d not found or not a voice channel.", channel_id
                )
                return

            members = [m for m in channel.members if not m.bot]
            players = get_player_list(members)

        if not players and not is_debug:
            groups: list[WoWGroup] = []
        else:
            groups = create_mythic_plus_groups(players, debug=is_debug)

        if hasattr(self.bot, "group_service"):
            self.bot.group_service.last_results[guild_id] = {
                "players": list(players),
                "groups": list(groups),
            }

        groups_data = [g.to_dict() for g in groups]

        await self.firebase.update_channel_doc(
            doc_id, {"status": "spinning", "groups": groups_data}
        )

    async def _announce_completion(
        self, channel_id: int, guild_id: int, data: dict[str, Any]
    ) -> None:
        """Announces results to the voice channel using per-group embeds."""
        guild = self.bot.get_guild(guild_id)
        if not guild:
            return

        channel = guild.get_channel(channel_id)
        if not channel or not isinstance(channel, discord.VoiceChannel):
            return

        # Try cached WoWGroup objects from last spin, fall back to Firestore dicts
        groups: list[WoWGroup] = []
        last = (
            self.bot.group_service.last_results.get(guild_id)
            if hasattr(self.bot, "group_service")
            else None
        )
        if last and last.get("groups"):
            groups = list(last["groups"])
        else:
            groups_data = data.get("groups") or []
            groups = [WoWGroup.from_dict(g) for g in groups_data]

        if not groups:
            await channel.send("No groups were formed this round.")
            return

        try:
            for i, group in enumerate(groups, 1):
                embed = build_group_embed(group, i)
                await channel.send(embed=embed)
        except Exception as e:
            logger.warning(
                "Could not send completion embed to channel %s: %s",
                channel.name,
                e,
            )

    async def refresh_guild_voice_channels(self, guild: discord.Guild) -> None:
        """Scans all voice channels in the guild and writes voiceChannels to guild doc."""
        guild_id_str = str(guild.id)

        voice_channels_data: list[dict[str, Any]] = []
        for vc in guild.voice_channels:
            count = len([m for m in vc.members if not m.bot])
            if count > 0:
                voice_channels_data.append(
                    {"id": str(vc.id), "name": vc.name, "userCount": count}
                )

        voice_channels_data.sort(key=lambda x: cast(int, x["userCount"]), reverse=True)

        await self.firebase.update_guild_doc(
            guild_id_str, {"voiceChannels": voice_channels_data}
        )

    async def update_channel_players(
        self, channel_id: int, guild: discord.Guild
    ) -> None:
        """Gets members from one channel and writes players to its channel doc."""
        active = self.active_channels.get(channel_id)
        if not active:
            return

        channel = guild.get_channel(channel_id)
        if channel and isinstance(channel, discord.VoiceChannel):
            members = [m for m in channel.members if not m.bot]
            players = get_player_list(members)
            players_data = [p.to_dict() for p in players]
        else:
            players_data = []

        await self.firebase.update_channel_doc(active.doc_id, {"players": players_data})

    async def cleanup_channel(self, channel_id: int) -> None:
        """Deletes a channel doc and cleans up tracking."""
        active = self.active_channels.pop(channel_id, None)
        if not active:
            return

        # Stop the listener
        if active.doc_id in self.channel_listeners:
            watch = self.channel_listeners.pop(active.doc_id)
            watch.unsubscribe()

        # Delete the channel doc
        await self.firebase.delete_channel_doc(active.doc_id)

        # If no more active channels for this guild, clean up guild
        await self._async_cleanup_guild_if_empty(active.guild_id)

    def _cleanup_guild_if_empty(self, guild_id: int) -> None:
        """Removes guild tracking and listener if no active channels remain (sync)."""
        guild_has_channels = any(
            ac.guild_id == guild_id for ac in self.active_channels.values()
        )
        if not guild_has_channels:
            self.active_guilds.discard(guild_id)
            if guild_id in self.guild_listeners:
                watch = self.guild_listeners.pop(guild_id)
                if watch:
                    watch.unsubscribe()

    async def _async_cleanup_guild_if_empty(self, guild_id: int) -> None:
        """Removes guild tracking, listener, and Firestore doc if no active channels remain."""
        guild_has_channels = any(
            ac.guild_id == guild_id for ac in self.active_channels.values()
        )
        if not guild_has_channels:
            self.active_guilds.discard(guild_id)
            await self.firebase.delete_guild_doc(str(guild_id))
            if guild_id in self.guild_listeners:
                watch = self.guild_listeners.pop(guild_id)
                if watch:
                    watch.unsubscribe()

    def get_active_channel_ids_for_guild(self, guild_id: int) -> list[int]:
        """Returns all channel_ids in active_channels for a given guild."""
        return [
            ch_id
            for ch_id, ac in self.active_channels.items()
            if ac.guild_id == guild_id
        ]
