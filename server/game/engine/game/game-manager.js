import { BotPlayer } from "../players/bot.js";
import { Game } from "./game.js";
import { config } from "../../../config.js";


/**
 * Server-side Game object builder. No HumanPlayer or DOM references.
 */
class GameManager {
  constructor(players) {
    this.players = players || [
      new BotPlayer(0),
      new BotPlayer(1),
      new BotPlayer(2),
      new BotPlayer(3),
    ];
  }

  newGame() {
    let game = new Game(this.players);
    return game;
  }
}

export { GameManager };
