import { useState, useRef, useCallback, useEffect } from 'react';
import { useGameSocket } from './useGameSocket';
import { useVoice } from './useVoice';
import { useSoundEffects } from './useSoundEffects';
import { useBgm } from './useBgm';
import { GameBoard } from './components/GameBoard';
import { WaitingRoom } from './components/WaitingRoom';
import { theme } from './theme';
import type { GameEvent } from './types';
import './App.css';

function App() {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const voice = useVoice(wsRef);
  const sfx = useSoundEffects();
  const bgm = useBgm();

  const handleGameEvent = useCallback((event: GameEvent) => {
    switch (event.type) {
      case 'turn:discard': sfx.play('discard'); break;
      case 'turn:claim': sfx.play('claim'); break;
      case 'hand:win': sfx.play('win'); break;
      case 'turn:draw': sfx.play('draw'); break;
    }
  }, [sfx]);

  const {
    screen, connected, gameState, seatId, events, roomCode,
    lobbyState, pendingAction, claimOptions, error,
    createGame, joinGame, startGame, discard, claim, pass, restart, sendChat,
    wsRef: gameWsRef,
  } = useGameSocket(voice.handleVoiceMessage, handleGameEvent);

  wsRef.current = gameWsRef.current;

  // Auto-start voice when game begins
  const voiceStartedRef = useRef(false);
  useEffect(() => {
    if (screen === 'playing' && gameState && !voice.enabled && !voiceStartedRef.current) {
      voiceStartedRef.current = true;
      voice.startVoice();
    }
  }, [screen, gameState, voice]);

  // Auto-start BGM when entering waiting room or game
  const bgmStartedRef = useRef(false);
  useEffect(() => {
    if ((screen === 'waiting' || screen === 'playing') && !bgmStartedRef.current) {
      bgmStartedRef.current = true;
      bgm.start();
    }
  }, [screen, bgm]);

  // Home screen
  if (screen === 'home') {
    return (
      <div style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.font,
        background: `
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 1.5rem,
            rgba(160,120,60,0.08) 1.5rem,
            rgba(160,120,60,0.08) 1.55rem
          ),
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 6rem,
            rgba(120,80,30,0.06) 6rem,
            rgba(120,80,30,0.06) 6.1rem
          ),
          linear-gradient(
            170deg,
            #D4C4A0 0%, #C8B68C 30%, #DACCB0 50%, #C4B288 80%, #D0C098 100%
          )
        `,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{
            fontSize: '3rem', fontWeight: 800, marginBottom: 0,
            background: 'linear-gradient(135deg, #F2836B, #E06B55)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>麻雀 Mahjong</h1>
        </div>

        {/* Name + Buttons container */}
        <div style={{ width: '20rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            autoFocus
            style={{
              padding: '0.75rem 1.25rem',
              fontSize: '1rem',
              border: `2px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: theme.colors.bgCard,
              color: theme.colors.textPrimary,
              textAlign: 'center',
            }}
          />

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => playerName.trim() && createGame(playerName.trim())}
              disabled={!playerName.trim()}
              style={{
                flex: 1,
                padding: '0.875rem 0',
                fontSize: '1rem',
                fontWeight: 700,
                backgroundColor: playerName.trim() ? theme.colors.accent : theme.colors.textMuted,
                color: '#fff',
                border: 'none',
                borderRadius: theme.radius.md,
                cursor: playerName.trim() ? 'pointer' : 'not-allowed',
                opacity: playerName.trim() ? 1 : 0.4,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              Create Game
            </button>
            <button
              onClick={() => setShowJoinInput(!showJoinInput)}
              style={{
                flex: 1,
                padding: '0.875rem 0',
                fontSize: '1rem',
                fontWeight: 700,
                backgroundColor: 'transparent',
                color: theme.colors.accent,
                border: `2px solid ${theme.colors.accent}`,
                borderRadius: theme.radius.md,
                cursor: 'pointer',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              Join Game
            </button>
          </div>
        </div>

        {/* Join Code Input */}
        {showJoinInput && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <input
              type="text"
              placeholder="Enter code"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              onKeyDown={e => {
                if (e.key === 'Enter' && playerName.trim() && joinCode.length === 4) {
                  joinGame(playerName.trim(), joinCode);
                }
              }}
              autoFocus
              maxLength={4}
              style={{
                padding: '0.625rem 1rem',
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: '0.375rem',
                border: `2px solid ${theme.colors.border}`,
                borderRadius: theme.radius.md,
                outline: 'none',
                width: '8.75rem',
                backgroundColor: theme.colors.bgCard,
                color: theme.colors.textPrimary,
                textAlign: 'center',
              }}
            />
            <button
              onClick={() => playerName.trim() && joinCode.length === 4 && joinGame(playerName.trim(), joinCode)}
              disabled={!playerName.trim() || joinCode.length !== 4}
              style={{
                padding: '0.625rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                backgroundColor: (playerName.trim() && joinCode.length === 4) ? theme.colors.accent : theme.colors.textMuted,
                color: '#fff',
                border: 'none',
                borderRadius: theme.radius.md,
                cursor: (playerName.trim() && joinCode.length === 4) ? 'pointer' : 'not-allowed',
                opacity: (playerName.trim() && joinCode.length === 4) ? 1 : 0.4,
              }}
            >
              Join
            </button>
          </div>
        )}

        {error && (
          <p style={{ color: '#d44', fontSize: '0.875rem', marginTop: '0.5rem' }}>{error}</p>
        )}

        {connected && screen === 'home' && (
          <p style={{ marginTop: '1rem', color: theme.colors.textSecondary, fontSize: '0.875rem' }}>
            Connecting...
          </p>
        )}
      </div>
    );
  }

  // Waiting room
  if (screen === 'waiting') {
    return (
      <WaitingRoom
        roomCode={roomCode!}
        seatId={seatId}
        lobbyState={lobbyState}
        onStart={startGame}
      />
    );
  }

  // Game board — wait for first game:state before rendering
  if (!gameState) {
    return (
      <div style={{
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, #D4E8CC 0%, #E8F0E4 50%, #C8DCBC 100%)',
        fontFamily: theme.font,
        color: theme.colors.textSecondary,
        fontSize: 18,
      }}>
        Starting game...
      </div>
    );
  }

  return (
    <GameBoard
      gameState={gameState}
      seatId={seatId}
      events={events}
      pendingAction={pendingAction}
      claimOptions={claimOptions}
      onDiscard={discard}
      onClaim={claim}
      onPass={pass}
      onRestart={restart}
      onSendChat={sendChat}
      voice={voice}
      bgm={bgm}
    />
  );
}

export default App;
