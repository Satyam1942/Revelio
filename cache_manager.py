import os
import json

CACHE_FILE = 'video_cache.jsonl'
memory_cache = {}

def initialize_cache_on_startup():
    """Reads the .jsonl file ONCE when the server boots to populate RAM."""
    global memory_cache
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'r') as f:
            for line in f:
                if line.strip():
                    record = json.loads(line)
                    # Get the only key (video_id) and its value
                    video_id = list(record.keys())[0]
                    memory_cache[video_id] = record[video_id]
        print(f"Loaded {len(memory_cache)} videos into memory cache.")
    else:
        with open(CACHE_FILE, 'w') as f:
            pass
        print(f"Created new cache file: {CACHE_FILE}")


def append_to_cache(video_id, data):
    """Updates RAM and appends a single line to the file without reading it."""
    memory_cache[video_id] = data # Update fast memory
    
    # Append to disk (Notice the 'a' mode and the \n newline character)
    with open(CACHE_FILE, 'a') as f:
        new_record = {video_id: data}
        f.write(json.dumps(new_record) + '\n')

# Run this immediately when the module is imported
initialize_cache_on_startup()