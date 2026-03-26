import { useState, useMemo } from 'react';
import { PlayerArea } from './PlayerArea';
import { DiscardPool } from './DiscardPool';
import { ActionBar } from './ActionBar';
import { EventLog } from './EventLog';
import { VoicePanel } from './VoicePanel';
import { TranscriptLog } from './TranscriptLog';
import { RulesPanel } from './RulesPanel';
import { theme } from '../theme';
import { useBgm } from '../useBgm';
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

interface GameBoardProps {
  gameState: ClientGameState;
  seatId: number;
  events: GameEvent[];
  pendingAction: 'discard' | 'claim' | null;
  claimOptions: ClaimOption[] | null;
  onDiscard: (tileIndex: number) => void;
  onClaim: (claimtype: number) => void;
  onPass: () => void;
  voice?: VoiceHook;
}

export function GameBoard({
  gameState, seatId, events, pendingAction, claimOptions,
  onDiscard, onClaim, onPass, voice,
}: GameBoardProps) {
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const bgm = useBgm();

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
        gap: 12,
        padding: 12,
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
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: '100%',
            maxWidth: 'min(100%, calc((100vh - 100px)))', // keep roughly square but never overflow
            margin: '0 auto',
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
            gridTemplateRows: 'auto 1fr auto auto',
            gap: 6,
            padding: 10,
            overflow: 'hidden',
          }}>
            {/* Top player */}
            <div style={{
              gridArea: 'top-hand',
              display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
              minWidth: 0,
            }}>
              <div style={{ width: '100%' }}>
                <PlayerArea
                  player={gameState.players[seatOrder[2]]}
                  isMe={false}
                  position="top"
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
    </div>
  );
}
