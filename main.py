import os
import json
import concurrent.futures
from flask import Flask, request, jsonify
from flask import Response, stream_with_context
from flask_cors import CORS

from transcript_extractor import check_video_length, extract_video_id, get_video_transcript
from summary_generator import process_transcript_claims
from claim_checker import  fetch_ddg_context, run_ai_judge

app = Flask(__name__)
CORS(app)

### ------------------ CACHE logic ------------------------------------ 
CACHE_FILE = 'video_cache.jsonl'
memory_cache = {}
MAX_LENGTH = 960

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

# Run this immediately when the script starts
initialize_cache_on_startup()

def append_to_cache(video_id, data):
    """Updates RAM and appends a single line to the file without reading it."""
    global memory_cache
    memory_cache[video_id] = data # Update fast memory
    
    # Append to disk (Notice the 'a' mode and the \n newline character)
    with open(CACHE_FILE, 'a') as f:
        new_record = {video_id: data}
        f.write(json.dumps(new_record) + '\n')
# -------------------------------------------


@app.route('/api/analyze-video', methods=['POST'])
def analyze_video():
    """
    Main endpoint. Expects a JSON payload: {"video_url": "https://youtube.com/..."}
    """
    data = request.get_json()
    video_url = data.get('video_url')
    
    if not video_url:
        return jsonify({"status": "error", "message": "No video_url provided"}), 400

    gemini_key = os.environ.get("GEMINI_API_KEY")
    
    if not gemini_key:
        return jsonify({"status": "error", "message": "Server missing API configurations."}), 500

    def generate():
        try: 
            
            yield f"data: {json.dumps({'step': 0, 'message': 'Verifying video length...'})}\n\n"
            video_length = check_video_length(video_url)
        
            if video_length > MAX_LENGTH:
                yield f"data: {json.dumps({'status': 'error', 'message': f'Video is too long ({video_length // 60} mins). Please use a video under 15 minutes.'})}\n\n"
                return 
            elif video_length == -1:
                yield f"data: {json.dumps({'status': 'error', 'message': 'Could not verify video length. Please check the URL.'})}\n\n"
                return
            
            
            # Checking Cache if data is there 
            video_id = extract_video_id(video_url)
            if not video_id:
                yield f"data: {json.dumps({'status': 'error', 'message': 'Could not fetch video ID. Please check the URL.'})}\n\n"

            global memory_cache
            if video_id in memory_cache:
                print(f"\n[CACHE HIT] ⚡ Returning from memory for video: {video_id}")
                response_payload = memory_cache[video_id]
                yield f"data: {json.dumps({'step': 5, 'message': 'Complete!', 'result': response_payload})}\n\n"
                return
            
            # [1/4] Fetching transcript for: {video_url} 
            yield f"data: {json.dumps({'step': 1, 'message': 'Fetching YouTube transcript...'})}\n\n"
            transcript = get_video_transcript(video_url)
            
            if transcript.startswith("Error") or transcript.startswith("An error"):
                return jsonify({"status": "error", "message": "Transcript Extraction failed"}), 400
                
            # "[2/4] Extracting and routing claims via Gemini..."
            yield f"data: {json.dumps({'step': 2, 'message': 'Extracting claims...'})}\n\n"
            extraction_data = process_transcript_claims(transcript, gemini_key)
            
            if extraction_data.get("status") == "error":
                yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
                return Response(status=500)
                
            # [3/4] Fetching live search evidence for {len(extraction_data['verifiable_claims'])} facts..."
            yield f"data: {json.dumps({'step': 3, 'message': f'Fetching live search evidence for {len(extraction_data.get("verifiable_claims", []))} facts...'})}\n\n"
            claims_with_evidence = []
            
            def fetch_evidence(item):
                query = f"{item['claim']} {item['context']}"
                evidence = fetch_ddg_context(query)
                return {
                    "claim": item['claim'],
                    "video_context": item['context'],
                    "live_search_evidence": evidence
                }

            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                results = executor.map(fetch_evidence, extraction_data['verifiable_claims'])
                claims_with_evidence = list(results)
            
            # [4/4] Passing evidence to the AI Judge..."
            yield f"data: {json.dumps({'step': 4, 'message': 'Passing evidence to the AI Judge...'})}\n\n"
            final_verdicts = []
            if claims_with_evidence:
                final_report_obj = run_ai_judge(claims_with_evidence, gemini_key)
                if final_report_obj:
                    final_verdicts = [verdict.model_dump() for verdict in final_report_obj.evaluations]

            print("Pipeline complete! Sending response.")
            
            # returning the response
            response_payload = {
                "status": "success",
                "data": {
                    "video_url": video_url,
                    "video_topic": extraction_data['video_topic'],
                    "ai_generation_probability": extraction_data['ai_generation_probability'],
                    "metrics": {
                        "total_verifiable_claims": len(final_verdicts),
                        "total_subjective_claims": len(extraction_data['subjective_claims'])
                    },
                    "fact_check_results": final_verdicts,
                    "subjective_opinions": extraction_data['subjective_claims']
                }
            }

            # 3. APPEND to the cache json file 
            append_to_cache(video_id, response_payload)
            yield f"data: {json.dumps({'step': 5, 'message': 'Complete!', 'result': response_payload})}\n\n"
        
        except Exception as e:
            print(f"Pipeline failed: {e}")
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
            return Response(status=500)
        
    return  Response(stream_with_context(generate()), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(debug=True, port=5000)