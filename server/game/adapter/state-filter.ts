/**
 * Filters game state to produce per-player views.
 * Each player can only see their own concealed tiles.
 */
import type { ClientGameState, PlayerPublicInfo, ClaimOption } from './types.js';
import { CLAIM } from '../../config.js';

const WIND_NAMES = ['East', 'South', 'West', 'North'];
const CLAIM_LABELS: Record<number, string> = {
  [CLAIM.CHOW]: 'Chow',
  [CLAIM.CHOW1]: 'Chow',
  [CLAIM.CHOW2]: 'Chow',
  [CLAIM.CHOW3]: 'Chow',
  [CLAIM.PUNG]: 'Pung',
  [CLAIM.KONG]: 'Kong',
  [CLAIM.WIN]: 'Win',
  [CLAIM.PAIR]: 'Pair',
};

/**
 * Get the tile face number from a tile object or number.
 */
function getTileFace(t: any): number {
  if (typeof t === 'number') return t;
  if (t && typeof t.getTileFace === 'function') return t.getTileFace();
  if (t && t.dataset) return parseInt(t.dataset.tile);
  if (t && t.values) return t.values.tile;
  return -1;
}

/**
 * Extract locked set as array of tile face numbers.
 */
function getLockedSet(set: any[]): number[] {
  return set.map(getTileFace).filter(n => n >= 0).sort((a, b) => a - b);
}

/**
 * Build a per-player filtered view of the game state.
 */
export function buildClientState(
  game: any,
  players: any[],
  viewingPlayerId: number,
  pendingAction: 'discard' | 'claim' | null = null,
  claimOptions: ClaimOption[] | null = null,
): ClientGameState {
  const viewer = players[viewingPlayerId];

  const playerInfos: PlayerPublicInfo[] = players.map((p, idx) => ({
    id: idx,
    name: p.playerName || `Player ${idx}`,
    isAI: p.isBot !== false,
    wind: p.wind ?? 0,
    locked: (p.locked || []).map(getLockedSet),
    bonus: (p.bonus || []).map((b: any) => typeof b === 'number' ? b : getTileFace(b)),
    discards: (p.discards || []).map(getTileFace),
    tileCount: (p.tiles || []).length,
    score: p._score ?? 0,
    isCurrentTurn: game ? (game.currentPlayerId === idx) : false,
  }));

  // Build sorted hand and find the index of the latest drawn tile
  const handTiles = (viewer.tiles || []);
  const sortedIndices = handTiles
    .map((t: any, i: number) => ({ face: getTileFace(t), origIdx: i }))
    .sort((a: any, b: any) => a.face - b.face);
  const myHand = sortedIndices.map((s: any) => s.face);
  const myHandOriginalIndices = sortedIndices.map((s: any) => s.origIdx);

  // Find which sorted index corresponds to the latest drawn tile
  let lastDrawnIndex: number | null = null;
  if (viewer.latest) {
    const latestOrigIdx = handTiles.indexOf(viewer.latest);
    if (latestOrigIdx >= 0) {
      lastDrawnIndex = sortedIndices.findIndex((s: any) => s.origIdx === latestOrigIdx);
    }
  }

  return {
    phase: game?.GAME_START ? (game.windOfTheRound >= 4 ? 'finished' : 'playing') : 'lobby',
    myHand,
    myHandOriginalIndices,
    myLocked: (viewer.locked || []).map(getLockedSet),
    myBonus: (viewer.bonus || []).map((b: any) => typeof b === 'number' ? b : getTileFace(b)),
    players: playerInfos,
    currentTurn: game?.currentPlayerId ?? 0,
    wallRemaining: game?.wall?.remaining ?? 0,
    myTurnAction: pendingAction,
    claimOptions,
    scores: players.map(p => p._score ?? 0),
    hand: game?.hand ?? 0,
    wind: game?.wind ?? 0,
    windOfTheRound: game?.windOfTheRound ?? 0,
    lastDrawnIndex,
  };
}
