/**
 * Server-side config for Pomax mahjong engine.
 * Replaces the browser-dependent original config.
 */
import "./game/engine/node-shim.js";
import { Random } from "./game/engine/utils/prng.js";

const noop = () => {};

// Constants used during play
const CLAIM = {
  IGNORE: 0,
  PAIR: 1,
  CHOW: 2,
  CHOW1: 4,
  CHOW2: 5,
  CHOW3: 6,
  PUNG: 8,
  KONG: 16,
  SET: 30,
  WIN: 32,
};

const Constants = {
  PAIR: CLAIM.PAIR,
  CHOW: CLAIM.CHOW,
  CHOW1: CLAIM.CHOW1,
  CHOW2: CLAIM.CHOW2,
  CHOW3: CLAIM.CHOW3,
  PUNG: CLAIM.PUNG,
  KONG: CLAIM.KONG,
  SET: CLAIM.SET,
  WIN: CLAIM.WIN,
};

const TILE_NAMES = {
  0: "bamboo 1", 1: "bamboo 2", 2: "bamboo 3", 3: "bamboo 4",
  4: "bamboo 5", 5: "bamboo 6", 6: "bamboo 7", 7: "bamboo 8", 8: "bamboo 9",
  9: "characters 1", 10: "characters 2", 11: "characters 3", 12: "characters 4",
  13: "characters 5", 14: "characters 6", 15: "characters 7", 16: "characters 8", 17: "characters 9",
  18: "dots 1", 19: "dots 2", 20: "dots 3", 21: "dots 4",
  22: "dots 5", 23: "dots 6", 24: "dots 7", 25: "dots 8", 26: "dots 9",
  27: "east", 28: "south", 29: "west", 30: "north",
  31: "green dragon", 32: "red dragon", 33: "white dragon",
  34: "flower 1", 35: "flower 2", 36: "flower 3", 37: "flower 4",
  38: "season 1", 39: "season 2", 40: "season 3", 41: "season 4",
};

const TILE_GLYPHS = {
  0: "b1", 1: "b2", 2: "b3", 3: "b4", 4: "b5", 5: "b6", 6: "b7", 7: "b8", 8: "b9",
  9: "c1", 10: "c2", 11: "c3", 12: "c4", 13: "c5", 14: "c6", 15: "c7", 16: "c8", 17: "c9",
  18: "d1", 19: "d2", 20: "d3", 21: "d4", 22: "d5", 23: "d6", 24: "d7", 25: "d8", 26: "d9",
  27: "E", 28: "S", 29: "W", 30: "N",
  31: "F", 32: "C", 33: "P",
  34: "f1", 35: "f2", 36: "f3", 37: "f4",
  38: "s1", 39: "s2", 40: "s3", 41: "s4",
};

const SUIT_NAMES = {
  0: "bamboo", 1: "characters", 2: "dots", 3: "winds", 4: "dragons", 5: "bonus",
};

const playlog = {
  lines: [],
  log: (text) => {
    if (typeof text !== "string") text = text.toString();
    playlog.lines.push(text);
  },
  flush: () => { playlog.lines = []; },
};

const config = {
  DEBUG: false,
  USE_SOUND: false,
  SEED: 0,
  RULES: `Cantonese`,
  PLAY_IMMEDIATELY: true,
  PAUSE_ON_BLUR: false,
  FORCE_DRAW: false,
  FORCE_OPEN_BOT_PLAY: false,
  SHOW_CLAIM_SUGGESTION: false,
  SHOW_BOT_SUGGESTION: false,
  BOT_CHICKEN_THRESHOLD: 0.0008,
  CLAIM_INTERVAL: 5000,
  PLAY_INTERVAL: 0,
  HAND_INTERVAL: 0,
  BOT_DELAY_BEFORE_DISCARD_ENDS: 0,
  BOT_PLAY_DELAY: 0,
  WALL_HACK: "",
  WRITE_GAME_LOG: false,
  PRNG: new Random(1),
  log: playlog.log,
  flushLog: playlog.flush,
  START_OVERRIDE_SEED: 0,
  START_ON_HAND: 0,
  PAUSE_ON_HAND: 0,
  START_ON_DRAWS: 0,
  PAUSE_ON_DRAW: 0,
  PAUSE_ON_PLAY: 0,
  BOT_PLAY: true,
  ARTIFICIAL_BOT_DELAY: 0,
  LOSERS_SETTLE_SCORES: true,
  CLAIM,
  Constants,
  TILE_NAMES,
  TILE_GLYPHS,
  SUIT_NAMES,
  DEFAULT_CONFIG: {},
  set: (opt) => {
    Object.keys(opt).forEach((key) => {
      if (typeof config[key] !== "undefined") {
        config[key] = opt[key];
      }
    });
  },
  convertSubtypeToClaim: (diff) => {
    if (diff === -1) return CLAIM.CHOW3;
    if (diff === 1) return CLAIM.CHOW2;
    if (diff === 2) return CLAIM.CHOW1;
    return diff;
  },
};

export { config, CLAIM, Constants, TILE_NAMES, TILE_GLYPHS, SUIT_NAMES };
