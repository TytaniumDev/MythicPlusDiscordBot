from __future__ import annotations

import json
import logging
import os
import threading
from typing import cast

logger = logging.getLogger(__name__)

PREFERENCES_PATH: str | None = os.environ.get("PREFERENCES_PATH")
DATA_DIR: str | None = os.environ.get("DATA_DIR")
STORAGE_FILE: str = (
    PREFERENCES_PATH
    or (os.path.join(DATA_DIR, "player_preferences.json") if DATA_DIR else None)
    or "player_preferences.json"
)

file_lock = threading.RLock()
_preferences_cache: dict[str, list[str]] | None = None


_LEGACY_MIGRATIONS: dict[str, str] = {
    "DPS": "Melee",
    "DPS Offspec": "Melee Offspec",
}


def migrate_preferences(
    prefs: dict[str, list[str]],
) -> tuple[dict[str, list[str]], bool]:
    """Converts legacy role strings to their modern equivalents.

    Returns the (possibly-mutated) dict and a flag indicating whether any
    migration was applied.
    """
    changed = False
    for player, roles in prefs.items():
        new_roles = []
        for role in roles:
            replacement = _LEGACY_MIGRATIONS.get(role)
            if replacement is not None:
                new_roles.append(replacement)
                changed = True
            else:
                new_roles.append(role)
        if changed:
            prefs[player] = new_roles
    return prefs, changed


def _ensure_loaded() -> None:
    """Ensures the preferences cache is loaded from disk if necessary."""
    global _preferences_cache

    if _preferences_cache is not None:
        return

    with file_lock:
        if _preferences_cache is not None:
            return

        if os.path.exists(STORAGE_FILE):
            try:
                with open(STORAGE_FILE) as f:
                    raw = json.load(f)
                    _preferences_cache = cast(dict[str, list[str]], raw)
            except Exception as e:
                # Log type only to avoid leaking path or file content into logs.
                logger.error("Error loading preferences: %s", type(e).__name__)
                _preferences_cache = {}
        else:
            _preferences_cache = {}

        # Migrate legacy role strings on first load
        _preferences_cache, migrated = migrate_preferences(_preferences_cache)
        if migrated:
            save_preferences(_preferences_cache)


def load_preferences() -> dict[str, list[str]]:
    _ensure_loaded()
    # At this point _preferences_cache is guaranteed to be a dict (even if empty)
    assert _preferences_cache is not None
    # Return a copy to ensure thread safety for readers
    return _preferences_cache.copy()


def save_preferences(preferences: dict[str, list[str]]) -> None:
    # This function is assumed to be called under lock
    global _preferences_cache
    try:
        # Update cache and file
        _preferences_cache = preferences
        with open(STORAGE_FILE, "w") as f:
            json.dump(preferences, f, indent=4)
    except Exception as e:
        # Log type only to avoid leaking path or file content into logs.
        logger.error("Error saving preferences: %s", type(e).__name__)


def get_player_preference(player_name: str) -> list[str] | None:
    _ensure_loaded()
    assert _preferences_cache is not None
    return _preferences_cache.get(player_name)


def set_player_preference(player_name: str, roles: list[str]) -> None:
    with file_lock:
        # Load fresh copy (or from cache)
        prefs = load_preferences()
        prefs[player_name] = roles
        save_preferences(prefs)


def clear_player_preference(player_name: str) -> bool:
    with file_lock:
        prefs = load_preferences()
        if player_name in prefs:
            del prefs[player_name]
            save_preferences(prefs)
            return True
        return False


def get_all_preferences() -> dict[str, list[str]]:
    return load_preferences()
