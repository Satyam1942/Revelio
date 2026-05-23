import os
import json

CACHE_FILE = 'video_cache.jsonl'
MAX_CACHE_SIZE = 6
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
                    # Delete first so that reapplying an existing key moves it to the end (LRU behavior)
                    if video_id in memory_cache:
                        del memory_cache[video_id]
                    memory_cache[video_id] = record[video_id]
                    
        # Enforce max size on load (in case the file was previously larger than 6)
        while len(memory_cache) > MAX_CACHE_SIZE:
            oldest_key = next(iter(memory_cache))
            del memory_cache[oldest_key]
            
        # Rewrite the cache file to clean it up if it exceeded the limit
        with open(CACHE_FILE, 'w') as f:
            for k, v in memory_cache.items():
                f.write(json.dumps({k: v}) + '\n')
                
        print(f"Loaded {len(memory_cache)} videos into memory cache.")
    else:
        with open(CACHE_FILE, 'w') as f:
            pass
        print(f"Created new cache file: {CACHE_FILE}")

def get_from_cache(video_id):
    """Retrieves data from cache and updates its LRU position."""
    if video_id in memory_cache:
        data = memory_cache[video_id]
        
        # Delete and re-insert to move it to the end (most recently used)
        del memory_cache[video_id]
        memory_cache[video_id] = data
        
        # Synchronize with disk
        with open(CACHE_FILE, 'w') as f:
            for k, v in memory_cache.items():
                f.write(json.dumps({k: v}) + '\n')
                
        return data
    return None

def append_to_cache(video_id, data):
    """Updates RAM and maintains a cyclical LRU cache written to disk."""
    if video_id in memory_cache:
        del memory_cache[video_id]
        
    memory_cache[video_id] = data 
    
    while len(memory_cache) > MAX_CACHE_SIZE:
        oldest_key = next(iter(memory_cache))
        del memory_cache[oldest_key]
        
    with open(CACHE_FILE, 'w') as f:
        for k, v in memory_cache.items():
            f.write(json.dumps({k: v}) + '\n')

# Run this immediately when the module is imported
initialize_cache_on_startup()