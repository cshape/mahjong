import 'dotenv/config';
import './game/engine/node-shim.js';

import cors from 'cors';
import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { parse } from 'url';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { fileURLToPath } from 'url';

import { GameRoom } from './game/adapter/game-room.js';
import { RoomManager } from './room-manager.js';
import { CLAIM } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000');
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

const roomManager = new RoomManager();

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', rooms: roomManager.roomCount });
});

// Create a new game room
app.post('/api/rooms', (_req, res) => {
  const { code } = roomManager.createRoom();
  res.json({ code });
});

// Check if a room exists
app.get('/api/rooms/:code', (req, res) => {
  const room = roomManager.getRoom(req.params.code);
  if (!room) {
    return res.status(404).json({ exists: false });
  }
  const lobbyState = room.getLobbyState();
  res.json({
    exists: true,
    phase: room.phase,
    playerCount: lobbyState.humanCount,
    canJoin: room.phase === 'waiting' && !room.isFull(),
  });
});

// Serve client static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback — but not for /api or /game routes
  app.get('/{*splat}', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  const { pathname } = parse(request.url!);

  if (pathname === '/game') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// WebSocket connections
wss.on('connection', (ws, request) => {
  let room: GameRoom | undefined;
  let seatId: number = -1;
  let roomCode: string | undefined;

  ws.on('message', (data: RawData) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(ws, msg);
    } catch (err) {
      send({ type: 'error', message: 'Invalid message' });
    }
  });

  ws.on('close', () => {
    if (room && seatId >= 0) {
      room.removeHumanPlayer(seatId);
      roomManager.removeConnection(ws);

      // Clean up empty rooms after a delay
      if (roomCode) {
        setTimeout(() => roomManager.cleanupIfEmpty(roomCode!), 60_000);
      }
    }
  });

  function send(msg: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function handleMessage(ws: WebSocket, msg: any) {
    switch (msg.type) {
      case 'join': {
        const playerName = msg.playerName || 'Player';
        const requestedCode = msg.roomCode?.toUpperCase();

        if (requestedCode) {
          // Join existing room
          room = roomManager.getRoom(requestedCode);
          if (!room) {
            return send({ type: 'error', message: 'Room not found' });
          }
          if (room.phase !== 'waiting') {
            return send({ type: 'error', message: 'Game already in progress' });
          }
          if (room.isFull()) {
            return send({ type: 'error', message: 'Room is full' });
          }
          roomCode = requestedCode;
        } else {
          // Create new room
          const result = roomManager.createRoom();
          room = result.room;
          roomCode = result.code;
        }

        seatId = room.addHumanPlayer(playerName, send);
        if (seatId === -1) {
          return send({ type: 'error', message: 'Could not join room' });
        }

        roomManager.registerConnection(ws, roomCode, seatId);

        // Listen for game events (logging)
        if (seatId === 0) {
          room.on('game:event', (event) => {
            if (event.type === 'game:end') {
              console.log(`Game ${room!.id} ended. Scores: ${event.scores}`);
            }
          });
        }

        send({
          type: 'game:joined',
          roomCode,
          seatId,
          players: room.seats.map(s => s ? { id: s.id, name: s.name, isBot: s.isBot } : null),
        });

        break;
      }

      case 'start': {
        if (!room) return send({ type: 'error', message: 'Not in a room' });
        if (seatId !== 0) return send({ type: 'error', message: 'Only the host can start the game' });
        if (room.phase !== 'waiting') return send({ type: 'error', message: 'Game already started' });

        room.fillBotsAndStart().catch(err => {
          console.error('Game start error:', err);
          send({ type: 'error', message: 'Failed to start game' });
        });
        break;
      }

      case 'discard': {
        if (!room) return send({ type: 'error', message: 'Not in a room' });
        room.onHumanDiscard(seatId, msg.tileIndex);
        break;
      }

      case 'claim': {
        if (!room) return send({ type: 'error', message: 'Not in a room' });
        room.onHumanClaim(seatId, msg.claimtype);
        break;
      }

      case 'pass': {
        if (!room) return send({ type: 'error', message: 'Not in a room' });
        room.onHumanPass(seatId);
        break;
      }

      case 'restart': {
        if (!room) return send({ type: 'error', message: 'Not in a room' });
        if (room.phase !== 'finished') return send({ type: 'error', message: 'Game not finished' });
        room.restart().catch(err => {
          console.error('Game restart error:', err);
          send({ type: 'error', message: 'Failed to restart game' });
        });
        break;
      }

      case 'mic:audio': {
        if (room?.voiceManager && msg.audio) {
          room.voiceManager.onMicAudio(seatId, msg.audio);
        }
        break;
      }

      case 'chat': {
        if (!room) return send({ type: 'error', message: 'Not in a room' });
        const chatName = room.seats[seatId]?.name || 'Player';
        const chatMsg = { type: 'chat', seatId, playerName: chatName, text: msg.text };
        // Broadcast to all humans
        for (const seat of room.seats) {
          if (seat && !seat.isBot && seat.send) seat.send(chatMsg);
        }
        // Feed into voice manager so AI characters can react
        if (room.voiceManager) {
          room.voiceManager.onTextChat(chatName, msg.text);
        }
        break;
      }

      case 'welcome:dismissed': {
        room?.voiceManager?.onPlayerReady();
        break;
      }

      case 'voice:on': {
        room?.voiceManager?.setVoicePaused(false);
        break;
      }

      case 'voice:off': {
        room?.voiceManager?.setVoicePaused(true);
        break;
      }

      default:
        send({ type: 'error', message: `Unknown message type: ${msg.type}` });
    }
  }
});

server.listen(PORT, () => {
  console.log(`Mahjong server running on port ${PORT}`);
});

function shutdown() {
  console.log('Shutting down...');
  server.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
