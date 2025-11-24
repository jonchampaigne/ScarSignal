
import React, { useState, useEffect, useRef } from 'react';
import { StorySegment, LoadingStage, PlayerStats, LogEntry, StoryOption, Item } from './types';
import { generateNextStorySegment, generateSceneImage, generateNarrativeAudio } from './services/geminiService';
import { decodeBase64, decodeAudioData } from './services/audioUtils';
import { generateId } from './services/utils';
import TypewriterText from './components/TypewriterText';
import TerminalInput from './components/TerminalInput';
import AssetGenerator from './components/AssetGenerator';

// Default fallback image
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1618335829737-2228915674e0?q=80&w=2070&auto=format&fit=crop"; 
const STORAGE_KEY = 'SCAR_SIGNAL_V1_SAVE';

function App() {
  // --- STATE INITIALIZATION (PERSISTENCE) ---
  
  // Load initial state from local storage or defaults
  const loadState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // --- VALIDATION & MIGRATION ---
        if (!Array.isArray(parsed.log)) throw new Error("Corrupt Log Data");
        if (!Array.isArray(parsed.history)) throw new Error("Corrupt History Data");

        // Mark loaded logs as restored so they don't re-animate
        parsed.log = parsed.log.map((l: LogEntry) => ({ ...l, isRestored: true }));
        
        // Backwards compatibility
        if (!parsed.inventory) parsed.inventory = [];
        if (!parsed.hostId) parsed.hostId = `deck-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`;
        // Load volume settings if available, else default
        if (parsed.volume === undefined) parsed.volume = 0.5;
        if (parsed.isMuted === undefined) parsed.isMuted = false;

        console.log("SYSTEM: SESSION RESTORED SUCCESSFULLY.", parsed);
        return parsed;
      }
    } catch (e) {
      console.error("FATAL: Save file corruption detected. Wiping memory.", e);
      // We don't automatically wipe here to allow ErrorBoundary to show info if needed,
      // but if JSON parse fails, we return null to fall back to defaults.
      return null;
    }
    return null;
  };

  // Run loadState once
  const [savedState] = useState(loadState());

  // Core State
  const [log, setLog] = useState<LogEntry[]>(savedState?.log || []);
  const [history, setHistory] = useState<StorySegment[]>(savedState?.history || []); 
  const [currentSegment, setCurrentSegment] = useState<StorySegment | null>(savedState?.currentSegment || null);
  
  // Assets
  const [imageUrls, setImageUrls] = useState<string[]>(savedState?.imageUrls || [DEFAULT_IMAGE]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  // Stats & Inventory
  const [stats, setStats] = useState<PlayerStats>(savedState?.stats || { health: 100, wealth: 50, xp: 0 });
  const [inventory, setInventory] = useState<Item[]>(savedState?.inventory || []);
  const [hostId] = useState<string>(savedState?.hostId || `deck-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`);

  // Audio State
  const [volume, setVolume] = useState<number>(savedState?.volume ?? 0.5);
  const [isMuted, setIsMuted] = useState<boolean>(savedState?.isMuted ?? false);

  // UI State (Not persisted)
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(LoadingStage.IDLE);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDamaged, setIsDamaged] = useState(false);
  const [showAssetGenerator, setShowAssetGenerator] = useState(false);
  const [activeTab, setActiveTab] = useState<'monitor' | 'gear'>('monitor');

  // Refs
  const currentSegmentIdRef = useRef<string | null>(currentSegment?.id || null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bootRef = useRef(false);

  // --- PERSISTENCE EFFECT ---
  useEffect(() => {
    try {
      const stateToSave = {
        log,
        history,
        currentSegment,
        imageUrls,
        stats,
        inventory,
        hostId,
        volume,
        isMuted
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn("STORAGE WARNING: Quota exceeded or permission denied.", e);
    }
  }, [log, history, currentSegment, imageUrls, stats, inventory, hostId, volume, isMuted]);

  // --- BOOT SEQUENCE ---

  useEffect(() => {
    if (!bootRef.current) {
      bootRef.current = true;
      console.log("SYSTEM: Boot Sequence Initiated.");
      
      // If we have history, we are resuming
      if (history.length > 0) {
        addLog('system', `RE-ESTABLISHING CONNECTION TO HOST: ${hostId}... [OK]`);
        addLog('info', "SESSION RESTORED. AWAITING INPUT.");
      } else {
        runBootSequence();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log, loadingStage]);

  // Slideshow
  useEffect(() => {
    if (imageUrls.length <= 1) return;
    const interval = setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % imageUrls.length);
    }, 8000); 
    return () => clearInterval(interval);
  }, [imageUrls]);

  // Damage Effect
  useEffect(() => {
    if (isDamaged) {
      const timer = setTimeout(() => setIsDamaged(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isDamaged]);

  // Audio Volume Effect
  useEffect(() => {
    if (audioContextRef.current && gainNodeRef.current) {
      // Smoothly transition volume
      const targetVolume = isMuted ? 0 : volume;
      try {
        gainNodeRef.current.gain.setTargetAtTime(targetVolume, audioContextRef.current.currentTime, 0.1);
      } catch (e) {
        // Fallback for some browsers if time is weird
        gainNodeRef.current.gain.value = targetVolume;
      }
    }
  }, [volume, isMuted]);

  // --- LOGIC ---

  const addLog = (type: LogEntry['type'], content: string, options?: StoryOption[]) => {
    setLog(prev => [...prev, {
      id: generateId(),
      type,
      content,
      options,
      timestamp: new Date().toLocaleTimeString('en-GB'),
      isRestored: false
    }]);
  };

  const runBootSequence = async () => {
    const lines = [
      "INITIALIZING KERNEL...",
      "LOADING DRIVERS: [OK]",
      "MOUNTING FILE SYSTEM...",
      "CHECKING BIOMETRICS...",
      `HOST: ${hostId} ONLINE`,
      "CONNECTING TO MAGNETIC SPECTRUM...",
      "SIGNAL ESTABLISHED."
    ];

    for (const line of lines) {
      addLog('system', line);
      await new Promise(r => setTimeout(r, 150 + Math.random() * 200));
    }

    addLog('info', "WELCOME TO SCAR SIGNAL. TYPE 'START' OR 'INIT' TO BEGIN.");
  };

  const startGame = () => {
    console.log("SYSTEM: Starting Game...");
    initAudio();
    // Starting gear
    setInventory([
      { id: 'start_medkit', name: 'Standard Medkit', description: 'Basic field dressings and antiseptics.', type: 'consumable', effectValue: 30, quantity: 1 }
    ]);
    handleTurn("Initialize 'Scar Signal'. Begin with the protagonist, Kaia (Black British, late 30s), checking a magnetic trap in the Rust Cathedral. The atmosphere is heavy, humid, and smells of ozone.");
  };

  const resetGame = () => {
    if (window.confirm("CONFIRM FACTORY RESET? ALL DATA WILL BE LOST.")) {
      console.log("SYSTEM: Resetting Game...");
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  const initAudio = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Create Gain Node for Volume Control
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = isMuted ? 0 : volume;
        gainNode.connect(audioContextRef.current.destination);
        gainNodeRef.current = gainNode;
      }
      
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    } catch (e) {
      console.warn("Audio Context init failed (User interaction required?)", e);
    }
  };

  const playAudio = async (base64Audio: string) => {
    try {
      initAudio();
      const ctx = audioContextRef.current;
      const gainNode = gainNodeRef.current;
      
      if (!ctx || !gainNode) return;
      if (audioSourceRef.current) {
          try { audioSourceRef.current.stop(); } catch(e) {}
      }

      const bytes = decodeBase64(base64Audio);
      const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // Connect to Gain Node instead of Destination
      source.connect(gainNode);
      
      source.onended = () => setIsPlaying(false);
      
      audioSourceRef.current = source;
      source.start(0);
      setIsPlaying(true);
    } catch (err) {
      console.error("Audio playback error:", err);
      // Don't crash the game for audio errors
    }
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
          // ignore if already stopped
      }
      setIsPlaying(false);
    }
  };

  // --- ASSET PIPELINE ---
  const triggerBackgroundGeneration = async (segment: StorySegment) => {
    // Wrap in try-catch to prevent unhandled promise rejections crashing the app
    try {
        setIsBackgroundLoading(true);

        // Audio
        generateNarrativeAudio(segment.narrative)
        .then(audio => {
            // Only play if we are still on the same segment
            if (currentSegmentIdRef.current === segment.id) playAudio(audio);
        })
        .catch(e => console.warn("Audio generation skipped:", e));

        // Images
        const prompts = segment.visualPrompts.slice(0, 3);
        let firstImage = true;
        
        // Execute image generation
        // We use map to start them in parallel but handle errors individually
        await Promise.allSettled(prompts.map(async (prompt) => {
             try {
                 const url = await generateSceneImage(prompt);
                 if (currentSegmentIdRef.current === segment.id) {
                     setImageUrls(prev => {
                        if (firstImage) {
                            firstImage = false;
                            setActiveImageIndex(0);
                            return [url];
                        }
                        if (prev.includes(url)) return prev;
                        return [...prev, url];
                     });
                 }
             } catch (e) {
                 console.warn("Individual image gen failed:", e);
             }
        }));

    } catch (err) {
        console.error("Background Generation Error:", err);
    } finally {
        if (currentSegmentIdRef.current === segment.id) {
            setIsBackgroundLoading(false);
        }
    }
  }


  // --- INVENTORY LOGIC ---
  const handleUseItem = (item: Item) => {
    if (item.type === 'consumable' && item.effectValue) {
      // Heal Logic
      const newHealth = Math.min(100, stats.health + item.effectValue);
      setStats(prev => ({ ...prev, health: newHealth }));
      
      addLog('success', `USING ${item.name.toUpperCase()}... VITAL SIGNS RESTORED. [HEALTH: ${newHealth}%]`);
      
      // Remove from inventory
      setInventory(prev => {
        const idx = prev.findIndex(i => i.id === item.id);
        if (idx > -1) {
          const newState = [...prev];
          if (newState[idx].quantity > 1) {
            newState[idx].quantity--;
          } else {
            newState.splice(idx, 1);
          }
          return newState;
        }
        return prev;
      });
    } else {
      handleTurn(`I use the ${item.name} from my inventory.`);
    }
  };


  // --- MAIN GAME LOOP ---

  const handleInput = (input: string) => {
    const raw = input.trim().toLowerCase();
    addLog('command', input); 

    // Basic Commands
    if (raw === 'clear' || raw === 'cls') {
      setLog([]);
      return;
    }
    if (raw === 'exit') {
        window.location.reload();
        return;
    }
    if (raw === 'reset' || raw === 'restart' || raw === 'wipe') {
      resetGame();
      return;
    }
    if (raw === 'start' || raw === 'init') {
        if (history.length > 0) {
            addLog('error', "SESSION ACTIVE. TYPE 'RESET' TO WIPE MEMORY.");
        } else {
            startGame();
        }
        return;
    }

    // Option Parsing (e.g., "1", "01", "run 1")
    if (currentSegment) {
        const match = raw.match(/^(\d+)$/);
        if (match) {
            const index = parseInt(match[1], 10) - 1;
            if (index >= 0 && index < currentSegment.options.length) {
                handleTurn(currentSegment.options[index].action);
                return;
            }
        }
    }

    // Custom Input
    handleTurn(input);
  };

  const handleTurn = async (action: string) => {
    stopAudio();
    setLoadingStage(LoadingStage.WRITING);
    
    try {
      const nextSegment = await generateNextStorySegment(history, action, stats, inventory);
      
      // CLEAR TERMINAL TO PREVENT CLUTTER
      setLog([]);
      addLog('system', `// LOADING SEGMENT: ${nextSegment.id.substring(0,8)}...`);

      // Update State
      setCurrentSegment(nextSegment);
      currentSegmentIdRef.current = nextSegment.id;
      setHistory(prev => [...prev, nextSegment]);

      // Stat Updates
      if (nextSegment.statUpdates) {
        setStats(prev => {
          const healthChange = nextSegment.statUpdates?.health || 0;
          if (healthChange < 0) setIsDamaged(true);
          
          return {
            health: Math.min(100, Math.max(0, prev.health + healthChange)),
            wealth: Math.max(0, prev.wealth + (nextSegment.statUpdates?.wealth || 0)),
            xp: prev.xp + (nextSegment.statUpdates?.xp || 0)
          };
        });
      }

      // Handle Loot
      if (nextSegment.loot && nextSegment.loot.length > 0) {
        const newItems = nextSegment.loot;
        setInventory(prev => {
           const updated = [...prev];
           newItems.forEach(newItem => {
             // Check if we have it, stack it
             const existing = updated.find(i => i.name === newItem.name);
             if (existing) {
               existing.quantity += 1;
             } else {
               updated.push(newItem);
             }
           });
           return updated;
        });
        
        // Announce Loot
        const lootString = newItems.map(i => `[${i.name}]`).join(', ');
        addLog('success', `ITEMS ACQUIRED: ${lootString}`);
        setActiveTab('gear'); // Auto switch to gear to show new items
      }

      // Render Output to Log
      addLog('narrative', nextSegment.narrative);
      addLog('info', 'AVAILABLE PROTOCOLS:', nextSegment.options);

      // Trigger background assets
      triggerBackgroundGeneration(nextSegment);

      // Check Death
      if ((stats.health + (nextSegment.statUpdates?.health || 0)) <= 0) {
          addLog('error', "CRITICAL FAILURE. SIGNAL TERMINATED.");
          addLog('info', "TYPE 'RESET' TO REINITIALIZE.");
          setLoadingStage(LoadingStage.IDLE);
          return;
      }

    } catch (err: any) {
      console.error("TURN ERROR:", err);
      // Soft fail - allow user to try again
      addLog('error', `CONNECTION ERROR: ${err.message || 'Signal lost'}`);
      addLog('info', "RETRYING RECOMMENDED. CHECK NETWORK.");
    } finally {
      setLoadingStage(LoadingStage.IDLE);
    }
  };


  // --- RENDER ---
  
  if (showAssetGenerator) {
    return <AssetGenerator onBack={() => setShowAssetGenerator(false)} />;
  }

  return (
    <div className={`fixed inset-0 bg-[#050505] text-[#e2e8f0] font-terminal crt flex flex-col md:flex-row overflow-hidden transition-colors ${isDamaged ? 'bg-red-900/20 animate-shake' : ''}`}>
      
      {/* LEFT COLUMN: VISUALS + STATS */}
      <div className="w-full md:w-[45%] lg:w-[40%] flex flex-col border-r border-[#333] bg-[#0a0a0a]">
         
         {/* Top Header Panel */}
         <div className="h-12 bg-[#111] border-b border-[#333] flex items-center justify-between px-4 z-20">
             <div className="text-amber-500 font-bold tracking-widest text-sm truncate hidden sm:block">SCAR_SIGNAL // V1.6</div>
             
             {/* AUDIO & SYSTEM CONTROLS */}
             <div className="flex items-center space-x-3 ml-auto">
                 {/* Volume Control */}
                 <div className="flex items-center space-x-1 border-r border-stone-800 pr-3">
                    <button 
                        onClick={() => setIsMuted(!isMuted)} 
                        className={`text-[10px] uppercase font-bold px-1 w-8 ${isMuted ? 'text-red-500' : 'text-stone-400'}`}
                    >
                        {isMuted ? 'MUTE' : 'VOL'}
                    </button>
                    <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={volume} 
                        onChange={(e) => {
                            setVolume(parseFloat(e.target.value));
                            if (isMuted) setIsMuted(false);
                        }}
                        className="w-16 h-1 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                 </div>

                 <button onClick={resetGame} className="text-[10px] border border-red-900 text-red-700 hover:bg-red-900 hover:text-white px-2 py-0.5">RESET</button>
                 <button onClick={() => setShowAssetGenerator(true)} className="text-[10px] border border-stone-800 text-stone-500 hover:text-stone-300 px-2 py-0.5">DEV</button>
             </div>
         </div>

         {/* Image Monitor */}
         <div className="relative aspect-video bg-black border-b border-[#333] group shrink-0">
            {imageUrls.map((url, idx) => (
              <img 
                key={url}
                src={url} 
                alt="Feed" 
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === activeImageIndex ? 'opacity-90' : 'opacity-0'} filter grayscale-[0.3] contrast-125 sepia-[0.2]`}
              />
            ))}
            
            {/* Overlay Grid */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
            <div className="absolute top-2 left-2 text-[10px] text-green-500 bg-black/60 px-1 font-mono">LIVE_FEED</div>
            
            {isBackgroundLoading && (
                <div className="absolute bottom-2 right-2 text-[10px] text-amber-500 bg-black/80 px-2 py-1 border border-amber-900/50 animate-pulse">
                    RECEIVING DATA...
                </div>
            )}
         </div>

         {/* TAB SELECTOR */}
         <div className="flex border-b border-[#333] bg-[#111]">
            <button 
              onClick={() => setActiveTab('monitor')}
              className={`flex-1 py-2 text-xs font-bold tracking-wider ${activeTab === 'monitor' ? 'bg-[#1a1a1a] text-amber-500 border-b-2 border-amber-500' : 'text-stone-600 hover:text-stone-400'}`}
            >
              SYSTEM VITALS
            </button>
            <button 
              onClick={() => setActiveTab('gear')}
              className={`flex-1 py-2 text-xs font-bold tracking-wider ${activeTab === 'gear' ? 'bg-[#1a1a1a] text-[#00ff9d] border-b-2 border-[#00ff9d]' : 'text-stone-600 hover:text-stone-400'}`}
            >
              GEAR / BACKPACK
            </button>
         </div>

         {/* LOWER PANEL CONTENT */}
         <div className="flex-1 overflow-y-auto bg-[#0c0c0c] relative p-4 custom-scrollbar">
            
            {/* VITALS TAB */}
            {activeTab === 'monitor' && (
              <div className="grid grid-cols-2 gap-4 animate-[fadeIn_0.3s]">
                  <div className="bg-[#111] border border-stone-800 p-3">
                      <div className="text-[10px] text-stone-500 mb-1">INTEGRITY (HP)</div>
                      <div className="text-2xl text-[#00ff9d] font-bold">{stats.health}%</div>
                      <div className="h-1 w-full bg-stone-900 mt-2">
                          <div className={`h-full ${stats.health < 30 ? 'bg-red-500 animate-pulse' : 'bg-[#00ff9d]'}`} style={{ width: `${stats.health}%` }}></div>
                      </div>
                  </div>
                  
                  <div className="bg-[#111] border border-stone-800 p-3">
                      <div className="text-[10px] text-stone-500 mb-1">CREDITS</div>
                      <div className="text-2xl text-amber-500 font-bold">{stats.wealth}</div>
                  </div>

                  <div className="bg-[#111] border border-stone-800 p-3 col-span-2">
                      <div className="flex justify-between items-end mb-1">
                          <span className="text-[10px] text-stone-500">SURVIVAL SCORE (XP)</span>
                          <span className="text-lg text-stone-300">{stats.xp}</span>
                      </div>
                      <div className="text-[10px] text-stone-600 font-mono break-all">
                          {currentSegment ? `ID: ${currentSegment.id.substring(0, 24)}` : "NO_SIGNAL"}
                      </div>
                  </div>
                  
                  <div className="col-span-2 mt-4 text-xs text-stone-500 font-mono">
                    <p className="mb-2">> SYSTEM DIAGNOSTIC:</p>
                    <p className={stats.health < 50 ? "text-red-500" : "text-stone-400"}>
                      - BIOMETRICS: {stats.health < 50 ? "CRITICAL" : "STABLE"}
                    </p>
                    <p className="text-stone-400">- NEURAL LINK: CONNECTED</p>
                    <p className="text-stone-400">- INVENTORY LOAD: {inventory.length} ITEMS</p>
                  </div>
              </div>
            )}

            {/* GEAR TAB */}
            {activeTab === 'gear' && (
              <div className="animate-[fadeIn_0.3s]">
                {inventory.length === 0 ? (
                   <div className="text-center text-stone-600 mt-8">
                     <div className="text-4xl mb-2">∅</div>
                     <p>CONTAINER EMPTY</p>
                   </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {inventory.map((item) => (
                      <div key={item.id} className="bg-[#151515] border border-stone-800 p-3 flex justify-between items-start hover:border-[#00ff9d] transition-colors group">
                        <div className="flex-1">
                          <div className="text-[#00ff9d] font-bold text-sm flex items-center">
                            {item.name}
                            {item.quantity > 1 && <span className="ml-2 text-xs text-stone-400 bg-stone-900 px-1 rounded">x{item.quantity}</span>}
                          </div>
                          <div className="text-xs text-stone-500 mt-1">{item.description}</div>
                        </div>
                        <button 
                          onClick={() => handleUseItem(item)}
                          className="ml-3 px-3 py-1 bg-stone-900 border border-stone-700 text-[10px] text-stone-300 hover:bg-[#00ff9d] hover:text-black uppercase tracking-wider"
                        >
                          USE
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-6 p-2 bg-amber-900/10 border border-amber-900/30 text-[10px] text-amber-600 font-mono">
                   > INSTRUCTIONS: USE CONSUMABLES TO RESTORE VITALS. TOOLS MAY UNLOCK NARRATIVE PATHS AUTOMATICALLY.
                </div>
              </div>
            )}

         </div>
      </div>

      {/* RIGHT COLUMN: TERMINAL */}
      <div className="w-full md:w-[55%] lg:w-[60%] flex flex-col bg-[#050505] relative">
         
         {/* Terminal Window Header */}
         <div className="h-6 bg-[#1a1a1a] flex items-center px-2 space-x-2 select-none shrink-0">
             <div className="w-3 h-3 rounded-full bg-red-900/50"></div>
             <div className="w-3 h-3 rounded-full bg-amber-900/50"></div>
             <div className="w-3 h-3 rounded-full bg-green-900/50"></div>
             <div className="ml-auto text-[10px] text-stone-600">/bin/bash --login</div>
         </div>

         {/* Log Output Area */}
         <div 
           ref={scrollRef}
           className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 font-terminal scroll-smooth"
         >
            {log.map((entry) => (
                <div key={entry.id} className="mb-4 animate-[fadeIn_0.2s_ease-out]">
                    
                    {/* Time Stamp & Type */}
                    <div className="flex items-center space-x-2 mb-1 opacity-50 text-[10px] font-mono select-none">
                        <span className="text-stone-500">[{entry.timestamp}]</span>
                        {entry.type === 'system' && <span className="text-blue-500">SYSTEM</span>}
                        {entry.type === 'error' && <span className="text-red-500">ERROR</span>}
                        {entry.type === 'command' && <span className="text-green-500">INPUT</span>}
                        {entry.type === 'success' && <span className="text-[#00ff9d]">SUCCESS</span>}
                    </div>

                    {/* Content */}
                    <div className={`text-base md:text-lg leading-relaxed whitespace-pre-wrap
                        ${entry.type === 'system' ? 'text-blue-400 font-mono text-xs' : ''}
                        ${entry.type === 'command' ? 'text-stone-400 font-bold' : ''}
                        ${entry.type === 'error' ? 'text-red-500 bg-red-900/10 p-2 border border-red-900' : ''}
                        ${entry.type === 'success' ? 'text-[#00ff9d] bg-green-900/10 p-2 border border-green-900/50' : ''}
                        ${entry.type === 'narrative' ? 'text-phosphor' : ''}
                        ${entry.type === 'info' ? 'text-stone-300' : ''}
                    `}>
                        {entry.type === 'narrative' && !entry.isRestored ? (
                             <TypewriterText text={entry.content} speed={5} />
                        ) : (
                            entry.content
                        )}
                    </div>
                    
                    {/* Render Options if present */}
                    {entry.options && entry.options.length > 0 && (
                       <div className="mt-4 mb-2 flex flex-col space-y-1">
                           <div className="text-stone-500 text-xs mb-1">AVAILABLE PROTOCOLS:</div>
                           {entry.options.map((opt, i) => (
                               <div key={i} className="text-[#00ff9d] hover:text-[#bd93f9] transition-colors cursor-pointer" onClick={() => handleTurn(opt.action)}>
                                   [{String(i + 1).padStart(2, '0')}] <span className="text-[#e2e8f0] hover:underline">{opt.label}</span>
                               </div>
                           ))}
                       </div>
                    )}

                </div>
            ))}

            {loadingStage === LoadingStage.WRITING && (
                <div className="flex space-x-1 items-center mt-4">
                    <span className="w-2 h-4 bg-amber-500 animate-pulse"></span>
                    <span className="text-amber-500 text-sm animate-pulse">PROCESSING_NARRATIVE_STREAM...</span>
                </div>
            )}
            
            <div className="h-12"></div> {/* Spacer for scroll */}
         </div>

         {/* ZSH Input Area */}
         <div className="z-10 bg-[#050505]">
             <TerminalInput 
                onSubmit={handleInput} 
                disabled={loadingStage === LoadingStage.WRITING}
                location={currentSegment ? `~/${currentSegment.id.substring(0,8)}` : "~"}
                host={hostId}
             />
         </div>

      </div>
    </div>
  );
}

export default App;
