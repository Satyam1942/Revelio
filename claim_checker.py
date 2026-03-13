import os
import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from ddgs import DDGS

# ---------------------------------------------------------------------------
# 1. The Output Schema
# ---------------------------------------------------------------------------
class FactCheckVerdict(BaseModel):
    claim: str = Field(description="The original claim being evaluated.")
    status: str = Field(description="Must be exactly: VERIFIED, FALSE, or UNVERIFIED.")
    reasoning: str = Field(description="A strict 1-2 sentence explanation citing the provided search context.")

class FinalReport(BaseModel):
    evaluations: list[FactCheckVerdict]
    

def fetch_ddg_context(query: str) -> str:
    try:
        results = DDGS().text(query, max_results=3)
        context = ""
        for i, res in enumerate(results, 1):
            context += f"Result {i}: {res['title']} - {res['body']}\n"
        return context
    except Exception as e:
        return f"Search error: {e}"
    
# ---------------------------------------------------------------------------
# 2. The Judge Logic
# ---------------------------------------------------------------------------
def run_ai_judge(claims_with_evidence: list[dict], api_key: str) -> FinalReport | None:
    """
    Takes a list of dictionaries containing {claim, video_context, live_search_evidence}
    and returns a structured list of verdicts.
    """
    client = genai.Client(api_key=api_key)
    
    # We can stick with Flash, or upgrade to Gemini 2.5 Pro if you want 
    # maximum reasoning capability for complex, nuanced claims.
    model_id = 'gemini-2.5-flash' 
    
    system_instruction = """
    You are a strict, objective fact-checking judge. 
    You will be provided with a list of claims made in a video, alongside live Duck Duck Go search snippets.
    
    Your rules:
    1. If the search snippets explicitly confirm the claim, label it VERIFIED.
    2. If the search snippets explicitly contradict the claim, label it FALSE.
    3. If the search snippets do not contain enough information to prove or disprove the claim, label it UNVERIFIED.
    4. Base your verdict ONLY on the provided search evidence, not your internal training data.
    """

    # Format the input data cleanly for the prompt
    prompt_context = "Here are the claims and their corresponding search evidence:\n\n"
    for i, item in enumerate(claims_with_evidence, 1):
        prompt_context += f"Claim {i}: {item['claim']}\n"
        prompt_context += f"Video Context: {item['video_context']}\n"
        prompt_context += f"Duck Duck Go search Evidence:\n{item['live_search_evidence']}\n"
        prompt_context += "-" * 40 + "\n"

    print("The Judge is reviewing the evidence...")

    try:
        response = client.models.generate_content(
            model=model_id,
            contents=prompt_context,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=FinalReport,
                temperature=0.0, # Zero temperature. We want logic, not creativity.
            ),
        )
        
        return FinalReport.model_validate_json(response.text)

    except Exception as e:
        print(f"The Judge encountered an error: {e}")
        return None