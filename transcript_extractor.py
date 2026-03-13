import urllib.parse as urlparse
import requests
import re
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

def check_video_length(url: str) -> int:
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        match = re.search(r'"lengthSeconds":"(\d+)"', response.text)
        
        if match:
            length = int(match.group(1))
            print(f"Video Length (Verified): {length} seconds")
            return length
            
        print("Bouncer Warning: Could not find lengthSeconds in page source.")
        return -1
    
    except Exception as e:
        print(f"Metadata extraction error: {e}")
        return -1

def get_video_transcript(url: str) -> str:
    video_id = extract_video_id(url)
    
    if not video_id:
        return "Error: Could not extract a valid Video ID from the provided URL."

    try:
        ytt_api = YouTubeTranscriptApi()
        transcript_list = ytt_api.fetch(video_id)        
        formatter = TextFormatter()
        clean_text = formatter.format_transcript(transcript_list)
        
        return clean_text

    except Exception as e:
        return f"An error occurred while fetching the transcript: {e}"
