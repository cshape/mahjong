import { useEffect, useRef, useState } from 'react';
import { theme } from '../theme';
import type { TranscriptEntry } from '../useVoice';

const AGENT_COLORS: Record<number, string> = {
  1: '#C07840', // Grandpa - warm brown
  2: '#4A8C5A', // Gladys - forest green
  3: '#4A6EBF', // Lucky - deep blue
};

/** Strip audio markup tags like [laugh], [sigh], etc. from display text */
function stripMarkup(text: string): string {
  return text.replace(/\[[\w_]+\]\s*/g, '').trim();
}

interface TranscriptLogProps {
  transcripts: TranscriptEntry[];
  onSendChat?: (text: string) => void;
}

export function TranscriptLog({ transcripts, onSendChat }: TranscriptLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chatText, setChatText] = useState('');

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcripts]);

  const handleSend = () => {
    if (chatText.trim() && onSendChat) {
      onSendChat(chatText.trim());
      setChatText('');
    }
  };

  if (transcripts.length === 0 && !onSendChat) return null;

  return (
    <div className="glass-panel" style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 12px',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <div style={{
          fontSize: 10, color: theme.colors.accent,
          textTransform: 'uppercase', letterSpacing: 1.5,
          marginBottom: 6, fontWeight: 800,
        }}>Chat</div>
        {transcripts.filter(t => t.final).slice(-30).map((t, i) => (
          <div key={i} style={{ marginBottom: 3 }}>
            <span style={{
              fontWeight: 700,
              color: t.agentId != null ? (AGENT_COLORS[t.agentId] || theme.colors.textSecondary) : theme.colors.textPrimary,
            }}>
              {t.agentName}:
            </span>{' '}
            <span style={{ color: theme.colors.textSecondary }}>
              {stripMarkup(t.text)}
            </span>
          </div>
        ))}
      </div>
      {onSendChat && (
        <div style={{
          display: 'flex', gap: 4,
          padding: '6px 8px',
          borderTop: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}>
          <input
            type="text"
            value={chatText}
            onChange={e => setChatText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: 12,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              outline: 'none',
              backgroundColor: theme.colors.bgCard,
              color: theme.colors.textPrimary,
              minWidth: 0,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!chatText.trim()}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: chatText.trim() ? theme.colors.accent : theme.colors.textMuted,
              color: '#fff',
              border: 'none',
              borderRadius: theme.radius.sm,
              cursor: chatText.trim() ? 'pointer' : 'default',
              opacity: chatText.trim() ? 1 : 0.4,
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
