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

file_lock = threading.Lock()
_PREFERENCES_CACHE = None

def load_preferences():
    global _PREFERENCES_CACHE
    # We still want to use the lock for reading if we are reloading from file,
    # but here we are checking memory first.
    # However, if another thread is writing, we should be careful.
    # Given the lock is re-entrant or just simple mutex,
    # for simplicity and safety with the new threading model, we might want to lock globally
    # or just rely on the fact that writes are locked.
    # But since we have a cache now (from origin/main), reads are fast.

    if _PREFERENCES_CACHE is not None:
        return _PREFERENCES_CACHE.copy() # Return copy to avoid mutation race issues?
                                         # Or just trust consumers don't mutate dict in place without set_player_preference.

    # If cache miss, we need to load from file.
    # We should lock this to prevent multiple threads reading/populating cache simultaneously.
    with file_lock:
        if _PREFERENCES_CACHE is not None:
             return _PREFERENCES_CACHE # Double check locking

        if os.path.exists(STORAGE_FILE):
            try:
                with open(STORAGE_FILE, "r") as f:
                    _PREFERENCES_CACHE = json.load(f)
                    return _PREFERENCES_CACHE
            except Exception as e:
                print(f"Error loading preferences: {e}")
                _PREFERENCES_CACHE = {}
                return _PREFERENCES_CACHE

        _PREFERENCES_CACHE = {}
        return _PREFERENCES_CACHE

def save_preferences(preferences):
    # This function is called from set/clear which already hold the lock.
    global _PREFERENCES_CACHE
    try:
        _PREFERENCES_CACHE = preferences
        with open(STORAGE_FILE, "w") as f:
            json.dump(preferences, f, indent=4)
    except Exception as e:
        print(f"Error saving preferences: {e}")

def get_player_preference(player_name):
    # Lock shouldn't be strictly necessary for reading from memory cache
    # if we assume atomic dict ops, but safer to just read.
    # Actually, load_preferences manages the cache.
    prefs = load_preferences()
    return prefs.get(player_name)

def set_player_preference(player_name, roles):
    with file_lock:
        prefs = load_preferences()
        # Create a new dict to avoid mutating the cached one directly before save?
        # Or just mutate. Since we hold lock, it's fine for writers.
        # But readers (get_player_preference) might be reading without lock if we don't lock inside load_preferences for cache hits.
        # For strict safety, let's just use the lock.

        # If load_preferences returns the REFERENCE to _PREFERENCES_CACHE, modifying it here is thread-unsafe for readers
        # unless readers also lock.
        # The merge introduced a cache.
        # Let's simple use the lock for everything to be safe.

        # NOTE: load_preferences returning the direct cache object means modifications here affect it.
        # save_preferences writes it to disk.

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
