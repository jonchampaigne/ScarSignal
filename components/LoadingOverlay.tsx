import React from 'react';
import { LoadingStage } from '../types';

interface LoadingOverlayProps {
  stage: LoadingStage;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ stage }) => {
  // Only show overlay for critical blocking stages (Writing)
  // Painting and Voicing happen in background now.
  if (stage !== LoadingStage.WRITING) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md crt transition-all duration-300">
      <div className="relative w-full max-w-md px-8">
        {/* Progress Bar Container */}
        <div className="h-2 bg-[#1a1a1a] border border-[#333] mb-4 w-full">
            <div className="h-full bg-amber-600 animate-pulse w-full origin-left animate-[scale-x_2s_ease-in-out_infinite]"></div>
        </div>
        
        <div className="flex justify-between items-center text-amber-500 font-terminal text-sm">
            <span className="animate-pulse">PROCESSING INPUT...</span>
            <span className="font-mono">SYS.V1.5</span>
        </div>

        <p className="mt-8 text-center text-amber-500 font-terminal tracking-widest text-xl uppercase glitch-text">
          SPLICING NARRATIVE TAPE...
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;