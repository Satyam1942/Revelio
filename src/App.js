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
  const [executionTime, setExecutionTime] = useState(null);


  const videoRef = useRef(null);

  const getYouTubeEmbedUrl = (url) => {
    try {
      const urlObj = new URL(url);
      let videoId = '';
      if (urlObj.hostname === 'youtu.be') {
        videoId = urlObj.pathname.slice(1);
      } else if (urlObj.hostname.includes('youtube.com')) {
        videoId = urlObj.searchParams.get('v');
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    } catch (e) {
      return null;
    }
  };

  const handleCheckVideo = async (e) => {
    e.preventDefault();
    if (!url) return;
    
    const startTime = Date.now();

    setLoading(true);
    setError('');
    setReport(null);
    setVisibleClaimsCount(3);
    setFilter('ALL');
    setExecutionTime(null); 

    try {
      const response = await fetch('https://revelio-yp6g.onrender.com/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: url }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.replace('data: ', ''));
            
            if (data.status === 'error') {
              setError(data.message);
              setLoading(false);
              setCurrentStep(0);
              break;
            }

            setCurrentStep(data.step);
            setLoadingMessage(data.message);

            if (data.step === 5 && data.result) {
              const endTime = Date.now();
              const duration = ((endTime - startTime) / 1000).toFixed(2);
              setExecutionTime(duration);

              setReport(data.result.data);
              setLoading(false);
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
    <div className="min-h-screen bg-[#f9f9f9] text-[#0f0f0f] p-4 md:p-8 flex flex-col bg-transparent items-center font-['Roboto',sans-serif]">
      
      {/* --- THE CUSTOM VIDEO BACKGROUND --- */}
      <div className="fixed inset-0 z-[-1]">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="absolute w-full h-full object-cover brightness-[0.4]"
        >
          {/* Ensure the filename here matches exactly what you put in /public */}
          <source src="/background.mp4" type="video/mp4" />
        </video>
        {/* Subtle blur overlay to make the White/Red UI pop */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"></div>
      </div>

      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-[#e5e5e5] overflow-hidden">
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
            executionTime={executionTime} 
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