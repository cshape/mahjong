import { useEffect, useRef } from 'react';
import { theme } from '../theme';
import { TILE_GLYPHS, WIND_NAMES } from '../types';
import type { GameEvent, PlayerPublicInfo } from '../types';

interface EventLogProps {
  events: GameEvent[];
  players: PlayerPublicInfo[];
}

function formatEvent(event: GameEvent, players: PlayerPublicInfo[]): string | null {
  const pName = (id?: number) => id !== undefined ? players[id]?.name || `P${id}` : '?';
  const tName = (t?: number) => t !== undefined ? TILE_GLYPHS[t] || `?` : '?';

  switch (event.type) {
    case 'turn:discard':
      return `${pName(event.playerId)} discarded ${tName(event.tile)}`;
    case 'turn:claim':
      return `${pName(event.playerId)} claimed ${tName(event.tile)}`;
    case 'hand:win':
      return `🏆 ${pName(event.winner)} wins hand ${event.hand}!`;
    case 'hand:draw':
      return `Hand ${event.hand} is a draw`;
    case 'game:end':
      return `🎮 Game over!`;
    default:
      return null;
  }
}

export function EventLog({ events, players }: EventLogProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  const displayEvents = events
    .map(e => formatEvent(e, players))
    .filter(Boolean) as string[];

  return (
    <div className="glass-panel" style={{
      flex: 1,
      overflowY: 'auto',
      fontSize: 12,
      color: theme.colors.textSecondary,
      padding: '10px 12px',
    }}>
      <div style={{
        fontSize: 10, color: theme.colors.accent,
        textTransform: 'uppercase', letterSpacing: 1.5,
        marginBottom: 6, fontWeight: 800,
      }}>Game Log</div>
      {displayEvents.slice(-30).map((text, i) => (
        <div key={i} style={{
          padding: '3px 0',
          borderBottom: `1px solid rgba(210,160,130,0.12)`,
        }}>{text}</div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
