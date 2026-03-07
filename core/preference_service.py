from __future__ import annotations

import asyncio
import logging
from typing import Any

from core.firebase_service import FirebaseService
from core.storage import (
    clear_player_preference,
    get_all_preferences,
    get_player_preference,
    set_player_preference,
)

logger = logging.getLogger(__name__)

_instance: PreferenceService | None = None


def get_preference_service() -> PreferenceService:
    global _instance
    if _instance is None:
        _instance = PreferenceService()
    return _instance


class PreferenceService:
    """Unified preference service backed by Firestore with local JSON fallback."""

    def __init__(self) -> None:
        self.firebase = FirebaseService()
        self._cache: dict[str, list[str]] = {}
        self._name_to_id: dict[str, str] = {}

    def _firebase_ok(self) -> bool:
        return self.firebase.is_available()

    # ── Async Methods (Firestore + fallback) ──────────────────

    async def load_cache(self) -> None:
        """Populate cache from Firestore on startup."""
        if not self._firebase_ok():
            self._load_from_local()
            return

        try:
            docs = await self._fetch_all_preferences()
            for discord_id, data in docs.items():
                roles = data.get("roles", [])
                name = data.get("wowName", "")
                self._cache[discord_id] = roles
                if name:
                    self._name_to_id[name] = discord_id
            logger.info("Loaded %d preferences from Firestore", len(docs))
        except Exception:
            logger.exception("Failed to load preferences from Firestore, using local")
            self._load_from_local()

    def _load_from_local(self) -> None:
        """Load preferences from local JSON into name-keyed cache."""
        local = get_all_preferences()
        for name, roles in local.items():
            self._name_to_id[name] = name
            self._cache[name] = roles

    async def _fetch_all_preferences(self) -> dict[str, dict[str, Any]]:
        """Fetch all documents from the preferences collection."""
        if not self.firebase.db:
            return {}

        db = self.firebase.db

        def _run() -> dict[str, dict[str, Any]]:
            result: dict[str, dict[str, Any]] = {}
            for doc_snap in db.collection("preferences").stream():
                result[doc_snap.id] = doc_snap.to_dict()
            return result

        return await asyncio.to_thread(_run)

    async def get_preference(self, discord_id: str) -> list[str] | None:
        """Get preference: cache -> Firestore -> local JSON."""
        if discord_id in self._cache:
            return self._cache[discord_id]

        if self._firebase_ok():
            try:
                data = await self._read_firestore_pref(discord_id)
                if data is not None:
                    roles = data.get("roles", [])
                    name = data.get("wowName", "")
                    self._cache[discord_id] = roles
                    if name:
                        self._name_to_id[name] = discord_id
                    return roles
            except Exception:
                logger.exception("Firestore read failed for %s", discord_id)

        return None

    async def set_preference(
        self, discord_id: str, name: str, roles: list[str]
    ) -> None:
        """Write preference to Firestore + update cache + local JSON backup."""
        self._cache[discord_id] = roles
        self._name_to_id[name] = discord_id

        if self._firebase_ok():
            try:
                await self._write_firestore_pref(discord_id, name, roles)
            except Exception:
                logger.exception("Firestore write failed for %s", discord_id)

        # Local JSON backup
        set_player_preference(name, roles)

    async def clear_preference(self, discord_id: str) -> None:
        """Delete from Firestore + cache + local JSON."""
        # Find name for local cleanup
        name = None
        for n, did in self._name_to_id.items():
            if did == discord_id:
                name = n
                break

        self._cache.pop(discord_id, None)
        if name:
            self._name_to_id.pop(name, None)
            clear_player_preference(name)

        if self._firebase_ok():
            try:
                await self._delete_firestore_pref(discord_id)
            except Exception:
                logger.exception("Firestore delete failed for %s", discord_id)

    # ── Sync Methods (cache-only, hot-path reads) ─────────────

    async def refresh_preference(self, discord_id: str) -> None:
        """Re-read a single preference from Firestore into the cache."""
        if not self._firebase_ok():
            return
        try:
            data = await self._read_firestore_pref(discord_id)
            if data is not None:
                roles = data.get("roles", [])
                name = data.get("wowName", "")
                self._cache[discord_id] = roles
                if name:
                    self._name_to_id[name] = discord_id
            else:
                self._cache.pop(discord_id, None)
        except Exception:
            logger.exception("Firestore refresh failed for %s", discord_id)

    def get_preference_sync(self, discord_id: str) -> list[str] | None:
        """Cache-only lookup by discord ID."""
        return self._cache.get(discord_id)

    def get_preference_by_name_sync(self, name: str) -> list[str] | None:
        """Reverse lookup: name -> discord_id -> cache."""
        discord_id = self._name_to_id.get(name)
        if discord_id:
            return self._cache.get(discord_id)
        # Fallback to local JSON
        return get_player_preference(name)

    def resolve_discord_id(self, name: str) -> str | None:
        """Look up a discord ID by player name."""
        return self._name_to_id.get(name)

    # ── Firestore CRUD helpers ────────────────────────────────

    async def _read_firestore_pref(self, discord_id: str) -> dict[str, Any] | None:
        if not self.firebase.db:
            return None
        db = self.firebase.db
        ref = db.collection("preferences").document(discord_id)
        doc_snap = await asyncio.to_thread(ref.get)
        if doc_snap.exists:
            return doc_snap.to_dict()
        return None

    async def _write_firestore_pref(
        self, discord_id: str, name: str, roles: list[str]
    ) -> None:
        if not self.firebase.db:
            return
        from firebase_admin import (
            firestore as fs,  # pyright: ignore[reportMissingTypeStubs]
        )

        db = self.firebase.db
        ref = db.collection("preferences").document(discord_id)
        await asyncio.to_thread(
            ref.set,
            {"roles": roles, "wowName": name, "updatedAt": fs.SERVER_TIMESTAMP},
        )

    async def _delete_firestore_pref(self, discord_id: str) -> None:
        if not self.firebase.db:
            return
        db = self.firebase.db
        ref = db.collection("preferences").document(discord_id)
        await asyncio.to_thread(ref.delete)
