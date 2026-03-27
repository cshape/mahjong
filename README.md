# 麻雀 Mahjong

4-player Cantonese mahjong with AI voice characters. Built on [Inworld AI](https://inworld.ai).

**Stack:** React/Vite, Node/Express, WebSockets, Inworld AI (STT + LLM + TTS)

## Setup

```bash
npm install && npm run install:all
cp .env.example .env   # add your INWORLD_API_KEY
```

## Development

```bash
npm run dev   # server (3001) + client (5173) concurrently
```

## Production

```bash
npm run build && npm start
```

## Deploy to Render

1. Push to GitHub
2. In Render, click **New > Blueprint** and connect the repo
3. Render auto-detects `render.yaml`
4. Add `INWORLD_API_KEY` in the Render dashboard

Pushes to `main` auto-deploy.

## How It Works

One human player sits at a table with three AI opponents — **Grandpa**, **Gladys**, and **Lucky** — who speak, react to game events, and chat using synthesized voice.

The voice system uses three Inworld AI services:
- **STT** — transcribes human speech via WebSocket streaming
- **LLM** — dispatcher decides who speaks; agents generate dialogue
- **TTS** — converts agent responses to speech via streaming HTTP

Characters pipe up on their own during silence, react to claims and discards, and respond to both voice and text chat from players.

## Features

- Voice chat with AI characters (mic + speaker)
- Text chat with AI responses
- Background music with volume control
- Win celebrations and claim animations (Pong! Sheung! Kong!)
- In-place game restart (no page reload)
- Responsive mobile layout
- Multi-player support via game codes

## Characters

| Name | Voice | Personality |
|------|-------|-------------|
| Grandpa | Theodore | Warm, nostalgic old man. Tells stories from the old country. |
| Gladys | Loretta | Kvetching, sarcastic 40-something. Loves Sheungs. Lucky's mom. |
| Lucky | Avery | Gen Z e-sports gambler. Cocky but not mean. Gladys' son. |

## Acknowledgments

Mahjong game engine adapted from [Pomax/mahjong](https://github.com/Pomax/mahjong).
