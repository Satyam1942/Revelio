import React from 'react';

export default function AnalysisReport({ 
  report, 
  executionTime, 
  resetApp, 
  getYouTubeEmbedUrl, 
  filter, 
  setFilter, 
  visibleClaimsCount, 
  setVisibleClaimsCount 
}) {

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#e5e5e5] pb-6 gap-4">
                <div className='flex flex-col'>
                  <h2 className="text-3xl font-black text-[#0f0f0f] tracking-tighter ">The Report</h2>
                  {executionTime && (
                    <p className="text-[10px] font-black  tracking-widest text-[#909090] mt-1">
                      Analysis completed in <span className="text-[#ff0000]">{executionTime}s</span>
                    </p>
                  )}
                </div>


                <button onClick={resetApp} className="flex items-center text-[#065fd4] font-bold hover:bg-[#def1ff] px-4 py-2 rounded-full transition-all text-sm w-fit">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                  BACK TO SEARCH
                </button>
              </div>

              {report.video_url && getYouTubeEmbedUrl(report.video_url) && (
                <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-2xl bg-black border-[8px] border-white ring-1 ring-[#e5e5e5]">
                  <iframe 
                    width="100%" height="100%" 
                    src={getYouTubeEmbedUrl(report.video_url)} 
                    title="YouTube video player" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                  ></iframe>
                </div>
              )}

              <div className="bg-[#0f0f0f] p-6 rounded-2xl text-white shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <svg className="w-20 h-20" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </div>
                <h3 className="text-[#aaaaaa] font-black text-xs uppercase tracking-[0.2em] mb-3">Topic Summary</h3>
                <p className="text-lg md:text-xl font-medium leading-relaxed">"{report.video_topic}"</p>
              </div>

              {/* --- AI GENERATION PROBABILITY GAUGE --- */}
              <div className="bg-white p-6 rounded-2xl border-2 border-[#f2f2f2] shadow-sm flex flex-col md:flex-row items-center gap-6">
                <div className="relative w-24 h-24">
                  {/* Background Circle */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="48" cy="48" r="40"
                      stroke="#e5e5e5" strokeWidth="8" fill="transparent"
                    />
                    {/* Progress Circle */}
                    <circle
                      cx="48" cy="48" r="40"
                      stroke="#ff0000" strokeWidth="8" fill="transparent"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * (report.ai_generation_probability || 0)) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-black text-xl">
                    {report.ai_generation_probability}%
                  </div>
                </div>
                
                <div className="text-center md:text-left">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#909090] mb-1">AI Detection Score</h3>
                  <p className="text-[#0f0f0f] font-bold text-lg">
                    {report.ai_generation_probability > 70 ? "Highly Likely AI Generated" : 
                    report.ai_generation_probability > 40 ? "Mixed/AI-Assisted" : "Likely Human Authored"}
                  </p>
                  <p className="text-xs text-[#606060] mt-1 italic">Based on linguistic pattern analysis and syntax consistency.</p>
                </div>
              </div>

              <div>
                {(() => {
                  const filteredClaims = report.fact_check_results.filter(
                    (res) => filter === 'ALL' || res.status === filter
                  );

                  return (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center space-x-3">
                           <div className="bg-[#ff0000] w-2 h-8 rounded-full"></div>
                           <h3 className="text-2xl font-black tracking-tight">Claims Found</h3>
                           <span className="bg-[#f2f2f2] px-3 py-1 rounded-md text-sm font-black border border-[#e5e5e5]">
                            {filteredClaims.length}
                           </span>
                        </div>
                        
                        <select 
                          value={filter} 
                          onChange={(e) => {
                            setFilter(e.target.value);
                            setVisibleClaimsCount(3);
                          }}
                          className="bg-white border-2 border-[#e5e5e5] text-[#0f0f0f] py-2 px-4 rounded-xl font-bold text-sm focus:border-[#0f0f0f] outline-none transition-all cursor-pointer shadow-sm hover:shadow-md"
                        >
                          <option value="ALL">Show All Data</option>
                          <option value="VERIFIED">Verified Only</option>
                          <option value="FALSE">Flagged as False</option>
                          <option value="UNVERIFIED">Under Review</option>
                        </select>
                      </div>
                      
                      <div className="space-y-4">
                        {filteredClaims.slice(0, visibleClaimsCount).map((result, idx) => {
                          const isVerified = result.status === 'VERIFIED';
                          const isFalse = result.status === 'FALSE';
                          
                          return (
                            <div key={idx} className="group border-2 border-[#f2f2f2] rounded-2xl p-6 transition-all hover:border-[#e5e5e5] hover:shadow-md bg-white">
                              <div className="flex justify-between items-start gap-4 mb-4">
                                <p className="font-black text-lg leading-tight text-[#0f0f0f]">{result.claim}</p>
                                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white shadow-sm
                                  ${isVerified ? 'bg-[#2ba640]' : isFalse ? 'bg-[#ff0000]' : 'bg-[#fbc02d]'}`}>
                                  {result.status}
                                </span>
                              </div>
                              <div className="bg-[#f9f9f9] p-4 rounded-xl border border-dashed border-[#d1d1d1]">
                                <p className="text-sm font-bold text-[#606060] uppercase text-[10px] mb-2 tracking-widest flex items-center">
                                  <span className="w-1.5 h-1.5 bg-[#ff0000] rounded-full mr-2"></span>
                                  AI Reasoning
                                </p>
                                <p className="text-sm text-[#0f0f0f] leading-relaxed font-medium">
                                  {result.reasoning}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {visibleClaimsCount < filteredClaims.length && (
                        <div className="pt-4 flex justify-center">
                          <button 
                            onClick={() => setVisibleClaimsCount(prev => prev + 3)}
                            className="px-10 py-3 bg-white border-2 border-[#0f0f0f] text-[#0f0f0f] font-black text-sm rounded-full hover:bg-[#0f0f0f] hover:text-white transition-all transform hover:-translate-y-1 active:translate-y-0"
                          >
                            LOAD MORE DATA
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {report.subjective_opinions && report.subjective_opinions.length > 0 && (
                <div className="pt-8 border-t border-[#e5e5e5]">
                  <h3 className="text-2xl font-black mb-3 tracking-tight ">Subjective Context/ Opinions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.subjective_opinions.map((opinion, idx) => (
                      <div key={idx} className="bg-[#f9f9f9] p-4 rounded-xl text-sm font-medium text-[#606060] border border-[#eeeeee]">
                        {opinion}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
 );
}