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
    createGame, joinGame, startGame, discard, claim, pass, restart, sendChat, sendReady,
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

  // Auto-start BGM when game starts (not in lobby)
  const bgmStartedRef = useRef(false);
  useEffect(() => {
    if (screen === 'playing' && !bgmStartedRef.current) {
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
        <div style={theme.modalCard}>
        <h1 style={{
          fontSize: 'clamp(2rem, 6vw, 3rem)', fontWeight: 800, marginBottom: 'clamp(1rem, 3vw, 2rem)',
          background: 'linear-gradient(135deg, #F2836B, #E06B55)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textAlign: 'center',
        }}>麻雀 Mahjong</h1>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text"
            placeholder="Your name"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            autoFocus
            style={{
              padding: '0.75rem 1rem',
              fontSize: '1rem',
              border: `2px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: theme.colors.bgCard,
              color: theme.colors.textPrimary,
            }}
          />

          {!showJoinInput ? (
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
                onClick={() => setShowJoinInput(true)}
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
          ) : (
            <>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Game code"
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
                    flex: 1,
                    padding: '0.75rem 1rem',
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    letterSpacing: '0.25rem',
                    border: `2px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.md,
                    outline: 'none',
                    backgroundColor: theme.colors.bgCard,
                    color: theme.colors.textPrimary,
                    minWidth: 0,
                  }}
                />
                <button
                  onClick={() => playerName.trim() && joinCode.length === 4 && joinGame(playerName.trim(), joinCode)}
                  disabled={!playerName.trim() || joinCode.length !== 4}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    backgroundColor: (playerName.trim() && joinCode.length === 4) ? theme.colors.accent : theme.colors.textMuted,
                    color: '#fff',
                    border: 'none',
                    borderRadius: theme.radius.md,
                    cursor: (playerName.trim() && joinCode.length === 4) ? 'pointer' : 'not-allowed',
                    opacity: (playerName.trim() && joinCode.length === 4) ? 1 : 0.4,
                    flexShrink: 0,
                  }}
                >
                  Join
                </button>
              </div>
              <button
                onClick={() => { setShowJoinInput(false); setJoinCode(''); }}
                style={{
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  color: theme.colors.textMuted,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                ← Back
              </button>
            </>
          )}
        </div>

        {error && (
          <p style={{ color: '#d44', fontSize: '0.875rem', marginTop: '0.5rem' }}>{error}</p>
        )}

        {connected && screen === 'home' && (
          <p style={{ marginTop: '1rem', color: theme.colors.textSecondary, fontSize: '0.875rem' }}>
            Connecting...
          </p>
        )}
        </div>{/* end modal card */}

        {/* Footer icons */}
        <div className="footer-links" style={{
          position: 'fixed', bottom: 16, right: 20,
          display: 'flex', gap: 10, zIndex: 10,
        }}>
          <a
            className="footer-link"
            href="https://github.com/cshape/mahjong"
            target="_blank"
            rel="noopener noreferrer"
            title="View on GitHub"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', background: 'rgba(60,50,40,0.85)', color: '#F5F0E8',
              textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500,
              boxShadow: '0 4px 6px rgba(0,0,0,0.2)', border: '1px solid rgba(210,160,130,0.3)',
              transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            <span>GitHub</span>
          </a>
          <a
            className="footer-link"
            href="https://render.com/deploy?repo=https://github.com/cshape/mahjong"
            target="_blank"
            rel="noopener noreferrer"
            title="Deploy on Render"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', background: theme.colors.accent, color: '#fff',
              textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500,
              boxShadow: '0 4px 6px rgba(0,0,0,0.2)', border: `1px solid ${theme.colors.accent}`,
              transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7L12 12L22 7L12 2Z"/><path d="M2 17L12 22L22 17"/><path d="M2 12L12 17L22 12"/></svg>
            <span>Deploy on Render</span>
          </a>
        </div>
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
      onReady={sendReady}
      voice={voice}
      bgm={bgm}
    />
  );
}

export default App;
