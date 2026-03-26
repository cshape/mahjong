export interface PlayerPublicInfo {
  id: number;
  name: string;
  isAI: boolean;
  wind: number;
  locked: number[][];
  bonus: number[];
  discards: number[];
  tileCount: number;
  score: number;
  isCurrentTurn: boolean;
}

export interface ClaimOption {
  claimtype: number;
  label: string;
}

export interface ClientGameState {
  phase: 'lobby' | 'playing' | 'hand_end' | 'finished';
  myHand: number[];
  /** Maps sorted hand index → original engine tile index (for discard) */
  myHandOriginalIndices: number[];
  myLocked: number[][];
  myBonus: number[];
  players: PlayerPublicInfo[];
  currentTurn: number;
  wallRemaining: number;
  myTurnAction: 'discard' | 'claim' | null;
  claimOptions: ClaimOption[] | null;
  scores: number[];
  hand: number;
  wind: number;
  windOfTheRound: number;
  lastDrawnIndex: number | null;
}

export interface GameEvent {
  type: string;
  playerId?: number;
  tile?: number;
  claimType?: number;
  scores?: number[];
  winner?: number;
  hand?: number;
  data?: any;
}

export interface LobbyState {
  code: string;
  seats: ({ id: number; name: string; isBot: boolean } | null)[];
  humanCount: number;
  canStart: boolean;
}

export interface JoinedMessage {
  type: 'game:joined';
  roomCode: string;
  seatId: number;
  players: ({ id: number; name: string; isBot: boolean } | null)[];
}

export type ServerMessage =
  | { type: 'game:state'; state: ClientGameState }
  | { type: 'game:event'; event: GameEvent }
  | JoinedMessage
  | { type: 'lobby:state'; state: LobbyState }
  | { type: 'lobby:started' }
  | { type: 'voice:audio'; agentId: number; audio: string }
  | { type: 'voice:transcript'; agentId: number; text: string; final: boolean }
  | { type: 'voice:human_transcript'; text: string; seatId?: number; playerName?: string }
  | { type: 'voice:interrupt'; agentId: number }
  | { type: 'voice:speaking'; agentId: number }
  | { type: 'error'; message: string };

// Tile display constants
export const TILE_GLYPHS: Record<number, string> = {
  0: 'b1', 1: 'b2', 2: 'b3', 3: 'b4', 4: 'b5', 5: 'b6', 6: 'b7', 7: 'b8', 8: 'b9',
  9: 'c1', 10: 'c2', 11: 'c3', 12: 'c4', 13: 'c5', 14: 'c6', 15: 'c7', 16: 'c8', 17: 'c9',
  18: 'd1', 19: 'd2', 20: 'd3', 21: 'd4', 22: 'd5', 23: 'd6', 24: 'd7', 25: 'd8', 26: 'd9',
  27: 'E', 28: 'S', 29: 'W', 30: 'N',
  31: 'F', 32: 'C', 33: 'P',
  34: 'f1', 35: 'f2', 36: 'f3', 37: 'f4',
  38: 's1', 39: 's2', 40: 's3', 41: 's4',
};

export const TILE_NAMES: Record<number, string> = {
  0: '🀐', 1: '🀑', 2: '🀒', 3: '🀓', 4: '🀔', 5: '🀕', 6: '🀖', 7: '🀗', 8: '🀘',
  9: '🀇', 10: '🀈', 11: '🀉', 12: '🀊', 13: '🀋', 14: '🀌', 15: '🀍', 16: '🀎', 17: '🀏',
  18: '🀙', 19: '🀚', 20: '🀛', 21: '🀜', 22: '🀝', 23: '🀞', 24: '🀟', 25: '🀠', 26: '🀡',
  27: '🀀', 28: '🀁', 29: '🀂', 30: '🀃',
  31: '🀅', 32: '🀄', 33: '🀆',
  34: '🏵1', 35: '🏵2', 36: '🏵3', 37: '🏵4',
  38: '🌸1', 39: '🌸2', 40: '🌸3', 41: '🌸4',
};

export const WIND_NAMES = ['East', 'South', 'West', 'North'];

export const CLAIM = {
  IGNORE: 0, PAIR: 1, CHOW: 2, CHOW1: 4, CHOW2: 5, CHOW3: 6,
  PUNG: 8, KONG: 16, WIN: 32,
};
