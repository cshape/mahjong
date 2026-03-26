import { Tile } from './Tile';
import { theme } from '../theme';
import { WIND_NAMES } from '../types';
import type { PlayerPublicInfo } from '../types';

interface PlayerAreaProps {
  player: PlayerPublicInfo;
  isMe: boolean;
  position: 'bottom' | 'right' | 'top' | 'left';
  myHand?: number[];
  myLocked?: number[][];
  myBonus?: number[];
  lastDrawnIndex?: number | null;
  selectedTile?: number | null;
  onTileClick?: (index: number) => void;
}

const WIND_SYMBOLS: Record<string, string> = {
  East: '東', South: '南', West: '西', North: '北',
};

function PlayerInfo({ player, isMe, isActive, compact }: {
  player: PlayerPublicInfo;
  isMe: boolean;
  isActive: boolean;
  compact?: boolean;
}) {
  const wind = WIND_NAMES[player.wind] || '?';
  const windChar = WIND_SYMBOLS[wind] || '?';

  if (compact) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '4px 2px',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24,
          backgroundColor: isActive ? theme.colors.accent : 'rgba(0,0,0,0.06)',
          color: isActive ? '#fff' : theme.colors.textSecondary,
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 700,
        }}>{windChar}</span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: theme.colors.textPrimary,
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          letterSpacing: 1,
        }}>{player.name}</span>
        {player.isAI && (
          <span style={{
            fontSize: 8, color: theme.colors.textMuted,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 3, padding: '0px 3px', textTransform: 'uppercase',
          }}>AI</span>
        )}
        <span style={{
          fontSize: 14, fontWeight: 800,
          color: theme.colors.accent,
          fontVariantNumeric: 'tabular-nums',
        }}>{player.score}</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28,
        backgroundColor: isActive ? theme.colors.accent : 'rgba(0,0,0,0.06)',
        color: isActive ? '#fff' : theme.colors.textSecondary,
        borderRadius: 8,
        fontSize: 16,
        fontWeight: 700,
      }}>{windChar}</span>
      <span style={{
        fontSize: 14, fontWeight: 700,
        color: isMe ? theme.colors.textPrimary : theme.colors.textSecondary,
      }}>{player.name}</span>
      {player.isAI && (
        <span style={{
          fontSize: 9, color: theme.colors.textMuted,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>AI</span>
      )}
      <span style={{
        marginLeft: 'auto',
        fontSize: 16, fontWeight: 800,
        color: theme.colors.accent,
        fontVariantNumeric: 'tabular-nums',
      }}>{player.score}</span>
    </div>
  );
}

export function PlayerArea({
  player, isMe, position, myHand, myLocked, myBonus,
  lastDrawnIndex, selectedTile, onTileClick,
}: PlayerAreaProps) {
  const isActive = player.isCurrentTurn;
  const locked = isMe ? myLocked : player.locked;
  const bonus = isMe ? myBonus : player.bonus;
  const isSide = position === 'left' || position === 'right';

  const cardStyle: React.CSSProperties = {
    borderRadius: theme.radius.md,
    backgroundColor: isActive ? theme.colors.accentSoft : theme.colors.bgCard,
    border: isActive ? `2px solid ${theme.colors.accent}` : `1px solid ${theme.colors.border}`,
    boxShadow: theme.colors.shadow,
    transition: 'all 0.3s ease',
  };

  // Side players: compact vertical layout with tile count badge
  if (isSide) {
    return (
      <div style={{
        ...cardStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 6,
        width: '100%',
      }}>
        <PlayerInfo player={player} isMe={false} isActive={isActive} compact />
        {/* Tile count badge */}
        <div style={{
          background: `linear-gradient(145deg, ${theme.colors.tileBack}, #C08A70)`,
          borderRadius: theme.radius.sm,
          padding: '6px 10px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          boxShadow: '0 1px 4px rgba(100,70,50,0.15)',
        }}>
          <span style={{
            fontSize: 20, fontWeight: 800, color: '#fff',
            lineHeight: 1,
          }}>{player.tileCount}</span>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 }}>tiles</span>
        </div>
        {/* Locked sets */}
        {locked && locked.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
            {locked.map((set, si) => (
              <div key={`l${si}`} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.04)',
                borderRadius: 4, padding: 1,
              }}>
                {set.map((tile, ti) => (
                  <Tile key={ti} tile={tile} small />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Top player: horizontal row
  if (position === 'top') {
    return (
      <div style={{
        ...cardStyle,
        padding: '6px 10px',
      }}>
        <PlayerInfo player={player} isMe={false} isActive={isActive} />
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', overflow: 'hidden' }}>
          {Array.from({ length: player.tileCount }, (_, i) => (
            <Tile key={i} tile={0} hidden small />
          ))}
        </div>
        {((locked && locked.length > 0) || (bonus && bonus.length > 0)) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, justifyContent: 'center' }}>
            {locked?.map((set, si) => (
              <div key={`l${si}`} style={{
                display: 'inline-flex',
                backgroundColor: 'rgba(0,0,0,0.04)',
                borderRadius: 4, padding: 2,
              }}>
                {set.map((tile, ti) => (
                  <Tile key={ti} tile={tile} small />
                ))}
              </div>
            ))}
            {bonus && bonus.length > 0 && (
              <div style={{
                display: 'inline-flex',
                backgroundColor: 'rgba(0,0,0,0.03)',
                borderRadius: 4, padding: 2,
              }}>
                {bonus.map((tile, i) => (
                  <Tile key={`b${i}`} tile={tile} small />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Bottom player (me): full hand view
  return (
    <div style={{
      ...cardStyle,
      padding: '8px 12px',
    }}>
      <PlayerInfo player={player} isMe={true} isActive={isActive} />
      {myHand ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
          {myHand.map((tile, i) => (
            <Tile
              key={i}
              tile={tile}
              selected={selectedTile === i}
              lastDrawn={lastDrawnIndex === i}
              onClick={onTileClick ? () => onTileClick(i) : undefined}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {Array.from({ length: player.tileCount }, (_, i) => (
            <Tile key={i} tile={0} hidden small />
          ))}
        </div>
      )}

      {((locked && locked.length > 0) || (bonus && bonus.length > 0)) && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6,
          alignItems: 'center',
        }}>
          {locked?.map((set, si) => (
            <div key={`l${si}`} style={{
              display: 'inline-flex',
              backgroundColor: 'rgba(0,0,0,0.04)',
              borderRadius: 4, padding: 2,
            }}>
              {set.map((tile, ti) => (
                <Tile key={ti} tile={tile} small />
              ))}
            </div>
          ))}
          {bonus && bonus.length > 0 && (
            <div style={{
              display: 'inline-flex',
              backgroundColor: 'rgba(0,0,0,0.03)',
              borderRadius: 4, padding: 2,
            }}>
              {bonus.map((tile, i) => (
                <Tile key={`b${i}`} tile={tile} small />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
