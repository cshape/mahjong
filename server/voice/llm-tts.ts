/**
 * LLM+TTS: streaming chat completions with audio output.
 *
 * Uses Inworld's /v1/chat/completions endpoint with the `audio` parameter
 * to generate both text and speech in a single streaming HTTP call.
 * Each call is stateless — conversation history is passed in messages.
 */

export interface LlmTtsMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateSpeechOpts {
  voice: string;
  model?: string;
  messages: LlmTtsMessage[];
  onAudioChunk: (base64pcm: string) => void;
  onTranscript: (text: string, final: boolean) => void;
  onDone: (cancelled: boolean) => void;
  signal?: AbortSignal;
}

const LLM_MODEL = 'openai/gpt-4.1-nano';
const TTS_MODEL = 'inworld-tts-1.5-max';
const API_URL = 'https://api.inworld.ai/v1/chat/completions';

/**
 * Stream an LLM response with TTS audio.
 * Resolves when the stream completes or is aborted.
 */
export async function generateSpeech(opts: GenerateSpeechOpts): Promise<void> {
  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) throw new Error('INWORLD_API_KEY not set');

  const { voice, messages, onAudioChunk, onTranscript, onDone, signal } = opts;

  let cancelled = false;
  let fullTranscript = '';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model || LLM_MODEL,
        messages,
        stream: true,
        max_tokens: 200,
        audio: {
          voice,
          model: TTS_MODEL,
        },
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[LLM+TTS] HTTP ${res.status}: ${text}`);
      onDone(false);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onDone(false);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          const audio = delta.audio;
          if (audio?.data) {
            onAudioChunk(audio.data);
          }
          if (audio?.transcript) {
            fullTranscript += audio.transcript;
            onTranscript(audio.transcript, false);
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }

    // Emit final transcript
    if (fullTranscript) {
      onTranscript(fullTranscript, true);
    }
    onDone(false);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      cancelled = true;
      onDone(true);
    } else {
      console.error('[LLM+TTS] Error:', err.message);
      onDone(false);
    }
  }
}
