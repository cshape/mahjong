/**
 * RealtimeSession: manages a single Inworld Realtime API WebSocket session.
 *
 * Four session modes:
 * - "agent": audio+text output, receives context, always responds with speech
 * - "dispatcher": text-only output, receives game events + human transcripts,
 *   responds with routing decisions ("speak: Name" or "silence").
 * - "stt": audio input only, transcribes human speech via Whisper.
 *   No output — only fires onHumanTranscript.
 *
 * Auto-reconnects on unexpected disconnection.
 */
import WebSocket from 'ws';

export type SessionMode = 'agent' | 'dispatcher' | 'stt';

export interface AgentConfig {
  name: string;
  voice: string;
  instructions: string;
  mode: SessionMode;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;

export class RealtimeSession {
  readonly agentName: string;
  private ws: WebSocket | null = null;
  private config: AgentConfig;
  private closed = false; // true when intentionally closed
  private reconnectAttempts = 0;
  ready = false;

  responding = false;

  // Callbacks
  onAudioChunk: ((base64pcm: string) => void) | null = null;
  onTranscript: ((text: string, final: boolean) => void) | null = null;
  onTextResponse: ((text: string) => void) | null = null;
  onHumanTranscript: ((text: string) => void) | null = null;
  onResponseDone: ((cancelled: boolean) => void) | null = null;
  onReady: (() => void) | null = null;
  onError: ((err: string) => void) | null = null;

  constructor(config: AgentConfig) {
    this.agentName = config.name;
    this.config = config;
  }

  /**
   * Open WebSocket to Inworld Realtime API and wait for session.created.
   */
  connect(): Promise<void> {
    const apiKey = process.env.INWORLD_API_KEY;
    if (!apiKey) {
      return Promise.reject(new Error('INWORLD_API_KEY not set'));
    }

    this.closed = false;

    return new Promise((resolve, reject) => {
      const key = `agent-${this.agentName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
      const url = `wss://api.inworld.ai/api/v1/realtime/session?key=${key}&protocol=realtime`;

      this.ws = new WebSocket(url, {
        headers: { Authorization: `Basic ${apiKey}` },
      });

      const timeout = setTimeout(() => {
        reject(new Error(`${this.agentName}: connection timeout`));
        this.close();
      }, 15000);

      this.ws.on('open', () => {
        console.log(`[Voice] ${this.agentName}: WebSocket connected`);
        this.reconnectAttempts = 0;
      });

      // Accumulate text response deltas for dispatcher
      let pendingText = '';
      let lastFinalTranscript = '';

      this.ws.on('message', (raw: WebSocket.RawData) => {
        const msg = JSON.parse(raw.toString());
        const type = msg.type || '';

        switch (type) {
          case 'session.created':
            this._sendSessionUpdate();
            break;

          case 'session.updated':
            clearTimeout(timeout);
            this.ready = true;
            console.log(`[Voice] ${this.agentName}: session ready`);
            this.onReady?.();
            resolve();
            break;

          // Agent audio output
          case 'response.audio.delta':
          case 'response.output_audio.delta':
            if (msg.delta) this.onAudioChunk?.(msg.delta);
            break;

          // Agent speech transcript (streaming)
          case 'response.audio_transcript.delta':
          case 'response.output_audio_transcript.delta':
            if (msg.delta) this.onTranscript?.(msg.delta, false);
            break;

          // Agent speech transcript (final) — only emit once
          // Both output_audio_transcript.done and content_part.done fire with the same text
          case 'response.output_audio_transcript.done':
            if (msg.transcript) {
              lastFinalTranscript = msg.transcript;
              this.onTranscript?.(msg.transcript, true);
            }
            break;

          case 'response.content_part.done':
            // Skip if we already emitted this via output_audio_transcript.done
            if (msg.part?.transcript && msg.part.transcript !== lastFinalTranscript) {
              this.onTranscript?.(msg.part.transcript, true);
            }
            break;

          // Text output deltas (dispatcher mode)
          case 'response.output_text.delta':
          case 'response.text.delta':
            if (msg.delta) pendingText += msg.delta;
            break;

          case 'response.output_text.done':
          case 'response.text.done':
            if (msg.text) pendingText = msg.text;
            break;

          // Human speech transcription (dispatcher handles STT)
          case 'conversation.item.input_audio_transcription.completed':
            if (msg.transcript) this.onHumanTranscript?.(msg.transcript);
            break;

          case 'conversation.item.input_audio_transcription.delta':
          case 'input_audio_transcription.delta':
          case 'input_audio_buffer.transcription.delta':
            break;

          case 'response.done': {
            const cancelled = msg.response?.status === 'cancelled';
            this.responding = false;
            if (pendingText.trim()) {
              this.onTextResponse?.(pendingText.trim());
              pendingText = '';
            }
            lastFinalTranscript = '';
            this.onResponseDone?.(cancelled);
            break;
          }

          case 'error':
            console.error(`[Voice] ${this.agentName} error:`, msg.error || msg);
            this.onError?.(msg.error?.message || 'Unknown error');
            break;
        }
      });

      this.ws.on('error', (err) => {
        console.error(`[Voice] ${this.agentName}: WS error:`, err.message);
        clearTimeout(timeout);
        reject(err);
      });

      this.ws.on('close', (code, reason) => {
        this.ready = false;
        const reasonStr = reason?.toString() || '';
        console.log(`[Voice] ${this.agentName}: WebSocket closed (code=${code}${reasonStr ? ', reason=' + reasonStr : ''})`);

        // Auto-reconnect if not intentionally closed
        if (!this.closed && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
          console.log(`[Voice] ${this.agentName}: reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
          setTimeout(() => {
            if (!this.closed) {
              this.connect().catch(err => {
                console.error(`[Voice] ${this.agentName}: reconnect failed:`, err.message);
              });
            }
          }, delay);
        }
      });
    });
  }

  /**
   * Send session.update based on session mode.
   */
  private _sendSessionUpdate() {
    if (this.config.mode === 'stt') {
      // STT-only: audio input with Whisper, no output
      this._send({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: 'openai/gpt-4o-mini',
          instructions: 'Transcribe the audio input.',
          output_modalities: ['text'],
          audio: {
            input: {
              turn_detection: {
                type: 'semantic_vad',
                eagerness: 'high',
                create_response: false,
                interrupt_response: false,
              },
              transcription: { model: 'whisper-1' },
            },
          },
        },
      });
    } else if (this.config.mode === 'dispatcher') {
      // Dispatcher: text-only output, no audio input
      this._send({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: 'openai/gpt-4o-mini',
          instructions: this.config.instructions,
          output_modalities: ['text'],
        },
      });
    } else {
      // Agent: audio+text output
      this._send({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: 'openai/gpt-4o-mini',
          instructions: this.config.instructions,
          output_modalities: ['audio', 'text'],
          audio: {
            output: {
              model: 'inworld-tts-1.5-mini',
              voice: this.config.voice,
            },
          },
        },
      });
    }
  }

  /**
   * Send a context message and trigger a response.
   */
  sendContext(text: string) {
    if (!this.ready) return;
    this._send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    this._send({ type: 'response.create' });
    this.responding = true;
  }

  /**
   * Cancel an in-progress response.
   */
  cancelResponse() {
    if (!this.ready || !this.responding) return;
    this._send({ type: 'response.cancel' });
    this.responding = false;
  }

  /**
   * Append raw PCM16 audio (base64) to the input buffer (for dispatcher STT).
   */
  sendAudio(base64pcm: string) {
    if (!this.ready) return;
    this._send({
      type: 'input_audio_buffer.append',
      audio: base64pcm,
    });
  }

  private _send(obj: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  close() {
    this.closed = true;
    this.ready = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
