import os
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import Dict, List, Any

# ---------------------------------------------------------------------------
# 1. Pydantic Schemas
# ---------------------------------------------------------------------------
class FactClaim(BaseModel):
    claim: str = Field(description="The specific statement made in the video.")
    context: str = Field(description="A brief 1-sentence context of what this claim is about.")
    is_verifiable: bool = Field(description="True if this is an objective claim that can be fact-checked via search. False if it's purely subjective opinion, emotion, or a joke.")

class VideoSummary(BaseModel):
    video_topic: str = Field(description="A short 5-10 sentence summary of the overall video.")
    ai_generation_probability: int = Field(description='An integer between 0 and 100  representing how likely the script was written by an AI ')
    facts: list[FactClaim]
    

# ---------------------------------------------------------------------------
# 2. The Extraction & Routing Function
# ---------------------------------------------------------------------------
def process_transcript_claims(transcript: str, api_key: str) -> Dict[str, Any]:
    """
    Feeds the transcript to Gemini, extracts claims, and routes them 
    into verifiable and subjective buckets.
    """
    client = genai.Client(api_key=api_key)
    model_id = os.environ.get("GEMINI_SUMMARY_MODEL_ID")
    
    system_instruction = """
    You are an expert data-extraction pipeline. Read the video transcript and extract 
    distinct claims. For every claim, accurately flag 'is_verifiable' as True (for stats, 
    historical events, news, specs) or False (for personal opinions, jokes, feelings).
    Also give a confidence score between 0 to 100 representing how likely 
    the script was written by an AI (look for robotic structures, 
    typical LLM transitions, and lack of human filler).
    """

    print("Analyzing transcript with Gemini...")
    
    try:
        response = client.models.generate_content(
            model=model_id,
            contents=f"Extract all claims from this transcript:\n\n{transcript}",
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=VideoSummary,
                temperature=0.1, 
            ),
        )
        
        structured_data = VideoSummary.model_validate_json(response.text)

        verifiable_claims = []
        subjective_claims = []
        
        for fact in structured_data.facts:
            if fact.is_verifiable:
                verifiable_claims.append({
                    "claim": fact.claim,
                    "context": fact.context
                })
            else:
                subjective_claims.append(fact.claim)
                
        return {
            "status": "success",
            "video_topic": structured_data.video_topic,
            "ai_generation_probability": structured_data.ai_generation_probability,
            "verifiable_claims": verifiable_claims,
            "subjective_claims": subjective_claims
        }

    except Exception as e:
        print(f"Extraction failed: {e}")
        return {"status": "error", "message": str(e)}