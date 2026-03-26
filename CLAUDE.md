# CLAUDE.md

## Project Overview

Mahjong AI voice demo. 4-player Cantonese mahjong with 3 AI voice characters powered by Inworld Realtime API. Monorepo with `client/` (React + Vite) and `server/` (Node + Express + WebSocket).

## Commands

```bash
npm run dev            # run server + client concurrently (dev mode)
npm run dev:server     # server only (nodemon + ts-node, port 3001)
npm run dev:client     # client only (vite dev, port 5173, proxies to :3001)
npm run build          # build both client and server for production
npm start              # run production server (serves client/dist)
```

Server TypeScript check:
```bash
cd server && npx tsc --noEmit
```

Client TypeScript check (use --noEmit, `tsc -b` has pre-existing unrelated errors):
```bash
cd client && npx tsc --noEmit
```

Client build (vite):
```bash
cd client && npx vite build
```

## Architecture

### Client (`client/src/`)
- `App.tsx` — main game UI, lobby/game state machine
- `useGameSocket.ts` — WebSocket connection, sends/receives game messages
- `useVoice.ts` — mic capture (24kHz PCM16), audio playback queues per agent
- `components/` — GameBoard, Tile, ActionBar, VoicePanel, TranscriptLog, etc.
- Vite dev server on :5173 proxies `/api` and `/game` (ws) to :3001

### Server (`server/`)
- `index.ts` — Express HTTP + WebSocket server, room routing
- `room-manager.ts` — multi-room lobby, short game codes
- `voice/voice-manager.ts` — voice orchestration (the most important file for AI behavior)
  - `ALL_PERSONAS` array (line ~22): character names, voices, and system prompts
  - `buildDispatcherInstructions()`: controls when/who speaks
  - Silence detection (15s) and slow discard detection (10s) timers
- `voice/realtime-session.ts` — Inworld Realtime API WebSocket client, handles connect/reconnect/auth
- `game/adapter/game-room.ts` — bridges Pomax game engine to WebSocket clients
  - `ALL_BOT_PERSONAS` array: bot name/voice mapping (keep in sync with voice-manager)
  - Emits game events: `turn:discard`, `turn:draw`, `turn:claim`, `hand:win`, `hand:draw`, `game:end`
- `game/adapter/state-filter.ts` — filters game state per player (hides opponents' tiles)
- `game/engine/` — Pomax mahjong engine (forked JS, not TypeScript). Don't modify unless fixing game logic bugs.

### Key Data Flow
1. Client connects via WebSocket to `/game?room=CODE&seat=N`
2. Game events flow: engine → game-room.ts → voice-manager.ts → dispatcher session → agent session → audio back to client
3. Human speech: mic → client WS → server → STT session → transcript → dispatcher → agent response

## Environment
- `INWORLD_API_KEY` — required for voice (base64-encoded). Without it, game runs but AI characters are silent.
- `PORT` — server port (default 3000, dev mode uses 3001)

## Code Conventions
- Server is TypeScript (ESM, `"type": "module"`). Game engine files are plain JS with `allowJs: true`.
- No test framework set up. Manual testing by playing the game.
- Character names must stay in sync between `voice-manager.ts` (ALL_PERSONAS) and `game-room.ts` (ALL_BOT_PERSONAS) and `client/src/useVoice.ts` (AGENT_NAMES).
- Audio format throughout: 24kHz PCM16 mono, transmitted as base64 over WebSocket.

## Characters
- **Grandpa** (voice: Clive) — supportive, tells old country stories, disfluencies: "ah," "well now," "you know"
- **Gladys** (voice: Eleanor) — kvetching, sarcastic, loves Sheungs, disfluencies: "ugh," "oh for crying out loud"
- **Lucky** (voice: Dennis) — 17yo e-sports gambler, teen slang, disfluencies: "like," "bro," "yo"
- Gladys is Lucky's mom. Grandpa is Gladys' father (Lucky's great-grandpa).
- Personas use Inworld audio markups: `[laugh]`, `[sigh]`, `[cough]`, `[clear_throat]`, `[breathe]`
