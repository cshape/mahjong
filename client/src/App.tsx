import { useState, useRef, useCallback, useEffect } from 'react';
import { useGameSocket } from './useGameSocket';
import { useVoice } from './useVoice';
import { useSoundEffects } from './useSoundEffects';
import { GameBoard } from './components/GameBoard';
import { WaitingRoom } from './components/WaitingRoom';
import { theme } from './theme';
import type { GameEvent } from './types';
import './App.css';

/** Background images for the landing page — place files in public/bg/ */
const BG_IMAGES = [
  '/bg/1.jpg',
  '/bg/2.jpg',
  '/bg/3.jpg',
  '/bg/4.jpg',
  '/bg/5.jpg',
];
const BG_INTERVAL = 6000; // ms between transitions

function App() {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  const voice = useVoice(wsRef);
  const sfx = useSoundEffects();

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
    createGame, joinGame, startGame, discard, claim, pass,
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

  // Cycle background images on landing page
  useEffect(() => {
    if (screen !== 'home') return;
    const timer = setInterval(() => {
      setBgIndex(i => (i + 1) % BG_IMAGES.length);
    }, BG_INTERVAL);
    return () => clearInterval(timer);
  }, [screen]);

  // Home screen
  if (screen === 'home') {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a1a',
        fontFamily: theme.font,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Crossfading background images */}
        {BG_IMAGES.map((src, i) => (
          <div
            key={src}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: i === bgIndex ? 1 : 0,
              transition: 'opacity 2s ease-in-out',
              zIndex: 0,
            }}
          />
        ))}
        {/* Dark overlay for readability */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1,
        }} />
        {/* Content (above background) */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{
            fontSize: 48, fontWeight: 800, marginBottom: 0,
            background: 'linear-gradient(135deg, #F2836B, #E06B55)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>麻雀 Mahjong</h1>
        </div>

        {/* Name + Buttons container */}
        <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            autoFocus
            style={{
              padding: '12px 20px',
              fontSize: 16,
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

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => playerName.trim() && createGame(playerName.trim())}
              disabled={!playerName.trim()}
              style={{
                flex: 1,
                padding: '14px 0',
                fontSize: 16,
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
                padding: '14px 0',
                fontSize: 16,
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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
                padding: '10px 16px',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 6,
                border: `2px solid ${theme.colors.border}`,
                borderRadius: theme.radius.md,
                outline: 'none',
                width: 140,
                backgroundColor: theme.colors.bgCard,
                color: theme.colors.textPrimary,
                textAlign: 'center',
              }}
            />
            <button
              onClick={() => playerName.trim() && joinCode.length === 4 && joinGame(playerName.trim(), joinCode)}
              disabled={!playerName.trim() || joinCode.length !== 4}
              style={{
                padding: '10px 24px',
                fontSize: 14,
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
          <p style={{ color: '#d44', fontSize: 14, marginTop: 8 }}>{error}</p>
        )}

        {connected && screen === 'home' && (
          <p style={{ marginTop: 16, color: theme.colors.textSecondary, fontSize: 14 }}>
            Connecting...
          </p>
        )}

        </div>{/* end content wrapper */}
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
        height: '100vh',
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
      voice={voice}
    />
  );
}

export default App;
