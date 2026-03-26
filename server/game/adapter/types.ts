/**
 * Types for the game adapter layer.
 */

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

export interface ClaimOption {
  claimtype: number;
  label: string;
}

// Events emitted by GameRoom
export type GameEventType =
  | 'hand:start'
  | 'turn:draw'
  | 'turn:discard'
  | 'turn:claim'
  | 'hand:win'
  | 'hand:draw'
  | 'game:end'
  | 'turn:prompt';

export interface GameEvent {
  type: GameEventType;
  playerId?: number;
  tile?: number;
  claimType?: number;
  claimTiles?: number[];
  scores?: number[];
  winner?: number;
  hand?: number;
  data?: any;
}

// Lobby types
export interface LobbyState {
  code: string;
  seats: ({ id: number; name: string; isBot: boolean } | null)[];
  humanCount: number;
  canStart: boolean;
}

// WebSocket protocol messages
export type ClientMessage =
  | { type: 'join'; playerName: string; roomCode?: string }
  | { type: 'start' }
  | { type: 'discard'; tileIndex: number }
  | { type: 'claim'; claimtype: number }
  | { type: 'pass' }
  | { type: 'ready' };

export type ServerMessage =
  | { type: 'game:joined'; roomCode: string; seatId: number; players: any[] }
  | { type: 'lobby:state'; state: LobbyState }
  | { type: 'lobby:started' }
  | { type: 'game:state'; state: ClientGameState }
  | { type: 'turn:prompt'; action: 'discard' | 'claim'; options?: ClaimOption[] }
  | { type: 'game:event'; event: GameEvent }
  | { type: 'voice:audio'; agentId: number; audio: string }
  | { type: 'voice:transcript'; agentId: number; text: string; final: boolean }
  | { type: 'voice:human_transcript'; text: string; seatId?: number; playerName?: string }
  | { type: 'voice:interrupt'; agentId: number }
  | { type: 'error'; message: string };
