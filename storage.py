import json
import os

PREFERENCES_PATH = os.environ.get("PREFERENCES_PATH")
DATA_DIR = os.environ.get("DATA_DIR")
STORAGE_FILE = (
    PREFERENCES_PATH
    or (os.path.join(DATA_DIR, "player_preferences.json") if DATA_DIR else None)
    or "player_preferences.json"
)

_preferences_cache = None

def load_preferences():
    global _preferences_cache
    if _preferences_cache is not None:
        return _preferences_cache

    if os.path.exists(STORAGE_FILE):
        try:
            with open(STORAGE_FILE, "r") as f:
                _preferences_cache = json.load(f)
                return _preferences_cache
        except Exception as e:
            print(f"Error loading preferences: {e}")
            _preferences_cache = {}
            return _preferences_cache

    _preferences_cache = {}
    return _preferences_cache

def save_preferences(preferences):
    global _preferences_cache
    _preferences_cache = preferences
    try:
        with open(STORAGE_FILE, "w") as f:
            json.dump(preferences, f, indent=4)
    except Exception as e:
        print(f"Error saving preferences: {e}")

def get_player_preference(player_name):
    prefs = load_preferences()
    return prefs.get(player_name)

def set_player_preference(player_name, roles):
    prefs = load_preferences()
    prefs[player_name] = roles
    save_preferences(prefs)

def clear_player_preference(player_name):
    prefs = load_preferences()
    if player_name in prefs:
        del prefs[player_name]
        save_preferences(prefs)
        return True
    return False

def get_all_preferences():
    return load_preferences()
