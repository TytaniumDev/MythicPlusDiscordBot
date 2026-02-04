import json
import os
import threading

PREFERENCES_PATH = os.environ.get("PREFERENCES_PATH")
DATA_DIR = os.environ.get("DATA_DIR")
STORAGE_FILE = (
    PREFERENCES_PATH
    or (os.path.join(DATA_DIR, "player_preferences.json") if DATA_DIR else None)
    or "player_preferences.json"
)

file_lock = threading.RLock()
_PREFERENCES_CACHE = None


def load_preferences():
    global _PREFERENCES_CACHE

    # Return a copy to ensure thread safety for readers
    if _PREFERENCES_CACHE is not None:
        return _PREFERENCES_CACHE.copy()

    # If cache miss, lock to prevent race conditions during load
    with file_lock:
        if _PREFERENCES_CACHE is not None:
            return _PREFERENCES_CACHE.copy()

        if os.path.exists(STORAGE_FILE):
            try:
                with open(STORAGE_FILE) as f:
                    _PREFERENCES_CACHE = json.load(f)
                    return _PREFERENCES_CACHE.copy()
            except Exception as e:
                print(f"Error loading preferences: {e}")
                _PREFERENCES_CACHE = {}
                return _PREFERENCES_CACHE.copy()

        _PREFERENCES_CACHE = {}
        return _PREFERENCES_CACHE.copy()


def save_preferences(preferences):
    # This function is assumed to be called under lock
    global _PREFERENCES_CACHE
    try:
        # Update cache and file
        _PREFERENCES_CACHE = preferences
        with open(STORAGE_FILE, "w") as f:
            json.dump(preferences, f, indent=4)
    except Exception as e:
        print(f"Error saving preferences: {e}")


def get_player_preference(player_name):
    prefs = load_preferences()
    return prefs.get(player_name)


def set_player_preference(player_name, roles):
    with file_lock:
        # Load fresh copy (or from cache)
        prefs = load_preferences()
        prefs[player_name] = roles
        save_preferences(prefs)


def clear_player_preference(player_name):
    with file_lock:
        prefs = load_preferences()
        if player_name in prefs:
            del prefs[player_name]
            save_preferences(prefs)
            return True
        return False


def get_all_preferences():
    return load_preferences()
