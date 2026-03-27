import { useState } from 'react';
import { theme } from '../theme';
import type { LobbyState } from '../types';

interface WaitingRoomProps {
  roomCode: string;
  seatId: number;
  lobbyState: LobbyState | null;
  onStart: () => void;
}

const bambooBackground = `
  repeating-linear-gradient(90deg, transparent, transparent 1.5rem, rgba(160,120,60,0.08) 1.5rem, rgba(160,120,60,0.08) 1.55rem),
  repeating-linear-gradient(0deg, transparent, transparent 6rem, rgba(120,80,30,0.06) 6rem, rgba(120,80,30,0.06) 6.1rem),
  linear-gradient(170deg, #D4C4A0 0%, #C8B68C 30%, #DACCB0 50%, #C4B288 80%, #D0C098 100%)
`;

export function WaitingRoom({ roomCode, seatId, lobbyState, onStart }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const isHost = seatId === 0;
  const humanCount = lobbyState?.humanCount ?? 1;

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: bambooBackground,
      fontFamily: theme.font,
    }}>
      <div style={{
        ...theme.modalCard,
        aspectRatio: undefined, // allow taller for seat list
        maxHeight: 'clamp(420px, 85vh, 600px)',
        gap: 'clamp(0.75rem, 2vw, 1.25rem)',
      }}>
        <h2 style={{
          fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', fontWeight: 700,
          color: theme.colors.textPrimary, margin: 0,
        }}>
          Waiting for Players
        </h2>

        {/* Game Code */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'clamp(10px, 1.5vw, 12px)', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Game Code
          </div>
          <div style={{
            fontSize: 'clamp(2rem, 7vw, 3rem)', fontWeight: 800, letterSpacing: '0.4em',
            color: theme.colors.accent, cursor: 'pointer',
          }} onClick={copyCode} title="Click to copy">
            {roomCode}
          </div>
          <button onClick={copyCode} style={{
            marginTop: 4, padding: '4px 12px', fontSize: 12,
            background: 'transparent', border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm, color: theme.colors.textSecondary, cursor: 'pointer',
          }}>
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>

        {/* Seat List */}
        <div style={{ width: '100%', flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {[0, 1, 2, 3].map(i => {
            const seat = lobbyState?.seats[i];
            const windLabels = ['East', 'South', 'West', 'North'];
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center',
                padding: 'clamp(6px, 1vw, 10px) 0',
                borderBottom: i < 3 ? `1px solid ${theme.colors.border}` : 'none',
              }}>
                <div style={{
                  width: 'clamp(28px, 5vw, 36px)', height: 'clamp(28px, 5vw, 36px)', borderRadius: '50%',
                  background: seat ? (seat.isBot ? theme.colors.lavender : theme.colors.accent) : 'rgba(0,0,0,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 'clamp(11px, 1.5vw, 14px)',
                  marginRight: 'clamp(8px, 1.5vw, 12px)', flexShrink: 0,
                }}>
                  {seat ? (seat.isBot ? 'AI' : seat.name[0].toUpperCase()) : '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 'clamp(13px, 1.8vw, 15px)',
                    color: seat ? theme.colors.textPrimary : theme.colors.textMuted,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {seat ? seat.name : 'Empty (AI will fill)'}
                    {seat && !seat.isBot && i === seatId && (
                      <span style={{ fontSize: 'clamp(9px, 1.2vw, 11px)', color: theme.colors.textMuted, marginLeft: 6 }}>(you)</span>
                    )}
                  </div>
                  <div style={{ fontSize: 'clamp(10px, 1.2vw, 12px)', color: theme.colors.textMuted }}>
                    {windLabels[i]} Wind
                  </div>
                </div>
                {i === 0 && seat && !seat.isBot && (
                  <div style={{
                    fontSize: 'clamp(8px, 1vw, 10px)', fontWeight: 700, textTransform: 'uppercase',
                    color: theme.colors.accent, letterSpacing: 0.5, flexShrink: 0,
                  }}>Host</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Start / Waiting */}
        {isHost ? (
          <button onClick={onStart} style={{
            padding: 'clamp(0.625rem, 1.5vw, 0.875rem) 2rem',
            fontSize: 'clamp(14px, 2vw, 18px)', fontWeight: 700,
            backgroundColor: theme.colors.accent, color: '#fff',
            border: 'none', borderRadius: theme.radius.md, cursor: 'pointer',
            letterSpacing: 0.5, textTransform: 'uppercase', width: '100%',
          }}>
            Start Game {humanCount < 4 && `(${4 - humanCount} AI)`}
          </button>
        ) : (
          <p style={{ color: theme.colors.textSecondary, fontSize: 'clamp(13px, 1.5vw, 15px)', margin: 0, textAlign: 'center' }}>
            Waiting for host to start...
          </p>
        )}

        <p style={{ fontSize: 'clamp(10px, 1.2vw, 13px)', color: theme.colors.textMuted, textAlign: 'center', margin: 0 }}>
          {humanCount}/4 players &middot; Share the code to invite friends
        </p>
      </div>
    </div>
  );
}
