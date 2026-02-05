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

            cred_dict = json.loads(config.FIREBASE_CREDENTIALS_JSON)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            logger.info("Firebase initialized successfully.")
        except Exception as e:
            logger.error("Failed to initialize Firebase: %s", e)
            self.db = None

    def is_available(self) -> bool:
        return self.db is not None

    async def create_session(
        self, guild_id: int, channel_id: int, players: list[dict[str, Any]]
    ) -> str:
        """
        Creates a new session document in Firestore.
        Returns the session ID (document ID).
        """
        if not self.db:
            raise RuntimeError("Firebase is not initialized.")

        # Create the document
        # We use a collection named 'sessions'
        doc_ref = self.db.collection("sessions").document()

        data = {
            "guildId": str(guild_id),
            "channelId": str(channel_id),
            "status": "lobby",  # lobby, spinning, completed
            "players": players,  # List of dicts
            "groups": [],  # Calculated groups
            "createdAt": firestore.SERVER_TIMESTAMP,
        }

        # Async writing to Firestore in a sync wrapper needs care if using async/await
        # But firebase-admin is synchronous (blocking).
        # We should wrap it in asyncio.to_thread to avoid blocking the bot loop.
        import asyncio

        await asyncio.to_thread(doc_ref.set, data)

        return doc_ref.id

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

    async def delete_session(self, session_id: str) -> None:
        """Deletes a session document from Firestore."""
        if not self.db:
            return

        doc_ref = self.db.collection("sessions").document(session_id)
        await asyncio.to_thread(doc_ref.delete)
        logger.debug("Deleted session %s from Firestore", session_id)

    async def delete_sessions_older_than(self, seconds: int) -> int:
        """
        Deletes session documents whose createdAt is older than the given age.
        Returns the number of documents deleted. Used to clean up abandoned sessions.
        """
        if not self.db:
            return 0

        db = self.db
        cutoff = datetime.now(UTC) - timedelta(seconds=seconds)

        def _run() -> int:
            refs = list(
                db.collection("sessions").where("createdAt", "<", cutoff).stream()
            )
            for doc in refs:
                doc.reference.delete()
            return len(refs)

        deleted = await asyncio.to_thread(_run)
        if deleted:
            logger.info(
                "Deleted %d old session(s) from Firestore (older than %d seconds)",
                deleted,
                seconds,
            )
        return deleted
