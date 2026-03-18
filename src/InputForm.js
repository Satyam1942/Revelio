import React from 'react';
import { useState, useEffect } from 'react';

export default function InputForm({ url, setUrl, handleCheckVideo, error }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5000/api/get-history') 
      .then(res => res.json())
      .then(res => {
        if (res.status === "success") {
          setHistory(res.data.history);
        }
      })
      .catch(err => console.error("Failed to fetch history", err));
  }, []);

  const handleHistoryItemClick = (selectedUrl) => {
    handleCheckVideo(null, selectedUrl); 
  };

  return (
    <>
            <div className="text-center space-y-8 animate-in fade-in duration-500">
              
              <div className="flex items-center justify-center space-x-3 mb-10">
              {/* This container provides the soft, glimmering glow */}
              <div className="bg-red-600/10 p-2.5 rounded-2xl shadow-[0_0_20px_5px_rgba(255,0,0,0.3)] border border-red-500/20">
                <svg className="w-9 h-9 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.626-.246-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 4-8 4z"/>
                </svg>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tighter">
                Revel<span className="text-red-600">IO</span>
              </h1>
            </div>

              <p className="text-[#606060] text-lg max-w-2xl mx-auto font-medium">
                Verify the truth behind any video. Our AI extracts claims and scans the web to separate fact from fiction.
              </p>
              
              <form onSubmit={handleCheckVideo} className="flex flex-col sm:flex-row gap-3 mt-10">
                <input
                  type="url"
                  placeholder="Paste YouTube URL here..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  className="flex-1 px-5 py-4 bg-[#f8f8f8] border border-[#cccccc] rounded-full focus:outline-none focus:border-[#065fd4] focus:ring-1 focus:ring-[#065fd4] transition-all"
                />
                <button
                  type="submit"
                  className="px-8 py-4 bg-[#0f0f0f] text-white font-bold rounded-full hover:bg-[#272727] active:scale-95 transition-all shadow-md"
                >
                  Analyze Video
                </button>
              </form>
              
              {/* System Guidelines */}
              <div className="mt-12 bg-[#f2f2f2] rounded-2xl p-6 text-sm text-[#0f0f0f] text-left border border-transparent">
                <h4 className="font-bold text-base mb-3 flex items-center">
                  <span className="mr-2">💡</span> System Guidelines:
                </h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-90">
                  <li className="flex items-start">
                    <span className="text-[#ff0000] mr-2">•</span>
                    <span><strong>10 minutes Limit:</strong> Processing is optimized for shorts and videos under 10 minutes.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#ff0000] mr-2">•</span>
                    <span><strong>Fact-Based:</strong> Best used for reviews, news, and technical essays.</span>
                  </li>
                </ul>
              </div>
              
              {/* Error  */}
              {error && (
                <div className="mt-6 p-4 bg-[#fff1f0] text-[#d93025] rounded-xl border border-[#ffccc7] font-medium">
                  {error}
                </div>
              )}
            </div>

              {/* History */}
              {history.length > 0 && (
                  <div className="bg-[#f2f2f2] rounded-3xl mt-5 p-6 shadow-sm border border-[#eeeeee] animate-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-[#0f0f0f] uppercase tracking-wider flex items-center">
                        <span className="mr-2 text-lg">🕒</span> Recent History
                      </h4>
                      <span className="text-xs text-[#606060] font-medium">{history.length} items cached</span>
                    </div>
          
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {history.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => handleHistoryItemClick(item.url)}
                        className="flex items-center text-left p-3 rounded-xl border border-[#f0f0f0] bg-[#fafafa] hover:bg-[#f2f2f2] hover:border-[#e0e0e0] transition-all group"
                      >
                        <div className="w-8 h-8 flex-shrink-0 bg-red-600/10 rounded-lg flex items-center justify-center mr-3 group-hover:bg-red-600 group-hover:text-white transition-colors">
                          <span className="text-xs">▶</span>
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-semibold text-[#0f0f0f] truncate">
                            {item.topic}
                          </p>
                          <p className="text-[11px] text-[#606060] truncate opacity-70">
                            {item.url}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
            )}
    </>
);
}