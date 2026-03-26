/**
 * Bootstrap file for the Pomax mahjong engine in Node.js.
 * Import this ONCE before using any engine code.
 * It sets up the DOM shim, config, and registers scoring rulesets.
 */

// 1. DOM shim (sets up globals: document, HTMLElement, customElements, etc.)
import "./engine/node-shim.js";

// 2. Config is available via normal imports from "../config.js" or "../../config.js"
// (the engine files import it at their own relative paths)

// 3. Register scoring rulesets (they import config internally and self-register via Ruleset.register)
import "./engine/scoring/cantonese.js";
import "./engine/scoring/chinese-classical.js";

// Re-export the key engine pieces for convenience
export { GameManager } from "./engine/game/game-manager.js";
export { Game } from "./engine/game/game.js";
export { BotPlayer } from "./engine/players/bot.js";
export { Player } from "./engine/players/player.js";
export { Wall } from "./engine/game/wall/wall.js";
export { config, CLAIM, TILE_NAMES, TILE_GLYPHS } from "../config.js";
