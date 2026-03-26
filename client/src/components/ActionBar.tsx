import { CLAIM } from '../types';
import { theme } from '../theme';
import type { ClaimOption } from '../types';

interface ActionBarProps {
  pendingAction: 'discard' | 'claim' | null;
  selectedTile: number | null;
  claimOptions: ClaimOption[] | null;
  onDiscard: () => void;
  onClaim: (claimtype: number) => void;
  onPass: () => void;
}

const btnBase: React.CSSProperties = {
  padding: '8px 20px',
  fontSize: 13,
  fontWeight: 700,
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  minWidth: 80,
};

export function ActionBar({
  pendingAction, selectedTile, claimOptions, onDiscard, onClaim, onPass,
}: ActionBarProps) {
  if (!pendingAction) {
    return (
      <div style={{
        padding: 10, textAlign: 'center',
        color: theme.colors.textMuted,
        fontSize: 13,
        letterSpacing: 0.5,
      }}>
        Waiting for other players...
      </div>
    );
  }

  if (pendingAction === 'discard') {
    return (
      <div style={{
        padding: 8,
        display: 'flex', justifyContent: 'center',
      }}>
        <button
          onClick={onDiscard}
          disabled={selectedTile === null}
          style={{
            ...btnBase,
            backgroundColor: selectedTile !== null ? theme.colors.accent : theme.colors.textMuted,
            opacity: selectedTile !== null ? 1 : 0.4,
            cursor: selectedTile !== null ? 'pointer' : 'not-allowed',
          }}
        >
          Discard
        </button>
      </div>
    );
  }

  if (pendingAction === 'claim' && claimOptions) {
    return (
      <div style={{
        padding: 10,
        display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(242,131,107,0.08)',
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.colors.accent}30`,
        animation: 'slideUp 0.3s ease-out',
      }}>
        <span style={{ fontWeight: 700, color: theme.colors.accent, fontSize: 13 }}>
          Claim this tile?
        </span>
        {claimOptions.map((opt, i) => (
          <button
            key={i}
            onClick={() => onClaim(opt.claimtype)}
            style={{
              ...btnBase,
              backgroundColor: opt.claimtype === CLAIM.WIN ? '#c62828' : theme.colors.accent,
              fontSize: opt.claimtype === CLAIM.WIN ? 15 : 13,
            }}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={onPass}
          style={{
            ...btnBase,
            backgroundColor: 'rgba(0,0,0,0.06)',
            color: theme.colors.textMuted,
          }}
        >
          Pass
        </button>
      </div>
    );
  }

  return null;
}
