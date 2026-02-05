import json
import logging
import threading

import firebase_admin
from firebase_admin import credentials, firestore

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
        self, guild_id: int, channel_id: int, players: list
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

    async def update_session(self, session_id: str, data: dict):
        """Updates fields in an existing session."""
        if not self.db:
            return

        doc_ref = self.db.collection("sessions").document(session_id)
        import asyncio

        await asyncio.to_thread(doc_ref.update, data)

    def listen_to_session(self, session_id: str, callback):
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
