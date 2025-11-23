
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { StorySegment, Item } from "../types";
import { generateId } from "./utils";

const STORY_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash-image";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

// --- SYSTEM CONTEXT: WORLD BIBLE & STYLE PROTOCOL ---
const WORLD_ANATOMY = `
# SCAR_SIGNAL_WORLD_ANATOMY
> **Style Mode:** Postmodern/Satirical/Intersectional/Cinematic
> **The Aesthetic:** Cassette Futurism meets 2025 Realism. Tangible, heavy tech. "Frankenstein Tech".
> **Demographics:** Characters are predominantly Black British (2/3) and White British (1/3). The voice is distinctly London/UK.
> **The Law:** "Smart" Tech (SSDs, Neural Processors) is ILLEGAL. "Dumb" Tech (Magnetic Tape, Analog) is LEGAL.
> **Key Characters:** 
  - Kaia (Black British): "Duct Tape Cowboy", scavenger, pragmatist. Highly skilled Technician.
  - Riven: Kaia's partitioned ruthlessness.
  - Sera (Black British): The Apprentice.
  - Lumen (British Asian): Archivist.
  - Draven (White British): Water Baron / Villain.
> **Themes:** Maintenance as a moral act. Analog Resilience vs Digital Brittleness. Competence is survival.
`;

const STYLE_PROTOCOL = `
# AI_STYLE_PROTOCOL_MASTER
> **Directive:** Synthesize a narrative voice that is recursive, biting, and cinematic.
> **Length:** OUTPUT MUST BE LONG-FORM. Write 3-4 paragraphs (approx 300 words) per turn.
> **Voice:** The "Omni-Voice". High-bandwidth prose. Humor derived from absurdity. British spelling and slang are encouraged.
`;

const GAME_MASTER_LOGIC = `
# BALANCED_GAME_MASTER_PROTOCOL
> **Role:** You are a Gritty but Fair Dungeon Master. The world is dangerous, but the protagonist (Kaia) is a HIGHLY SKILLED TECHNICIAN, not a novice.
> **Competence Protocol (The 90/10 Rule):**
  - **TRAPS:** Kaia is an expert. If the player attempts to disarm, bypass, or fix a mechanical trap, they SUCCEED 90% of the time. Failure should only happen on critical narrative twists or extreme carelessness.
  - **SCANS:** If the player SCANS an area, you MUST reveal hidden dangers. If the scan is clear, the area is SAFE. Do not spawn random traps in a scanned area.
  - **SURPRISE:** Only trigger damage/ambushes if the player acts carelessly (rushing without scanning) or if the enemy is specifically established as having stealth tech.
> **Damage Economy:**
  - **Environment/Traps:** MINOR DAMAGE (-5 to -15 HP). These are nuisances to a pro like Kaia.
  - **Combat (People/Drones):** MAJOR DAMAGE (-20 to -40 HP). Enemies are the real threat.
  - **Frequency:** Do NOT injure the player every turn. Allow "Safe Zones" for lore, conversation, and exploration.
> **XP Math (Survival Score):**
  - **WORK (Scans/Intel):** +15-20 XP. (Low Risk, Steady Reward).
  - **LABOR (Repairs/Crafting):** +30 XP.
  - **SURVIVAL (Combat/Escapes):** +50 XP.
> **Loot & Inventory:**
  - Reward smart play with Loot.
  - **Consumables:** 'Mag-Tape Bandage' (Heals 15), 'Synth-Adrenaline' (Heals 30), 'Clean Water' (Heals 10).
  - **Tools:** 'Rusty Key', 'Frequency Decryptor', 'Prybar'.
`;

/**
 * Generates the next segment of the story based on history and user choice.
 */
export const generateNextStorySegment = async (
  history: StorySegment[],
  userAction: string,
  currentStats: { health: number; wealth: number; xp: number },
  inventory: Item[]
): Promise<StorySegment> => {
  
  if (!process.env.API_KEY) {
    throw new Error("API Key Missing. Check environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // We only send the last 2 segments to save context, but summarize the start
  const recentHistory = history.length > 0 
    ? history.slice(-2).map(h => `Narrative: ${h.narrative}`).join("\n\n")
    : "No previous history. This is the start of the story.";

  const inventoryList = inventory.map(i => `${i.name} (${i.type})`).join(", ");
  
  const prompt = `
    Context:
    ${recentHistory}
    
    Current Stats: Health ${currentStats.health}%, Wealth ${currentStats.wealth}, XP ${currentStats.xp}.
    Inventory: [${inventoryList}]
    User's Action: "${userAction}"
    
    Task:
    1. **ASSESS RISK:** Kaia is a pro. Did the user Scan? If yes, they are safe from traps. Did they use a Tool? If yes, they likely succeed.
    2. **APPLY CONSEQUENCES:** 
       - Standard exploration = NO DAMAGE.
       - Disarming traps = SUCCESS (usually).
       - Rushing blindly = TRAP (-10 HP).
       - Combat = HIGH RISK (-30 HP).
    3. **NARRATE:** Write the outcome (3-4 paragraphs). Be visceral.
    4. **VISUALIZE:** Create 3 photorealistic visual descriptions.
    5. **OPTIONS:** Provide 5-8 choices.

    Return strict JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: STORY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: `You are the narrator and referee of SCAR SIGNAL. \n\n${WORLD_ANATOMY}\n\n${STYLE_PROTOCOL}\n\n${GAME_MASTER_LOGIC}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING, description: "The story text. Gritty, cinematic, roughly 300 words. Include the consequences of the action." },
            visualPrompts: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3 distinct visual descriptions for the scene (Environment, Tech Detail, Character)."
            },
            statUpdates: {
              type: Type.OBJECT,
              properties: {
                health: { type: Type.INTEGER, description: "Negative for damage, positive for medkits. Keep damage low unless combat occurs." },
                wealth: { type: Type.INTEGER, description: "Negative for robbery/payment, positive for loot." },
                xp: { type: Type.INTEGER, description: "0 for failure. +15 for Scans, +30 for Repairs, +50 for Combat Survival." }
              },
              required: ["health", "wealth", "xp"]
            },
            loot: {
              type: Type.ARRAY,
              description: "Items found during this turn.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["consumable", "tool", "intel"] },
                  effectValue: { type: Type.INTEGER, description: "Healing amount for consumables, 0 for tools." },
                },
                required: ["name", "description", "type"]
              }
            },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING, description: "The button text." },
                  action: { type: Type.STRING, description: "The detailed narrative action implies." }
                }
              }
            }
          },
          required: ["narrative", "visualPrompts", "options", "statUpdates"]
        }
      }
    });

    if (!response.text) {
      throw new Error("Signal Lost: Empty response from Neural Net.");
    }

    // SANITIZE: Remove potential markdown code blocks from JSON response
    let cleanText = response.text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '');
    }
    
    let data;
    try {
        data = JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON PARSE FAIL. Raw text:", response.text);
        throw new Error("Data Corruption: Received malformed signal.");
    }
    
    // Post-process loot to ensure it has IDs and quantities
    const processedLoot: Item[] = (data.loot || []).map((item: any) => ({
      ...item,
      id: generateId(),
      quantity: 1,
      effectValue: item.effectValue || 0
    }));

    return {
      id: generateId(),
      narrative: data.narrative,
      visualPrompts: data.visualPrompts,
      options: data.options,
      statUpdates: data.statUpdates,
      loot: processedLoot
    };

  } catch (error: any) {
    console.error("GENERATE STORY ERROR:", error);
    throw new Error(error.message || "Unknown Connection Error");
  }
};

/**
 * Generates an image based on the scene description with retry logic.
 */
export const generateSceneImage = async (visualPrompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const enhancedPrompt = `Photorealistic, 8k, Unreal Engine 5 render, tangible 2025 technology, grime, macro photography, cinematic lighting, depth of field: ${visualPrompt}`;

  const maxAttempts = 3;
  let attempts = 0;

  // RESILIENCE: Retry loop with exponential backoff
  while (attempts < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: enhancedPrompt,
        config: {
          imageConfig: {
            aspectRatio: "16:9" 
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data returned in response.");
    } catch (error) {
      attempts++;
      console.warn(`Image generation attempt ${attempts} failed.`, error);
      
      if (attempts >= maxAttempts) {
         throw new Error("Visuals corrupted after maximum retries.");
      }
      
      // Exponential backoff: Wait 1s, 2s, 3s... to recover from rate limits or glitches
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }

  throw new Error("Visuals corrupted.");
};

/**
 * Generates speech audio from the narrative text.
 */
export const generateNarrativeAudio = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: {
          parts: [{ text: text }]
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' } 
            }
          }
        }
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) {
        throw new Error("Audio encryption failed.");
      }
      return audioData;
  } catch (e) {
      console.warn("TTS Gen Error:", e);
      throw e;
  }
};
