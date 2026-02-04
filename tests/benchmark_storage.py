import time
import json
import os
import sys

# Add parent dir to path so we can import storage
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import storage

# Mock data
NUM_PLAYERS = 50
ITERATIONS = 100
TEST_FILE = "benchmark_prefs.json"

# Override storage file for safety
storage.STORAGE_FILE = TEST_FILE

def setup_data():
    data = {f"Player{i}": ["Tank", "DPS"] for i in range(NUM_PLAYERS)}
    with open(TEST_FILE, "w") as f:
        json.dump(data, f)
    return list(data.keys())

def cleanup():
    if os.path.exists(TEST_FILE):
        os.remove(TEST_FILE)

def run_benchmark():
    players = setup_data()

    print(f"Benchmarking {ITERATIONS} iterations of fetching {NUM_PLAYERS} players...")

    start_time = time.time()

    for _ in range(ITERATIONS):
        # Determine if we need to clear cache to simulate worst case?
        # No, the real world case is repeated access during one command execution.
        # But currently, every access re-reads the file.
        # So we just call get_player_preference repeatedly.

        for player in players:
            _ = storage.get_player_preference(player)

    end_time = time.time()

    duration = end_time - start_time
    ops_per_sec = (NUM_PLAYERS * ITERATIONS) / duration

    print(f"Total time: {duration:.4f} seconds")
    print(f"Operations: {NUM_PLAYERS * ITERATIONS}")
    print(f"Ops/sec: {ops_per_sec:.2f}")

    cleanup()

if __name__ == "__main__":
    try:
        run_benchmark()
    except Exception as e:
        print(f"Error: {e}")
        cleanup()
