/**
 * VoiceManager: orchestrates voice for the mahjong game.
 *
 * Architecture:
 * - 1 STT WebSocket per human player (Inworld STT API)
 * - Dispatcher: on-demand LLM HTTP calls (decides who speaks)
 * - Agents: on-demand LLM+TTS streaming HTTP calls (generates speech)
 *
 * No persistent agent connections — each response is a fresh HTTP stream.
 */
import { SttSession } from './stt-session.js';
import { askDispatcher } from './dispatcher.js';
import { generateSpeech, type LlmTtsMessage } from './llm-tts.js';
import { TILE_NAMES } from '../config.js';

const CLAIM_LABELS: Record<number, string> = {
  2: 'Sheung', 4: 'Sheung', 5: 'Sheung', 6: 'Sheung',
  8: 'Pong', 16: 'Kong', 32: 'Mah Jong',
};

/** All available bot personas */
/**
 * TTS audio markup reference (only these are supported):
 * [sigh] [laugh] [breathe] [cough] [clear_throat] [yawn]
 * Use *word* for emphasis (single asterisks only).
 * Use filler words (uh, um, well) for natural disfluency.
 */
/** Common rules appended to every persona's instructions */
const COMMON_RULES = `
CONTEXT FORMAT:
- "[Game] Grandpa claimed..." means that action was YOUR action if you are Grandpa. React naturally in first person ("Yes! I needed that."), not third person ("Go Grandpa!"). Don't just repeat the claim name — comment on it like a real person would.
- "[Game] Gladys discarded..." is another player's action if you are not Gladys.
- "[PlayerName]: text" is what someone said.
- "[System]" messages are prompts for you to speak.

SPEECH RULES:
- Respond with 1-2 short sentences max. This is table talk, not a monologue.
- Use filler words (uh, um, well, like) for natural-sounding speech.
- You may use ONLY these audio tags sparingly: [sigh] [laugh] [breathe] [cough] [clear_throat] [yawn]. No other bracket tags.
- Use *word* with single asterisks to emphasize a word.
- NEVER describe game mechanics, strategy, or your hand in detail.
- NEVER refer to yourself in the third person.`;

const ALL_PERSONAS: { name: string; voice: string; instructions: string }[] = [
  {
    name: 'Grandpa',
    voice: 'Theodore',
    instructions: `You are Grandpa, a supportive sweetheart at a casual mahjong table. You've had a long, colorful life and love to share little stories from growing up in the old country. You're encouraging to everyone, especially your great-grandson Lucky. Gladys is your daughter.

Your style: warm, gentle, nostalgic. Filler words like "ah," "well now," "you know," "hmm."
Occasionally start a brief anecdote: "That reminds me of when..." but keep it to one sentence.
When you claim tiles — express warm satisfaction ("Ah, I *needed* that one."). When others claim — be supportive or mildly impressed.
${COMMON_RULES}`,
  },
  {
    name: 'Gladys',
    voice: 'Loretta',
    instructions: `You are Gladys, a kvetching old woman at a casual mahjong table. You're usually bitter and sarcastic — always got something to complain about. The tiles are bad, the room is cold, your back hurts. But you have a soft spot for Sheungs — whenever anyone gets one, you light up and think they're just lovely.
Lucky is your son. You nag him. Grandpa is your father.

Your style: cranky, complaining, sarcastic but not cruel. Filler words like "ugh," "oh for crying out loud," "well..."
When you or anyone gets a Sheung — genuine delight ("Oh, now *that's* nice.").
When you claim other tiles — grudging satisfaction ("Well, about time."). When others claim — complain about it or snark ("Oh great, just what I needed, him getting *more* tiles.").
${COMMON_RULES}`,
  },
  {
    name: 'Lucky',
    voice: 'Avery',
    instructions: `You are Lucky, a 17-year-old who loves gambling. You're a successful e-sports gambler. You don't really know what you want to do with your life beyond NBA, gambling, and mah jong. You're cocky but not mean. Gladys is your mom, Grandpa is your great-grandpa.

Your style: gen z slang, short bursts, competitive energy. Filler words like "like," "bro," "yo," "nah," "I mean," "no cap," "lowkey."
When you claim tiles — hype yourself up ("Yes! I *needed* that, let's go!" or "That's what I'm talking about.").
When others claim — trash talk or act unbothered ("Whatever bro, I'm still winning this.").
${COMMON_RULES}`,
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

/** Max context lines to keep */
const MAX_CONTEXT_LINES = 30;

/** Max conversation history per agent */
const MAX_AGENT_HISTORY = 20;

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
- When a bot CLAIMS a tile (Pong, Sheung, Kong): ALWAYS respond with that bot's name. Example: if "Grandpa claimed bamboo 5 for a Pong" → respond "speak: Grandpa"
- When a bot WINS: ALWAYS respond with that bot's name.
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
- When a bot CLAIMS a tile (Pong, Sheung, Kong): ALWAYS respond with that bot's name. Example: if "Grandpa claimed bamboo 5 for a Pong" → respond "speak: Grandpa"
- When a bot WINS: ALWAYS respond with that bot's name.
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

interface PersonaConfig {
  name: string;
  voice: string;
  instructions: string;
}

export class VoiceManager {
  private sttSessions = new Map<number, SttSession>();
  private lastSpeakTime = 0;
  private sendToClient: (msg: any) => void;
  private playerNames: string[] = [];
  private humanSeats: number[] = [];
  private botSeats: number[] = [];
  private botPersonas = new Map<number, string>(); // seatId → persona name
  private personaConfigs = new Map<number, PersonaConfig>(); // seatId → full persona
  private agentNameToSeat = new Map<string, number>(); // lowercase name → seatId
  private dispatchQueue: Promise<void> = Promise.resolve();
  private discardBuffer: string[] = [];

  /** Running context shared across all interactions */
  private contextLog: string[] = [];

  /** Per-agent conversation history for LLM calls */
  private agentHistory = new Map<number, LlmTtsMessage[]>();

  /** Seat ID of the agent currently generating a response, or null */
  private respondingAgentSeat: number | null = null;
  /** AbortController for the current LLM+TTS stream */
  private respondingAbort: AbortController | null = null;

  /** Dispatcher instructions (built once at init) */
  private dispatcherInstructions = '';
  private dispatcherInFlight = false;

  /** When true, AI characters don't vocalize */
  private voicePaused = false;

  /** Whether we've sent the initial greeting */
  private greeted = false;

  /** Silence detection */
  private lastActivityTime = Date.now();
  private silenceTimer: ReturnType<typeof setInterval> | null = null;

  /** Slow discard detection */
  private slowDiscardTimer: ReturnType<typeof setTimeout> | null = null;
  private slowDiscardFired = false;

  /** Speech queue */
  private speechQueue: { seatId: number; context: string }[] = [];

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

    if (botSeats.length === 0) {
      console.log('[Voice] No bot seats, skipping voice initialization');
      return;
    }

    // Set up persona configs for each bot
    const personaByName = new Map(ALL_PERSONAS.map(p => [p.name, p]));

    for (let i = 0; i < botSeats.length; i++) {
      const seatId = botSeats[i];
      const assignedName = playerNames[seatId];
      const persona = personaByName.get(assignedName) || ALL_PERSONAS[i];
      this.botPersonas.set(seatId, persona.name);
      this.personaConfigs.set(seatId, persona);
      this.agentHistory.set(seatId, []);

      // Build name lookup (lowercase variants)
      const nameLower = persona.name.toLowerCase();
      this.agentNameToSeat.set(nameLower, seatId);
      for (const part of nameLower.split(' ')) {
        this.agentNameToSeat.set(part, seatId);
      }
    }

    // Build dispatcher instructions
    this.dispatcherInstructions = buildDispatcherInstructions(
      playerNames, humanSeats, botSeats, this.botPersonas,
    );

    // Connect STT sessions for each human player
    const connectPromises: Promise<void>[] = [];

    for (const seatId of humanSeats) {
      const humanName = playerNames[seatId];
      const sttSession = new SttSession(humanName);

      sttSession.onTranscript = (text) => {
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

    try {
      await Promise.all(connectPromises);
      console.log(`[Voice] ${this.sttSessions.size} STT session(s) connected. Dispatcher + agents use on-demand HTTP.`);
    } catch (err) {
      console.error('[Voice] Failed to connect STT sessions:', err);
    }

    // Start silence detection
    this.lastActivityTime = Date.now();
    this.silenceTimer = setInterval(() => {
      this._checkSilence();
    }, SILENCE_CHECK_INTERVAL);

    // Trigger greeting directly (bypass dispatcher — it sometimes says "silence")
    this.greeted = true;
    setTimeout(() => {
      if (!this.voicePaused) {
        const randomBot = botSeats[Math.floor(Math.random() * botSeats.length)];
        const humanNames = this.humanSeats.map(s => this.playerNames[s]).join(', ');
        this._addContext(`[System] Game started. Players: ${humanNames}`);
        this._speakAgent(randomBot, `[System] The game just started! Welcome the players (${humanNames}) to the mahjong table. Give a brief, friendly greeting.`);
      }
    }, 2000);
  }

  /**
   * Called when a human player's speech is transcribed.
   */
  private _onHumanSpeech(humanName: string, text: string) {
    this._touchActivity();
    if (this.voicePaused) return;

    // Interrupt current agent if speaking
    if (this.respondingAgentSeat !== null) {
      const personaName = this.botPersonas.get(this.respondingAgentSeat);
      console.log(`[Voice] Interrupting ${personaName} for ${humanName}'s speech`);
      this._cancelCurrentResponse();
      this.speechQueue = [];
    }

    const context = `[${humanName} says]: "${text}"`;
    this._askDispatcher(context);
  }

  /** Handle text chat from a human player */
  onTextChat(playerName: string, text: string) {
    this._addContext(`[${playerName}]: ${text}`);
    this._touchActivity();
    if (this.voicePaused) return;
    this._onHumanSpeech(playerName, text);
  }

  /** Pause all AI vocalization */
  setVoicePaused(paused: boolean) {
    this.voicePaused = paused;
    if (paused) {
      this._cancelCurrentResponse();
      this.speechQueue = [];
    }
    console.log(`[Voice] Voice ${paused ? 'paused' : 'resumed'}`);
  }

  /** Route mic audio to STT session */
  onMicAudio(seatId: number, base64pcm: string) {
    const sttSession = this.sttSessions.get(seatId);
    if (sttSession?.ready) {
      sttSession.sendAudio(base64pcm);
    }
  }

  /** Called by GameRoom on game events */
  onGameEvent(event: any) {
    this._touchActivity();

    // Track slow discards for human players
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

    // Notable events — flush pending discards and send immediately
    if (this.discardBuffer.length > 0) {
      const batched = this.discardBuffer.join('\n');
      this.discardBuffer = [];
      this._askDispatcher(batched + '\n' + context);
    } else {
      this._askDispatcher(context);
    }
  }

  // ─── Dispatcher ───

  private _askDispatcher(context: string) {
    this.dispatchQueue = this.dispatchQueue.then(async () => {
      if (this.voicePaused) return;

      const now = Date.now();
      const sinceLastSpeak = now - this.lastSpeakTime;
      if (sinceLastSpeak < SPEECH_COOLDOWN) {
        await sleep(SPEECH_COOLDOWN - sinceLastSpeak);
      }

      await this._askDispatcherDirect(context);
    });
  }

  private async _askDispatcherDirect(context: string) {
    if (this.voicePaused) return;
    this.dispatcherInFlight = true;

    console.log(`[Voice] Dispatcher <- ${context}`);
    const recentContext = this.contextLog.slice(-15).join('\n') + '\n' + context;
    const response = await askDispatcher({
      instructions: this.dispatcherInstructions,
      context: recentContext,
    });

    this.dispatcherInFlight = false;
    this._handleDispatcherResponse(response);
  }

  private _handleDispatcherResponse(text: string) {
    console.log(`[Voice] Dispatcher -> ${text}`);

    const lower = text.toLowerCase().trim();
    if (lower === 'silence' || lower.startsWith('silence')) {
      return;
    }

    // Parse "speak: Name" or just "Name" (dispatcher sometimes omits prefix)
    const speakMatch = text.match(/^(?:speak:\s*)?(.+?)(?:\s*[—–\-].*)?$/i);
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

    this._queueSpeech(seatId);
  }

  // ─── Speech Queue ───

  private _queueSpeech(seatId: number) {
    if (this.respondingAgentSeat === null) {
      this._speakAgent(seatId);
    } else {
      if (this.speechQueue.length < 2) {
        const context = this.contextLog.slice(-15).join('\n');
        this.speechQueue.push({ seatId, context });
        console.log(`[Voice] Queued ${this.botPersonas.get(seatId)} (${this.speechQueue.length} in queue)`);
      }
    }
  }

  private _dequeueSpeech() {
    if (this.respondingAgentSeat !== null) return;
    if (this.speechQueue.length === 0) return;

    const next = this.speechQueue.shift()!;
    this._speakAgent(next.seatId, next.context);
  }

  private _cancelCurrentResponse() {
    if (this.respondingAgentSeat !== null) {
      this.respondingAbort?.abort();
      this.sendToClient({ type: 'voice:interrupt', agentId: this.respondingAgentSeat });
      this.respondingAgentSeat = null;
      this.respondingAbort = null;
    }
  }

  // ─── Agent Speech (LLM+TTS) ───

  private _speakAgent(seatId: number, context?: string) {
    const persona = this.personaConfigs.get(seatId);
    if (!persona) return;

    const ctx = context || this.contextLog.slice(-15).join('\n');
    const personaName = persona.name;
    console.log(`[Voice] -> ${personaName} (generating speech)`);

    // Build messages for the LLM
    const history = this.agentHistory.get(seatId) || [];
    const messages: LlmTtsMessage[] = [
      { role: 'system', content: persona.instructions },
      ...history,
      { role: 'user', content: ctx },
    ];

    // Set up abort controller with 30s timeout
    const abort = new AbortController();
    const timeout = setTimeout(() => {
      if (!abort.signal.aborted) {
        console.warn(`[Voice] ${personaName}: response timed out after 30s`);
        abort.abort();
      }
    }, 30000);
    this.respondingAgentSeat = seatId;
    this.respondingAbort = abort;

    generateSpeech({
      voice: persona.voice,
      messages,
      onAudioChunk: (base64pcm) => {
        if (this.voicePaused || this.respondingAgentSeat !== seatId) return;
        this.sendToClient({
          type: 'voice:audio',
          agentId: seatId,
          audio: base64pcm,
        });
      },
      onTranscript: (text, final) => {
        if (this.voicePaused || this.respondingAgentSeat !== seatId) return;
        this.sendToClient({
          type: 'voice:transcript',
          agentId: seatId,
          agentName: personaName,
          text,
          final,
        });
        if (final) {
          this.lastSpeakTime = Date.now();
          this._touchActivity();
          this._addContext(`[${personaName}]: ${text}`);

          // Update conversation history
          const hist = this.agentHistory.get(seatId) || [];
          hist.push({ role: 'user', content: ctx });
          hist.push({ role: 'assistant', content: text });
          // Cap history
          if (hist.length > MAX_AGENT_HISTORY) {
            this.agentHistory.set(seatId, hist.slice(-MAX_AGENT_HISTORY));
          }
        }
      },
      onDone: (cancelled) => {
        clearTimeout(timeout);
        console.log(`[Voice] ${personaName}: done (cancelled=${cancelled}, responding=${this.respondingAgentSeat})`);
        if (this.respondingAgentSeat === seatId) {
          this.respondingAgentSeat = null;
          this.respondingAbort = null;
        }
        this._dequeueSpeech();
      },
      signal: abort.signal,
    });
  }

  // ─── Context & Events ───

  private _addContext(line: string) {
    this.contextLog.push(line);
    if (this.contextLog.length > MAX_CONTEXT_LINES) {
      this.contextLog = this.contextLog.slice(-MAX_CONTEXT_LINES);
    }
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

  // ─── Timers ───

  private _touchActivity() {
    this.lastActivityTime = Date.now();
  }

  private _checkSilence() {
    if (this.respondingAgentSeat !== null) return;
    if (this.dispatcherInFlight) return;
    if (this.voicePaused) return;

    const elapsed = Date.now() - this.lastActivityTime;
    if (elapsed >= SILENCE_THRESHOLD) {
      console.log(`[Voice] Silence detected (${Math.round(elapsed / 1000)}s), nudging dispatcher`);
      this._touchActivity();
      this._askDispatcher('[System] It\'s been quiet at the table for a while. Someone should say something to keep things lively.');
    }
  }

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
    this._cancelCurrentResponse();
    for (const session of this.sttSessions.values()) {
      session.close();
    }
    this.sttSessions.clear();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
