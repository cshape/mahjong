/**
 * Dispatcher: text-only LLM call to decide which AI character should speak.
 *
 * Uses Inworld's /v1/chat/completions endpoint (non-streaming).
 * Returns "speak: <Name>" or "silence".
 */

const LLM_MODEL = 'openai/gpt-4.1-mini';
const API_URL = 'https://api.inworld.ai/v1/chat/completions';

export async function askDispatcher(opts: {
  instructions: string;
  context: string;
}): Promise<string> {
  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) throw new Error('INWORLD_API_KEY not set');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: opts.instructions },
          { role: 'user', content: opts.context },
        ],
        max_tokens: 20,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Dispatcher] HTTP ${res.status}: ${text}`);
      return 'silence';
    }

    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || 'silence';
  } catch (err: any) {
    console.error('[Dispatcher] Error:', err.message);
    return 'silence';
  }
}
