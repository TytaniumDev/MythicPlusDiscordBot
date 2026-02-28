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
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            logger.info("Firebase initialized successfully.")
        except Exception as e:
            # Log type only; exception message may contain credential/project hints.
            logger.error("Failed to initialize Firebase: %s", type(e).__name__)
            self.db = None

    def is_available(self) -> bool:
        return self.db is not None

    async def get_or_create_session(
        self,
        guild_id: int,
        debug: bool = False,
        selected_channel_id: str | None = None,
        guild_name: str | None = None,
        guild_icon_url: str | None = None,
    ) -> str:
        """
        Gets or creates a persistent session document for the guild.
        Returns the session ID (which is the guild ID).
        """
        if not self.db:
            raise RuntimeError("Firebase is not initialized.")

        session_id = str(guild_id)
        doc_ref = self.db.collection("sessions").document(session_id)

        import asyncio

        # Check if exists
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            # Create new session structure
            data: dict[str, Any] = {
                "guildId": str(guild_id),
                "status": "lobby",  # lobby, spinning, completed
                "players": [],  # List of players (synced when channel selected)
                "groups": [],  # Calculated groups
                "voiceChannels": [],  # List of {id, name, userCount}
                "selectedChannelId": selected_channel_id,
                "isDebug": debug,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "lastActive": firestore.SERVER_TIMESTAMP,
            }
            if guild_name is not None:
                data["guildName"] = guild_name
            if guild_icon_url is not None:
                data["guildIconUrl"] = guild_icon_url
            await asyncio.to_thread(doc_ref.set, data)
        else:
            # Update lastActive and selected channel
            update: dict[str, Any] = {"lastActive": firestore.SERVER_TIMESTAMP}
            if selected_channel_id:
                update["selectedChannelId"] = selected_channel_id
            if guild_name is not None:
                update["guildName"] = guild_name
            if guild_icon_url is not None:
                update["guildIconUrl"] = guild_icon_url
            await asyncio.to_thread(doc_ref.update, update)

        return session_id

    async def update_session(self, session_id: str, data: dict[str, Any]) -> None:
        """Updates fields in an existing session."""
        if not self.db:
            return

        doc_ref = self.db.collection("sessions").document(session_id)
        import asyncio

        await asyncio.to_thread(doc_ref.update, data)

    def listen_to_session(
        self,
        session_id: str,
        callback: Callable[..., None],
    ) -> object | None:
        """
        Sets up a real-time listener for a specific session.
        callback(doc_snapshot, changes, read_time)
        """
        if not self.db:
            return None

        doc_ref = self.db.collection("sessions").document(session_id)

        # Watch is blocking/threaded in background by the SDK
        watch = doc_ref.on_snapshot(callback)
        return watch

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

    async def delete_session(self, session_id: str) -> None:
        """Deletes a session document from Firestore."""
        if not self.db:
            return

        doc_ref = self.db.collection("sessions").document(session_id)
        await asyncio.to_thread(doc_ref.delete)
        logger.debug("Deleted session %s from Firestore", session_id)

    async def delete_sessions_older_than(self, seconds: int) -> int:
        """
        Deletes session documents whose lastActive is older than the given age.
        Returns the number of documents deleted. Used to clean up abandoned sessions.
        """
        if not self.db:
            return 0

        db = self.db
        cutoff = datetime.now(UTC) - timedelta(seconds=seconds)

        def _run() -> int:
            # Check both createdAt (legacy) and lastActive
            # We'll just query for lastActive < cutoff, and handle legacy docs that might not have it
            # (though new code adds it).
            # For simplicity, let's just use lastActive if present, fallback to createdAt?
            # Firestore queries are strict. Let's just query lastActive.
            # If a doc doesn't have lastActive, it won't be returned by the query?
            # Actually, let's query createdAt for legacy cleanup, and lastActive for new.
            # But simpler: we just migrated. Let's rely on lastActive.
            # If a session is brand new, it has lastActive.

            # Note: We should probably ensure we don't delete active guild sessions.
            # But 24 hours (default) inactivity is probably fine to delete.
            refs = list(
                db.collection("sessions").where("lastActive", "<", cutoff).stream()
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
                "Deleted %d old session(s) from Firestore (older than %d seconds)",
                deleted,
                seconds,
            )
        return deleted
