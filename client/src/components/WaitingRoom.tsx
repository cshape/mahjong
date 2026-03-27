import { useState } from 'react';
import { theme } from '../theme';
import type { LobbyState } from '../types';

interface WaitingRoomProps {
  roomCode: string;
  seatId: number;
  lobbyState: LobbyState | null;
  onStart: () => void;
}

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
      background: 'radial-gradient(ellipse at center, #D4E8CC 0%, #E8F0E4 50%, #C8DCBC 100%)',
      fontFamily: theme.font,
    }}>
      {/* Scrollable content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1rem',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🀄</div>
          <h2 style={{
            fontSize: 28, fontWeight: 700, color: theme.colors.textPrimary, margin: 0,
          }}>
            Waiting for Players
          </h2>
        </div>

        {/* Game Code */}
        <div style={{
          background: theme.colors.bgCard,
          borderRadius: theme.radius.lg,
          padding: '1.25rem 2.5rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
          boxShadow: theme.colors.shadow,
        }}>
          <div style={{ fontSize: 12, color: theme.colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Game Code
          </div>
          <div style={{
            fontSize: 48, fontWeight: 800, letterSpacing: 8,
            color: theme.colors.accent,
            cursor: 'pointer',
          }} onClick={copyCode} title="Click to copy">
            {roomCode}
          </div>
          <button onClick={copyCode} style={{
            marginTop: 8,
            padding: '6px 16px',
            fontSize: 13,
            background: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            color: theme.colors.textSecondary,
            cursor: 'pointer',
          }}>
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>

        {/* Seat List */}
        <div style={{
          background: theme.colors.bgCard,
          borderRadius: theme.radius.lg,
          padding: '1.25rem',
          width: '100%',
          maxWidth: 320,
          boxShadow: theme.colors.shadow,
        }}>
          {[0, 1, 2, 3].map(i => {
            const seat = lobbyState?.seats[i];
            const windLabels = ['East', 'South', 'West', 'North'];
            return (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < 3 ? `1px solid ${theme.colors.border}` : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: seat ? (seat.isBot ? theme.colors.lavender : theme.colors.accent) : 'rgba(0,0,0,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  marginRight: 12, flexShrink: 0,
                }}>
                  {seat ? (seat.isBot ? 'AI' : seat.name[0].toUpperCase()) : '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 15,
                    color: seat ? theme.colors.textPrimary : theme.colors.textMuted,
                  }}>
                    {seat ? seat.name : 'Empty (AI will fill)'}
                    {seat && !seat.isBot && i === seatId && (
                      <span style={{ fontSize: 11, color: theme.colors.textMuted, marginLeft: 6 }}>(you)</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: theme.colors.textMuted }}>
                    {windLabels[i]} Wind
                  </div>
                </div>
                {i === 0 && seat && !seat.isBot && (
                  <div style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    color: theme.colors.accent, letterSpacing: 0.5,
                  }}>Host</div>
                )}
              </div>
            );
          })}
        </div>

        <p style={{
          marginTop: '1rem', fontSize: 13, color: theme.colors.textMuted, textAlign: 'center',
        }}>
          {humanCount}/4 players joined &middot; Share the code to invite friends
        </p>
      </div>

      {/* Bottom-anchored start button — always visible */}
      <div style={{
        flexShrink: 0,
        padding: '1rem',
        display: 'flex',
        justifyContent: 'center',
        background: 'linear-gradient(transparent, rgba(200,220,188,0.8))',
      }}>
        {isHost ? (
          <button onClick={onStart} style={{
            padding: '1rem 3rem',
            fontSize: 18,
            fontWeight: 700,
            backgroundColor: theme.colors.accent,
            color: '#fff',
            border: 'none',
            borderRadius: theme.radius.md,
            cursor: 'pointer',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            width: '100%',
            maxWidth: 320,
          }}>
            Start Game {humanCount < 4 && `(${4 - humanCount} AI)`}
          </button>
        ) : (
          <p style={{ color: theme.colors.textSecondary, fontSize: 15, margin: 0 }}>
            Waiting for host to start the game...
          </p>
        )}
      </div>
    </div>
  );
}
