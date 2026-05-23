import yt_dlp
import os
import cv2
import time
import uuid
import concurrent.futures
import numpy as np
import mediapipe as mp
import json
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Optional

class VideoAnalysis(BaseModel):
    ai_probability_score: float = Field(..., description="Probability (0.0 to 1.0) that the video is AI-generated.")
    detected_artifacts: List[str] = Field(..., description="List of specific visual/audio flaws found (e.g., 'ear morphing', 'shadow mismatch').")
    physicality_check: str = Field(..., description="Reasoning on why the movement feels human or NPC-like.")
    confidence_level: float = Field(..., description="AI's confidence in this specific assessment.")
    is_animation: bool = Field(..., description="True if the video is intentional animation/CGI rather than deepfake/AI-realism.")
    synth_id_detected: bool = Field(..., description="True if a Google SynthID or similar cryptographic AI watermark is detected in the video.")
    metadata_ai_tags: List[str] = Field(..., description="Any AI-generation tags or software traces found in the video metadata (e.g., 'Runway', 'Sora', 'Veo').")
    
    
class VideoAnalyzer:
    def __init__(self, gemini_key: str):
        # Initialize Detectors
        self.mp_pose = mp.solutions.pose.Pose(static_image_mode=False, min_detection_confidence=0.5)
        self.mp_face = mp.solutions.face_mesh.FaceMesh(refine_landmarks=True)
        self.gemini_key = gemini_key
        

    def analyze_biological(self, frames):
        """Analyzes human biometrics: Pulse (rPPG), Blinks, and Kinematics."""
        pulse_signals = []
        blink_count = 0
        joint_variance = []
        
        for frame in frames:
            # 1. remote photoplethysmography (rPPG): Extract mean Green channel from forehead/cheeks
            # (Subtle color changes indicate blood flow)
            h, w, _ = frame.shape
            roi = frame[int(h*0.1):int(h*0.3), int(w*0.4):int(w*0.6)]
            pulse_signals.append(np.mean(roi[:, :, 1])) # Green channel
            
            # 2. Pose Kinematics: Check for joint angles
            results = self.mp_pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            if results.pose_landmarks:
                # Track upper body stability (Nose, Left Shoulder, Right Shoulder)
                nose_y = results.pose_landmarks.landmark[0].y
                l_shoulder_y = results.pose_landmarks.landmark[11].y
                r_shoulder_y = results.pose_landmarks.landmark[12].y
                
                # Average vertical position to track overall body sway/jitter
                joint_variance.append((nose_y + l_shoulder_y + r_shoulder_y) / 3.0)

        # Calculate Stability Metrics
        pulse_consistency = np.std(pulse_signals) 
        kinematic_jitter = np.std(joint_variance) if joint_variance else 0
        
        return {
            "biometric_pulse_variance": round(float(pulse_consistency), 4),
            "kinematic_integrity_score": "High" if kinematic_jitter < 0.02 else "Suspicious",
            "detected_entity": "Biological"
        }

    def analyze_physics(self, frames):
        """Analyzes non-living/scenic features: Light consistency & Motion Flow."""
        flow_magnitudes = []
        topology_shifts = []
        
        if len(frames) < 2:
            return {
                "temporal_flow_stability (boiling)": 0,
                "topology_stability (morphing)": 0,
                "physics_violation_index": "Insufficient Frames",
                "detected_entity": "Unknown"
            }
        
        for i in range(len(frames) - 1):
            prev_gray = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
            next_gray = cv2.cvtColor(frames[i+1], cv2.COLOR_BGR2GRAY)
            
            # 1. Optical Flow (Pixel Boiling)
            flow = cv2.calcOpticalFlowFarneback(prev_gray, next_gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)
            mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
            flow_magnitudes.append(np.mean(mag))

            # 2. Topology Check (Impossible object morphing)
            prev_edges = cv2.Canny(prev_gray, 100, 200)
            curr_edges = cv2.Canny(next_gray, 100, 200)
            diff = cv2.absdiff(prev_edges, curr_edges)
            topology_shifts.append(np.mean(diff))

        boiling_index = np.std(flow_magnitudes)
        morph_index = np.std(topology_shifts)
        
        return {
            "temporal_flow_stability (boiling)": round(float(boiling_index), 4),
            "topology_stability (morphing)": round(float(morph_index), 4),
            "physics_violation_index": "None" if boiling_index < 0.5 and morph_index < 1.0 else "Likely AI Anomaly",
            "detected_entity": "Environment/Object"
        }

    def run_scan(self, video_path):
        """
        Main entry point for Revelio Local Analysis.
        Dynamically samples the video based on duration to catch AI drifts.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"error": "Could not open video file."}

        # 1. Video Metadata Gathering
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0: fps = 30 # Fallback for metadata errors
        duration = total_frames / fps

        # 2. Dynamic Sampling Strategy (Temporal Entropy-Aware)
        # Scaled to avoid overlapping in Shorts vs Long-form
        if duration < 20:
            # Micro-Short: One continuous burst
            burst_size = min(total_frames, 450)
            positions = [0]
        elif duration < 60:
            # Standard Short: 3 small bursts (Start, Mid, End)
            burst_size = 50 
            positions = [0, total_frames // 2, max(0, total_frames - 50)]
        else:
            # Long-form: 3 heavy forensic bursts
            burst_size = 200
            positions = [0, total_frames // 2, max(0, total_frames - 200)]

        all_frames = []
        print(f"Scanning {duration:.2f}s video. Extracting {len(positions)} bursts of size {burst_size}...")

        try:
            for pos in positions:
                cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
                for _ in range(burst_size):
                    ret, frame = cap.read()
                    if not ret:
                        break
                    all_frames.append(frame)
        finally:
            cap.release()

        if not all_frames:
            return {"error": "No frames could be extracted."}

        # 3. Run both Domain-Specific Algorithms
        print("Running Biometrics & Physics Consistency checks in parallel...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            bio_future = executor.submit(self.analyze_biological, all_frames)
            physics_future = executor.submit(self.analyze_physics, all_frames)
            
            bio_results = bio_future.result()
            physics_results = physics_future.result()
        
        # Combine results into a single payload
        results = {**bio_results, **physics_results}
        results["detected_entity"] = "Biological & Physical"

        # 5. Metadata Integration
        results.update({
            "video_duration_secs": round(duration, 2),
            "total_samples_analyzed": len(all_frames),
            "sampling_strategy": "Continuous" if duration < 20 else "Stratified Burst"
        })

        return results

    @staticmethod
    def download_video(video_url, output_filename):
        # 'bestvideo[height<=480]+bestaudio/best[height<=480]' ensures 480p quality
        # We prefer mp4 for easy frame extraction with OpenCV/Gemini
        ydl_opts = {
            'format': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best',
            'outtmpl': f'{output_filename}.%(ext)s',
            'merge_output_format': 'mp4',
            'noplaylist': True,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])
                
                # yt-dlp might append .mp4 or stay as specified in outtmpl
                final_path = f"{output_filename}.mp4"
                
                if os.path.exists(final_path):
                    print(f"Success! Video saved to {final_path}")
                    return final_path
                else:
                    # Fallback check in case extension was forced differently
                    for file in os.listdir('.'):
                        if file.startswith(output_filename):
                            return file
                            
                raise FileNotFoundError("Video download failed.")
                
        except Exception as e:
            print(f"DETAILED ERROR: {str(e)}")
            return None
        
    @staticmethod
    def calculate_hybrid_score(local_report, gemini_response: VideoAnalysis):
        """
        Combines local forensic signals with Gemini's reasoning using 
        weighted probability rather than binary penalties.
        """
        # 1. Weights for different signals (Adjustable)
        WEIGHTS = {
            'gemini': 0.70,      # Give the LLM's visual reasoning high weight
            'boiling': 0.10,     # Temporal shimmer
            'morphing': 0.10,    # Topology shifts
            'biometric': 0.10     # Pulse consistency (lowest due to compression noise)
        }

        # 2. Extract Gemini's base probability (0.0 to 1.0)
        g_score = gemini_response.ai_probability_score

        # 3. Calculate Normalized Local Scores (0.0 to 1.0)
        # Boiling: Threshold 0.5 as high AI indicator
        boiling_val = local_report.get('temporal_flow_stability (boiling)', 0)
        b_score = min(boiling_val / 0.8, 1.0) if boiling_val > 0.3 else 0

        # Morphing: Threshold 1.0 as high AI indicator
        morph_val = local_report.get('topology_stability (morphing)', 0)
        m_score = min(morph_val / 1.5, 1.0) if morph_val > 0.7 else 0

        # Biometric: Treat extreme stability OR extreme chaos as suspicious
        pulse_var = local_report.get('biometric_pulse_variance', 0)
        if pulse_var < 0.01 or pulse_var > 0.8:
            bio_score = 0.7  # Suspicious but not definitive
        else:
            bio_score = 0.0

        # 4. Compute Weighted Average
        final_score = (
            (g_score * WEIGHTS['gemini']) +
            (b_score * WEIGHTS['boiling']) +
            (m_score * WEIGHTS['morphing']) +
            (bio_score * WEIGHTS['biometric'])
        ) * 100

        # 5. Animation Bypass
        if gemini_response.is_animation:
            return round(g_score * 100, 2) # Don't penalize art for physics violations
            
        return round(final_score, 2)

    def analyze_video(self, video_url):
        unique_id = str(uuid.uuid4())
        output_name = f"temp_video_{unique_id}"
        video_path = self.download_video(video_url, output_name)
        if not video_path:
            return {"error": "Failed to download video."}
        
        video_file = None
        
        try:
            # 1. Run local mathematical/forensic scan
            local_report = self.run_scan(video_path)
            
            # 2. Gemini Analysis
            client = genai.Client(api_key=self.gemini_key)
            model_list_env = os.environ.get("GEMINI_VID_MODEL_ID", "gemini-3.5-flash")
            model_list = [m.strip(" []'\"") for m in model_list_env.split(",")]
                
            print("Uploading video to Gemini...")
            video_file = client.files.upload(file=video_path)
            
            # Wait for video processing to complete on Gemini's side
            while True:
                video_file = client.files.get(name=video_file.name)
                state = getattr(video_file.state, 'name', video_file.state)
                if state != "PROCESSING":
                    break
                print("Waiting for video processing...")
                time.sleep(2)
                
            if getattr(video_file.state, 'name', video_file.state) == "FAILED":
                raise Exception("Gemini failed to process the uploaded video file.")
            
            prompt = f"""
            I am providing a 480p video file and a pre-calculated Local Forensic Report. 
            Perform a deep deepfake and AI-generation analysis on this video.
            We have already run a local programmatic check. The results are:
            {local_report}
            
            Cross-reference our local programmatic findings with your own visual and audio assessment.
            Additionally, deeply inspect the video for any cryptographic AI watermarks (like Google SynthID) or known AI-generator tags in the file metadata.
            """
            
            max_retries = 3
            for attempt in range(max_retries):
                model_id = model_list[attempt % len(model_list)]
                try:
                    response = client.models.generate_content(
                        model=model_id,
                        contents=[prompt, video_file],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=VideoAnalysis,
                            temperature=0.2
                        )
                    )
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"Video API call with model '{model_id}' failed: {e}. Retrying in 10 seconds...")
                        time.sleep(10)
                    else:
                        raise e
                        
            gemini_response = response.parsed
            
            # 3. Calculate Hybrid Score
            final_score = self.calculate_hybrid_score(local_report, gemini_response)
            
            return {
                "status": "success",
                "local_analysis": local_report,
                "gemini_analysis": gemini_response.model_dump(),
                "hybrid_authenticity_score": final_score
            }
            
        except Exception as e:
            return {"error": f"Gemini Analysis Failed: {str(e)}"}
            
        finally:
            # Always clean up local and cloud files, even if Gemini throws an error
            if os.path.exists(video_path):
                os.remove(video_path)
            if video_file:
                try:
                    client.files.delete(name=video_file.name)
                except Exception:
                    pass