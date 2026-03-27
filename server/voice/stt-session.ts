/**
 * SttSession: WebSocket client for Inworld STT streaming API.
 *
 * Connects to wss://api.inworld.ai/stt/v1/transcribe:streamBidirectional
 * Streams PCM16 audio in, receives transcription results out.
 */
import WebSocket from 'ws';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;

export class SttSession {
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectAttempts = 0;
  private playerName: string;
  ready = false;

  /** Fires when a final transcript is available */
  onTranscript?: (text: string) => void;

  constructor(playerName: string) {
    this.playerName = playerName;
  }

  async connect(): Promise<void> {
    const apiKey = process.env.INWORLD_API_KEY;
    if (!apiKey) throw new Error('INWORLD_API_KEY not set');

    this.closed = false;

    return new Promise((resolve, reject) => {
      const url = 'wss://api.inworld.ai/stt/v1/transcribe:streamBidirectional';

      this.ws = new WebSocket(url, {
        headers: { Authorization: `Basic ${apiKey}` },
      });

      const timeout = setTimeout(() => {
        reject(new Error(`STT-${this.playerName}: connection timeout`));
        this.close();
      }, 15000);

      this.ws.on('open', () => {
        console.log(`[STT] ${this.playerName}: connected`);
        this.reconnectAttempts = 0;

        // Send config as first message
        this._send({
          transcribe_config: {
            modelId: 'assemblyai/universal-streaming-english',
            audioEncoding: 'LINEAR16',
            sampleRateHertz: 24000,
            numberOfChannels: 1,
          },
        });

        this.ready = true;
        clearTimeout(timeout);
        resolve();
      });

      this.ws.on('message', (raw: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(raw.toString());
          const transcription = msg?.result?.transcription;
          if (transcription?.transcript && transcription.isFinal) {
            this.onTranscript?.(transcription.transcript);
          }
        } catch {
          // Ignore malformed messages
        }
      });

      this.ws.on('error', (err) => {
        console.error(`[STT] ${this.playerName}: error:`, err.message);
        clearTimeout(timeout);
        if (!this.ready) reject(err);
      });

      this.ws.on('close', (code) => {
        this.ready = false;
        console.log(`[STT] ${this.playerName}: closed (code=${code})`);

        if (!this.closed && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
          console.log(`[STT] ${this.playerName}: reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
          setTimeout(() => {
            if (!this.closed) {
              this.connect().catch(err => {
                console.error(`[STT] ${this.playerName}: reconnect failed:`, err.message);
              });
            }
          }, delay);
        }
      });
    });
  }

  sendAudio(base64pcm: string) {
    if (!this.ready) return;
    this._send({
      audio_chunk: { content: base64pcm },
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
    if (this.ws?.readyState === WebSocket.OPEN) {
      this._send({ close_stream: {} });
    }
    this.ws?.close();
    this.ws = null;
  }
}
