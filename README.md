# SCAR SIGNAL

> **System Status:** ONLINE
> **Version:** 1.5
> **Protocol:** Cassette Futurism / Post-Apocalyptic Survival

## 1. MISSION BRIEFING (How to Play)

Scar Signal is an infinite, AI-generated text adventure set in a gritty, magnetic-apocalypse London (circa 2025+). You play as **Kaia**, a "Duct Tape Cowboy" surviving in a world where modern "smart" technology is illegal and dangerous, and analog "dumb" technology is the only way to survive.

### Initialization
1.  Click **INITIALIZE BOOT SEQUENCE** on the start screen.
2.  Allow audio permissions if prompted (for the narrator).

### The Interface
*   **Visual Feed (Left):** Displays a rotating carousel of 3 generated images depicting the current scene, technology, and characters.
*   **Narrative Terminal (Right):** Displays the story text.
*   **Vitals (HUD):**
    *   **Health:** Your physical condition. Reaching 0% terminates the signal.
    *   **Credits:** Currency for trade and bribes.
    *   **XP:** Survival Score. Gained by working, scanning, and surviving combat.

### Controls
*   **Options:** Select one of the numbered protocols (01-08) to advance the story.
*   **Override:** Type your own custom action in the input field at the bottom to improvise.
*   **Terminate:** Click `[ TERMINATE ]` in the top right to end the session and return to the menu.

---

## 2. SYSTEM MECHANICS

### The Engine
The game uses Google's Gemini API as a dynamic "Game Master":
*   **Narrative:** Generates 3-4 paragraphs of story based on your choices.
*   **Visuals:** Generates 3 distinct photorealistic 8k images per turn (Wide Shot, Tech Detail, Character) using `gemini-2.5-flash-image`.
*   **Audio:** Synthesizes a British female voice ('Kore') for narration using `gemini-2.5-flash-preview-tts`.

### Game Rules & XP Math
*   **Smart Tech is Death:** In this world, SSDs and neural processors attract "The Static". Use magnetic tape and analog gear.
*   **XP (Experience):** 
    *   **Scans & Intel:** +15 XP (Low Risk)
    *   **Repairs & Labor:** +30 XP (Medium Risk)
    *   **Combat Survival:** +50 XP (High Risk)
    *   **Failure:** 0 XP.
*   **Consequences:** 
    *   **Traps:** Carelessness triggers traps (-20 Health).
    *   **Enemies:** Bandits will rob you (-Credits) or kill you (-Health).
*   **Permadeath:** If your Health hits 0, the narrative ends. You must Terminate and restart.

---

## 3. TECHNICAL DOCUMENTATION

### Stack
*   **Frontend:** React 19, TailwindCSS.
*   **AI:** Google GenAI SDK (`@google/genai`).
*   **Build:** Browser-native ES Modules (No bundler required for this specific setup).

### Key Files
*   `App.tsx`: Main game loop, UI rendering, image carousel logic, and state management.
*   `services/geminiService.ts`: Handles all API calls (Text, Image, Audio), prompt engineering, and response parsing.
*   `types.ts`: TypeScript interfaces for the game state and story segments.

### Development Note
This project uses an Import Map in `index.html` to load dependencies directly from a CDN. This allows the application to run immediately in modern browsers without an `npm install` build step, provided you have a valid API Key.

---
*Maintained by the Archivist Guild. End of Line.*