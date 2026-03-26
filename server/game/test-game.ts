/**
 * Test script: runs a full 4-bot mahjong game and prints results.
 * Usage: npm run game:test
 */
import { GameManager, BotPlayer, config, TILE_GLYPHS } from './bootstrap.js';

// Configure for fast bot play
config.SEED = 1;
config.PRNG.seed(config.SEED);
config.BOT_PLAY = true;
config.PLAY_INTERVAL = 0;
config.HAND_INTERVAL = 0;
config.BOT_PLAY_DELAY = 0;
config.BOT_DELAY_BEFORE_DISCARD_ENDS = 0;
config.RULES = 'Cantonese';

console.log('Starting 4-bot mahjong game (Cantonese rules)...\n');

const players = [0, 1, 2, 3].map(id => new BotPlayer(id));
const gm = new GameManager(players);
const game = gm.newGame();

game.startGame((secondsTaken: number) => {
  const history = game.scoreHistory;
  const mapfn = (t: any) => TILE_GLYPHS[t.dataset ? t.dataset.tile : t] || `?${t}`;

  console.log('\n=== GAME RESULTS ===\n');

  history.forEach((entry: any, hand: number) => {
    console.log(`Hand ${hand + 1}:`);
    entry.fullDisclosure.forEach((data: any, pid: number) => {
      const concealed = data.concealed.sort().map(mapfn).join(',');
      const locked = data.locked.map((set: any[]) => set.map(mapfn)).join(', ');
      const bonus = data.bonus.map(mapfn).join(',');
      const pattern = `${concealed.length ? `${concealed} ` : ''}${locked.length ? `[${locked}] ` : ''}${bonus.length ? `(${bonus})` : ''}`;
      const wind = ['E', 'S', 'W', 'N'][data.wind];
      const adj = entry.adjustments[pid];
      console.log(`  P${pid} (${wind}): ${adj >= 0 ? '+' : ''}${adj} for ${pattern}`);
    });
    console.log();
  });

  console.log('Final scores:');
  players.forEach(p => {
    console.log(`  Player ${p.id}: ${(p as any)._score}`);
  });

  console.log(`\nGame completed in ${secondsTaken}s, ${history.length} hands played.`);
});
