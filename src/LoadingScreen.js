import React from 'react';

export default function Loader({ loadingMessage }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-10">
      {/* Gemini-style animated container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl p-[3px] shadow-lg">
        {/* Sweeping comet rotating border effect */}
        <div className="absolute inset-[-200%] animate-[spin_2.5s_linear_infinite] bg-[conic-gradient(from_0deg_at_50%_50%,#f2f2f2_0%,#f2f2f2_70%,#0f0f0f_85%,#ff0000_100%)]"></div>
        
        {/* Inner wrapper to hold shimmering content and cover the center */}
        <div className="relative h-full w-full rounded-[21px] bg-white z-10 p-8">
          <div className="text-center">
            <h2 className="text-2xl font-black text-[#0f0f0f] text-center mb-2">
              Initializing Analysis...
            </h2>
            <p className="text-center text-[#606060] font-medium text-sm animate-pulse">
              {loadingMessage || "Fetching video details and preparing streams..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}