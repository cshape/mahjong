/**
 * useVoice: React hook for mic capture and agent audio playback.
 *
 * - Captures mic at 24kHz via AudioWorklet, sends PCM16 base64 chunks to server
 * - Receives agent audio (PCM16 24kHz base64) from server, plays via Web Audio API
 * - Per-agent playback queues to prevent overlap
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface VoiceState {
  enabled: boolean;
  muted: boolean;
  speakingAgentId: number | null;
  transcripts: TranscriptEntry[];
}

export interface TranscriptEntry {
  agentId: number | null; // null = human
  agentName: string;
  text: string;
  final: boolean;
  timestamp: number;
}

/** Fallback agent names (overridden by server-provided agentName) */
const AGENT_NAMES: Record<number, string> = {};

export function useVoice(wsRef: React.RefObject<WebSocket | null>) {
  const [state, setState] = useState<VoiceState>({
    enabled: false,
    muted: false,
    speakingAgentId: null,
    transcripts: [],
  });

  // Audio contexts
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const playbackElRef = useRef<HTMLAudioElement | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Global playback scheduling — ensures no overlap between any agents
  const nextPlayTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carry byte between chunks: Inworld's SSE audio chunks aren't guaranteed to
  // be 2-byte aligned, so a sample can straddle two chunks. Holding the odd
  // trailing byte until the next chunk keeps Int16 decoding aligned.
  const carryByteRef = useRef<number | null>(null);

  /**
   * Decode base64 PCM16 to Float32Array for Web Audio playback.
   */
  const base64ToFloat32 = useCallback((b64: string): Float32Array => {
    const bin = atob(b64);
    const incoming = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) incoming[i] = bin.charCodeAt(i);

    let bytes: Uint8Array;
    if (carryByteRef.current !== null) {
      bytes = new Uint8Array(incoming.length + 1);
      bytes[0] = carryByteRef.current;
      bytes.set(incoming, 1);
      carryByteRef.current = null;
    } else {
      bytes = incoming;
    }

    let usable = bytes.length;
    if (usable % 2 !== 0) {
      carryByteRef.current = bytes[usable - 1];
      usable -= 1;
    }
    if (usable === 0) return new Float32Array(0);

    const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, usable / 2);
    const f32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) f32[i] = pcm16[i] / 32768;
    return f32;
  }, []);

  /**
   * Queue an audio chunk for playback.
   */
  const queueAudio = useCallback((base64: string, agentId: number) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    const f32 = base64ToFloat32(base64);
    if (f32.length === 0) return;

    const buf = ctx.createBuffer(1, f32.length, 48000);
    buf.getChannelData(0).set(f32);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(playbackDestRef.current || ctx.destination);

    const now = ctx.currentTime;
    const nextTime = nextPlayTimeRef.current;
    const startTime = Math.max(now, nextTime);
    src.start(startTime);
    nextPlayTimeRef.current = startTime + buf.duration;

    activeSourcesRef.current.push(src);
    src.onended = () => {
      const idx = activeSourcesRef.current.indexOf(src);
      if (idx !== -1) activeSourcesRef.current.splice(idx, 1);
    };

    // Update speaking indicator
    setState(s => ({ ...s, speakingAgentId: agentId }));
    if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
    speakingTimerRef.current = setTimeout(() => {
      setState(s => ({ ...s, speakingAgentId: null }));
    }, 500);
  }, [base64ToFloat32]);

  /**
   * Flush all queued/playing audio for an agent (used when server cancels a response).
   */
  const flushAgentAudio = useCallback((agentId: number) => {
    // Stop all active audio sources (only one agent speaks at a time)
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
    activeSourcesRef.current = [];

    // Reset global playback scheduling
    nextPlayTimeRef.current = 0;

    // Drop any carry byte from the interrupted utterance
    carryByteRef.current = null;

    // Clear speaking indicator
    if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
    setState(s => ({
      ...s,
      speakingAgentId: null,
      // Remove the non-final streaming transcript for this agent (the interrupted one)
      transcripts: s.transcripts.filter(
        t => !(t.agentId === agentId && !t.final)
      ),
    }));
  }, []);

  /**
   * Handle incoming voice messages from server.
   */
  const handleVoiceMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case 'voice:audio':
        if (state.enabled) {
          queueAudio(msg.audio, msg.agentId);
        }
        break;

      case 'voice:transcript':
        // Cache agent name from server
        if (msg.agentName) {
          AGENT_NAMES[msg.agentId] = msg.agentName;
        }
        setState(s => {
          const transcripts = [...s.transcripts];
          const name = AGENT_NAMES[msg.agentId] || 'Agent';
          if (msg.final) {
            // Replace any streaming entry for this agent with the final one
            const idx = transcripts.findIndex(
              t => t.agentId === msg.agentId && !t.final
            );
            if (idx !== -1) transcripts.splice(idx, 1);
            transcripts.push({
              agentId: msg.agentId,
              agentName: name,
              text: msg.text,
              final: true,
              timestamp: Date.now(),
            });
          } else {
            // Streaming delta — append to existing or create new
            const idx = transcripts.findIndex(
              t => t.agentId === msg.agentId && !t.final
            );
            if (idx !== -1) {
              transcripts[idx] = { ...transcripts[idx], text: transcripts[idx].text + msg.text };
            } else {
              transcripts.push({
                agentId: msg.agentId,
                agentName: name,
                text: msg.text,
                final: false,
                timestamp: Date.now(),
              });
            }
          }
          // Keep last 50 entries
          return { ...s, transcripts: transcripts.slice(-50) };
        });
        break;

      case 'voice:human_transcript':
        setState(s => ({
          ...s,
          transcripts: [
            ...s.transcripts.slice(-49),
            {
              agentId: null,
              agentName: msg.playerName || 'Player',
              text: msg.text,
              final: true,
              timestamp: Date.now(),
            },
          ],
        }));
        break;

      case 'voice:interrupt':
        flushAgentAudio(msg.agentId);
        break;

      case 'chat':
        setState(s => ({
          ...s,
          transcripts: [
            ...s.transcripts.slice(-49),
            {
              agentId: null,
              agentName: msg.playerName || 'Player',
              text: msg.text,
              final: true,
              timestamp: Date.now(),
            },
          ],
        }));
        break;
    }
  }, [state.enabled, queueAudio, flushAgentAudio]);

  /**
   * Start voice: init audio contexts, request mic, start capture.
   */
  const startVoice = useCallback(async () => {
    try {
      // Playback context — route through <audio> element so hardware
      // volume / mute switch is respected on mobile (iOS especially)
      const playbackCtx = new AudioContext({ sampleRate: 48000 });
      if (playbackCtx.state === 'suspended') await playbackCtx.resume();
      playbackCtxRef.current = playbackCtx;

      const streamDest = playbackCtx.createMediaStreamDestination();
      playbackDestRef.current = streamDest;
      const audioEl = document.createElement('audio');
      audioEl.srcObject = streamDest.stream;
      audioEl.play().catch(() => {});
      playbackElRef.current = audioEl;

      // Mic capture
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const captureCtx = new AudioContext({ sampleRate: 24000 });
      captureCtxRef.current = captureCtx;
      const source = captureCtx.createMediaStreamSource(stream);

      // AudioWorklet for Float32 → PCM16 conversion
      const workletCode = `
        class P extends AudioWorkletProcessor {
          constructor() { super(); this._buf = []; this._len = 0; }
          process(inputs) {
            const ch = inputs[0]?.[0];
            if (!ch) return true;
            const pcm = new Int16Array(ch.length);
            for (let i = 0; i < ch.length; i++) {
              const s = Math.max(-1, Math.min(1, ch[i]));
              pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            this._buf.push(pcm);
            this._len += pcm.length;
            if (this._len >= 2400) {
              const out = new Int16Array(this._len);
              let off = 0;
              for (const c of this._buf) { out.set(c, off); off += c.length; }
              this._buf = []; this._len = 0;
              this.port.postMessage(out.buffer, [out.buffer]);
            }
            return true;
          }
        }
        registerProcessor('pcm-capture', P);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await captureCtx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      const workletNode = new AudioWorkletNode(captureCtx, 'pcm-capture');
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e) => {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
          const b64 = arrayBufferToBase64(e.data);
          ws.send(JSON.stringify({ type: 'mic:audio', audio: b64 }));
        }
      };

      source.connect(workletNode);
      workletNode.connect(captureCtx.destination);

      // Tell server to enable voice
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'voice:on' }));
      }

      setState(s => ({ ...s, enabled: true }));
    } catch (err) {
      console.error('[Voice] Failed to start:', err);
    }
  }, [wsRef]);

  /**
   * Stop voice: clean up audio contexts and mic.
   */
  const stopVoice = useCallback(() => {
    // Tell server to disable voice
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'voice:off' }));
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (captureCtxRef.current) {
      captureCtxRef.current.close();
      captureCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    // Flush playback
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
    carryByteRef.current = null;
    if (playbackElRef.current) {
      playbackElRef.current.pause();
      playbackElRef.current.srcObject = null;
      playbackElRef.current = null;
    }
    if (playbackDestRef.current) {
      playbackDestRef.current.disconnect();
      playbackDestRef.current = null;
    }
    if (playbackCtxRef.current) {
      playbackCtxRef.current.close();
      playbackCtxRef.current = null;
    }
    setState(s => ({ ...s, enabled: false, speakingAgentId: null }));
  }, [wsRef]);

  const toggleMute = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      const track = stream.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setState(s => ({ ...s, muted: !track.enabled }));
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoice();
    };
  }, [stopVoice]);

  return {
    ...state,
    startVoice,
    stopVoice,
    toggleMute,
    handleVoiceMessage,
  };
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + 0x8000, bytes.length)) as unknown as number[]
    );
  }
  return btoa(bin);
}
