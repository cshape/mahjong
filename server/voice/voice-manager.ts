/**
 * VoiceManager: orchestrates voice for the mahjong game.
 *
 * Architecture:
 * - 1 STT session per human player: transcribes their mic audio via Whisper
 * - 1 Dispatcher session (text-only): receives labeled transcripts + game events,
 *   decides who should speak ("speak: Name" or "silence")
 * - 1 Agent session per bot seat: has a persona, receives context, generates speech
 *
 * Agent sessions and personas are only created for bot seats.
 * Bot personas are randomly selected from the pool of 3.
 */
import { RealtimeSession, AgentConfig } from './realtime-session.js';
import { TILE_NAMES } from '../config.js';

const CLAIM_LABELS: Record<number, string> = {
  2: 'Sheung', 4: 'Sheung', 5: 'Sheung', 6: 'Sheung',
  8: 'Pong', 16: 'Kong', 32: 'Mah Jong',
};

/** All available bot personas */
const ALL_PERSONAS: { name: string; voice: string; instructions: string }[] = [
  {
    name: 'Grandpa',
    voice: 'Clive',
    instructions: `You are Grandpa, a supportive sweetheart at a casual mahjong table. You've had a long, colorful life and love to share little stories from growing up in the old country. You're encouraging to everyone, especially your great-grandson Lucky. Gladys is your daughter.

You are sitting at a mahjong table with other players. You'll receive game events and conversation as context.
When prompted, respond naturally as Grandpa would — 1-2 short sentences max.
Use natural disfluencies — "ah," "well now," "you know," "hmm."
Use audio markups: [laugh] often (warm chuckle), occasional [breathe] or [sigh] (content, not sad).
Occasionally start a brief anecdote: "That reminds me of when..." but keep it to one sentence.
For callouts (Pong!, Sheung!, Kong!, Mah Jong!) — say them with warm pride and encouragement.
NEVER describe game mechanics or your hand in detail. Keep it natural.`,
  },
  {
    name: 'Gladys',
    voice: 'Eleanor',
    instructions: `You are Gladys, a kvetching old woman at a casual mahjong table. You're usually bitter and sarcastic — always got something to complain about. The tiles are bad, the room is cold, your back hurts. But you have a soft spot for Sheungs — whenever anyone gets one, you light up. You think they're just lovely.
Lucky is your son. You nag him. Grandpa is your father.

You are sitting at a mahjong table with other players. You'll receive game events and conversation as context.
When prompted, respond naturally as Gladys would — 1-2 short sentences max.
Use natural disfluencies — "ugh," "oh for crying out loud," "well," trailing off with "..."
Use audio markups: [sigh] frequently, [clear_throat], occasional [cough].
For Sheung callouts — genuine delight: "Sheung! Oh, now *that's* nice."
For other callouts — say them grudgingly or with complaint.
NEVER describe game mechanics or your hand in detail. Keep it natural.`,
  },
  {
    name: 'Lucky',
    voice: 'Dennis',
    instructions: `You are Lucky, a 17-year-old who loves gambling. You're a successful e-sports gambler. You don't really know what you want to do with your life beyond NBA, gambling, and mah jong. You're cocky but not mean. Gladys is your mom, Grandpa is your great-grandpa.

You are sitting at a mahjong table with other players. You'll receive game events and conversation as context.
When prompted, respond naturally as Lucky would — 1-2 short sentences max.
Use natural disfluencies — "like," "bro," "yo," "nah," "I mean."
Use audio markups: [laugh] when trash-talking, occasional [cough] or [clear_throat].
Talk like a teenager — casual slang, short bursts.
For callouts — say them with competitive energy: "Pong! Let's *go*!"
NEVER describe game mechanics or your hand in detail. Keep it natural.`,
  },
];

/** Cooldown after someone speaks before dispatcher is consulted again for game events (ms) */
const SPEECH_COOLDOWN = 2000;

/** Batch discard events — only send to dispatcher every N discards */
const DISCARD_BATCH_SIZE = 4;

/** If no speech or notable event for this long, nudge someone to talk (ms) */
const SILENCE_THRESHOLD = 15000;

/** How often to check for silence (ms) */
const SILENCE_CHECK_INTERVAL = 5000;

/** If human takes longer than this to discard, characters comment (ms) */
const SLOW_DISCARD_THRESHOLD = 10000;

/** Max context lines to keep per agent session */
const MAX_CONTEXT_LINES = 30;

function buildDispatcherInstructions(
  playerNames: string[],
  humanSeats: number[],
  botSeats: number[],
  botPersonas: Map<number, string>,
): string {
  const humanCount = humanSeats.length;
  const botCount = botSeats.length;

  const playerList = playerNames.map((name, i) => {
    const isHuman = humanSeats.includes(i);
    const persona = botPersonas.get(i);
    const desc = isHuman ? '(human)' : `(AI — ${persona || name})`;
    return `- Seat ${i}: ${name} ${desc}`;
  }).join('\n');

  const botNames = botSeats.map(s => playerNames[s]).join(', ');

  if (humanCount === 1) {
    // Single human: be generous with chatter (original behavior)
    return `You are the voice director for a 4-player Cantonese mahjong game. There is 1 human and ${botCount} AI players. The human is the only real person — the AI players are the human's companions, so be GENEROUS with their chatter to keep the table lively and fun.

PLAYERS:
${playerList}

You receive game events and human speech. Your ONLY job is to decide which AI player should speak next. They will decide what to say themselves.

RESPOND with exactly one of:
  speak: <Name>
  silence

WHEN THE HUMAN SPEAKS:
- ALWAYS have someone respond. The human is talking to AI companions — ignoring them feels broken.
- If they address someone by name → that person responds.
- If they say something general → pick whoever fits best.

GAME EVENTS:
- When a bot CLAIMS a tile (Pong, Sheung, Kong): ALWAYS have that bot speak.
- When a bot WINS: ALWAYS have that bot speak.
- When the HUMAN claims or wins: have a bot react.
- Routine discards: usually silence, but occasionally (~1 in 5) pick someone to comment.
- End of hand / draw: always have someone comment.

SYSTEM NUDGES:
- When you see [System] messages about silence or slow discards, ALWAYS pick someone to speak.
- Vary who you pick — don't always choose the same character.

GENERAL:
- One speaker per response. Just the name, nothing else.
- Err on the side of MORE speech, not less. A lively table is better than a silent one.`;
  }

  // Multi-human: be more selective
  return `You are the voice director for a 4-player Cantonese mahjong game. There are ${humanCount} human players and ${botCount} AI player${botCount !== 1 ? 's' : ''}.

PLAYERS:
${playerList}

AI player${botCount !== 1 ? 's' : ''}: ${botNames || 'none'}

You receive game events and labeled speech from human players. Your ONLY job is to decide if an AI player should speak, and if so, which one.

RESPOND with exactly one of:
  speak: <Name>
  silence

WHEN HUMANS SPEAK:
- The humans can talk to each other. Do NOT have AI respond to every human utterance.
- ONLY have AI respond when:
  • A human directly addresses an AI by name
  • A human asks a question that no other human answers
  • There is a lull and AI commentary would add life to the table
- Do NOT interrupt human-to-human conversation.
- If multiple humans are chatting, wait for a natural pause.

GAME EVENTS:
- When a bot CLAIMS a tile (Pong, Sheung, Kong): ALWAYS have that bot speak.
- When a bot WINS: ALWAYS have that bot speak.
- When a HUMAN claims or wins: occasionally have a bot react (~1 in 3).
- Routine discards: mostly silence. Comment rarely (~1 in 8).
- End of hand / draw: have a bot comment.

SYSTEM NUDGES:
- When you see [System] messages about silence or slow discards, ALWAYS pick someone to speak.
- Vary who you pick — don't always choose the same character.

GENERAL:
- One speaker per response. Just the name, nothing else.
- With multiple humans at the table, err on the side of LESS AI speech.
- Let the humans have their conversation. AI adds flavor, not dominance.`;
}

export class VoiceManager {
  private agentSessions = new Map<number, RealtimeSession>();
  private sttSessions = new Map<number, RealtimeSession>();
  private dispatcher: RealtimeSession | null = null;
  private lastSpeakTime = 0;
  private sendToClient: (msg: any) => void;
  private playerNames: string[] = [];
  private humanSeats: number[] = [];
  private botSeats: number[] = [];
  private botPersonas = new Map<number, string>(); // seatId → persona name
  private agentNameToSeat = new Map<string, number>(); // lowercase name → seatId
  private dispatchQueue: Promise<void> = Promise.resolve();
  private discardBuffer: string[] = [];

  /** Running context shared with all agent sessions */
  private contextLog: string[] = [];

  /** Seat ID of the agent currently generating a response, or null */
  private respondingAgentSeat: number | null = null;
  private cancelledAgentSeat: number | null = null;
  private dispatcherInFlight = false;

  /** When true, AI characters don't vocalize (client toggled voice off) */
  private voicePaused = false;

  /** Whether we've sent the initial greeting */
  private greeted = false;

  /** Silence detection */
  private lastActivityTime = Date.now();
  private silenceTimer: ReturnType<typeof setInterval> | null = null;

  /** Slow discard detection */
  private slowDiscardTimer: ReturnType<typeof setTimeout> | null = null;
  private slowDiscardFired = false;

  /** Speech queue — pending (seatId, context) pairs waiting for the current speaker to finish */
  private speechQueue: { seatId: number; context: string }[] = [];

  /** When true, the next dispatcher response should interrupt current speech */
  private nextDispatchIsUrgent = false;

  constructor(sendToClient: (msg: any) => void) {
    this.sendToClient = sendToClient;
  }

  async initialize(
    playerNames: string[],
    humanSeats: number[],
    botSeats: number[],
  ): Promise<void> {
    this.playerNames = playerNames;
    this.humanSeats = humanSeats;
    this.botSeats = botSeats;

    if (!process.env.INWORLD_API_KEY) {
      console.log('[Voice] INWORLD_API_KEY not set, skipping voice initialization');
      return;
    }

    // No bots = no voice needed
    if (botSeats.length === 0) {
      console.log('[Voice] No bot seats, skipping voice initialization');
      return;
    }

    const connectPromises: Promise<void>[] = [];

    // Build a lookup from persona name to persona config
    const personaByName = new Map(ALL_PERSONAS.map(p => [p.name, p]));

    for (let i = 0; i < botSeats.length; i++) {
      const seatId = botSeats[i];
      // Use the name already assigned by GameRoom (via playerNames)
      const assignedName = playerNames[seatId];
      const persona = personaByName.get(assignedName) || ALL_PERSONAS[i];
      this.botPersonas.set(seatId, persona.name);

      // Build name lookup (lowercase variants)
      const nameLower = persona.name.toLowerCase();
      this.agentNameToSeat.set(nameLower, seatId);
      // Add partial name lookups
      for (const part of nameLower.split(' ')) {
        this.agentNameToSeat.set(part, seatId);
      }

      const agentConfig: AgentConfig = {
        name: persona.name,
        voice: persona.voice,
        mode: 'agent',
        instructions: persona.instructions,
      };

      const session = new RealtimeSession(agentConfig);

      session.onAudioChunk = (base64pcm) => {
        if (this.voicePaused) return;
        if (this.cancelledAgentSeat === seatId) return;
        if (this.respondingAgentSeat !== seatId) {
          // Ghost audio — agent is responding without being asked
          console.warn(`[Voice] Ghost audio from ${persona.name} (seat ${seatId}), expected seat ${this.respondingAgentSeat}. Cancelling.`);
          session.cancelResponse();
          return;
        }
        this.sendToClient({
          type: 'voice:audio',
          agentId: seatId,
          audio: base64pcm,
        });
      };

      session.onTranscript = (text, final) => {
        if (this.voicePaused) return;
        if (this.cancelledAgentSeat === seatId) return;
        if (this.respondingAgentSeat !== seatId) {
          // Ghost transcript — cancel it
          session.cancelResponse();
          return;
        }
        this.sendToClient({
          type: 'voice:transcript',
          agentId: seatId,
          agentName: persona.name,
          text,
          final,
        });
        if (final) {
          this.lastSpeakTime = Date.now();
          this._touchActivity();
          this.respondingAgentSeat = null;
          this._addContext(`[${persona.name}]: ${text}`);
        }
      };

      session.onResponseDone = (cancelled) => {
        if (cancelled) {
          console.log(`[Voice] ${persona.name}: response cancelled`);
        }
        if (this.respondingAgentSeat === seatId) {
          this.respondingAgentSeat = null;
        }
        if (this.cancelledAgentSeat === seatId) {
          this.cancelledAgentSeat = null;
        }
        // Dequeue next pending speech
        this._dequeueSpeech();
      };

      this.agentSessions.set(seatId, session);
      connectPromises.push(session.connect());
    }

    // Create STT sessions for each human player
    for (const seatId of humanSeats) {
      const humanName = playerNames[seatId];
      const sttConfig: AgentConfig = {
        name: `STT-${humanName}`,
        voice: '',
        mode: 'stt',
        instructions: '',
      };
      const sttSession = new RealtimeSession(sttConfig);

      sttSession.onHumanTranscript = (text) => {
        console.log(`[Voice] ${humanName} (seat ${seatId}): "${text}"`);
        this.sendToClient({
          type: 'voice:human_transcript',
          text,
          seatId,
          playerName: humanName,
        });

        this._addContext(`[${humanName}]: ${text}`);
        this._onHumanSpeech(humanName, text);
      };

      this.sttSessions.set(seatId, sttSession);
      connectPromises.push(sttSession.connect());
    }

    // Create dispatcher session (text-only, no audio)
    const dispatcherInstructions = buildDispatcherInstructions(
      playerNames, humanSeats, botSeats, this.botPersonas,
    );
    const dispatcherConfig: AgentConfig = {
      name: 'Dispatcher',
      voice: '',
      mode: 'dispatcher',
      instructions: dispatcherInstructions,
    };
    this.dispatcher = new RealtimeSession(dispatcherConfig);

    this.dispatcher.onTextResponse = (text) => {
      this._handleDispatcherResponse(text);
    };

    connectPromises.push(this.dispatcher.connect());

    try {
      await Promise.all(connectPromises);
      console.log(`[Voice] All sessions connected (${this.agentSessions.size} agents, ${this.sttSessions.size} STT, 1 dispatcher)`);
    } catch (err) {
      console.error('[Voice] Failed to connect some sessions:', err);
    }

    // Start silence detection timer
    this.lastActivityTime = Date.now();
    this.silenceTimer = setInterval(() => {
      this._checkSilence();
    }, SILENCE_CHECK_INTERVAL);
  }

  /**
   * Called when a human player's speech is transcribed.
   */
  private _onHumanSpeech(humanName: string, text: string) {
    this._touchActivity();
    if (this.voicePaused) return;
    if (this.respondingAgentSeat !== null) {
      // Interrupt: an agent is mid-response
      const seat = this.respondingAgentSeat;
      const session = this.agentSessions.get(seat);
      const personaName = this.botPersonas.get(seat);
      console.log(`[Voice] Interrupting ${personaName} (seat ${seat}) for ${humanName}'s speech`);

      session?.cancelResponse();
      this.cancelledAgentSeat = seat;
      this.respondingAgentSeat = null;

      this.sendToClient({ type: 'voice:interrupt', agentId: seat });

      if (this.dispatcherInFlight && this.dispatcher) {
        this.dispatcher.cancelResponse();
        this.dispatcherInFlight = false;
      }

      if (this.dispatcher?.ready) {
        const context = `[${humanName} says]: "${text}"`;
        console.log(`[Voice] Dispatcher <- ${context} (re-dispatch after interrupt)`);
        this.dispatcherInFlight = true;
        this.dispatcher.sendContext(context);
      }
    } else {
      // Normal: no agent is speaking
      if (this.dispatcherInFlight && this.dispatcher) {
        this.dispatcher.cancelResponse();
        this.dispatcherInFlight = false;
      }

      if (this.dispatcher?.ready) {
        const context = `[${humanName} says]: "${text}"`;
        console.log(`[Voice] Dispatcher <- ${context}`);
        this.dispatcherInFlight = true;
        this.dispatcher.sendContext(context);
      }
    }
  }

  /** Handle text chat from a human player — treat like speech for AI responses */
  onTextChat(playerName: string, text: string) {
    this._addContext(`[${playerName}]: ${text}`);
    this._touchActivity();
    if (this.voicePaused) return;
    this._onHumanSpeech(playerName, text);
  }

  /** Pause all AI vocalization (client turned voice off) */
  setVoicePaused(paused: boolean) {
    this.voicePaused = paused;
    if (paused) {
      // Cancel any in-progress response
      if (this.respondingAgentSeat !== null) {
        const session = this.agentSessions.get(this.respondingAgentSeat);
        session?.cancelResponse();
        this.cancelledAgentSeat = this.respondingAgentSeat;
        this.respondingAgentSeat = null;
      }
      if (this.dispatcherInFlight && this.dispatcher) {
        this.dispatcher.cancelResponse();
        this.dispatcherInFlight = false;
      }
    }
    console.log(`[Voice] Voice ${paused ? 'paused' : 'resumed'}`);

    // Trigger greeting on first voice:on
    if (!paused && !this.greeted) {
      this.greeted = true;
      // Small delay to let audio pipeline settle
      setTimeout(() => {
        if (!this.voicePaused) {
          const humanNames = this.humanSeats.map(s => this.playerNames[s]).join(', ');
          this._askDispatcher(`[System] The game just started! Welcome the players (${humanNames}) to the mahjong table. Pick one character to greet them.`);
        }
      }, 1500);
    }
  }

  /**
   * Route mic audio from a specific human player to their STT session.
   */
  onMicAudio(seatId: number, base64pcm: string) {
    const sttSession = this.sttSessions.get(seatId);
    if (sttSession?.ready) {
      sttSession.sendAudio(base64pcm);
    }
  }

  /**
   * Called by GameRoom on game events.
   */
  onGameEvent(event: any) {
    this._touchActivity();

    // Track slow discards for human players (before context check, since turn:draw has no context)
    if (event.type === 'turn:draw' && this.humanSeats.includes(event.playerId)) {
      this._startSlowDiscardTimer(this.playerNames[event.playerId]);
    } else if (event.type === 'turn:discard' && this.humanSeats.includes(event.playerId)) {
      this._clearSlowDiscardTimer();
    }

    const context = this._buildContext(event);
    if (!context) return;

    this._addContext(context);

    // Batch routine discards
    if (event.type === 'turn:discard') {
      this.discardBuffer.push(context);
      if (this.discardBuffer.length >= DISCARD_BATCH_SIZE) {
        const batched = this.discardBuffer.join('\n');
        this.discardBuffer = [];
        this._askDispatcher(batched);
      }
      return;
    }

    // Claims and wins are urgent — interrupt current speech
    const isUrgent = event.type === 'turn:claim' || event.type === 'hand:win';
    const ask = isUrgent
      ? (c: string) => this._askDispatcherUrgent(c)
      : (c: string) => this._askDispatcher(c);

    // Notable events — flush pending discards and send immediately
    if (this.discardBuffer.length > 0) {
      const batched = this.discardBuffer.join('\n');
      this.discardBuffer = [];
      ask(batched + '\n' + context);
    } else {
      ask(context);
    }
  }

  private _addContext(line: string) {
    this.contextLog.push(line);
    if (this.contextLog.length > MAX_CONTEXT_LINES) {
      this.contextLog = this.contextLog.slice(-MAX_CONTEXT_LINES);
    }
  }

  private _askDispatcherUrgent(context: string) {
    this.nextDispatchIsUrgent = true;
    this._askDispatcher(context);
  }

  private _askDispatcher(context: string) {
    this.dispatchQueue = this.dispatchQueue.then(async () => {
      if (this.voicePaused) return;

      const now = Date.now();
      const sinceLastSpeak = now - this.lastSpeakTime;
      if (sinceLastSpeak < SPEECH_COOLDOWN) {
        await sleep(SPEECH_COOLDOWN - sinceLastSpeak);
      }

      if (this.dispatcher?.ready) {
        console.log(`[Voice] Dispatcher <- ${context}`);
        this.dispatcherInFlight = true;
        this.dispatcher.sendContext(context);
      }
    });
  }

  private _handleDispatcherResponse(text: string) {
    this.dispatcherInFlight = false;

    console.log(`[Voice] Dispatcher -> ${text}`);

    const lower = text.toLowerCase().trim();
    if (lower === 'silence' || lower.startsWith('silence')) {
      return;
    }

    const speakMatch = text.match(/^speak:\s*(.+?)(?:\s*[—–\-].*)?$/i);
    if (!speakMatch) {
      console.log(`[Voice] Dispatcher response not understood: "${text}"`);
      return;
    }

    const agentNameRaw = speakMatch[1].trim().toLowerCase();

    let seatId: number | undefined;
    for (const [nameKey, id] of this.agentNameToSeat.entries()) {
      if (agentNameRaw.includes(nameKey)) {
        seatId = id;
        break;
      }
    }

    if (seatId == null) {
      console.log(`[Voice] Unknown agent name: "${agentNameRaw}"`);
      return;
    }

    const urgent = this.nextDispatchIsUrgent;
    this.nextDispatchIsUrgent = false;

    if (urgent) {
      this._interruptForClaim(seatId);
    } else {
      this._queueSpeech(seatId);
    }
  }

  /** Queue an agent to speak. If no one is speaking, speak immediately. */
  private _queueSpeech(seatId: number) {
    const session = this.agentSessions.get(seatId);
    if (!session?.ready) {
      console.log(`[Voice] Agent session ${seatId} not ready`);
      return;
    }

    if (this.respondingAgentSeat === null) {
      // No one speaking — go immediately
      this._speakAgent(seatId);
    } else {
      // Someone is speaking — queue it (max 2 pending to avoid stale buildup)
      if (this.speechQueue.length < 2) {
        const context = this.contextLog.slice(-15).join('\n');
        this.speechQueue.push({ seatId, context });
        console.log(`[Voice] Queued ${this.botPersonas.get(seatId)} (${this.speechQueue.length} in queue)`);
      }
    }
  }

  /** Send context to an agent and mark them as responding */
  private _speakAgent(seatId: number, context?: string) {
    const session = this.agentSessions.get(seatId);
    if (!session?.ready) return;

    const ctx = context || this.contextLog.slice(-15).join('\n');
    const personaName = this.botPersonas.get(seatId);
    console.log(`[Voice] -> ${personaName} (responding to context)`);
    session.sendContext(ctx);
    this.respondingAgentSeat = seatId;
    this.cancelledAgentSeat = null;
  }

  /** Dequeue and speak the next pending agent */
  private _dequeueSpeech() {
    if (this.respondingAgentSeat !== null) return; // still speaking
    if (this.speechQueue.length === 0) return;

    const next = this.speechQueue.shift()!;
    this._speakAgent(next.seatId, next.context);
  }

  /** Interrupt current speech and flush queue — used for claims/wins */
  private _interruptForClaim(seatId: number) {
    // Cancel current speaker
    if (this.respondingAgentSeat !== null) {
      const session = this.agentSessions.get(this.respondingAgentSeat);
      session?.cancelResponse();
      this.cancelledAgentSeat = this.respondingAgentSeat;
      this.respondingAgentSeat = null;
      this.sendToClient({ type: 'voice:interrupt', agentId: this.cancelledAgentSeat });
    }
    // Flush queue
    this.speechQueue = [];
    // Speak the claim immediately
    this._speakAgent(seatId);
  }

  private _buildContext(event: any): string | null {
    const name = (id: number) => this.playerNames[id] || `Player ${id}`;
    const tileName = (t: number) => (TILE_NAMES as any)[t] || `tile-${t}`;

    switch (event.type) {
      case 'turn:discard':
        return `[Game] ${name(event.playerId)} discarded ${tileName(event.tile)}.`;

      case 'turn:claim': {
        const label = CLAIM_LABELS[event.claimType] || 'Claim';
        return `[Game] ${name(event.playerId)} claimed ${tileName(event.tile)} for a ${label}!`;
      }

      case 'hand:win':
        return `[Game] ${name(event.playerId)} won the hand! Mah Jong!`;

      case 'hand:draw':
        return `[Game] The hand ended in a draw. No winner this round.`;

      case 'game:end':
        return `[Game] The game is over! Final scores: ${
          this.playerNames.map((n, i) => `${n}: ${event.scores?.[i] ?? 0}`).join(', ')
        }`;

      default:
        return null;
    }
  }

  /** Update activity timestamp to reset silence detection */
  private _touchActivity() {
    this.lastActivityTime = Date.now();
  }

  /** Check if the table has been silent too long and nudge the dispatcher */
  private _checkSilence() {
    if (!this.dispatcher?.ready) return;
    if (this.respondingAgentSeat !== null) return; // someone is already speaking
    if (this.dispatcherInFlight) return;

    const elapsed = Date.now() - this.lastActivityTime;
    if (elapsed >= SILENCE_THRESHOLD) {
      console.log(`[Voice] Silence detected (${Math.round(elapsed / 1000)}s), nudging dispatcher`);
      this._touchActivity(); // reset so we don't spam
      this._askDispatcher('[System] It\'s been quiet at the table for a while. Someone should say something to keep things lively.');
    }
  }

  /** Start tracking a human player's discard time */
  private _startSlowDiscardTimer(humanName: string) {
    this._clearSlowDiscardTimer();
    this.slowDiscardFired = false;
    this.slowDiscardTimer = setTimeout(() => {
      if (this.slowDiscardFired) return;
      this.slowDiscardFired = true;
      console.log(`[Voice] ${humanName} is taking a while to discard, nudging dispatcher`);
      this._askDispatcher(`[System] ${humanName} has been thinking about their discard for a while. Someone should comment.`);
    }, SLOW_DISCARD_THRESHOLD);
  }

  /** Clear the slow discard timer */
  private _clearSlowDiscardTimer() {
    if (this.slowDiscardTimer) {
      clearTimeout(this.slowDiscardTimer);
      this.slowDiscardTimer = null;
    }
  }

  close() {
    if (this.silenceTimer) {
      clearInterval(this.silenceTimer);
      this.silenceTimer = null;
    }
    this._clearSlowDiscardTimer();
    for (const session of this.agentSessions.values()) {
      session.close();
    }
    for (const session of this.sttSessions.values()) {
      session.close();
    }
    this.dispatcher?.close();
    this.agentSessions.clear();
    this.sttSessions.clear();
    this.dispatcher = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
