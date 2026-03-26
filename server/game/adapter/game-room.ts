/**
 * GameRoom: wraps the Pomax Game engine with typed events and
 * manages a 4-player room with human and bot players.
 *
 * This is the unit of isolation - one GameRoom per game.
 * It encapsulates game state, players, and voice sessions.
 *
 * Supports 1-4 human players. AI bots fill remaining seats.
 */
import { EventEmitter } from 'events';
import { GameManager, BotPlayer, Game, config, CLAIM, TILE_GLYPHS } from '../bootstrap.js';
import { buildClientState } from './state-filter.js';
import { VoiceManager } from '../../voice/voice-manager.js';
import type { GameEvent, ClientGameState, ClaimOption } from './types.js';

const CLAIM_LABELS: Record<number, string> = {
  [CLAIM.CHOW]: 'Sheung',
  [CLAIM.CHOW1]: 'Sheung',
  [CLAIM.CHOW2]: 'Sheung',
  [CLAIM.CHOW3]: 'Sheung',
  [CLAIM.PUNG]: 'Pong',
  [CLAIM.KONG]: 'Kong',
  [CLAIM.WIN]: 'Mah Jong',
  [CLAIM.PAIR]: 'Pair',
};

const ALL_BOT_PERSONAS = [
  { name: 'Grandpa', voice: 'Clive' },
  { name: 'Gladys', voice: 'Eleanor' },
  { name: 'Lucky', voice: 'Dennis' },
];

/** How long to wait for a disconnected player to reconnect before converting to bot (ms) */
const RECONNECT_TIMEOUT = 30_000;

export interface PlayerSeat {
  id: number;
  name: string;
  isBot: boolean;
  /** For remote human players, resolves pending discard/claim */
  pendingDiscard?: { resolve: (tile: any) => void } | null;
  pendingClaim?: { resolve: (claim: any) => void } | null;
  /** Send function for WebSocket messages */
  send?: (msg: any) => void;
  /** Bot persona name (only for bot seats) */
  persona?: string;
}

export interface LobbyState {
  code: string;
  seats: ({ id: number; name: string; isBot: boolean } | null)[];
  humanCount: number;
  canStart: boolean;
}

export class GameRoom extends EventEmitter {
  id: string;
  seats: (PlayerSeat | null)[];
  game: any;
  players: any[];
  private gm: any;
  phase: 'waiting' | 'playing' | 'finished' = 'waiting';
  voiceManager?: VoiceManager;
  private reconnectTimers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(roomId: string) {
    super();
    this.id = roomId;
    this.seats = [null, null, null, null];
    this.players = [];
  }

  /**
   * Add a human player to the next available seat.
   * Returns the assigned seat ID, or -1 if room is full.
   */
  addHumanPlayer(name: string, sendFn: (msg: any) => void): number {
    if (this.phase !== 'waiting') return -1;

    const seatId = this.seats.findIndex(s => s === null);
    if (seatId === -1) return -1;

    this.seats[seatId] = { id: seatId, name, isBot: false, send: sendFn };
    this._broadcastLobby();
    return seatId;
  }

  /**
   * Reconnect a human player to an existing seat (after disconnect).
   */
  reconnectPlayer(seatId: number, sendFn: (msg: any) => void): boolean {
    const seat = this.seats[seatId];
    if (!seat || seat.isBot) return false;

    // Clear reconnect timer
    const timer = this.reconnectTimers.get(seatId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(seatId);
    }

    seat.send = sendFn;

    if (this.phase === 'playing') {
      // Send current game state to reconnected player
      const state = this.getStateForPlayer(seatId);
      sendFn({ type: 'game:state', state });
    } else {
      this._broadcastLobby();
    }

    console.log(`[Room ${this.id}] Player "${seat.name}" reconnected to seat ${seatId}`);
    return true;
  }

  /**
   * Remove a human player from the room.
   * In waiting phase: removes from seat.
   * In playing phase: starts reconnection timer, then converts to bot.
   */
  removeHumanPlayer(seatId: number): void {
    const seat = this.seats[seatId];
    if (!seat || seat.isBot) return;

    if (this.phase === 'waiting') {
      this.seats[seatId] = null;
      this._broadcastLobby();
      console.log(`[Room ${this.id}] Player "${seat.name}" left lobby (seat ${seatId})`);
    } else if (this.phase === 'playing') {
      // Clear send function so we stop sending them messages
      seat.send = undefined;

      // Auto-pass any pending actions
      if (seat.pendingDiscard) {
        // Can't auto-discard safely — resolve with first available tile
        const player = this.players[seatId];
        const tiles = player?.getAvailableTiles?.();
        if (tiles?.length > 0) {
          const { resolve } = seat.pendingDiscard;
          seat.pendingDiscard = null;
          resolve(0); // discard first tile
        }
      }
      if (seat.pendingClaim) {
        seat.pendingClaim = null;
        // Auto-pass handled by claim timeout
      }

      console.log(`[Room ${this.id}] Player "${seat.name}" disconnected (seat ${seatId}), waiting ${RECONNECT_TIMEOUT / 1000}s for reconnect`);

      // Start reconnect timer
      const timer = setTimeout(() => {
        this.reconnectTimers.delete(seatId);
        this._convertToBot(seatId);
      }, RECONNECT_TIMEOUT);
      this.reconnectTimers.set(seatId, timer);
    }
  }

  /**
   * Convert a disconnected player's seat to a bot.
   */
  private _convertToBot(seatId: number) {
    const seat = this.seats[seatId];
    if (!seat || seat.isBot) return;

    console.log(`[Room ${this.id}] Converting seat ${seatId} ("${seat.name}") to bot`);
    seat.isBot = true;
    seat.send = undefined;

    // The engine player at this seat is already a BotPlayer,
    // but we patched its determineDiscard/determineClaim for human input.
    // We need to restore the original bot behavior. The simplest way:
    // create a fresh BotPlayer and copy its methods.
    const freshBot = new BotPlayer(seatId);
    const player = this.players[seatId];
    player.determineDiscard = freshBot.determineDiscard.bind(player);
    player.determineClaim = freshBot.determineClaim.bind(player);

    this._broadcastState();
  }

  /**
   * Fill remaining seats with bots and start the game.
   * Only callable from 'waiting' phase.
   */
  async fillBotsAndStart(): Promise<void> {
    if (this.phase !== 'waiting') return;

    const humanCount = this.seats.filter(s => s !== null).length;
    if (humanCount === 0) return;

    // Randomly select bot personas for empty seats
    const availablePersonas = [...ALL_BOT_PERSONAS];
    for (let i = availablePersonas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availablePersonas[i], availablePersonas[j]] = [availablePersonas[j], availablePersonas[i]];
    }

    let personaIdx = 0;
    for (let i = 0; i < 4; i++) {
      if (this.seats[i] === null) {
        const persona = availablePersonas[personaIdx++];
        this.seats[i] = { id: i, name: persona.name, isBot: true, persona: persona.name };
      }
    }

    // Create engine players for all seats
    this.players = this.seats.map((seat, idx) => {
      const p = new BotPlayer(idx);
      (p as any).playerName = seat!.name;
      (p as any).isBot = seat!.isBot;
      return p;
    });

    // Patch all human players
    for (const seat of this.seats) {
      if (seat && !seat.isBot) {
        this._patchHumanPlayer(seat.id);
      }
    }

    // Notify all players game is starting
    for (const seat of this.seats) {
      if (seat && !seat.isBot && seat.send) {
        seat.send({ type: 'lobby:started' });
      }
    }

    await this.start();
  }

  /** Whether room has 4 humans (full, no bots needed). */
  isFull(): boolean {
    return this.seats.filter(s => s !== null).length >= 4;
  }

  /** Get human seat IDs. */
  get humanSeats(): number[] {
    return this.seats
      .filter((s): s is PlayerSeat => s !== null && !s.isBot)
      .map(s => s.id);
  }

  /** Get bot seat IDs. */
  get botSeats(): number[] {
    return this.seats
      .filter((s): s is PlayerSeat => s !== null && s.isBot)
      .map(s => s.id);
  }

  /**
   * Broadcast lobby state to all connected humans.
   */
  _broadcastLobby(): void {
    const state = this.getLobbyState();
    for (const seat of this.seats) {
      if (seat && !seat.isBot && seat.send) {
        seat.send({ type: 'lobby:state', state });
      }
    }
  }

  getLobbyState(): LobbyState {
    return {
      code: this.id,
      seats: this.seats.map(s => s ? { id: s.id, name: s.name, isBot: s.isBot } : null),
      humanCount: this.seats.filter(s => s !== null && !s.isBot).length,
      canStart: this.seats.filter(s => s !== null).length >= 1,
    };
  }

  /**
   * Patches a player to wait for external input (WebSocket) instead of using bot logic.
   */
  private _patchHumanPlayer(seatId: number) {
    const player = this.players[seatId];
    const seat = this.seats[seatId]!;
    const self = this;

    // Override determineDiscard to wait for human input
    const originalDetermineDiscard = player.determineDiscard.bind(player);
    player.determineDiscard = function(tilesRemaining: number, resolve: Function) {
      // If player disconnected and became a bot, use bot logic
      if (seat.isBot) {
        return originalDetermineDiscard(tilesRemaining, resolve);
      }

      // Check if already won (same logic as BotPlayer)
      if (player.has_won) return resolve(undefined);

      // Check for win condition
      const tiles = player.getAvailableTiles();
      if (!tiles.length) return resolve(undefined);

      const { winpaths } = player.tilesNeeded();
      if (winpaths.length > 0 && player.personality.isValidWin(tilesRemaining)) {
        if (!player.lastClaim) player.selfdraw = true;
        return resolve(undefined);
      }

      // Set pending BEFORE broadcast so state includes myTurnAction: 'discard'
      seat.pendingDiscard = {
        resolve: (tileIndex: number) => {
          const tile = player.tiles[tileIndex];
          if (tile) {
            resolve(tile);
          }
        }
      };

      // Broadcast state so the human sees their hand
      self._broadcastState();

      // Send prompt to human client
      self._emitGameEvent({
        type: 'turn:prompt',
        playerId: seatId,
        data: { action: 'discard' },
      });
    };

    // Override determineClaim to wait for human input
    player.determineClaim = function(
      pid: number, discard: any, tilesRemaining: number,
      resolve: Function, interrupt: Function, claimTimer: any
    ) {
      // If player disconnected and became a bot, use bot logic
      if (seat.isBot) {
        const freshBot = new BotPlayer(seatId);
        return freshBot.determineClaim.call(player, pid, discard, tilesRemaining, resolve, interrupt, claimTimer);
      }

      // Build claim options based on bot's lookout analysis
      const { lookout, waiting } = player.tilesNeeded();
      const tile = discard.getTileFace();
      const mayChow = player.mayChow(pid);
      const options: ClaimOption[] = [];

      if (lookout[tile]) {
        const claims = lookout[tile];
        for (const print of claims) {
          const type = parseInt(print);
          if (type >= CLAIM.CHOW && type <= CLAIM.CHOW3 && !mayChow) continue;
          if (type === CLAIM.WIN || type >= CLAIM.PUNG || (type >= CLAIM.CHOW && mayChow)) {
            const label = CLAIM_LABELS[type] || `Claim ${type}`;
            if (!options.find(o => o.label === label)) {
              options.push({ claimtype: type, label });
            }
          }
        }
      }

      // Check for win
      if (waiting) {
        const winTiles: any = {};
        lookout.forEach((list: any, tn: number) => {
          if (list) {
            const winList = list.filter((v: string) => v.indexOf('32') === 0);
            if (winList.length) winTiles[tn] = winList;
          }
        });
        if (winTiles[tile]) {
          if (!options.find(o => o.claimtype === CLAIM.WIN)) {
            options.push({ claimtype: CLAIM.WIN, label: 'Mah Jong!' });
          }
        }
      }

      if (options.length === 0) {
        return resolve({ claimtype: CLAIM.IGNORE });
      }

      // Set pending BEFORE broadcast so state includes myTurnAction: 'claim'
      seat.pendingClaim = {
        resolve: (claimtype: number) => {
          if (claimtype === CLAIM.IGNORE || claimtype === 0) {
            resolve({ claimtype: CLAIM.IGNORE });
          } else {
            let wintype: number | undefined;
            if (claimtype === CLAIM.WIN && waiting) {
              const winTiles: any = {};
              lookout.forEach((list: any, tn: number) => {
                if (list) {
                  const wl = list.filter((v: string) => v.indexOf('32') === 0);
                  if (wl.length) winTiles[tn] = wl;
                }
              });
              if (winTiles[tile]) {
                const ways = winTiles[tile].map((v: string) => parseInt(v.substring(3))).sort((a: number, b: number) => b - a);
                wintype = ways[0];
              }
            }
            resolve({ claimtype, wintype });
          }
        }
      };

      // Broadcast state and send claim prompt to human
      self._broadcastState();
      self._emitGameEvent({
        type: 'turn:prompt',
        playerId: seatId,
        data: { action: 'claim', options, tile: tile },
      });

      // Timeout: auto-pass if human doesn't respond
      setTimeout(() => {
        if (seat.pendingClaim) {
          seat.pendingClaim = null;
          resolve({ claimtype: CLAIM.IGNORE });
        }
      }, config.CLAIM_INTERVAL);
    };
  }

  /**
   * Handle human player's discard choice.
   */
  onHumanDiscard(seatId: number, tileIndex: number) {
    const seat = this.seats[seatId];
    if (seat?.pendingDiscard) {
      const { resolve } = seat.pendingDiscard;
      seat.pendingDiscard = null;
      resolve(tileIndex);
    }
  }

  /**
   * Handle human player's claim choice.
   */
  onHumanClaim(seatId: number, claimtype: number) {
    const seat = this.seats[seatId];
    if (seat?.pendingClaim) {
      const { resolve } = seat.pendingClaim;
      seat.pendingClaim = null;
      resolve(claimtype);
    }
  }

  /**
   * Handle human passing on a claim.
   */
  onHumanPass(seatId: number) {
    this.onHumanClaim(seatId, CLAIM.IGNORE);
  }

  /**
   * Start the game.
   */
  async start() {
    if (this.phase !== 'waiting') return;
    this.phase = 'playing';

    // Configure for server-side play
    config.SEED = Date.now() % 2147483647;
    config.PRNG.seed(config.SEED);
    config.BOT_PLAY = false; // We have human player(s)
    config.PLAY_INTERVAL = 2400;
    config.HAND_INTERVAL = 0;
    config.BOT_PLAY_DELAY = 800;
    config.BOT_DELAY_BEFORE_DISCARD_ENDS = 1500;
    config.CLAIM_INTERVAL = 15000;
    config.ARTIFICIAL_BOT_DELAY = 1200;
    config.RULES = 'Cantonese';

    this.gm = new GameManager(this.players);
    this.game = this.gm.newGame();

    // Hook into game events by overriding player methods
    this._hookGameEvents();

    // Initialize voice manager (non-blocking)
    const humanSeatIds = this.humanSeats;
    const botSeatIds = this.botSeats;

    this.voiceManager = new VoiceManager((msg) => {
      for (const seat of this.seats) {
        if (seat && !seat.isBot && seat.send) seat.send(msg);
      }
    });

    const playerNames = this.seats.map(s => s!.name);
    this.voiceManager.initialize(playerNames, humanSeatIds, botSeatIds).catch(err => {
      console.error('[Voice] Initialization failed:', err);
    });

    this.game.startGame((secondsTaken: number) => {
      this.phase = 'finished';
      const scores = this.players.map((p: any) => (p as any)._score);
      this._emitGameEvent({
        type: 'game:end',
        scores,
        data: { secondsTaken, hands: this.game.scoreHistory.length },
      });
    });
  }

  /**
   * Hook into the game engine to emit events at key moments.
   */
  private _hookGameEvents() {
    const originalProcessDiscard = this.game.processDiscard.bind(this.game);
    this.game.processDiscard = async (player: any) => {
      await originalProcessDiscard(player);
      const tile = this.game.discard?.getTileFace?.();
      this._emitGameEvent({
        type: 'turn:discard',
        playerId: player.id,
        tile,
      });
      this._broadcastState();
    };

    const originalDealTile = this.game.dealTile.bind(this.game);
    this.game.dealTile = async (player: any) => {
      const result = await originalDealTile(player);
      this._emitGameEvent({
        type: 'turn:draw',
        playerId: player.id,
      });
      this._broadcastState();
      return result;
    };

    const originalProcessClaim = this.game.processClaim.bind(this.game);
    this.game.processClaim = (player: any, claim: any) => {
      const tile = this.game.discard?.getTileFace?.();
      this._emitGameEvent({
        type: 'turn:claim',
        playerId: claim.p,
        tile,
        claimType: claim.claimtype,
      });
      this._broadcastState();
      return originalProcessClaim(player, claim);
    };

    const originalProcessWin = this.game.processWin.bind(this.game);
    this.game.processWin = async (player: any, discardpid: any) => {
      this._emitGameEvent({
        type: 'hand:win',
        playerId: player.id,
        winner: player.id,
        hand: this.game.hand,
      });
      return originalProcessWin(player, discardpid);
    };
  }

  /**
   * Emit a game event to all listeners.
   */
  private _emitGameEvent(event: GameEvent) {
    this.emit('game:event', event);

    for (const seat of this.seats) {
      if (seat && !seat.isBot && seat.send) {
        seat.send({ type: 'game:event', event });
      }
    }

    this.voiceManager?.onGameEvent(event);
  }

  /**
   * Broadcast current game state to all connected human players.
   */
  private _broadcastState() {
    for (const seat of this.seats) {
      if (seat && !seat.isBot && seat.send) {
        const state = this.getStateForPlayer(seat.id);
        seat.send({ type: 'game:state', state });
      }
    }
  }

  /**
   * Get filtered game state for a specific player.
   */
  getStateForPlayer(playerId: number): ClientGameState {
    const seat = this.seats[playerId];
    return buildClientState(
      this.game,
      this.players,
      playerId,
      seat?.pendingDiscard ? 'discard' : seat?.pendingClaim ? 'claim' : null,
      null,
    );
  }
}
