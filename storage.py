import json
import os

STORAGE_FILE = "player_preferences.json"

def load_preferences():
    if os.path.exists(STORAGE_FILE):
        try:
            with open(STORAGE_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading preferences: {e}")
            return {}
    return {}

def save_preferences(preferences):
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
