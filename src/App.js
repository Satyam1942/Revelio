import React, { useState, useEffect, useRef } from 'react';
import InputForm from './InputForm';
import Loader from './LoadingScreen';
import AnalysisReport from './Report';

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [visibleClaimsCount, setVisibleClaimsCount] = useState(3);
  const [showAllOpinions, setShowAllOpinions] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [executionTimes, setExecutionTimes] = useState({});


  const videoRef = useRef(null);

  const getYouTubeEmbedUrl = (url) => {
    try {
      const urlObj = new URL(url);
      let videoId = '';
      if (urlObj.pathname.startsWith("/shorts/")) {
        videoId = urlObj.pathname.split("/")[2];
      } else if (urlObj.hostname === 'youtu.be') {
        videoId = urlObj.pathname.slice(1);
      } else if (urlObj.hostname.includes('youtube.com')) {
        videoId = urlObj.searchParams.get('v');
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    } catch (e) {
      return null;
    }
  };

  const handleCheckVideo = async (e, manualUrl = null) => {
    if(e!=null ) {
        e.preventDefault();
    }

    const urlToAnalyze = manualUrl || url;
    if (!urlToAnalyze) return;
    
    const startTime = Date.now();

    setLoading(true);
    setError('');
    setReport(null);
    setVisibleClaimsCount(3);
    setFilter('ALL');
    setExecutionTimes({}); 

    try {
      const response = await fetch('http://localhost:5000/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: urlToAnalyze }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let buffer = '';
      let reportStarted = false;
      let currentReport = null;
      let isFinished = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (!isFinished && reportStarted) {
            const endTime = Date.now();
            setExecutionTimes(prev => ({ ...prev, final: ((endTime - startTime) / 1000).toFixed(2) }));
            isFinished = true;
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // Keep the last incomplete chunk in the buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.replace('data: ', ''));
            
            if (data.status === 'error') {
              setError(data.message);
              setLoading(false);
              setCurrentStep(0);
              break;
            }

            if (data.type) {
              if (!reportStarted) {
                setLoading(false); // Transition to the report layout with skeletons
                reportStarted = true;
              }
              
              // Calculate elapsed time for this specific payload type (audio, video, transcript, etc.)
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
              setExecutionTimes(prev => ({ ...prev, [data.type]: elapsed }));
              
              currentReport = currentReport ? { ...currentReport } : {};
              if (data.type === 'transcript') {
                Object.assign(currentReport, data);
              } else if (data.type === 'audio') {
                currentReport.audio_analysis = data;
              } else if (data.type === 'video') {
                currentReport.video_analysis = data;
              } else if (data.type === 'final') {
                currentReport.final_score = data.ai_generation_probability;
                isFinished = true;
              }
              setReport(currentReport);
            } else if (!reportStarted) {
              // Standard loading step updates before any data arrives
              setCurrentStep(data.step);
              setLoadingMessage(data.message);
            }
          }
        }
      }
    } catch (err) {
      setError('Failed to connect to the server.');
      setLoading(false);
    }
  };

  const resetApp = () => {
    setUrl('');
    setReport(null);
    setError('');
    setVisibleClaimsCount(3);
    setFilter('ALL');
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.5;
      videoRef.current.load();
    }
  }, []);


  return (
    <div className="min-h-screen text-[#0f0f0f] p-4 md:p-8 flex flex-col bg-black items-center font-['Roboto',sans-serif]">
      
      {/* --- THE CUSTOM BACKGROUND --- */}
      <div className="fixed inset-0 z-[-1]">
        {/* Subtle blur overlay to make the White/Red UI pop */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"></div>
      </div>

      <div className={`w-full ${report ? 'max-w-7xl' : 'max-w-4xl'} bg-white rounded-2xl shadow-sm border border-[#e5e5e5] overflow-hidden transition-all duration-500`}>
        <div className="p-6 md:p-10">

        {/* --- STATE 1: INPUT FORM --- */}
        <div>
        {!loading && !report && (
          <InputForm url={url} setUrl={setUrl} handleCheckVideo={handleCheckVideo} error={error} />
        )}
        </div>
        
        
        {/* --- STATE 2: LOADING --- */}
          {loading && (
           <Loader loadingMessage={loadingMessage} currentStep={currentStep} />
          )}

          {/* --- STATE 3: COMPLETE REPORT --- */}
          {report && !loading && (
            <AnalysisReport 
            report={report} 
            executionTimes={executionTimes} 
            isAnalyzing={!executionTimes.final}
            resetApp={resetApp} 
            getYouTubeEmbedUrl={getYouTubeEmbedUrl}
            filter={filter}
            setFilter={setFilter}
            visibleClaimsCount={visibleClaimsCount}
            setVisibleClaimsCount={setVisibleClaimsCount}
            showAllOpinions={showAllOpinions}
            setShowAllOpinions={setShowAllOpinions}
            />  
          )}
        </div>

      </div>
    </div>
  );
}