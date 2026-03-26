import { useMemo, useState, useEffect, useRef } from 'react';
import { Tile } from './Tile';
import { theme } from '../theme';
import type { PlayerPublicInfo } from '../types';
import { WIND_NAMES } from '../types';

interface DiscardPoolProps {
  players: PlayerPublicInfo[];
  lastDiscard?: { playerId: number; tile: number } | null;
  seatId?: number;
}

const WIND_SYMBOLS: Record<string, string> = {
  East: '東', South: '南', West: '西', North: '北',
};

const SPOTLIGHT_DURATION = 1200;

export function DiscardPool({ players, lastDiscard, seatId = 0 }: DiscardPoolProps) {
  const seatOrder = useMemo(() => [
    seatId,
    (seatId + 1) % 4,
    (seatId + 2) % 4,
    (seatId + 3) % 4,
  ], [seatId]);

  const [spotlight, setSpotlight] = useState<{ tile: number; playerId: number; key: number } | null>(null);
  const lastDiscardRef = useRef(lastDiscard);

  useEffect(() => {
    if (
      lastDiscard &&
      (lastDiscard !== lastDiscardRef.current) &&
      (lastDiscardRef.current?.playerId !== lastDiscard.playerId ||
       lastDiscardRef.current?.tile !== lastDiscard.tile)
    ) {
      lastDiscardRef.current = lastDiscard;
      setSpotlight({ ...lastDiscard, key: Date.now() });

      const timer = setTimeout(() => {
        setSpotlight(null);
      }, SPOTLIGHT_DURATION);
      return () => clearTimeout(timer);
    }
    lastDiscardRef.current = lastDiscard;
  }, [lastDiscard]);

  const spotlightName = spotlight
    ? players[spotlight.playerId]?.name || ''
    : '';

  const renderDiscards = (pid: number) => {
    const p = players[pid];
    if (!p) return null;
    const wind = WIND_NAMES[p.wind] || '?';
    const wc = WIND_SYMBOLS[wind] || '?';

    return (
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: 0, minHeight: 28,
      }}>
        <span style={{
          fontSize: 13, color: theme.colors.textMuted,
          width: 20, textAlign: 'center', flexShrink: 0,
          marginRight: 2,
        }}>
          {wc}
        </span>
        {p.discards.map((tile, i) => {
          const isLatest = lastDiscard &&
            lastDiscard.playerId === pid &&
            i === p.discards.length - 1;
          return (
            <Tile
              key={i}
              tile={tile}
              small
              animated={isLatest || false}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: theme.radius.md,
      padding: 8,
      border: '1px solid rgba(255,255,255,0.2)',
      height: '100%',
      position: 'relative',
      display: 'grid',
      gridTemplateAreas: `
        "dtop  dtop"
        "dleft dright"
        "dbot  dbot"
      `,
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr 1fr',
      gap: 4,
      overflow: 'hidden',
    }}>
      {/* Center spotlight tile */}
      {spotlight && (
        <div
          key={spotlight.key}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            animation: 'spotlightIn 0.2s ease-out, spotlightOut 0.3s ease-in forwards',
            animationDelay: `0s, ${SPOTLIGHT_DURATION - 300}ms`,
            pointerEvents: 'none',
          }}
        >
          <Tile tile={spotlight.tile} />
          <span style={{
            fontSize: 11,
            color: theme.colors.textSecondary,
            fontWeight: 700,
            textShadow: '0 1px 3px rgba(255,255,255,0.5)',
          }}>
            {spotlightName}
          </span>
        </div>
      )}

      <div style={{ gridArea: 'dtop', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        {renderDiscards(seatOrder[2])}
      </div>

      <div style={{ gridArea: 'dleft', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
        {renderDiscards(seatOrder[3])}
      </div>

      <div style={{ gridArea: 'dright', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {renderDiscards(seatOrder[1])}
      </div>

      <div style={{ gridArea: 'dbot', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
        {renderDiscards(seatOrder[0])}
      </div>
    </div>
  );
}
