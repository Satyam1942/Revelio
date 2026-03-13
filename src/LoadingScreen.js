import React from 'react';

export default function Loader({ loadingMessage, currentStep }) {
  return (
     <div className="flex flex-col items-center justify-center py-16 space-y-10 animate-pulse">
              <div className="relative">
                <div className="w-20 h-20 border-[6px] border-[#f3f3f3] border-t-[#ff0000] rounded-full animate-spin"></div>
              </div>
              
              <div className="w-full max-w-md bg-[#f9f9f9] rounded-3xl p-8 border border-[#eeeeee]">
                <h2 className="text-2xl font-black text-[#0f0f0f] text-center mb-8">
                  {loadingMessage}
                </h2>
                
                <div className="space-y-5">
                  {[
                    { step: 1, label: "Scanning Audio" },
                    { step: 2, label: "AI Analysis" },
                    { step: 3, label: "Web Verification" },
                    { step: 4, label: "Judge's Verdict" }
                  ].map((item) => (
                    <div key={item.step} className="flex items-center group">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black mr-4 transition-all duration-500 shadow-sm
                        ${currentStep > item.step ? 'bg-[#0f0f0f] text-white' : 
                          currentStep === item.step ? 'bg-[#ff0000] text-white scale-110 shadow-lg' : 
                          'bg-[#e5e5e5] text-[#909090]'}`}
                      >
                        {currentStep > item.step ? '✓' : item.step}
                      </div>
                      <span className={`text-base font-bold transition-colors ${currentStep >= item.step ? 'text-[#0f0f0f]' : 'text-[#aaaaaa]'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
  );
}