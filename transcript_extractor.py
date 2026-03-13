import urllib.parse as urlparse
import requests
import re
import isodate

from googleapiclient.discovery import build
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter


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

def get_video_transcript(video_id: str) -> str:
    if not video_id:
        return "Error: Could not extract a valid Video ID from the provided URL."

    try:
        ytt_api = YouTubeTranscriptApi()
        transcript_list = ytt_api.fetch(video_id)        
        formatter = TextFormatter()
        clean_text = formatter.format_transcript(transcript_list)
        print(clean_text)
        return clean_text

    except Exception as e:
        return f"An error occurred while fetching the transcript: {e}"
