import { theme } from '../theme';

const AGENT_COLORS: Record<number, string> = {
  1: '#C07840', // Grandpa
  2: '#4A8C5A', // Gladys
  3: '#4A6EBF', // Lucky
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

interface VoicePanelProps {
  enabled: boolean;
  muted: boolean;
  speakingAgentId: number | null;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onToggleMute: () => void;
}

export function VoicePanel({
  enabled, muted, speakingAgentId,
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
          {speakingAgentId != null && (
            <span style={{
              fontSize: 10,
              color: AGENT_COLORS[speakingAgentId] || theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}>
              <span style={{
                display: 'inline-block',
                width: 5,
                height: 5,
                borderRadius: '50%',
                backgroundColor: AGENT_COLORS[speakingAgentId] || theme.colors.textSecondary,
                animation: 'pulse 0.8s ease-in-out infinite',
              }} />
              Speaking
            </span>
          )}
        </>
      )}
    </div>
  );
}
