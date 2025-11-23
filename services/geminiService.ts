import { GoogleGenAI, Type, Modality } from "@google/genai";
import { StorySegment } from "../types";

// Initialize the client. API_KEY is expected to be in the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  - Kaia (Black British): "Duct Tape Cowboy", scavenger, pragmatist.
  - Riven: Kaia's partitioned ruthlessness.
  - Sera (Black British): The Apprentice.
  - Lumen (British Asian): Archivist.
  - Draven (White British): Water Baron / Villain.
> **Themes:** Maintenance as a moral act. Analog Resilience vs Digital Brittleness.
`;

const STYLE_PROTOCOL = `
# AI_STYLE_PROTOCOL_MASTER
> **Directive:** Synthesize a narrative voice that is recursive, biting, and cinematic.
> **Length:** OUTPUT MUST BE LONG-FORM. Write 3-4 paragraphs (approx 300 words) per turn to allow for 2-3 minutes of reading time.
> **Voice:** The "Omni-Voice". High-bandwidth prose. Humor derived from absurdity. British spelling and slang are encouraged.
`;

/**
 * Generates the next segment of the story based on history and user choice.
 */
export const generateNextStorySegment = async (
  history: StorySegment[],
  userAction: string,
  currentStats: { health: number; wealth: number; xp: number }
): Promise<StorySegment> => {
  
  // We only send the last 2 segments to save context, but summarize the start
  const recentHistory = history.slice(-2).map(h => `Narrative: ${h.narrative}`).join("\n\n");
  
  const prompt = `
    Context:
    ${recentHistory}
    
    Current Stats: Health ${currentStats.health}%, Wealth ${currentStats.wealth}, XP ${currentStats.xp}.
    User's Action: "${userAction}"
    
    Task:
    1. Continue the story of 'Scar Signal'. Use the Style Protocol. Write 3-4 substantial paragraphs.
    2. Create 3 DISTINCT visual descriptions for the scene (Wide shot, Close up of tech, Character portrait). Style: "Photorealistic, 2025 tech, tangible textures, cinematic lighting, 8k".
    3. Provide 5 to 8 distinct options for the player.
    4. Calculate stat changes based on the user's *previous* action result.
    
    Return strict JSON.
  `;

  const response = await ai.models.generateContent({
    model: STORY_MODEL,
    contents: prompt,
    config: {
      systemInstruction: `You are the narrator of SCAR SIGNAL. \n\n${WORLD_ANATOMY}\n\n${STYLE_PROTOCOL}`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          narrative: { type: Type.STRING, description: "The story text. Gritty, cinematic, roughly 300 words, multiple paragraphs." },
          visualPrompts: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "3 distinct visual descriptions for the scene (Environment, Tech Detail, Character)."
          },
          statUpdates: {
            type: Type.OBJECT,
            properties: {
              health: { type: Type.INTEGER, description: "Change in health (e.g. -10 or +5)" },
              wealth: { type: Type.INTEGER, description: "Change in wealth" },
              xp: { type: Type.INTEGER, description: "Change in XP (usually positive)" }
            },
            required: ["health", "wealth", "xp"]
          },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "The button text (e.g., 'Splice the wire [Requires Tool]')." },
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
    throw new Error("The signal was lost. No data received.");
  }

  const data = JSON.parse(response.text);
  
  return {
    id: crypto.randomUUID(),
    narrative: data.narrative,
    visualPrompts: data.visualPrompts,
    options: data.options,
    statUpdates: data.statUpdates
  };
};

/**
 * Generates an image based on the scene description.
 */
export const generateSceneImage = async (visualPrompt: string): Promise<string> => {
  // Enforcing realism and 2025 tech look with specific camera and texture prompts
  const enhancedPrompt = `Photorealistic, 8k, Unreal Engine 5 render, tangible 2025 technology, grime, macro photography, cinematic lighting, depth of field: ${visualPrompt}`;

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

  throw new Error("Visuals corrupted.");
};

/**
 * Generates speech audio from the narrative text.
 */
export const generateNarrativeAudio = async (text: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: {
      parts: [{ text: text }]
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          // Kore is a female voice. 
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
};