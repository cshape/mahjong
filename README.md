# Mahjong AI Voice Demo

A 4-player Cantonese mahjong game with AI-powered voice characters, built on the [Inworld Realtime API](https://docs.inworld.ai). Responsive — works on desktop and mobile.

One human player sits at a table with three AI opponents — Grandpa, Gladys, and Lucky — who speak, react to game events, and chat with the player using synthesized voice.

## Setup

```bash
npm install          # root deps (concurrently)
npm run install:all  # client + server deps
```

Copy `.env.example` to `.env` in the project root and fill in your Inworld API key:

```
INWORLD_API_KEY=<base64-encoded key>
```

## Running

```bash
npm run dev          # starts server (port 3001) + client (port 5173) concurrently
npm run dev:server   # server only
npm run dev:client   # client only (vite dev server with proxy to :3001)
```

Open http://localhost:5173 in your browser. Create a room, then start the game.

## Production Build

```bash
npm run build   # builds client (vite) + server (tsc)
npm start       # runs server/dist/index.js, serves client/dist as static files
```

## Deploy to Render

The repo includes a `render.yaml` for one-click Render deploy. Set the `INWORLD_API_KEY` environment variable in the Render dashboard. Pushes to `main` auto-deploy.

## Architecture

```
client/          React + Vite frontend
  src/
    App.tsx              Main game UI, lobby/game state machine
    useGameSocket.ts     WebSocket connection to server
    useVoice.ts          Mic capture + audio playback
    useBgm.ts            Background music (loop, volume control)
    useIsMobile.ts       Responsive breakpoint hook
    useSoundEffects.ts   Synthesized game sound effects
    components/
      GameBoard.tsx      Main game layout (desktop + mobile)
      PlayerArea.tsx     Player hand, locked sets, score display
      DiscardPool.tsx    Center discard area with spotlight animation
      ActionBar.tsx      Discard/claim/pass buttons
      VoicePanel.tsx     Voice on/off/mute controls
      TranscriptLog.tsx  Voice chat transcript sidebar
      EventLog.tsx       Game event log sidebar
      RulesPanel.tsx     Slide-out rules & tips panel
      WaitingRoom.tsx    Pre-game lobby
      Tile.tsx           Individual tile rendering

server/          Node + Express + WebSocket backend
  index.ts               HTTP server, WebSocket upgrade, room routing
  room-manager.ts        Multi-room lobby with short game codes
  voice/
    voice-manager.ts     Orchestrates AI voice (dispatcher + per-bot agents)
    realtime-session.ts  Inworld Realtime API WebSocket client
  game/
    adapter/
      game-room.ts       Bridges game engine to WebSocket clients
      state-filter.ts    Per-player state view (hides opponents' tiles)
      types.ts           Shared types and events
    engine/              Mahjong game engine (forked from Pomax/mj)
      game/              Core game loop, wall, tile dealing
      players/           Bot AI, human input adapter, personality
      scoring/           Cantonese & Chinese Classical scoring
      algorithm/         Tile pattern matching
```

## Voice System

The voice system uses three types of Inworld Realtime API sessions:

- **STT sessions** (one per human): transcribe mic audio via Whisper
- **Dispatcher session** (text-only): receives game events + human speech, decides which AI character should speak next
- **Agent sessions** (one per bot): each has a persona, generates voiced responses

Characters pipe up on their own if the table is silent for 15 seconds, or if the human player takes more than 10 seconds to discard. Turning voice off sends `voice:off` to the server, which cancels in-flight responses and stops dispatching until re-enabled.

Audio markup tags (`[laugh]`, `[sigh]`, etc.) are stripped from the transcript display.

## Game Features

- **Background music** with play/pause toggle and volume slider — auto-starts when a game begins
- **Win celebration** with trophy overlay, golden player highlight, and fanfare sound
- **Game over scoreboard** with ranked scores
- **New Game** restarts in-place (same players, same room, no page reload) — music and voice persist
- **Responsive mobile layout** — single column, hamburger menu, slide-out log/chat panels

## Characters

| Name | Voice | Personality |
|------|-------|-------------|
| Grandpa | Clive | Supportive sweetheart, tells stories from the old country. Gladys' father. |
| Gladys | Eleanor | Kvetching and sarcastic, but loves Sheungs. Lucky's mom, Grandpa's daughter. |
| Lucky | Dennis | 17-year-old e-sports gambler, cocky teen energy. Gladys' son. |

Characters use natural disfluencies and Inworld audio markups for expressive speech.
