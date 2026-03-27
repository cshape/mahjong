import { useState, useMemo, useEffect } from 'react';
import { PlayerArea } from './PlayerArea';
import { DiscardPool } from './DiscardPool';
import { ActionBar } from './ActionBar';
import { EventLog } from './EventLog';
import { VoicePanel } from './VoicePanel';
import { TranscriptLog } from './TranscriptLog';
import { RulesPanel } from './RulesPanel';
import { theme } from '../theme';
import { useIsMobile } from '../useIsMobile';
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
  onSendChat?: (text: string) => void;
  voice?: VoiceHook;
  bgm?: BgmHook;
}

export function GameBoard({
  gameState, seatId, events, pendingAction, claimOptions,
  onDiscard, onClaim, onPass, onRestart, onSendChat, voice, bgm,
}: GameBoardProps) {
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [claimBanner, setClaimBanner] = useState<{ playerName: string; label: string } | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'log' | 'chat' | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const isMobile = useIsMobile();

  const CLAIM_LABELS: Record<number, string> = {
    2: 'Sheung!', 4: 'Sheung!', 5: 'Sheung!', 6: 'Sheung!',
    8: 'Pong!', 16: 'Kong!', 32: 'Mah Jong!',
  };

  // Detect hand wins from events
  useEffect(() => {
    const last = events[events.length - 1];
    if (last?.type === 'hand:win' && last.winner != null) {
      setWinnerId(last.winner);
      const timer = setTimeout(() => setWinnerId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [events]);

  // Detect claims from events
  useEffect(() => {
    const last = events[events.length - 1];
    if (last?.type === 'turn:claim' && last.claimType && last.claimType !== 32) {
      const label = CLAIM_LABELS[last.claimType] || 'Claim!';
      const playerName = gameState.players[last.playerId!]?.name || 'Player';
      setClaimBanner({ playerName, label });
      const timer = setTimeout(() => setClaimBanner(null), 2000);
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

  const circleBtn = (active: boolean): React.CSSProperties => ({
    ...btnStyle,
    width: 32, height: 32, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 800,
    borderRadius: '50%',
    borderColor: active ? theme.colors.accent : theme.colors.border,
    color: active ? theme.colors.accent : theme.colors.textSecondary,
    background: active ? theme.colors.accentSoft : theme.colors.bgCard,
  });

  // ── Shared board inner ──
  const boardInner = (
    <div style={{
      height: '100%',
      width: '100%',
      maxHeight: '100%',
      background: `
        repeating-linear-gradient(87deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0.04) 1px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 6px),
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
      gridTemplateColumns: isMobile ? '48px 1fr 48px' : 'clamp(60px, 12%, 110px) 1fr clamp(60px, 12%, 110px)',
      gridTemplateRows: 'auto minmax(0, 1fr) auto auto',
      gap: isMobile ? 4 : 6,
      padding: isMobile ? 6 : 10,
      overflow: 'hidden',
    }}>
      <div style={{ gridArea: 'top-hand', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ width: '100%' }}>
          <PlayerArea player={gameState.players[seatOrder[2]]} isMe={false} position="top" isWinner={winnerId === seatOrder[2]} />
        </div>
      </div>
      <div style={{ gridArea: 'left-p', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
        <PlayerArea player={gameState.players[seatOrder[3]]} isMe={false} position="left" isWinner={winnerId === seatOrder[3]} />
      </div>
      <div style={{ gridArea: 'discards', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
        <DiscardPool players={gameState.players} lastDiscard={lastDiscard} seatId={seatId} />
      </div>
      <div style={{ gridArea: 'right-p', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
        <PlayerArea player={gameState.players[seatOrder[1]]} isMe={false} position="right" isWinner={winnerId === seatOrder[1]} />
      </div>
      <div style={{ gridArea: 'bot-hand', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
        <div style={{ width: '100%' }}>
          <PlayerArea
            player={gameState.players[seatId]} isMe={true} position="bottom"
            myHand={gameState.myHand} myLocked={gameState.myLocked} myBonus={gameState.myBonus}
            lastDrawnIndex={gameState.lastDrawnIndex} selectedTile={selectedTile}
            onTileClick={handleTileClick} isWinner={winnerId === seatId}
          />
        </div>
      </div>
      <div style={{ gridArea: 'actions', minWidth: 0 }}>
        <ActionBar pendingAction={pendingAction} selectedTile={selectedTile} claimOptions={claimOptions} onDiscard={handleDiscard} onClaim={onClaim} onPass={onPass} />
      </div>
    </div>
  );

  // ── Shared overlays ──
  const overlays = (
    <>
      {/* Claim banner */}
      {claimBanner && !winnerId && gameState.phase !== 'finished' && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '30%', zIndex: 45,
          display: 'flex', justifyContent: 'center',
          pointerEvents: 'none',
          animation: 'claimSlam 0.4s ease-out',
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.7)',
            borderRadius: 16,
            padding: 'clamp(12px, 2vw, 20px) clamp(24px, 4vw, 48px)',
            textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              fontSize: 'clamp(28px, 5vw, 48px)',
              fontWeight: 800,
              color: '#fff',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              letterSpacing: 2,
            }}>
              {claimBanner.label}
            </div>
            <div style={{
              fontSize: 'clamp(14px, 2vw, 18px)',
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 600,
              marginTop: 4,
            }}>
              {claimBanner.playerName}
            </div>
          </div>
        </div>
      )}

      {winnerId != null && gameState.phase !== 'finished' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', animation: 'fadeIn 0.3s ease-out', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', animation: 'winBounce 0.5s ease-out' }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#FFD700', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
              {gameState.players[winnerId]?.name || 'Player'} wins the hand!
            </div>
            <div style={{ fontSize: 16, color: '#fff', marginTop: 8, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>Mah Jong!</div>
          </div>
        </div>
      )}
      {gameState.phase === 'finished' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
          <div style={{ background: theme.colors.bgCard, borderRadius: theme.radius.lg, padding: '2rem 2.5rem', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', minWidth: 280 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.colors.accent, marginBottom: 16 }}>Game Over</div>
            <div style={{ marginBottom: 20 }}>
              {[...gameState.players].sort((a, b) => b.score - a.score).map((p, i) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, padding: '6px 0', fontSize: 14, fontWeight: i === 0 ? 800 : 400, color: i === 0 ? '#FFD700' : theme.colors.textPrimary, borderBottom: i < 3 ? `1px solid ${theme.colors.border}` : 'none' }}>
                  <span>{i === 0 ? '🏆 ' : ''}{p.name}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.score}</span>
                </div>
              ))}
            </div>
            <button onClick={onRestart} style={{ padding: '0.75rem 2rem', fontSize: 16, fontWeight: 700, backgroundColor: theme.colors.accent, color: '#fff', border: 'none', borderRadius: theme.radius.md, cursor: 'pointer', letterSpacing: 0.5, textTransform: 'uppercase' }}>Start New Game</button>
          </div>
        </div>
      )}

      {/* Welcome popup */}
      {showWelcome && (
        <div
          onClick={() => setShowWelcome(false)}
          style={{
            position: 'absolute', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.3s ease-out',
            cursor: 'pointer',
          }}
        >
          <div style={{
            background: theme.colors.bgCard,
            borderRadius: theme.radius.lg,
            padding: 'clamp(1.5rem, 4vw, 2.5rem)',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            maxWidth: 'clamp(280px, 80vw, 380px)',
            animation: 'winBounce 0.4s ease-out',
          }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 'clamp(32px, 6vw, 48px)', marginBottom: 8 }}>🀄</div>
            <div style={{ fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 800, color: theme.colors.accent, marginBottom: 12 }}>
              Welcome to Mahjong!
            </div>
            <p style={{ fontSize: 'clamp(13px, 2vw, 15px)', color: theme.colors.textSecondary, lineHeight: 1.6, marginBottom: 20 }}>
              Your AI opponents will chat with you as you play. Need help with the rules? Tap the <b style={{ color: theme.colors.accent }}>?</b> button in the top {isMobile ? 'menu' : 'right'}.
            </p>
            <button
              onClick={() => setShowWelcome(false)}
              style={{
                padding: '0.75rem 2rem',
                fontSize: 'clamp(14px, 2vw, 16px)',
                fontWeight: 700,
                backgroundColor: theme.colors.accent,
                color: '#fff',
                border: 'none',
                borderRadius: theme.radius.md,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Let's Play!
            </button>
          </div>
        </div>
      )}
    </>
  );

  // ═══════════════════════════════════════════
  //  MOBILE LAYOUT
  // ═══════════════════════════════════════════
  if (isMobile) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
        <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />

        {/* Mobile slide-out panels */}
        {mobilePanel && (
          <div onClick={() => setMobilePanel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 80 }} />
        )}
        <div style={{
          position: 'fixed', left: 0, top: 0, width: 300, height: '100dvh',
          background: theme.colors.bgCard, zIndex: 81, padding: 12, overflowY: 'auto',
          transform: mobilePanel === 'log' ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
          boxShadow: mobilePanel === 'log' ? '4px 0 20px rgba(0,0,0,0.15)' : 'none',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, color: theme.colors.accent }}>Game Log</span>
            <button onClick={() => setMobilePanel(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: theme.colors.textMuted }}>×</button>
          </div>
          <EventLog events={events} players={gameState.players} />
        </div>
        <div style={{
          position: 'fixed', right: 0, top: 0, width: 300, height: '100dvh',
          background: theme.colors.bgCard, zIndex: 81, padding: 12, overflowY: 'auto',
          transform: mobilePanel === 'chat' ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          boxShadow: mobilePanel === 'chat' ? '-4px 0 20px rgba(0,0,0,0.15)' : 'none',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, color: theme.colors.accent }}>Voice Chat</span>
            <button onClick={() => setMobilePanel(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: theme.colors.textMuted }}>×</button>
          </div>
          {voice && voice.transcripts.length > 0 ? (
            <TranscriptLog transcripts={voice.transcripts} onSendChat={onSendChat} />
          ) : (
            <div style={{ fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', marginTop: 32 }}>Voice transcript will appear here</div>
          )}
        </div>

        {/* Mobile menu overlay */}
        {mobileMenu && (
          <>
            <div onClick={() => setMobileMenu(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 90 }} />
            <div style={{
              position: 'fixed', top: 52, right: 8, zIndex: 91,
              background: theme.colors.bgCard, borderRadius: theme.radius.md,
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)', padding: 12,
              display: 'flex', flexDirection: 'column', gap: 10, minWidth: 180,
            }}>
              {bgm && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => { bgm.toggle(); }} style={btnStyle}>{bgm.playing ? '⏸ Music' : '♫ Music'}</button>
                  {bgm.playing && (
                    <input type="range" min={0} max={1} step={0.05} value={bgm.volume}
                      onChange={e => bgm.changeVolume(parseFloat(e.target.value))}
                      style={{ flex: 1, height: 4, accentColor: theme.colors.accent }} />
                  )}
                </div>
              )}
              {voice && (
                <VoicePanel enabled={voice.enabled} muted={voice.muted} onStartVoice={voice.startVoice} onStopVoice={voice.stopVoice} onToggleMute={voice.toggleMute} />
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setMobilePanel('log'); setMobileMenu(false); }} style={btnStyle}>Game Log</button>
                <button onClick={() => { setMobilePanel('chat'); setMobileMenu(false); }} style={btnStyle}>Chat</button>
              </div>
              <button onClick={() => { setRulesOpen(true); setMobileMenu(false); }} style={btnStyle}>Rules & Tips</button>
            </div>
          </>
        )}

        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 4, padding: 4, background: theme.colors.bgPage }}>
          {/* Compact top bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px',
            background: theme.colors.bgCard, borderRadius: theme.radius.md,
            boxShadow: theme.colors.shadow, minHeight: 40, flexShrink: 0,
          }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: theme.colors.accent, flexShrink: 0 }}>🀄</span>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: theme.colors.textSecondary, flex: 1, justifyContent: 'center' }}>
              <span>H<b style={{ color: theme.colors.accent }}>{gameState.hand}</b></span>
              <span>{WIND_NAMES[gameState.wind]?.[0]}</span>
              <span>W<b style={{ color: theme.colors.accent }}>{gameState.wallRemaining}</b></span>
            </div>
            {bgm && (
              <button onClick={bgm.toggle} style={circleBtn(bgm.playing)} title={bgm.playing ? 'Pause music' : 'Play music'}>
                {bgm.playing ? '⏸' : '♫'}
              </button>
            )}
            <button onClick={() => setMobileMenu(m => !m)} style={circleBtn(mobileMenu)} title="Menu">☰</button>
          </div>
          {/* Board */}
          <div style={{ flex: 1, overflow: 'hidden' }}>{boardInner}</div>
        </div>

        {overlays}
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  DESKTOP LAYOUT
  // ═══════════════════════════════════════════
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '100vw', height: '100dvh', overflow: 'hidden' }}>
      <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <div style={{
        width: '100%', height: '100%', display: 'grid',
        gridTemplateAreas: showLog
          ? `"topbar topbar topbar" "elog board tlog"`
          : `"topbar" "board"`,
        gridTemplateColumns: showLog
          ? 'clamp(160px, 16vw, 240px) 1fr clamp(160px, 16vw, 240px)'
          : '1fr',
        gridTemplateRows: 'auto 1fr',
        gap: 8, padding: 8, background: theme.colors.bgPage,
      }}>
        {/* Top bar */}
        <div style={{
          gridArea: 'topbar', display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 16px', background: theme.colors.bgCard,
          borderRadius: theme.radius.md, boxShadow: theme.colors.shadow, minHeight: 48,
        }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: theme.colors.accent, flexShrink: 0 }}>🀄 麻雀</span>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: theme.colors.textSecondary, marginLeft: 'auto' }}>
            <span>Hand <b style={{ color: theme.colors.accent }}>{gameState.hand}</b></span>
            <span>Wind <b style={{ color: theme.colors.accent }}>{WIND_NAMES[gameState.wind]}</b></span>
            <span>Round <b style={{ color: theme.colors.accent }}>{WIND_NAMES[gameState.windOfTheRound]}</b></span>
            <span>Wall <b style={{ color: theme.colors.accent }}>{gameState.wallRemaining}</b></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            {bgm && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={bgm.toggle} style={circleBtn(bgm.playing)} title={bgm.playing ? 'Pause music' : 'Play music'}>
                  {bgm.playing ? '⏸' : '♫'}
                </button>
                {bgm.playing && (
                  <input type="range" min={0} max={1} step={0.05} value={bgm.volume}
                    onChange={e => bgm.changeVolume(parseFloat(e.target.value))}
                    title={`Volume: ${Math.round(bgm.volume * 100)}%`}
                    style={{ width: 60, height: 4, cursor: 'pointer', accentColor: theme.colors.accent }} />
                )}
              </div>
            )}
            {voice && (
              <VoicePanel enabled={voice.enabled} muted={voice.muted} onStartVoice={voice.startVoice} onStopVoice={voice.stopVoice} onToggleMute={voice.toggleMute} />
            )}
            <button onClick={() => setShowLog(s => !s)} style={{ ...btnStyle, borderColor: showLog ? theme.colors.accent : theme.colors.border, color: showLog ? theme.colors.accent : theme.colors.textSecondary, background: showLog ? theme.colors.accentSoft : theme.colors.bgCard }}>Log</button>
            <button onClick={() => setRulesOpen(true)} style={circleBtn(false)} title="Rules & Tips">?</button>
          </div>
        </div>

        {/* Sidebars */}
        {showLog && (
          <div style={{ gridArea: 'elog', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <EventLog events={events} players={gameState.players} />
          </div>
        )}
        <div style={{ gridArea: 'board', display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', overflow: 'hidden' }}>
          {boardInner}
        </div>
        {showLog && (
          <div style={{ gridArea: 'tlog', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {voice && voice.transcripts.length > 0 ? (
              <TranscriptLog transcripts={voice.transcripts} onSendChat={onSendChat} />
            ) : (
              <div className="glass-panel" style={{ flex: 1, padding: '12px 14px', fontSize: 12, color: theme.colors.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Voice transcript will appear here
              </div>
            )}
          </div>
        )}
      </div>

      {overlays}
    </div>
  );
}
