import { useEffect, useRef } from 'react';
import { theme } from '../theme';
import type { TranscriptEntry } from '../useVoice';

const AGENT_COLORS: Record<number, string> = {
  1: '#C07840', // Grandpa - warm brown
  2: '#4A8C5A', // Gladys - forest green
  3: '#4A6EBF', // Lucky - deep blue
};

interface TranscriptLogProps {
  transcripts: TranscriptEntry[];
}

export function TranscriptLog({ transcripts }: TranscriptLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcripts]);

  if (transcripts.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="glass-panel"
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
      }}>Voice Chat</div>
      {transcripts.filter(t => t.final).slice(-15).map((t, i) => (
        <div key={i} style={{ marginBottom: 3 }}>
          <span style={{
            fontWeight: 700,
            color: t.agentId != null ? (AGENT_COLORS[t.agentId] || theme.colors.textSecondary) : theme.colors.textPrimary,
          }}>
            {t.agentName}:
          </span>{' '}
          <span style={{ color: theme.colors.textSecondary }}>
            {t.text}
          </span>
        </div>
      ))}
    </div>
  );
}
