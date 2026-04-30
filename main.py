import os
import json
import asyncio
import queue
import threading
import concurrent.futures
from flask import Flask, request, jsonify
from flask import Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv

from asgiref.sync import async_to_sync, sync_to_async
from video_metadata_extractor import VideoMetadataExtractor
from audio_analyzer import AudioAnalyzer
from video_analyzer import VideoAnalyzer
from summary_generator import process_transcript_claims
from claim_checker import  fetch_ddg_context, run_ai_judge
from cache_manager import memory_cache, append_to_cache

load_dotenv()

app = Flask(__name__)
CORS(app)

MAX_LENGTH = 660

@app.route('/api/get-history', methods = ['GET']) 
def get_history():
    value_list = list(memory_cache.values())[-6:]
    response_payload = {
        "status": "success",
        "data": {
            "history": [
                {
                    'url' : value['data']['video_url'],
                    'topic' : value['data']['video_topic'][:50],    
                } 
                for value in value_list
            ]
        }
    }
    return jsonify(response_payload)


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
    youtube_key = os.environ.get("YOUTUBE_API_KEY")
    video_metadata_extractor = VideoMetadataExtractor()
    audio_analyzer = AudioAnalyzer(gemini_key)
    video_analyzer = VideoAnalyzer(gemini_key)
    
    
    
    if not ( gemini_key or youtube_key ):
        return jsonify({"status": "error", "message": "Server missing API configurations."}), 500

    async def generate():
        try: 
            # Checking Cache if data is there 
            video_id, is_shorts = video_metadata_extractor.extract_video_id(video_url)
            if not video_id:
                yield f"data: {json.dumps({'status': 'error', 'message': 'Could not fetch video ID. Please check the URL.'})}\n\n"
            
            if video_id in memory_cache:
                print(f"\n[CACHE HIT] ⚡ Returning from memory for video: {video_id}")
                response_payload = memory_cache[video_id]
                cached_data = response_payload.get("data", {})
                
                # 1. Transcript Payload
                transcript_payload = {
                    "type": "transcript",
                    "video_url": cached_data.get("video_url"),
                    "is_shorts": cached_data.get("is_shorts"),
                    "video_topic": cached_data.get("video_topic", "Unknown Topic"),
                    "metrics": cached_data.get("metrics", {}),
                    "fact_check_results": cached_data.get("fact_check_results", []),
                    "subjective_opinions": cached_data.get("subjective_opinions", [])
                }
                if "transcript_error" in cached_data:
                    transcript_payload["error"] = cached_data["transcript_error"]
                yield f"data: {json.dumps(transcript_payload)}\n\n"
                await asyncio.sleep(0.1)
                
                # 2. Audio Payload
                audio_cached = cached_data.get("audio_analysis", {})
                audio_payload = dict(audio_cached if isinstance(audio_cached, dict) else audio_cached.model_dump())
                audio_payload["type"] = "audio"
                yield f"data: {json.dumps(audio_payload)}\n\n"
                await asyncio.sleep(0.1)
                
                # 3. Video Payload
                video_payload = dict(cached_data.get("video_analysis", {}))
                video_payload["type"] = "video"
                yield f"data: {json.dumps(video_payload)}\n\n"
                await asyncio.sleep(0.1)
                
                # 4. Final Payload
                final_payload = {
                    "type": "final",
                    "ai_generation_probability": cached_data.get("ai_generation_probability", 0)
                }
                yield f"data: {json.dumps(final_payload)}\n\n"
                return
  
            if not is_shorts :
                yield f"data: {json.dumps({'step': 0, 'message': 'Verifying video length...'})}\n\n"
                video_length = video_metadata_extractor.check_video_length(video_id, youtube_key)
                if video_length > MAX_LENGTH:
                    yield f"data: {json.dumps({'status': 'error', 'message': f'Video is too long ({video_length // 60} mins). Please use a video under 10 minutes.'})}\n\n"
                    return 
                elif video_length == -1:
                    yield f"data: {json.dumps({'status': 'error', 'message': 'Could not verify video length. Please check the URL.'})}\n\n"
                    return
                
            async def full_transcript_pipeline(video_id):
                try:
                    print('Fetching transcript...')
                    transcript = await asyncio.to_thread(video_metadata_extractor.get_transcript, video_id)
                    if isinstance(transcript, dict) and "error" in transcript:
                        raise ValueError(f"Transcript Error: {transcript['error']}")
                    if transcript.startswith("Error") or transcript.startswith("An error"):
                        raise ValueError("YouTube transcript is unavailable for this video.")
                    print('Transcript fetched!')
                    
                    print('Extracting claims...')
                    claims = await asyncio.to_thread(process_transcript_claims, transcript, gemini_key)
                    if claims.get("status") == "error":
                        raise ValueError("Extraction claim failed, Gemini 2.5 API might be unavailable.")
                    print('Claims extracted!')
                    
                    print('Fetching live search evidence...')
                    verifiable_claims = claims.get('verifiable_claims', [])
                    claims_with_evidence = []
                    
                    if verifiable_claims:
                        def fetch_evidence(item):
                            query = f"{item['claim']} {item['context']}"
                            evidence = fetch_ddg_context(query)
                            return {
                                "claim": item['claim'],
                                "video_context": item['context'],
                                "live_search_evidence": evidence
                            }

                        with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
                            results = executor.map(fetch_evidence, verifiable_claims)
                            claims_with_evidence = list(results)
                    
                    print('Passing evidence to AI Judge...')
                    final_verdicts = []
                    if claims_with_evidence:
                        final_report_obj = await asyncio.to_thread(run_ai_judge, claims_with_evidence, gemini_key)
                        if final_report_obj:
                            final_verdicts = [verdict.model_dump() for verdict in final_report_obj.evaluations]
                            
                    return claims, final_verdicts
                except Exception as e:
                    print(f"Transcript pipeline error: {e}")
                    return {"status": "error", "message": str(e)}, []
                
            # Execute all heavy tasks in parallel
            yield f"data: {json.dumps({'message': 'Running parallel analysis...'})}\n\n"
            
            transcript_task = asyncio.create_task(full_transcript_pipeline(video_id), name="transcript")
            audio_task = asyncio.create_task(asyncio.to_thread(audio_analyzer.analyze_audio, video_url), name="audio")
            video_task = asyncio.create_task(asyncio.to_thread(video_analyzer.analyze_video, video_url), name="video")
            
            pending = {transcript_task, audio_task, video_task}
            
            # Initialize defaults in case a task fails
            extraction_data, final_verdicts = {"status": "error", "message": "Did not complete"}, []
            audio_obj = {"error": "Did not complete"}
            video_obj = {"error": "Did not complete"}
            
            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    name = task.get_name()
                    try:
                        res = task.result()
                        if name == "transcript":
                            extraction_data, final_verdicts = res
                            transcript_payload = {
                                "type": "transcript",
                                "video_url": video_url,
                                "is_shorts": is_shorts,
                                "video_topic": extraction_data.get('video_topic', 'Unknown Topic'),
                                "metrics": {
                                    "total_verifiable_claims": len(final_verdicts),
                                    "total_subjective_claims": len(extraction_data.get('subjective_claims', []))
                                },
                                "fact_check_results": final_verdicts,
                                "subjective_opinions": extraction_data.get('subjective_claims', [])
                            }
                            if extraction_data.get("status") == "error":
                                transcript_payload["error"] = extraction_data.get("message")
                            yield f"data: {json.dumps(transcript_payload)}\n\n"
                        elif name == "audio":
                            audio_obj = res
                            print(f"Audio analysis complete: {audio_obj}")
                            audio_data = audio_obj if isinstance(audio_obj, dict) else audio_obj.model_dump()
                            audio_data["type"] = "audio"
                            yield f"data: {json.dumps(audio_data)}\n\n"
                        elif name == "video":
                            video_obj = res
                            print(f"Video analysis complete: {video_obj}")
                            video_obj["type"] = "video"
                            yield f"data: {json.dumps(video_obj)}\n\n"
                    except Exception as e:
                        print(f"Task {name} failed: {e}")
                        error_msg = str(e)
                        if name == "transcript":
                            extraction_data, final_verdicts = {"status": "error", "message": error_msg}, []
                            yield f"data: {json.dumps({'type': 'transcript', 'error': error_msg, 'video_url': video_url, 'is_shorts': is_shorts})}\n\n"
                        elif name == "audio":
                            audio_obj = {"error": error_msg}
                            yield f"data: {json.dumps({'type': 'audio', 'error': error_msg})}\n\n"
                        elif name == "video":
                            video_obj = {"error": error_msg}
                            yield f"data: {json.dumps({'type': 'video', 'error': error_msg})}\n\n"
            
            print("Pipelines complete! Formatting response.")
            
            # Safely unpack sub-task results in case any threw localized errors
            extraction_error = extraction_data.get("message") if extraction_data.get("status") == "error" else None
            
            if isinstance(audio_obj, dict) and "error" in audio_obj:
                audio_ai_generated_probability = 0
                audio_analysis = {"error": audio_obj["error"]}
            else:
                audio_ai_generated_probability = audio_obj.ai_generated_probability if not isinstance(audio_obj, dict) else audio_obj.get("ai_generated_probability", 0)
                audio_analysis = audio_obj if isinstance(audio_obj, dict) else audio_obj.model_dump()
                
            if "error" in video_obj:
                video_hybrid_score = 0
                video_analysis = {"error": video_obj["error"]}
            else:
                video_hybrid_score = video_obj.get("hybrid_authenticity_score", 0)
                video_analysis = video_obj
                
            script_ai_prob = extraction_data.get('ai_generation_probability', 0) if not extraction_error else 0
            
            # Weighting final AI generation probability combining audio, transcript, and video
            ai_generation_probability = (0.33 * audio_ai_generated_probability) + (0.33 * script_ai_prob) + (0.34 * video_hybrid_score)
    
            # Yield ONLY the final score to the frontend as requested
            yield f"data: {json.dumps({'type': 'final', 'ai_generation_probability': round(ai_generation_probability, 2)})}\n\n"

            # returning the response
            response_payload = {
                "status": "success",
                "data": {
                    "video_url": video_url,
                    "is_shorts": is_shorts,
                    "video_topic": extraction_data.get('video_topic', 'Unknown Topic'),
                    "ai_generation_probability": round(ai_generation_probability, 2),
                    "audio_analysis": audio_analysis,
                    "video_analysis": video_analysis,
                    "metrics": {
                        "total_verifiable_claims": len(final_verdicts),
                        "total_subjective_claims": len(extraction_data.get('subjective_claims', []))
                    },
                    "fact_check_results": final_verdicts,
                    "subjective_opinions": extraction_data.get('subjective_claims', [])
                }
            }
            if extraction_error:
                response_payload["data"]["transcript_error"] = extraction_error

            # 3. APPEND to the cache json file 
            append_to_cache(video_id, response_payload)
        
        except Exception as e:
            print(f"Pipeline failed: {e}")
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
            return
        
    def sync_generator_wrapper():
        q = queue.Queue()
        
        def run_async():
            async def task():
                try:
                    async for item in generate():
                        q.put(("item", item))
                except Exception as e:
                    q.put(("error", e))
            
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(task())
            finally:
                loop.close()
            q.put(("done", None))

        threading.Thread(target=run_async).start()
        
        while True:
            msg_type, val = q.get()
            if msg_type == "done":
                break
            elif msg_type == "error":
                yield f"data: {json.dumps({'status': 'error', 'message': f'Server stream error: {str(val)}'})}\n\n"
                break
            else:
                yield val
    
    return Response(stream_with_context(sync_generator_wrapper()), mimetype='text/event-stream')