import React from 'react';

export default function AnalysisReport({ 
  report, 
  executionTimes, 
  resetApp, 
  getYouTubeEmbedUrl, 
  filter, 
  setFilter, 
  visibleClaimsCount, 
  setVisibleClaimsCount,
  showAllOpinions, 
  setShowAllOpinions,
  isAnalyzing
}) {

  const filteredClaims = (report.fact_check_results || []).filter(
    (res) => {
      // Case-insensitive fallback check for status or verdict
      const itemStatus = (res.status || res.verdict || 'UNVERIFIED').toUpperCase();
      return filter === 'ALL' || itemStatus === filter;
    }
  );

  // Flexible fallback if cache object uses old naming conventions
  const finalScore = report.final_score !== undefined ? report.final_score : report.ai_generation_probability;

  // Reusable Component for Glowing/Spinning Border Skeletons
  const AnimatedSkeletonContainer = ({ children, className = "", innerClassName = "" }) => (
    <div className={`relative overflow-hidden rounded-2xl p-[3px] shadow-sm ${className}`}>
      {/* Sweeping comet rotating border effect (YouTube Red/Black themed) */}
      <div className="absolute inset-[-200%] animate-[spin_2.5s_linear_infinite] bg-[conic-gradient(from_0deg_at_50%_50%,#f2f2f2_0%,#f2f2f2_70%,#0f0f0f_85%,#ff0000_100%)]"></div>
      {/* Inner wrapper to hold shimmering content and cover the center */}
      <div className={`relative h-full w-full rounded-[13px] bg-white z-10 ${innerClassName}`}>
        {children}
      </div>
    </div>
  );

  const ScoreSkeleton = () => (
    <AnimatedSkeletonContainer className="h-full" innerClassName="p-8 flex flex-col items-center text-center justify-center">
      <div className="w-32 h-32 rounded-full border-[10px] border-[#f9f9f9] mb-4 animate-pulse"></div>
      <div className="mb-6 flex flex-col items-center w-full">
          <div className="h-3 w-20 bg-[#e5e5e5] rounded mb-3 animate-pulse"></div>
          <div className="h-6 w-24 bg-[#f2f2f2] rounded animate-pulse"></div>
      </div>
      <div className="w-full bg-[#f9f9f9] p-4 rounded-xl border border-[#eeeeee] flex flex-col items-center gap-2 animate-pulse">
         <div className="h-2 w-16 bg-[#e5e5e5] rounded mb-1"></div>
         <div className="h-2 w-full bg-[#e5e5e5] rounded"></div>
         <div className="h-2 w-5/6 bg-[#e5e5e5] rounded"></div>
      </div>
    </AnimatedSkeletonContainer>
  );

  // Component for the Audio Score/Analysis card
  const ScoreSection = () => {
    const audioScore = Math.round(report.audio_analysis?.ai_generated_probability ?? report.audio_analysis?.ai_generation_probability ?? 0);
    const audioStatement = report.audio_analysis?.vocal_analysis_statement || report.audio_analysis?.audio_analysis_statement || "No Analysis available...";
    
    return (
      <div className={`bg-white p-8 rounded-2xl border-2 border-[#f2f2f2] shadow-sm flex flex-col items-center text-center h-full justify-center`}>
          {executionTimes?.audio && (
              <p className="text-[10px] font-bold text-[#ff0000] mt-1">Analyzed in {executionTimes.audio}s</p>
            )}
        {/* 1. The Circle (Gauge) */}
        <div className="relative w-32 h-32 mb-4">
          <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" stroke="#e5e5e5" strokeWidth="10" fill="transparent" />
            <circle
              cx="50" cy="50" r="40"
              stroke="#ef4444"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray="251.2"
              strokeDashoffset={251.2 - (251.2 * audioScore) / 100}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-black text-2xl text-[#0f0f0f]">{audioScore}%</span>
          </div>
        </div>

        {/* 2. The Score Label */}
        <div className="mb-6">
          <h3 className="text-xs font-black tracking-widest mb-2">AUDIO AI SCORE</h3>
          <p className="text-xl font-black">
            {audioScore > 70 ? "Highly Likely AI Voice" : 
             audioScore > 40 ? "Mixed/AI-Assisted" : "Likely Human"}
          </p>
        </div>

        {/* 3. The Analysis Statement */}
        <div className="w-full bg-[#f9f9f9] p-4 rounded-xl border border-[#eeeeee]">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[#909090] mb-2">Vocal Analysis</h3>
          <p className="text-[#0f0f0f] text-sm leading-relaxed">
            "{audioStatement}"
          </p>
        </div>
      </div>
    );
  };

  // Component for the Video Analysis card
  const VideoAnalysisSection = () => {
    const videoAnalysis = report.video_analysis || {};
    const localAnalysis = videoAnalysis.local_analysis || {};
    const geminiAnalysis = videoAnalysis.gemini_analysis || {};

    const videoScore = Math.round(videoAnalysis.hybrid_authenticity_score ?? videoAnalysis.deepfake_probability ?? 0);
    
    let videoStatement = geminiAnalysis.physicality_check || videoAnalysis.visual_artifacts_summary;
    if (!videoStatement && geminiAnalysis.detected_artifacts) {
      videoStatement = "Detected: " + geminiAnalysis.detected_artifacts.join(', ');
    }
    videoStatement = videoStatement || "No Analysis available...";

    const artifacts = geminiAnalysis.detected_artifacts || [];
    const kinematicScore = localAnalysis.kinematic_integrity_score;
    const physicsViolation = localAnalysis.physics_violation_index;
    
    return (
      <div className={`bg-white p-8 rounded-2xl border-2 border-[#f2f2f2] shadow-sm flex flex-col items-center text-center h-full justify-center`}>
           {executionTimes?.video && (
              <p className="text-[10px] font-bold text-[#ff0000] mt-1">Analyzed in {executionTimes.video}s</p>
            )}
        {/* 1. The Circle (Gauge) */}
        <div className="relative w-32 h-32 mb-4">
          <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" stroke="#e5e5e5" strokeWidth="10" fill="transparent" />
            <circle
              cx="50" cy="50" r="40"
              stroke="#ef4444"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray="251.2"
              strokeDashoffset={251.2 - (251.2 * videoScore) / 100}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-black text-2xl text-[#0f0f0f]">{videoScore}%</span>
          </div>
        </div>

        {/* 2. The Score Label */}
        <div className="mb-6">
          <h3 className="text-xs font-black tracking-widest mb-2">VIDEO AI SCORE</h3>
          <p className="text-xl font-black">
           {videoScore === 0? "No Score Available" :
            videoScore > 70 ? "High Deepfake Risk" : 
             videoScore > 40 ? "Potential Manipulation" : "Likely Authentic"}
          </p>
        </div>

        {/* 3. The Analysis Statement */}
        <div className="w-full bg-[#f9f9f9] p-4 rounded-xl border border-[#eeeeee] flex flex-col items-center">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[#909090] mb-2">Visual Analysis Summary</h3>
          <p className="text-[#0f0f0f] text-sm leading-relaxed mb-4">
            "{videoStatement}"
          </p>
          
          {/* Extended Video Metrics */}
          {(kinematicScore || physicsViolation) && (
             <div className="w-full grid grid-cols-2 gap-2 mb-4">
                {kinematicScore && (
                   <div className="bg-white border border-[#e5e5e5] rounded-lg p-2 flex flex-col items-center justify-center shadow-sm">
                      <span className="text-[12px] font-bold text-[#909090] uppercase tracking-wider mb-1">Kinematics</span>
                      <span className={`text-s font-black ${kinematicScore.includes('Suspicious') || kinematicScore.includes('Anomaly') ? 'text-[#ff0000]' : 'text-[#0f0f0f]'}`}>{kinematicScore}</span>
                   </div>
                )}
                {physicsViolation && (
                   <div className="bg-white border border-[#e5e5e5] rounded-lg p-2 flex flex-col items-center justify-center shadow-sm">
                      <span className="text-[12px] font-bold text-[#909090] uppercase tracking-wider mb-1">Physics</span>
                      <span className={`text-s font-black ${physicsViolation.includes('Anomaly') || physicsViolation.includes('Violation') ? 'text-[#ff0000]' : 'text-[#0f0f0f]'}`}>{physicsViolation}</span>
                   </div>
                )}
             </div>
          )}

          {artifacts.length > 0 && (
             <div className="w-full border-t border-[#e5e5e5] pt-3">
               <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#909090] mb-2">Detected Artifacts</h3>
               <div className="flex flex-wrap gap-1.5 justify-center">
                 {artifacts.map((artifact, idx) => (
                   <span key={idx} className="bg-[#ff0000]/10 text-[#ff0000] border border-[#ff0000]/20 px-2 py-1 rounded text-[12px] font-bold">
                     {artifact}
                   </span>
                 ))}
               </div>
             </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#e5e5e5] pb-6 gap-4">
        <div className='flex flex-col'>
          <h2 className="text-3xl font-black text-[#0f0f0f] tracking-tighter ">The Report</h2>
        </div>
        <button onClick={resetApp} className="flex items-center text-[#065fd4] font-bold hover:bg-[#def1ff] px-4 py-2 rounded-full transition-all text-sm w-fit">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          BACK TO SEARCH
        </button>
      </div>

      {/* --- OVERALL SCORE BANNER --- */}
      {finalScore !== undefined ? (
         <div className="bg-gradient-to-r from-[#0f0f0f] to-[#272727] rounded-2xl p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between border border-[#333]">
            <div>
                <h2 className="text-xl font-black tracking-widest uppercase mb-1 opacity-90 text-[#aaaaaa]">AI Generation Probability</h2>
                <p className="text-sm font-medium opacity-80">Combined analysis of audio, visual, and transcript data</p>
                 {executionTimes?.final && (
            <p className="text-[10px] font-black tracking-widest text-[#909090] mt-1">
              Full analysis completed in <span className="text-[#ff0000]">{executionTimes.final}s</span>
            </p>
          )}
            </div>
            <div className="mt-4 md:mt-0 text-6xl font-black tracking-tighter">
              <span className={finalScore > 70 ? 'text-[#ff0000]' : finalScore > 40 ? 'text-[#fbc02d]' : 'text-[#ffffff]'}>
                 {finalScore}%
              </span>
            </div>
         </div>
      ) : isAnalyzing ? (
         <AnimatedSkeletonContainer className="w-full" innerClassName="bg-[#f9f9f9] p-8 flex flex-col md:flex-row items-center justify-between">
            <div className="w-full md:w-1/2 animate-pulse">
                <div className="h-6 w-48 bg-[#e5e5e5] rounded mb-3"></div>
                <div className="h-4 w-full md:w-80 bg-[#e5e5e5] rounded"></div>
            </div>
            <div className="h-16 w-32 bg-[#e5e5e5] rounded mt-6 md:mt-0 animate-pulse"></div>
         </AnimatedSkeletonContainer>
      ) : null}

      {/* --- MAIN LAYOUT GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-12">
        
        {/* --- LEFT COLUMN: FACTS & ANALYSIS --- */}
        <div className="space-y-8">
          {/* AUDIO & VIDEO ANALYSIS CONTAINERS */}
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {report.audio_analysis ? (
                <ScoreSection />
              ) : isAnalyzing ? (
                <ScoreSkeleton />
              ) : (
                <div className="bg-white p-8 rounded-2xl border-2 border-[#f2f2f2] shadow-sm flex flex-col items-center text-center h-full justify-center text-[#909090]">
                  <svg className="w-16 h-16 mb-4 text-[#e5e5e5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                  <h3 className="text-xs font-black tracking-widest mb-2 uppercase">AUDIO AI SCORE</h3>
                  <p className="text-sm font-medium">No audio analysis data available.</p>
                </div>
              )}
              {report.video_analysis ? (
                <VideoAnalysisSection />
              ) : isAnalyzing ? (
                <ScoreSkeleton />
              ) : (
                <div className="bg-white p-8 rounded-2xl border-2 border-[#f2f2f2] shadow-sm flex flex-col items-center text-center h-full justify-center text-[#909090]">
                  <svg className="w-16 h-16 mb-4 text-[#e5e5e5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  <h3 className="text-xs font-black tracking-widest mb-2 uppercase">VIDEO AI SCORE</h3>
                  <p className="text-sm font-medium">No visual analysis data available for this video.</p>
                </div>
              )}
            </div>
          </div>

          {/* CLAIMS SECTION */}
          <div className="space-y-6 pt-8 border-t border-[#e5e5e5]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center space-x-3">
                  <div className="bg-[#ff0000] w-2 h-8 rounded-full"></div>
                  <h3 className="text-2xl font-black tracking-tight">Claims Found</h3>
                  <span className="bg-[#f2f2f2] px-3 py-1 rounded-md text-sm font-black border border-[#e5e5e5]">
                  {report.fact_check_results ? filteredClaims.length : <span className="opacity-0">0</span>}
                  </span>
                  {executionTimes?.transcript && (
                      <span className="text-[10px] font-bold text-[#ff0000] ml-2">Extracted in {executionTimes.transcript}s</span>
                  )}
              </div>
              
              {report.fact_check_results ? (
              <select 
                value={filter} 
                onChange={(e) => {
                  setFilter(e.target.value);
                  setVisibleClaimsCount(3);
                }}
                className="bg-white border-2 border-[#e5e5e5] text-[#0f0f0f] py-2 px-4 rounded-xl font-bold text-sm focus:border-[#0f0f0f] outline-none transition-all cursor-pointer shadow-sm"
              >
                <option value="ALL">Show All Data</option>
                <option value="VERIFIED">Verified Only</option>
                <option value="FALSE">False Claims</option>
                <option value="UNVERIFIED">Unverified Claims</option>
              </select>
              ) : isAnalyzing ? (
                 <div className="h-10 w-32 bg-[#f2f2f2] rounded-xl animate-pulse"></div>
              ) : null}
            </div>
            
            {report.fact_check_results ? (
              <div className="space-y-4">
                {filteredClaims.length > 0 ? (
                  filteredClaims.slice(0, visibleClaimsCount).map((result, idx) => {
                    // Standardize status for styling
                    const status = (result.status || result.verdict || 'UNVERIFIED').toUpperCase();
                    return (
                    <div key={idx} className="group border-2 border-[#f2f2f2] rounded-2xl p-6 transition-all hover:border-[#e5e5e5] hover:shadow-md bg-white">
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <p className="font-black text-lg leading-tight text-[#0f0f0f]">{result.claim || result.statement || result.text || "Unknown Claim"}</p>
                        <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white shadow-sm whitespace-nowrap
                          ${status === 'VERIFIED' ? 'bg-[#2ba640]' : status === 'FALSE' ? 'bg-[#ff0000]' : 'bg-[#fbc02d]'}`}>
                          {status}
                        </span>
                      </div>
                      <div className="bg-[#f9f9f9] p-4 rounded-xl border border-dashed border-[#d1d1d1]">
                        <p className="text-sm font-bold text-[#606060] uppercase text-[10px] mb-2 tracking-widest flex items-center">
                          <span className="w-1.5 h-1.5 bg-[#ff0000] rounded-full mr-2"></span>
                          AI Reasoning
                        </p>
                        <p className="text-sm text-[#0f0f0f] leading-relaxed font-medium">{result.reasoning || result.explanation || result.analysis || "No reasoning provided."}</p>
                      </div>
                    </div>
                  )})
                ) : (
                  <div className="text-center py-10 bg-[#f9f9f9] rounded-2xl border border-dashed border-[#e5e5e5]">
                    <p className="text-[#909090] font-medium">No claims match the selected filter.</p>
                  </div>
                )}
              </div>
            ) : isAnalyzing ? (
              <div className="space-y-4">
                  {[1,2,3].map(i => (
                      <AnimatedSkeletonContainer key={i} className="w-full" innerClassName="p-6 bg-white flex flex-col">
                          <div className="h-5 w-3/4 bg-[#e5e5e5] rounded mb-4 animate-pulse"></div>
                          <div className="h-20 w-full bg-[#f9f9f9] rounded-xl border border-[#eeeeee] animate-pulse"></div>
                      </AnimatedSkeletonContainer>
                  ))}
              </div>
            ) : (
               <div className="text-center py-10 bg-[#f9f9f9] rounded-2xl border border-dashed border-[#e5e5e5]">
                 <p className="text-[#909090] font-medium">No verifiable claims were detected in this video.</p>
               </div>
            )}

            {report.fact_check_results && visibleClaimsCount < filteredClaims.length && (
              <div className="pt-4 flex justify-center">
                <button onClick={() => setVisibleClaimsCount(prev => prev + 3)} className="px-10 py-3 bg-white border-2 border-[#0f0f0f] text-[#0f0f0f] font-black text-sm rounded-full hover:bg-[#0f0f0f] hover:text-white transition-all transform hover:-translate-y-1">
                  LOAD MORE DATA
                </button>
              </div>
            )}
          </div>
        </div>

        {/* --- RIGHT COLUMN: MEDIA & SUMMARY --- */}
        <div className="space-y-8">
          {/* PLAYER */}
          {report.video_url && getYouTubeEmbedUrl(report.video_url) ? (
            <div className={`${report.is_shorts ? "aspect-[9/16]" : "aspect-video"} w-full rounded-2xl overflow-hidden shadow-2xl bg-black border-[8px] border-white ring-1 ring-[#e5e5e5] transition-all duration-300`}>
              <iframe 
                width="100%" height="100%" 
                src={getYouTubeEmbedUrl(report.video_url)} 
                title="YouTube video player" frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            </div>
          ) : isAnalyzing ? (
             <AnimatedSkeletonContainer className={`${report.is_shorts ? "aspect-[9/16]" : "aspect-video"} w-full rounded-2xl shadow-2xl ring-1 ring-[#e5e5e5]`} innerClassName="bg-[#f9f9f9] flex items-center justify-center">
                 <svg className="w-12 h-12 text-[#e5e5e5] animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
             </AnimatedSkeletonContainer>
          ) : null}

          {/* TOPIC SUMMARY */}
          {report.video_topic ? (
            <div className="bg-[#0f0f0f] p-6 rounded-2xl text-white shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-20 h-20" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              </div>
              <div className="flex justify-between items-start mb-3 relative z-10">
                <h3 className="text-[#aaaaaa] font-black text-xs uppercase tracking-[0.2em]">Topic Summary</h3>
                {executionTimes?.transcript && (
                   <span className="text-[10px] font-bold text-[#ff0000] opacity-80 bg-black/30 px-2 py-1 rounded-md">Time: {executionTimes.transcript}s</span>
                )}
              </div>
              <p className="text-lg md:text-xl font-medium leading-relaxed">"{report.video_topic}"</p>
            </div>
          ) : isAnalyzing ? (
             <AnimatedSkeletonContainer className="w-full h-32" innerClassName="bg-[#f9f9f9] p-6 flex flex-col justify-center">
                  <div className="h-3 w-24 bg-[#e5e5e5] rounded mb-4 animate-pulse"></div>
                  <div className="h-5 w-full bg-[#e5e5e5] rounded mb-2 animate-pulse"></div>
                  <div className="h-5 w-3/4 bg-[#e5e5e5] rounded animate-pulse"></div>
             </AnimatedSkeletonContainer>
          ) : null}

          {/* SUBJECTIVE OPINIONS */}
          {report.subjective_opinions ? (
            report.subjective_opinions.length > 0 && (
            <div className="pt-8 border-t border-[#e5e5e5]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black tracking-tight">Subjective Context</h3>
                  {executionTimes?.transcript && (
                     <span className="text-[10px] font-bold text-[#ff0000] mt-1">Extracted in {executionTimes.transcript}s</span>
                  )}
                </div>
                {report.subjective_opinions.length > 4 && (
                    <button onClick={() => setShowAllOpinions(!showAllOpinions)} className="text-xs font-bold uppercase tracking-wider text-[#065fd4] hover:bg-[#def1ff] px-3 py-1.5 rounded-full">
                      {showAllOpinions ? "Show Less" : `Show All (${report.subjective_opinions.length})`}
                    </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3">
                {report.subjective_opinions
                  .slice(0, showAllOpinions ? report.subjective_opinions.length : 4)
                  .map((opinion, idx) => (
                    <div key={idx} className="bg-[#f9f9f9] p-4 rounded-xl text-sm font-medium text-[#606060] border border-[#eeeeee] flex items-start gap-3">
                      <span className="text-[#909090] mt-0.5">•</span>
                      {opinion}
                    </div>
                  ))}
              </div>
            </div>
            )
          ) : isAnalyzing ? (
            <div className="pt-8 border-t border-[#e5e5e5]">
                <div className="h-6 w-40 bg-[#e5e5e5] rounded mb-4 animate-pulse"></div>
                <div className="space-y-3 w-full">
                    <AnimatedSkeletonContainer className="w-full h-14" innerClassName="bg-[#f9f9f9] rounded-xl"></AnimatedSkeletonContainer>
                    <AnimatedSkeletonContainer className="w-full h-14" innerClassName="bg-[#f9f9f9] rounded-xl"></AnimatedSkeletonContainer>
                </div>
            </div>
          ): null}
        </div>

      </div>
    </div>
  );
}