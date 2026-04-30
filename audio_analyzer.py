import urllib.parse as urlparse
import isodate
import yt_dlp
import os 

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from googleapiclient.discovery import build


class AudioAnalysisResponse(BaseModel):
    ai_generated_probability: int = Field(
        ge=0, le=100, 
        description="A percentage (0-100) representing the likelihood that the audio was AI-generated."
    )
    vocal_analysis_statement: str = Field(
        description="A detailed observation of the audio characteristics (breath patterns, artifacts, tone, consistency)."
    )
    
    
class AudioAnalyzer:
    def __init__(self, gemini_key: str):
        self.gemini_key = gemini_key
        
    def download_audio(self, video_url):
        output_filename = 'temp_audio'
        ydl_opts = {
            'format': 'm4a/bestaudio/best',
            'outtmpl': f'{output_filename}.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'm4a',
            }],
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
    
    def analyze_audio(self, video_url):
        AUDIO_PATH = "temp_audio.m4a"
        self.download_audio(video_url)
        
        if not os.path.exists(AUDIO_PATH):
            return {"error": "Audio extraction failed on server."}
        
        client = genai.Client(api_key=self.gemini_key)
        model_id = os.environ.get("GEMINI_AUD_MODEL_ID", "gemini-2.5-flash")
        
        try:
            audio_file = client.files.upload(file=AUDIO_PATH)
            prompt = """
            Perform a deep analysis of this audio. 
            1. Evaluate the audio for signs of synthetic speech (AI). Look for phase artifacts, 
            perfectly rhythmic breathing (or lack thereof), and robotic timbre. 
            2. Assign a probability percentage in the 'ai_generated_probability' field.
            3. Provide a descriptive summary in 'vocal_analysis_statement' about how human or synthetic the voice sounds.
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
        