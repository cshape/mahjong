# CLAUDE.md

## Overview

Cantonese mahjong with 3 AI voice characters. Monorepo: `client/` (React + Vite) and `server/` (Node + Express + WebSocket). Deployed on Render — push to `main` to deploy.

## Commands

```bash
npm run dev          # server + client concurrently
npm run build        # build both for production
npm start            # run production server
```

Type-check: `cd server && npx tsc --noEmit`
Build client: `cd client && npx vite build`

## Architecture

### Voice Pipeline (server/voice/)

Three separate Inworld AI services replace the old unified Realtime API:

- **`stt-session.ts`** — WebSocket to `wss://api.inworld.ai/stt/v1/transcribe:streamBidirectional`. Model: `assemblyai/universal-streaming-english`. One persistent connection per human player. Receives 24kHz PCM16 mic audio, emits final transcripts.

- **`dispatcher.ts`** — HTTP POST to `/v1/chat/completions`. Model: `openai/gpt-4.1-mini`. Non-streaming, stateless. Takes game context, returns "speak: Name" or "silence". Called per game event batch and human speech.

- **`llm-tts.ts`** — HTTP POST to `/v1/chat/completions` with `audio` param. Model: `openai/gpt-4.1-nano` + `inworld-tts-1.5-max`. Streaming SSE — sends audio chunks (48kHz PCM) and transcript deltas. Each agent response is a fresh HTTP stream. Cancellation via AbortController.

- **`voice-manager.ts`** — Orchestrator. Routes game events → dispatcher → agent speech. Manages speech queue, silence/slow-discard timers, per-agent conversation history. Public API: `onGameEvent()`, `onMicAudio()`, `onTextChat()`, `setVoicePaused()`.

### Server (server/)

- `index.ts` — Express + WebSocket. Message types: `join`, `start`, `restart`, `discard`, `claim`, `pass`, `mic:audio`, `voice:on`, `voice:off`, `chat`
- `room-manager.ts` — Multi-room lobby with short game codes
- `game/adapter/game-room.ts` — Bridges Pomax engine to WebSocket. `restart()` for in-place game restart. `ALL_BOT_PERSONAS` must stay in sync with voice-manager.
- `game/engine/` — Pomax mahjong engine (forked JS). Don't modify unless fixing game bugs.

### Client (client/src/)

- `App.tsx` — State machine (home → waiting → playing). Owns BGM and voice hooks.
- `useGameSocket.ts` — WebSocket, exposes `restart()` and `sendChat()`
- `useVoice.ts` — Mic capture (24kHz), playback (48kHz), global audio queue
- `useBgm.ts` — Background music, alternates between `bgm_new.mp3` and `bgm.mp3`
- `useIsMobile.ts` — Breakpoint at 768px
- `components/GameBoard.tsx` — Desktop + mobile layouts, overlays (win, claim, welcome, game over)
- `components/TranscriptLog.tsx` — Chat display with text input. Strips `[audio_tags]` and `*emphasis*`.

### Key Flows

1. Human speech: mic → STT WebSocket → transcript → dispatcher HTTP → agent LLM+TTS stream → audio to client
2. Game event: engine → voice-manager → dispatcher → agent → audio
3. Text chat: client WS → broadcast to humans + feed to voice-manager → dispatcher → agent
4. Claims queue normally. Human speech interrupts current agent (abort + voice:interrupt).

## Environment

- `INWORLD_API_KEY` — Required (base64-encoded). Without it, game runs silently.
- `PORT` — Default 3000, dev uses 3001.

## Characters

- **Grandpa** (voice: Theodore) — Warm, nostalgic, time-worn. Filler: "ah," "well now," "you know"
- **Gladys** (voice: Loretta) — Kvetching, sarcastic, folksy. Loves Sheungs. Filler: "ugh," "oh for crying out loud"
- **Lucky** (voice: Avery) — Gen Z gambler, cocky. Filler: "like," "bro," "no cap," "lowkey"
- Family: Gladys is Lucky's mom. Grandpa is Gladys' father.
- Supported TTS tags: `[sigh]` `[laugh]` `[breathe]` `[cough]` `[clear_throat]` `[yawn]`
- Tags stripped from display in TranscriptLog.tsx

## Conventions

- Server: TypeScript ESM. Engine: plain JS (`allowJs`).
- Character names must sync between `voice-manager.ts` (ALL_PERSONAS) and `game-room.ts` (ALL_BOT_PERSONAS). Client gets names from server.
- Audio: mic 24kHz PCM16, TTS output 48kHz PCM, both as base64 over WebSocket.
- Sizes: rem for landing/lobby, px acceptable in game board for tile layout.
- BGM files in `client/public/`. Must be audio-only (not video containers).
