import { useState, useMemo, useEffect } from 'react';
import { PlayerArea } from './PlayerArea';
import { DiscardPool } from './DiscardPool';
import { ActionBar } from './ActionBar';
import { EventLog } from './EventLog';
import { VoicePanel } from './VoicePanel';
import { TranscriptLog } from './TranscriptLog';
import { RulesPanel } from './RulesPanel';
import { theme } from '../theme';
import type { ClientGameState, GameEvent, ClaimOption } from '../types';
import { WIND_NAMES } from '../types';

interface VoiceHook {
  enabled: boolean;
  muted: boolean;
  transcripts: { agentId: number | null; agentName: string; text: string; final: boolean; timestamp: number }[];
  startVoice: () => void;
  stopVoice: () => void;
  toggleMute: () => void;
}

interface BgmHook {
  playing: boolean;
  volume: number;
  toggle: () => void;
  changeVolume: (v: number) => void;
}

interface GameBoardProps {
  gameState: ClientGameState;
  seatId: number;
  events: GameEvent[];
  pendingAction: 'discard' | 'claim' | null;
  claimOptions: ClaimOption[] | null;
  onDiscard: (tileIndex: number) => void;
  onClaim: (claimtype: number) => void;
  onPass: () => void;
  onRestart: () => void;
  voice?: VoiceHook;
  bgm?: BgmHook;
}

export function GameBoard({
  gameState, seatId, events, pendingAction, claimOptions,
  onDiscard, onClaim, onPass, onRestart, voice, bgm,
}: GameBoardProps) {
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [winnerId, setWinnerId] = useState<number | null>(null);

  // Detect hand wins from events
  useEffect(() => {
    const last = events[events.length - 1];
    if (last?.type === 'hand:win' && last.winner != null) {
      setWinnerId(last.winner);
      const timer = setTimeout(() => setWinnerId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [events]);

  const seatOrder = useMemo(() => [
    seatId,
    (seatId + 1) % 4,
    (seatId + 2) % 4,
    (seatId + 3) % 4,
  ], [seatId]);

  const lastDiscard = useMemo(() => {
    const discardEvents = events.filter(e => e.type === 'turn:discard');
    const last = discardEvents[discardEvents.length - 1];
    if (last) return { playerId: last.playerId!, tile: last.tile! };
    return null;
  }, [events]);

  const handleTileClick = (index: number) => {
    if (pendingAction === 'discard') {
      setSelectedTile(prev => prev === index ? null : index);
    }
  };

  const handleDiscard = () => {
    if (selectedTile !== null) {
      // Map sorted display index → original engine tile index
      const originalIndex = gameState.myHandOriginalIndices?.[selectedTile] ?? selectedTile;
      onDiscard(originalIndex);
      setSelectedTile(null);
    }
  };

  const btnStyle: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 700,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    background: theme.colors.bgCard,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    lineHeight: '18px',
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '100vw', height: '100vh', overflow: 'hidden' }}>
      <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <div style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateAreas: showLog
          ? `"topbar topbar topbar" "elog board tlog"`
          : `"topbar" "board"`,
        gridTemplateColumns: showLog
          ? 'clamp(160px, 16vw, 240px) 1fr clamp(160px, 16vw, 240px)'
          : '1fr',
        gridTemplateRows: 'auto 1fr',
        gap: 8,
        padding: 8,
        background: theme.colors.bgPage,
      }}>
        {/* Top bar */}
        <div style={{
          gridArea: 'topbar',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          background: theme.colors.bgCard,
          borderRadius: theme.radius.md,
          boxShadow: theme.colors.shadow,
          minHeight: 48,
        }}>
          {/* Logo */}
          <span style={{
            fontSize: 18, fontWeight: 800,
            color: theme.colors.accent,
            flexShrink: 0,
          }}>
            🀄 麻雀
          </span>

          {/* Stats */}
          <div style={{
            display: 'flex', gap: 14, fontSize: 12,
            color: theme.colors.textSecondary,
            marginLeft: 'auto',
          }}>
            <span>Hand <b style={{ color: theme.colors.accent }}>{gameState.hand}</b></span>
            <span>Wind <b style={{ color: theme.colors.accent }}>{WIND_NAMES[gameState.wind]}</b></span>
            <span>Round <b style={{ color: theme.colors.accent }}>{WIND_NAMES[gameState.windOfTheRound]}</b></span>
            <span>Wall <b style={{ color: theme.colors.accent }}>{gameState.wallRemaining}</b></span>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            {bgm && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={bgm.toggle}
                  style={{
                    ...btnStyle,
                    width: 32, height: 32, padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                    borderColor: bgm.playing ? theme.colors.accent : theme.colors.border,
                    color: bgm.playing ? theme.colors.accent : theme.colors.textSecondary,
                    background: bgm.playing ? theme.colors.accentSoft : theme.colors.bgCard,
                    borderRadius: '50%',
                  }}
                  title={bgm.playing ? 'Pause music' : 'Play music'}
                >
                  {bgm.playing ? '⏸' : '♫'}
                </button>
                {bgm.playing && (
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={bgm.volume}
                    onChange={e => bgm.changeVolume(parseFloat(e.target.value))}
                    title={`Volume: ${Math.round(bgm.volume * 100)}%`}
                    style={{ width: 60, height: 4, cursor: 'pointer', accentColor: theme.colors.accent }}
                  />
                )}
              </div>
            )}
            {voice && (
              <VoicePanel
                enabled={voice.enabled}
                muted={voice.muted}
                onStartVoice={voice.startVoice}
                onStopVoice={voice.stopVoice}
                onToggleMute={voice.toggleMute}
              />
            )}
            <button
              onClick={() => setShowLog(s => !s)}
              style={{
                ...btnStyle,
                borderColor: showLog ? theme.colors.accent : theme.colors.border,
                color: showLog ? theme.colors.accent : theme.colors.textSecondary,
                background: showLog ? theme.colors.accentSoft : theme.colors.bgCard,
              }}
            >
              Log
            </button>
            <button
              onClick={() => setRulesOpen(true)}
              style={{
                ...btnStyle,
                width: 32, height: 32, padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 800,
                color: theme.colors.accent,
                borderRadius: '50%',
              }}
              title="Rules & Tips"
            >
              ?
            </button>
          </div>
        </div>

        {/* Event Log sidebar */}
        {showLog && (
          <div style={{
            gridArea: 'elog',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <EventLog events={events} players={gameState.players} />
          </div>
        )}

        {/* Board area */}
        <div style={{
          gridArea: 'board',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'stretch',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: '100%',
            background: `
              repeating-linear-gradient(
                87deg,
                rgba(255,255,255,0) 0px,
                rgba(255,255,255,0.04) 1px,
                rgba(255,255,255,0) 2px,
                rgba(255,255,255,0) 6px
              ),
              radial-gradient(ellipse at center, #C8DEBC 0%, ${theme.colors.bgBoard} 60%)
            `,
            borderRadius: theme.radius.lg,
            boxShadow: theme.colors.shadowLg,
            border: `2px solid rgba(160,180,140,0.4)`,
            display: 'grid',
            gridTemplateAreas: `
              ".       top-hand  .      "
              "left-p  discards  right-p"
              ".       bot-hand  .      "
              ".       actions   .      "
            `,
            gridTemplateColumns: 'clamp(60px, 12%, 110px) 1fr clamp(60px, 12%, 110px)',
            gridTemplateRows: 'auto minmax(0, 1fr) auto auto',
            gap: 6,
            padding: 10,
            overflow: 'hidden',
          }}>
            {/* Top player */}
            <div style={{
              gridArea: 'top-hand',
              display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
              minWidth: 0, overflow: 'hidden',
            }}>
              <div style={{ width: '100%' }}>
                <PlayerArea
                  player={gameState.players[seatOrder[2]]}
                  isMe={false}
                  position="top"
                  isWinner={winnerId === seatOrder[2]}
                />
              </div>
            </div>

            {/* Left player */}
            <div style={{
              gridArea: 'left-p',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 0,
            }}>
              <PlayerArea
                player={gameState.players[seatOrder[3]]}
                isMe={false}
                position="left"
                isWinner={winnerId === seatOrder[3]}
              />
            </div>

            {/* Center: discards */}
            <div style={{
              gridArea: 'discards',
              overflow: 'hidden',
              minWidth: 0,
              minHeight: 0,
            }}>
              <DiscardPool
                players={gameState.players}
                lastDiscard={lastDiscard}
                seatId={seatId}
              />
            </div>

            {/* Right player */}
            <div style={{
              gridArea: 'right-p',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 0,
            }}>
              <PlayerArea
                player={gameState.players[seatOrder[1]]}
                isMe={false}
                position="right"
                isWinner={winnerId === seatOrder[1]}
              />
            </div>

            {/* Bottom: my hand */}
            <div style={{
              gridArea: 'bot-hand',
              display: 'flex', justifyContent: 'center',
              minWidth: 0,
            }}>
              <div style={{ width: '100%' }}>
                <PlayerArea
                  player={gameState.players[seatId]}
                  isMe={true}
                  position="bottom"
                  myHand={gameState.myHand}
                  myLocked={gameState.myLocked}
                  myBonus={gameState.myBonus}
                  lastDrawnIndex={gameState.lastDrawnIndex}
                  selectedTile={selectedTile}
                  onTileClick={handleTileClick}
                  isWinner={winnerId === seatId}
                />
              </div>
            </div>

            {/* Action bar */}
            <div style={{ gridArea: 'actions', minWidth: 0 }}>
              <ActionBar
                pendingAction={pendingAction}
                selectedTile={selectedTile}
                claimOptions={claimOptions}
                onDiscard={handleDiscard}
                onClaim={onClaim}
                onPass={onPass}
              />
            </div>
          </div>
        </div>

        {/* Transcript Log sidebar */}
        {showLog && (
          <div style={{
            gridArea: 'tlog',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {voice && voice.transcripts.length > 0 ? (
              <TranscriptLog transcripts={voice.transcripts} />
            ) : (
              <div className="glass-panel" style={{
                flex: 1,
                padding: '12px 14px',
                fontSize: 12,
                color: theme.colors.textMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                Voice transcript will appear here
              </div>
            )}
          </div>
        )}
      </div>

      {/* Win celebration overlay */}
      {winnerId != null && gameState.phase !== 'finished' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <div style={{
            textAlign: 'center',
            animation: 'winBounce 0.5s ease-out',
          }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>🏆</div>
            <div style={{
              fontSize: 28, fontWeight: 800,
              color: '#FFD700',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}>
              {gameState.players[winnerId]?.name || 'Player'} wins!
            </div>
            <div style={{
              fontSize: 16, color: '#fff', marginTop: 8,
              textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              marginBottom: 24,
            }}>
              Mah Jong!
            </div>
            <button
              onClick={onRestart}
              style={{
                padding: '0.75rem 2rem',
                fontSize: 16,
                fontWeight: 700,
                backgroundColor: theme.colors.accent,
                color: '#fff',
                border: 'none',
                borderRadius: theme.radius.md,
                cursor: 'pointer',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              New Game
            </button>
          </div>
        </div>
      )}

      {/* Game over overlay */}
      {gameState.phase === 'finished' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)',
        }}>
          <div style={{
            background: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            padding: '2rem 2.5rem',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            minWidth: 280,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.colors.accent, marginBottom: 16 }}>
              Game Over
            </div>
            <div style={{ marginBottom: 20 }}>
              {[...gameState.players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between', gap: 24,
                    padding: '6px 0',
                    fontSize: 14,
                    fontWeight: i === 0 ? 800 : 400,
                    color: i === 0 ? '#FFD700' : theme.colors.textPrimary,
                    borderBottom: i < 3 ? `1px solid ${theme.colors.border}` : 'none',
                  }}>
                    <span>{i === 0 ? '🏆 ' : ''}{p.name}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.score}</span>
                  </div>
                ))}
            </div>
            <button
              onClick={onRestart}
              style={{
                padding: '0.75rem 2rem',
                fontSize: 16,
                fontWeight: 700,
                backgroundColor: theme.colors.accent,
                color: '#fff',
                border: 'none',
                borderRadius: theme.radius.md,
                cursor: 'pointer',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              Start New Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
