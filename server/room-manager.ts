/**
 * RoomManager: manages multiple concurrent game rooms with short game codes.
 */
import { WebSocket } from 'ws';
import { GameRoom } from './game/adapter/game-room.js';

export interface ConnectionInfo {
  roomCode: string;
  seatId: number;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private wsToRoom = new Map<WebSocket, ConnectionInfo>();

  /** Create a new room with a short game code. */
  createRoom(): { code: string; room: GameRoom } {
    const code = this._generateCode();
    const room = new GameRoom(code);
    this.rooms.set(code, room);
    return { code, room };
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      room.voiceManager?.close();
      this.rooms.delete(code);
    }
  }

  /** Track a WebSocket connection to a room + seat. */
  registerConnection(ws: WebSocket, roomCode: string, seatId: number): void {
    this.wsToRoom.set(ws, { roomCode, seatId });
  }

  /** Get the room and seat for a WebSocket connection. */
  getConnection(ws: WebSocket): ConnectionInfo | undefined {
    return this.wsToRoom.get(ws);
  }

  /** Remove a WebSocket connection and handle cleanup. */
  removeConnection(ws: WebSocket): { room: GameRoom; seatId: number } | undefined {
    const info = this.wsToRoom.get(ws);
    if (!info) return undefined;

    this.wsToRoom.delete(ws);
    const room = this.rooms.get(info.roomCode);
    if (!room) return undefined;

    return { room, seatId: info.seatId };
  }

  /** Clean up empty rooms (no humans connected). */
  cleanupIfEmpty(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;

    const hasHumans = room.seats.some(s => s && !s.isBot && s.send);
    if (!hasHumans) {
      console.log(`[RoomManager] Cleaning up empty room ${code}`);
      this.deleteRoom(code);
    }
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  /** Generate a 4-character alphanumeric game code. */
  private _generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
    let code: string;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }
}
