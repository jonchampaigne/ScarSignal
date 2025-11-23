import React, { useState } from 'react';
import { generateSceneImage } from '../services/geminiService';

const ASSET_PROMPTS = [
  { id: 'env_london', label: 'Environment: London Ruins', prompt: 'A wide shot of a ruined, post-apocalyptic London skyline, overgrown with vegetation, rusted metal structures, fog, cassette futurism aesthetic, 8k, cinematic, gloomy weather.' },
  { id: 'env_workshop', label: 'Environment: Repair Bay', prompt: 'A cluttered workbench covered in magnetic tape, old cathode ray tube monitors, soldering irons, wires, gritty, dim amber lighting, macro shot, photorealistic.' },
  { id: 'tech_tapes', label: 'Tech: Magnetic Tapes', prompt: 'Close up of a stack of rugged data cassettes, scratched plastic, handwritten labels, dusty, industrial lighting, tangible technology.' },
  { id: 'tech_crt', label: 'Tech: CRT Monitor', prompt: 'Extreme close up of an old monochrome CRT monitor displaying green and amber code, scanlines, glitch effect, dark room, analog horror style.' },
  { id: 'char_drone', label: 'Character: Rogue Drone', prompt: 'A menacing, makeshift drone built from scrap parts and old cameras, hovering in a dark tunnel, red sensor light, cinematic, scary.' },
  { id: 'tech_wiring', label: 'Tech: Hacked Circuit', prompt: 'A messy fuse box with wires spliced together, duct tape, sparks, hacking tool connected, cyberpunk aesthetic, grime.' },
  { id: 'loc_cathedral', label: 'Location: Rust Cathedral', prompt: 'Interior of a massive, decaying industrial factory turned into a place of worship, beams of light through smoke, rusted metal, religious atmosphere.' },
  { id: 'gear_kaia', label: 'Props: Survival Gear', prompt: 'A flat lay of survival gear: a modified cassette player, a heavy wrench, a map of london, compass, and a jagged knife, on a concrete floor, high detail.' },
];

interface GeneratedAsset {
  id: string;
  url: string;
  status: 'pending' | 'loading' | 'success' | 'error';
}

const AssetGenerator = ({ onBack }: { onBack: () => void }) => {
  const [assets, setAssets] = useState<GeneratedAsset[]>(
    ASSET_PROMPTS.map(p => ({ id: p.id, url: '', status: 'pending' }))
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAsset = async (index: number) => {
    const promptDef = ASSET_PROMPTS[index];
    
    setAssets(prev => {
      const copy = [...prev];
      copy[index].status = 'loading';
      return copy;
    });

    try {
      const base64Url = await generateSceneImage(promptDef.prompt);
      setAssets(prev => {
        const copy = [...prev];
        copy[index].status = 'success';
        copy[index].url = base64Url;
        return copy;
      });
    } catch (e) {
      console.error(e);
      setAssets(prev => {
        const copy = [...prev];
        copy[index].status = 'error';
        return copy;
      });
    }
  };

  const generateAll = async () => {
    setIsGenerating(true);
    // Execute sequentially to avoid rate limits
    for (let i = 0; i < ASSET_PROMPTS.length; i++) {
      if (assets[i].status !== 'success') {
        await generateAsset(i);
      }
    }
    setIsGenerating(false);
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `scar_signal_${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e2e8f0] font-terminal p-8 overflow-y-auto crt">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-[#333] pb-4">
          <div>
            <h1 className="text-3xl font-analog text-amber-500">DEV TOOLS // ASSET GENERATOR</h1>
            <p className="text-stone-400 text-sm mt-1">Generate documentation assets via Gemini 2.5 Flash Image</p>
          </div>
          <button 
            onClick={onBack}
            className="px-4 py-2 border border-red-900 text-red-500 hover:bg-red-900/20"
          >
            [ EXIT TERMINAL ]
          </button>
        </div>

        <div className="mb-8 p-4 bg-[#111] border border-amber-900/30 flex justify-between items-center">
           <div className="text-xs text-amber-700">
             WARNING: THIS WILL CONSUME API QUOTA.
           </div>
           <button
             onClick={generateAll}
             disabled={isGenerating}
             className={`px-6 py-3 bg-amber-600 text-black font-bold uppercase tracking-widest hover:bg-amber-500 transition-all ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
           >
             {isGenerating ? 'PROCESSING BATCH...' : 'GENERATE ALL ASSETS'}
           </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {ASSET_PROMPTS.map((item, idx) => {
            const asset = assets[idx];
            return (
              <div key={item.id} className="bg-[#0a0a0a] border border-[#333] p-4 flex flex-col">
                <div className="text-xs text-stone-500 mb-2 font-mono uppercase truncate" title={item.label}>
                  {item.label}
                </div>
                
                <div className="aspect-video bg-[#111] mb-4 relative flex items-center justify-center overflow-hidden border border-[#222]">
                  {asset.status === 'pending' && <span className="text-stone-700 text-xs">[ NO DATA ]</span>}
                  {asset.status === 'loading' && <span className="text-amber-500 animate-pulse text-xs">RENDERING...</span>}
                  {asset.status === 'error' && <span className="text-red-500 text-xs">GENERATION FAILED</span>}
                  {asset.status === 'success' && (
                    <img src={asset.url} alt={item.label} className="w-full h-full object-cover" />
                  )}
                </div>

                <div className="mt-auto flex space-x-2">
                   {asset.status === 'success' ? (
                     <button 
                       onClick={() => downloadImage(asset.url, item.id)}
                       className="flex-1 py-2 bg-stone-800 text-stone-200 text-xs hover:bg-amber-600 hover:text-black transition-colors"
                     >
                       DOWNLOAD .PNG
                     </button>
                   ) : (
                     <button 
                        onClick={() => generateAsset(idx)}
                        disabled={isGenerating || asset.status === 'loading'}
                        className="flex-1 py-2 border border-stone-800 text-stone-500 text-xs hover:border-amber-700 hover:text-amber-500 disabled:opacity-50"
                     >
                        RETRY / GENERATE
                     </button>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AssetGenerator;