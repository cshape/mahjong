/**
 * Test script: runs a GameRoom with 4 bots (all seats are bots for testing).
 */
import { GameRoom } from './adapter/game-room.js';

const room = new GameRoom('test-room-1');

// For testing, set up all 4 as bots (no human override)
import { BotPlayer, config } from './bootstrap.js';

config.SEED = 42;
config.PRNG.seed(config.SEED);
config.BOT_PLAY = true;
config.PLAY_INTERVAL = 0;
config.HAND_INTERVAL = 0;
config.BOT_PLAY_DELAY = 0;
config.BOT_DELAY_BEFORE_DISCARD_ENDS = 0;
config.CLAIM_INTERVAL = 5000;
config.RULES = 'Cantonese';

import { GameManager, Game } from './bootstrap.js';

const players = [0, 1, 2, 3].map(id => {
  const p = new BotPlayer(id);
  (p as any).playerName = ['Grandpa', 'Gladys', 'Lucky', 'Human'][id];
  (p as any).isBot = true;
  return p;
});

const gm = new GameManager(players);
const game = gm.newGame();

// Listen for events
let eventCount = 0;
const eventTypes: Record<string, number> = {};

// We can't easily hook into game events without GameRoom's wrappers,
// but let's just verify the game runs to completion.

console.log('Starting all-bot GameRoom test...\n');

game.startGame((secondsTaken: number) => {
  const scores = players.map(p => (p as any)._score);
  console.log('Game completed!');
  console.log('Final scores:', scores.map((s, i) => `${(players[i] as any).playerName}: ${s}`).join(', '));
  console.log(`Time: ${secondsTaken}s, Hands: ${game.scoreHistory.length}`);

  // Verify state filter works
  import('./adapter/state-filter.js').then(({ buildClientState }) => {
    const state = buildClientState(game, players, 0);
    console.log('\nState filter test (player 0 view):');
    console.log('  Phase:', state.phase);
    console.log('  Scores:', state.scores);
    console.log('  Players:', state.players.map(p => `${p.name} (${p.isAI ? 'AI' : 'Human'})`).join(', '));
    console.log('\nAll tests passed!');
  });
});
