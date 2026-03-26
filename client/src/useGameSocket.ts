import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientGameState, GameEvent, ServerMessage, ClaimOption, LobbyState } from './types';

/** Callback for voice-related messages from the server */
type VoiceMessageHandler = (msg: any) => void;

export type AppScreen = 'home' | 'waiting' | 'playing';

interface GameSocketState {
  connected: boolean;
  screen: AppScreen;
  roomCode: string | null;
  seatId: number;
  lobbyState: LobbyState | null;
  gameState: ClientGameState | null;
  events: GameEvent[];
  pendingAction: 'discard' | 'claim' | null;
  claimOptions: ClaimOption[] | null;
  claimTile: number | null;
  error: string | null;
}

export function useGameSocket(
  onVoiceMessage?: VoiceMessageHandler,
  onGameEvent?: (event: GameEvent) => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const voiceHandlerRef = useRef(onVoiceMessage);
  voiceHandlerRef.current = onVoiceMessage;
  const gameEventRef = useRef(onGameEvent);
  gameEventRef.current = onGameEvent;

  const [state, setState] = useState<GameSocketState>({
    connected: false,
    screen: 'home',
    roomCode: null,
    seatId: 0,
    lobbyState: null,
    gameState: null,
    events: [],
    pendingAction: null,
    claimOptions: null,
    claimTile: null,
    error: null,
  });

  const connectWs = useCallback((playerName: string, roomCode?: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/game`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(s => ({ ...s, connected: true, error: null }));
      ws.send(JSON.stringify({
        type: 'join',
        playerName,
        ...(roomCode ? { roomCode } : {}),
      }));
    };

    ws.onmessage = (e) => {
      const msg: ServerMessage = JSON.parse(e.data);

      switch (msg.type) {
        case 'game:joined':
          setState(s => ({
            ...s,
            roomCode: msg.roomCode,
            seatId: msg.seatId,
            screen: 'waiting',
          }));
          break;

        case 'lobby:state':
          setState(s => ({
            ...s,
            lobbyState: msg.state,
          }));
          break;

        case 'lobby:started':
          setState(s => ({
            ...s,
            screen: 'playing',
          }));
          break;

        case 'game:state':
          setState(s => ({
            ...s,
            screen: 'playing',
            gameState: msg.state,
            pendingAction: msg.state.myTurnAction,
          }));
          break;

        case 'game:event':
          setState(s => {
            const newState = {
              ...s,
              events: [...s.events.slice(-50), msg.event],
            };

            if (msg.event.type === 'turn:prompt' && msg.event.data) {
              if (msg.event.data.action === 'discard') {
                newState.pendingAction = 'discard';
                newState.claimOptions = null;
                newState.claimTile = null;
              } else if (msg.event.data.action === 'claim') {
                newState.pendingAction = 'claim';
                newState.claimOptions = msg.event.data.options || null;
                newState.claimTile = msg.event.data.tile ?? null;
              }
            }

            return newState;
          });
          gameEventRef.current?.(msg.event);
          break;

        case 'voice:audio':
        case 'voice:transcript':
        case 'voice:human_transcript':
        case 'voice:interrupt':
        case 'voice:speaking':
          voiceHandlerRef.current?.(msg);
          break;

        case 'error':
          console.error('Server error:', msg.message);
          setState(s => ({ ...s, error: msg.message }));
          break;
      }
    };

    ws.onclose = () => {
      setState(s => ({ ...s, connected: false }));
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }, []);

  const send = useCallback((msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const createGame = useCallback((playerName: string) => {
    connectWs(playerName);
  }, [connectWs]);

  const joinGame = useCallback((playerName: string, roomCode: string) => {
    connectWs(playerName, roomCode);
  }, [connectWs]);

  const startGame = useCallback(() => {
    send({ type: 'start' });
  }, [send]);

  const discard = useCallback((tileIndex: number) => {
    send({ type: 'discard', tileIndex });
    setState(s => ({ ...s, pendingAction: null }));
  }, [send]);

  const claim = useCallback((claimtype: number) => {
    send({ type: 'claim', claimtype });
    setState(s => ({ ...s, pendingAction: null, claimOptions: null, claimTile: null }));
  }, [send]);

  const pass = useCallback(() => {
    send({ type: 'pass' });
    setState(s => ({ ...s, pendingAction: null, claimOptions: null, claimTile: null }));
  }, [send]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return {
    ...state,
    wsRef,
    createGame,
    joinGame,
    startGame,
    discard,
    claim,
    pass,
  };
}
