import type { CSSProperties } from 'react';
import { TILE_NAMES, TILE_GLYPHS } from '../types';
import { theme } from '../theme';

type TileSize = 'small' | 'normal' | 'large';

interface TileProps {
  tile: number;
  hidden?: boolean;
  selected?: boolean;
  lastDrawn?: boolean;
  onClick?: () => void;
  small?: boolean;
  large?: boolean;
  animated?: boolean;
}

/** Responsive tile dimensions using clamp(min, preferred, max) */
const SIZES: Record<TileSize, { w: string; h: string; font: string; label: string; margin: string; radius: number }> = {
  small:  { w: 'clamp(24px, 3.5vw, 36px)',  h: 'clamp(32px, 4.5vw, 48px)',  font: 'clamp(16px, 2.5vw, 26px)',  label: 'clamp(6px, 0.8vw, 9px)',   margin: '1px', radius: 6 },
  normal: { w: 'clamp(36px, 4.5vw, 58px)',  h: 'clamp(48px, 6vw, 76px)',    font: 'clamp(26px, 3.5vw, 44px)',  label: 'clamp(8px, 0.9vw, 11px)',  margin: '2px', radius: 8 },
  large:  { w: 'clamp(54px, 7vw, 90px)',    h: 'clamp(72px, 9vw, 120px)',   font: 'clamp(40px, 5.5vw, 68px)',  label: 'clamp(10px, 1.2vw, 15px)', margin: '2px', radius: 10 },
};

function getTileColor(tile: number): string {
  if (tile < 9) return '#2e7d32';   // bamboo - green
  if (tile < 18) return '#c62828';  // characters - red
  if (tile < 27) return '#1565c0';  // dots - blue
  if (tile < 31) return '#6a1b9a';  // winds - purple
  if (tile < 34) return '#d84315';  // dragons - deep orange
  return '#5d4037';                  // bonus - brown
}

function getTileSuitLabel(tile: number): string {
  if (tile < 9) return `B${tile + 1}`;
  if (tile < 18) return `C${tile - 8}`;
  if (tile < 27) return `D${tile - 17}`;
  if (tile === 27) return 'E';
  if (tile === 28) return 'S';
  if (tile === 29) return 'W';
  if (tile === 30) return 'N';
  if (tile === 31) return 'Fa';
  if (tile === 32) return 'Ch';
  if (tile === 33) return 'Ba';
  return `B${tile - 33}`;
}

export function Tile({ tile, hidden, selected, lastDrawn, onClick, small, large, animated }: TileProps) {
  const size = large ? SIZES.large : small ? SIZES.small : SIZES.normal;

  if (hidden) {
    return (
      <div style={{
        width: size.w, height: size.h,
        background: `linear-gradient(145deg, ${theme.colors.tileBack} 0%, #C08A70 100%)`,
        borderTop: '1px solid #DEB8A0',
        borderLeft: '1px solid #DEB8A0',
        borderRight: '1px solid #B07860',
        borderBottom: '2px solid #A06850',
        borderRadius: size.radius,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: size.margin,
        boxShadow: '0 1px 3px rgba(100,70,50,0.2)',
      }} />
    );
  }

  const unicode = TILE_NAMES[tile];
  const label = getTileSuitLabel(tile);
  const color = getTileColor(tile);
  const isHighlighted = selected || lastDrawn;

  const style: CSSProperties = {
    width: size.w, height: size.h,
    background: selected
      ? 'linear-gradient(to bottom, #FFF0E8, #FFE4D6)'
      : `linear-gradient(to bottom, ${theme.colors.tileFace}, #F0E8D8)`,
    borderTop: isHighlighted ? `2px solid ${theme.colors.accent}` : '2px solid #FFF4EC',
    borderLeft: isHighlighted ? `2px solid ${theme.colors.accent}` : '2px solid #F0E8DC',
    borderRight: isHighlighted ? `2px solid ${theme.colors.accent}` : '2px solid #D8CFC0',
    borderBottom: isHighlighted ? `2px solid ${theme.colors.accent}` : '3px solid #C8BCA8',
    borderRadius: size.radius,
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    margin: size.margin,
    cursor: onClick ? 'pointer' : 'default',
    boxShadow: selected
      ? `0 0 10px rgba(242,131,107,0.5), 0 2px 4px rgba(100,70,50,0.15)`
      : lastDrawn
        ? '0 0 8px 2px rgba(242,131,107,0.4)'
        : '0 1px 4px rgba(100,70,50,0.12)',
    transition: 'all 0.15s ease',
    position: 'relative',
    userSelect: 'none',
    animation: animated
      ? 'tileAppear 0.3s ease-out'
      : lastDrawn
        ? 'lastDrawnPulse 1.5s ease-in-out 3'
        : undefined,
  };

  if (onClick) {
    style.transform = selected ? 'translateY(-6px)' : undefined;
  }

  return (
    <div onClick={onClick} style={style} title={`${TILE_GLYPHS[tile]}`}>
      <span style={{ fontSize: size.font, lineHeight: 1, marginTop: -2 }}>{unicode}</span>
      <span style={{
        fontSize: size.label,
        color,
        fontWeight: 800,
        letterSpacing: 0.5,
        marginTop: -1,
      }}>{label}</span>
    </div>
  );
}
