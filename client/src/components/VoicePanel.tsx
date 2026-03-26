import { theme } from '../theme';

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

interface VoicePanelProps {
  enabled: boolean;
  muted: boolean;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onToggleMute: () => void;
}

export function VoicePanel({
  enabled, muted,
  onStartVoice, onStopVoice, onToggleMute,
}: VoicePanelProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      {!enabled ? (
        <button onClick={onStartVoice} style={btnStyle}>
          Voice
        </button>
      ) : (
        <>
          <button
            onClick={onToggleMute}
            style={{
              ...btnStyle,
              borderColor: muted ? '#c44' : theme.colors.border,
              color: muted ? '#c44' : theme.colors.textSecondary,
            }}
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button
            onClick={onStopVoice}
            style={{
              ...btnStyle,
              color: theme.colors.textMuted,
              borderColor: theme.colors.border,
            }}
          >
            Voice Off
          </button>
        </>
      )}
    </div>
  );
}
