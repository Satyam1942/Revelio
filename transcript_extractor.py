import urllib.parse as urlparse
import isodate
import yt_dlp
import os 

from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from googleapiclient.discovery import build
from yt_dlp.networking.impersonate import ImpersonateTarget


class AudioAnalysisResponse(BaseModel):
    transcript: str = Field(description="The full transcription of the audio content.")
    ai_generated_probability: int = Field(
        ge=0, le=100, 
        description="A percentage (0-100) representing the likelihood that the audio was AI-generated."
    )
    vocal_analysis_statement: str = Field(
        description="A detailed observation of the audio characteristics (breath patterns, artifacts, tone, consistency)."
    )
    

def extract_video_id(url: str) -> str:
    parsed_url = urlparse.urlparse(url)
    
    if parsed_url.hostname == 'youtu.be':
        return parsed_url.path[1:]
    
    if parsed_url.hostname in ('www.youtube.com', 'youtube.com'):
        if parsed_url.path == '/watch':
            query_params = urlparse.parse_qs(parsed_url.query)
            return query_params.get('v', [None])[0]
            
    return None

def check_video_length(video_id: str, api_key: str) -> int:
    try:
        youtube = build("youtube", "v3", developerKey=api_key)
        request = youtube.videos().list(
            part="contentDetails",
            id=video_id
        )
        response = request.execute()
       
        if not response['items']:
            return -1

        duration_iso = response['items'][0]['contentDetails']['duration']
        duration_delta = isodate.parse_duration(duration_iso)
        
        return duration_delta.total_seconds()
    
    except Exception as e:
        print(f"Metadata extraction error: {e}")
        return -1

def download_audio(video_url):
    output_filename = 'temp_audio'
    ydl_opts = {
        'format': 'm4a/bestaudio/best',
        'outtmpl': f'{output_filename}.%(ext)s',
        'extractor_args': {
        'youtube': {
            # Use 'web_safari' or 'android' clients which are less restricted
            'player_client': ['web_safari', 'ios'], 
            'skip': ['webpage', 'configs'],
            }
        },
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'm4a',
        }],
       'impersonate': ImpersonateTarget.from_str('chrome'),
       'js_runtimes': 'deno',
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
            # The exact path on the server
            final_path = f"{output_filename}.m4a"
            
            if os.path.exists(final_path):
                return final_path
            raise FileNotFoundError("Audio extraction failed—is FFmpeg installed?")
    except Exception as e:
        print(f"DETAILED ERROR: {str(e)}")
    
def analyze_audio(video_url, api_key):
    AUDIO_PATH = "temp_audio.m4a"
    download_audio(video_url)
    
    if not os.path.exists(AUDIO_PATH):
        return {"error": "Audio extraction failed on server."}
    
    client = genai.Client(api_key=api_key)
    model_id = 'gemini-2.5-flash' 
    
    try:
        audio_file = client.files.upload(file=AUDIO_PATH)
        
        prompt = """
        Perform a deep analysis of this audio. 
        1. Transcribe the audio accurately into the 'transcript' field.
        2. Evaluate the audio for signs of synthetic speech (AI). Look for phase artifacts, 
        perfectly rhythmic breathing (or lack thereof), and robotic timbre. 
        3. Assign a probability percentage in the 'ai_generated_probability' field.
        4. Provide a descriptive summary in 'vocal_analysis_statement' about how human or synthetic the voice sounds.
        """
        
        response = client.models.generate_content(
            model=model_id,
            contents=[
                prompt,
                audio_file
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AudioAnalysisResponse # Pass the Pydantic class directly
            )
        )
        
        os.remove(AUDIO_PATH)
        
        return response.parsed
    
    except Exception as e:
        if os.path.exists(AUDIO_PATH): os.remove(AUDIO_PATH)
        return {"error": str(e)}