import asyncio
import json
import logging
import threading
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import firebase_admin  # pyright: ignore[reportMissingTypeStubs]
from firebase_admin import (  # pyright: ignore[reportMissingTypeStubs]
    credentials,
    firestore,
)

from core import config

logger = logging.getLogger(__name__)


class FirebaseService:
    DELETE_FIELD: Any = (
        firestore.firestore.DELETE_FIELD
    )  # Sentinel to remove a field on update
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.db = None
        self._initialize_firebase()
        self._initialized = True

    def _initialize_firebase(self):
        """Initializes the Firebase Admin SDK using credentials from env."""
        try:
            if not config.FIREBASE_CREDENTIALS_JSON:
                logger.warning(
                    "FIREBASE_CREDENTIALS_JSON not set. Firebase features will be disabled."
                )
                return

            try:
                cred_dict = json.loads(config.FIREBASE_CREDENTIALS_JSON)
            except json.JSONDecodeError:
                logger.error(
                    "Failed to parse FIREBASE_CREDENTIALS_JSON. "
                    "Ensure the JSON is valid and uses double quotes for all keys and string values."
                )
                self.db = None
                return

            cred = credentials.Certificate(cred_dict)
            try:
                firebase_admin.initialize_app(cred)
            except ValueError:
                # App already initialized (e.g. previous __init__ succeeded partially)
                pass
            self.db = firestore.client()
            logger.info("Firebase initialized successfully.")
        except Exception as e:
            # Log type only; exception message may contain credential/project hints.
            logger.error("Failed to initialize Firebase: %s", type(e).__name__)
            self.db = None

    def is_available(self) -> bool:
        return self.db is not None

    # ── Guild Doc Operations ──────────────────────────────────

    async def get_or_create_guild_doc(
        self,
        guild_id: int,
        guild_name: str | None = None,
        guild_icon_url: str | None = None,
    ) -> str:
        """Creates or updates a guild document. Returns the guild doc ID."""
        if not self.db:
            raise RuntimeError("Firebase is not initialized.")

        doc_id = str(guild_id)
        doc_ref = self.db.collection("guilds").document(doc_id)

        guild_fields: dict[str, Any] = {}
        if guild_name is not None:
            guild_fields["guildName"] = guild_name
        if guild_icon_url is not None:
            guild_fields["guildIconUrl"] = guild_icon_url

        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            data: dict[str, Any] = {
                "guildId": doc_id,
                "voiceChannels": [],
                "createdAt": firestore.SERVER_TIMESTAMP,
                "lastActive": firestore.SERVER_TIMESTAMP,
                **guild_fields,
            }
            await asyncio.to_thread(doc_ref.set, data)
        else:
            update: dict[str, Any] = {
                "lastActive": firestore.SERVER_TIMESTAMP,
                **guild_fields,
            }
            await asyncio.to_thread(doc_ref.update, update)

        return doc_id

    async def update_guild_doc(self, guild_id: str, data: dict[str, Any]) -> None:
        """Updates fields on a guild document."""
        if not self.db:
            return
        doc_ref = self.db.collection("guilds").document(guild_id)
        await asyncio.to_thread(doc_ref.update, data)

    async def delete_guild_doc(self, guild_id: str) -> None:
        """Deletes a guild document."""
        if not self.db:
            return
        doc_ref = self.db.collection("guilds").document(guild_id)
        await asyncio.to_thread(doc_ref.delete)
        logger.debug("Deleted guild doc %s from Firestore", guild_id)

    def listen_to_guild_doc(
        self,
        guild_id: str,
        callback: Callable[..., None],
    ) -> object | None:
        """Sets up a real-time listener for a guild document."""
        if not self.db:
            return None
        doc_ref = self.db.collection("guilds").document(guild_id)
        return doc_ref.on_snapshot(callback)

    # ── Channel Doc Operations ────────────────────────────────

    async def get_or_create_channel_doc(
        self,
        channel_id: int,
        guild_id: int,
        channel_name: str,
        debug: bool = False,
    ) -> str:
        """Creates or updates a channel document. Returns the channel doc ID."""
        if not self.db:
            raise RuntimeError("Firebase is not initialized.")

        doc_id = str(channel_id)
        doc_ref = self.db.collection("channels").document(doc_id)

        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            data: dict[str, Any] = {
                "channelId": doc_id,
                "channelName": channel_name,
                "guildId": str(guild_id),
                "status": "lobby",
                "players": [],
                "groups": [],
                "isDebug": debug,
                "announceResults": True,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "lastActive": firestore.SERVER_TIMESTAMP,
            }
            await asyncio.to_thread(doc_ref.set, data)
        else:
            update: dict[str, Any] = {
                "lastActive": firestore.SERVER_TIMESTAMP,
                "status": "lobby",
                "groups": [],
                "isDebug": debug,
            }
            await asyncio.to_thread(doc_ref.update, update)

        return doc_id

    async def update_channel_doc(self, channel_id: str, data: dict[str, Any]) -> None:
        """Updates fields on a channel document."""
        if not self.db:
            return
        doc_ref = self.db.collection("channels").document(channel_id)
        await asyncio.to_thread(doc_ref.update, data)

    async def delete_channel_doc(self, channel_id: str) -> None:
        """Deletes a channel document."""
        if not self.db:
            return
        doc_ref = self.db.collection("channels").document(channel_id)
        await asyncio.to_thread(doc_ref.delete)
        logger.debug("Deleted channel doc %s from Firestore", channel_id)

    def listen_to_channel_doc(
        self,
        channel_id: str,
        callback: Callable[..., None],
    ) -> object | None:
        """Sets up a real-time listener for a channel document."""
        if not self.db:
            return None
        doc_ref = self.db.collection("channels").document(channel_id)
        return doc_ref.on_snapshot(callback)

    # ── Collection Operations ─────────────────────────────────

    def listen_to_collection(
        self,
        collection_name: str,
        callback: Callable[..., None],
    ) -> object | None:
        """Sets up a real-time listener for an entire collection."""
        if not self.db:
            return None

        col_ref = self.db.collection(collection_name)
        return col_ref.on_snapshot(callback)

    async def delete_old_docs(self, collection: str, seconds: int) -> int:
        """
        Deletes documents in `collection` whose lastActive is older than the given age.
        Returns the number of documents deleted.
        """
        if not self.db:
            return 0

        db = self.db
        cutoff = datetime.now(UTC) - timedelta(seconds=seconds)

        def _run() -> int:
            refs = list(
                db.collection(collection).where("lastActive", "<", cutoff).stream()
            )
            batch = db.batch()
            count = 0
            for doc in refs:
                batch.delete(doc.reference)
                count += 1
                if count % 500 == 0:
                    batch.commit()
                    batch = db.batch()

            if count % 500 != 0:
                batch.commit()

            return len(refs)

        deleted = await asyncio.to_thread(_run)
        if deleted:
            logger.info(
                "Deleted %d old doc(s) from %s (older than %d seconds)",
                deleted,
                collection,
                seconds,
            )
        return deleted

    async def delete_all_in_collection(self, collection: str) -> int:
        """Deletes all documents in a collection. Returns count deleted."""
        if not self.db:
            return 0

        db = self.db

        def _run() -> int:
            refs = list(db.collection(collection).stream())
            batch = db.batch()
            count = 0
            for doc_snap in refs:
                batch.delete(doc_snap.reference)
                count += 1
                if count % 500 == 0:
                    batch.commit()
                    batch = db.batch()

            if count % 500 != 0:
                batch.commit()

            return len(refs)

        deleted = await asyncio.to_thread(_run)
        if deleted:
            logger.info("Deleted all %d doc(s) from %s collection", deleted, collection)
        return deleted
