import React, { useState, useEffect, useRef } from 'react';
import { StorySegment, LoadingStage, PlayerStats } from './types';
import { generateNextStorySegment, generateSceneImage, generateNarrativeAudio } from './services/geminiService';
import { decodeBase64, decodeAudioData } from './services/audioUtils';
import TypewriterText from './components/TypewriterText';
import LoadingOverlay from './components/LoadingOverlay';

// Default fallback image
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1618335829737-2228915674e0?q=80&w=2070&auto=format&fit=crop"; 

function App() {
  const [history, setHistory] = useState<StorySegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<StorySegment | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([DEFAULT_IMAGE]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(LoadingStage.IDLE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDamaged, setIsDamaged] = useState(false);

  // Stats
  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    wealth: 50,
    xp: 0
  });

  // Audio Context refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Slideshow timer
  useEffect(() => {
    if (imageUrls.length <= 1) return;
    const interval = setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % imageUrls.length);
    }, 8000); // Rotate image every 8 seconds
    return () => clearInterval(interval);
  }, [imageUrls]);

  // Remove damage flash after animation
  useEffect(() => {
    if (isDamaged) {
      const timer = setTimeout(() => setIsDamaged(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isDamaged]);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playAudio = async (base64Audio: string) => {
    try {
      initAudio();
      if (!audioContextRef.current) return;
      
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }

      const bytes = decodeBase64(base64Audio);
      // Gemini TTS standard: 24000Hz, 1 Channel (Mono)
      const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => setIsPlaying(false);
      
      audioSourceRef.current = source;
      source.start(0);
      setIsPlaying(true);
    } catch (err) {
      console.error("Audio playback error:", err);
      setErrorMsg("AUDIO_DECODER_FAILURE");
    }
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      setIsPlaying(false);
    }
  };

  const handleTurn = async (action: string) => {
    setErrorMsg(null);
    stopAudio();
    
    try {
      setLoadingStage(LoadingStage.WRITING);
      const nextSegment = await generateNextStorySegment(history, action, stats);
      
      // Update Stats & Check for Damage
      if (nextSegment.statUpdates) {
        setStats(prev => {
          const healthChange = nextSegment.statUpdates?.health || 0;
          if (healthChange < 0) {
            setIsDamaged(true);
          }
          return {
            health: Math.min(100, Math.max(0, prev.health + healthChange)),
            wealth: Math.max(0, prev.wealth + (nextSegment.statUpdates?.wealth || 0)),
            xp: prev.xp + (nextSegment.statUpdates?.xp || 0)
          };
        });
      }

      setCurrentSegment(nextSegment);
      setHistory(prev => [...prev, nextSegment]);
      
      // If dead, stop processing images/audio to save resources/time and show death screen immediately
      if ((stats.health + (nextSegment.statUpdates?.health || 0)) <= 0) {
         setLoadingStage(LoadingStage.IDLE);
         return; 
      }

      setLoadingStage(LoadingStage.PAINTING);
      
      // Generate 3 images in parallel for the carousel
      try {
        const prompts = nextSegment.visualPrompts.slice(0, 3); // Take up to 3
        const imagePromises = prompts.map(p => generateSceneImage(p));
        
        // Use allSettled so one failure doesn't kill the batch. 
        // Logic: Try to get all 3, if some fail, just use the successful ones.
        const results = await Promise.allSettled(imagePromises);
        const validImages = results
          .filter((r: any) => r.status === 'fulfilled')
          .map((r: any) => r.value as string);

        if (validImages.length > 0) {
            setImageUrls(validImages);
            setActiveImageIndex(0);
        } else {
            // If ALL fail, we might want to keep the old ones or show an error state
            // For now, keeping old ones is safer than blank screen
             console.warn("All image generations failed. Retaining previous buffer.");
        }
      } catch (e) {
        console.warn("Image generation system critical failure", e);
      }

      setLoadingStage(LoadingStage.VOICING);
      try {
        const audioData = await generateNarrativeAudio(nextSegment.narrative);
        playAudio(audioData); 
      } catch (e) {
        console.warn("Audio generation failed.", e);
      }

    } catch (err: any) {
      setErrorMsg(err.message || "SYSTEM CRITICAL FAILURE. PLEASE REBOOT.");
    } finally {
      setLoadingStage(LoadingStage.IDLE);
    }
  };

  const startGame = () => {
    setHasStarted(true);
    initAudio();
    handleTurn("Initialize 'Scar Signal'. Begin with the protagonist, Kaia (Black British, late 30s), checking a magnetic trap in the Rust Cathedral. The atmosphere is heavy, humid, and smells of ozone.");
  };

  const exitGame = () => {
    stopAudio();
    setHasStarted(false);
    setHistory([]);
    setCurrentSegment(null);
    setStats({ health: 100, wealth: 50, xp: 0 });
    setImageUrls([DEFAULT_IMAGE]);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    handleTurn(customInput);
    setCustomInput("");
  };

  // Intro Screen
  if (!hasStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black relative overflow-hidden font-terminal crt">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/40 via-black to-black"></div>
        
        <div className="z-10 text-center max-w-3xl px-6 border border-amber-900/50 p-12 bg-black/80 backdrop-blur-sm">
          <div className="mb-4 text-amber-700 text-xs tracking-[0.5em] animate-pulse">PROTOCOL V1.5</div>
          <h1 className="text-6xl md:text-8xl font-analog text-amber-500 mb-6 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
            SCAR SIGNAL
          </h1>
          <p className="text-xl text-stone-400 mb-10 font-terminal tracking-wide leading-relaxed">
            A field guide to the magnetic apocalypse. <br/>
            <span className="text-stone-600 text-sm">Where your trauma is your job description.</span>
          </p>
          
          <button 
            onClick={startGame}
            className="group relative px-10 py-4 bg-transparent border-2 border-amber-600 hover:bg-amber-600/10 transition-all duration-200"
          >
             <span className="text-amber-500 font-terminal text-xl uppercase tracking-widest group-hover:text-amber-400 group-hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]">
               INITIALIZE BOOT SEQUENCE
             </span>
             <div className="absolute -bottom-2 -right-2 w-4 h-4 border-r-2 border-b-2 border-amber-600"></div>
             <div className="absolute -top-2 -left-2 w-4 h-4 border-l-2 border-t-2 border-amber-600"></div>
          </button>
        </div>
        
        <div className="absolute bottom-4 text-amber-900/50 text-xs font-mono">
           STABLE_BUILD_2025.01.01 // FRANKENSTEIN_TECH_CORE
        </div>
      </div>
    );
  }

  // DEATH SCREEN
  if (stats.health <= 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black relative overflow-hidden font-terminal crt">
        <div className="absolute inset-0 bg-red-900/20 z-0 animate-pulse"></div>
        <div className="z-10 text-center border-2 border-red-800 p-12 bg-black/90 max-w-2xl mx-4">
           <h1 className="text-6xl text-red-600 font-analog mb-4 glitch-text">SIGNAL LOST</h1>
           <p className="text-red-400 font-mono mb-8 text-xl">BIO-SIGNS FLATLINED. NARRATIVE TERMINATED.</p>
           
           <div className="flex justify-center space-x-8 mb-8 text-stone-500 font-mono text-sm">
             <div>
               <span className="block text-stone-700">FINAL XP</span>
               <span className="text-amber-600 text-lg">{stats.xp}</span>
             </div>
             <div>
               <span className="block text-stone-700">WEALTH</span>
               <span className="text-amber-600 text-lg">{stats.wealth}</span>
             </div>
           </div>

           <button 
             onClick={exitGame}
             className="px-8 py-3 bg-red-900/20 border border-red-600 text-red-500 hover:bg-red-900/40 hover:text-red-300 transition-all"
           >
             REBOOT SYSTEM
           </button>
        </div>
      </div>
    );
  }

  // Main Interface
  return (
    <div className={`min-h-screen bg-[#050505] flex flex-col md:flex-row relative crt text-[#e2e8f0] transition-colors duration-100 ${isDamaged ? 'bg-red-900/30 animate-shake' : ''}`}>
      {/* Damage Overlay Flash */}
      <div className={`absolute inset-0 z-50 pointer-events-none bg-red-600 mix-blend-overlay transition-opacity duration-300 ${isDamaged ? 'opacity-40' : 'opacity-0'}`}></div>

      {/* Visual Canvas (Left) */}
      <div className="w-full md:w-1/2 h-[40vh] md:h-screen relative bg-black border-b md:border-b-0 md:border-r border-[#333] overflow-hidden">
        <LoadingOverlay stage={loadingStage} />
        <div className="absolute inset-0 bg-amber-500/5 mix-blend-overlay z-10 pointer-events-none"></div>
        
        {/* Slideshow Logic */}
        {imageUrls.map((url, idx) => (
          <img 
            key={idx}
            src={url} 
            alt={`Scene Frame ${idx}`} 
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] ${idx === activeImageIndex ? 'opacity-80' : 'opacity-0'} filter sepia-[0.3] contrast-110 grayscale-[0.2]`}
          />
        ))}

        {/* Stats HUD (Top Left Overlay) */}
        <div className="absolute top-4 left-4 z-30 flex flex-col space-y-2 bg-black/60 p-2 border border-amber-900/30 backdrop-blur-sm rounded-sm transition-all duration-300 hover:scale-110 hover:bg-black/80 hover:border-amber-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] origin-top-left cursor-default group">
             <div className="flex items-center space-x-3 text-amber-500 font-terminal text-xs tracking-wider">
               <span className="w-16">VITALS</span>
               <div className="h-1.5 w-24 bg-stone-800 border border-stone-600">
                 <div className={`h-full transition-all duration-500 ${stats.health < 30 ? 'bg-red-600 animate-pulse' : 'bg-amber-600'}`} style={{ width: `${stats.health}%` }}></div>
               </div>
               <span className={stats.health < 30 ? 'text-red-500 font-bold' : ''}>{stats.health}%</span>
             </div>
             <div className="flex items-center space-x-3 text-amber-500 font-terminal text-xs tracking-wider">
               <span className="w-16">CREDITS</span>
               <span className="text-stone-300">{stats.wealth}</span>
             </div>
             <div className="flex items-center space-x-3 text-amber-500 font-terminal text-xs tracking-wider">
               <span className="w-16">XP</span>
               <span className="text-stone-300 group-hover:text-amber-100 transition-colors">{stats.xp}</span>
             </div>
        </div>
        
        {/* Visual Log Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent z-20">
           {currentSegment && (
             <div className="border-l-2 border-amber-600 pl-3 transition-all duration-300 origin-bottom-left hover:scale-110 hover:border-amber-400 hover:pl-4 cursor-default">
               <p className="text-[10px] text-amber-700 font-terminal uppercase tracking-widest mb-1">
                 Visual Feed {activeImageIndex + 1}/{imageUrls.length}
               </p>
               <p className="text-xs text-stone-400 font-mono truncate opacity-70">
                 {currentSegment.visualPrompts?.[activeImageIndex] || "Scanning..."}
               </p>
             </div>
           )}
        </div>
      </div>

      {/* Narrative Terminal (Right) */}
      <div className="w-full md:w-1/2 h-[60vh] md:h-screen flex flex-col bg-[#0a0a0a]">
        
        {/* Header */}
        <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#111]">
          <h2 className="font-analog text-amber-600 text-lg tracking-widest uppercase">
            Signal: {currentSegment?.id.substring(0, 8) || "WAITING"}
          </h2>
          <div className="flex items-center space-x-4">
             {/* Audio Visualizer Fake */}
             <div className={`flex space-x-1 items-end h-4 ${isPlaying ? 'opacity-100' : 'opacity-20'}`}>
                <div className="w-1 bg-amber-500 h-2 animate-[bounce_1s_infinite]"></div>
                <div className="w-1 bg-amber-500 h-4 animate-[bounce_1.2s_infinite]"></div>
                <div className="w-1 bg-amber-500 h-3 animate-[bounce_0.8s_infinite]"></div>
             </div>
             
             <button 
                onClick={() => isPlaying ? stopAudio() : null}
                className={`text-amber-500 hover:text-amber-400 transition-colors text-xs font-mono ${!isPlaying && 'opacity-50'}`}
              >
                {isPlaying ? '[ MUTE ]' : '[ OFFLINE ]'}
              </button>

              <button
                onClick={exitGame}
                className="text-red-900 hover:text-red-500 transition-colors text-xs font-mono border border-red-900 px-2 py-1"
              >
                [ TERMINATE ]
              </button>
          </div>
        </div>

        {/* Console Output */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 font-terminal scrollbar-thin scrollbar-thumb-amber-900 scrollbar-track-black">
           {errorMsg && (
             <div className="p-4 border border-red-900 bg-red-900/10 text-red-500 font-mono text-sm">
               > ERROR: {errorMsg}
             </div>
           )}

           {currentSegment && (
             <div className="prose prose-invert max-w-none">
               <span className="text-amber-700 mr-2 text-xl">›</span>
               <div className="text-stone-300 text-lg leading-relaxed font-analog whitespace-pre-wrap">
                  <TypewriterText text={currentSegment.narrative} speed={10} />
               </div>
             </div>
           )}
        </div>

        {/* Command Interface */}
        <div className="p-4 bg-[#080808] border-t border-[#333] z-20">
          <p className="text-xs text-stone-500 mb-2 font-mono uppercase">Available Protocols:</p>
          <div className="max-h-48 overflow-y-auto pr-2 grid grid-cols-1 gap-2 mb-4">
            {currentSegment?.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleTurn(opt.action)}
                disabled={loadingStage !== LoadingStage.IDLE}
                className="text-left px-4 py-3 border border-stone-800 bg-[#111] hover:bg-amber-900/10 hover:border-amber-600/50 hover:text-amber-100 transition-all duration-100 group flex items-start"
              >
                <span className="text-amber-700 mr-3 font-mono text-xs opacity-50 group-hover:opacity-100 mt-1">0{idx + 1}</span>
                <div>
                   <span className="font-terminal tracking-wide text-sm md:text-base text-stone-300 group-hover:text-amber-50 block font-bold">{opt.label}</span>
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={handleCustomSubmit} className="relative mt-2">
            <span className="absolute left-3 top-3 text-amber-600 font-mono">></span>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="OVERRIDE PROTOCOL..."
              disabled={loadingStage !== LoadingStage.IDLE}
              className="w-full bg-[#050505] border border-stone-800 rounded-none py-3 pl-8 pr-4 text-stone-300 placeholder-stone-700 font-mono focus:outline-none focus:border-amber-600 focus:bg-[#0a0a0a] transition-all"
            />
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;