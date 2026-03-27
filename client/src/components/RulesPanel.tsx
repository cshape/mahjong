import { theme } from '../theme';

const sectionTitle: React.CSSProperties = {
  color: theme.colors.accent,
  fontSize: 16,
  fontWeight: 700,
  marginTop: 20,
  marginBottom: 8,
  borderBottom: `1px solid ${theme.colors.border}`,
  paddingBottom: 4,
};

const paragraph: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  color: theme.colors.textPrimary,
  marginBottom: 8,
};

const term: React.CSSProperties = {
  fontWeight: 700,
  color: theme.colors.accent,
};

interface RulesPanelProps {
  open: boolean;
  onClose: () => void;
}

export function RulesPanel({ open, onClose }: RulesPanelProps) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 199,
          }}
        />
      )}

      {/* Slide-out panel */}
      <div style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: 360,
        height: '100dvh',
        background: theme.colors.bgCard,
        color: theme.colors.textPrimary,
        padding: 24,
        overflowY: 'auto',
        zIndex: 200,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease',
        boxShadow: open ? '-4px 0 20px rgba(100,70,50,0.15)' : 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.colors.accent }}>How to Play</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: theme.colors.textMuted,
              fontSize: 24,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            &times;
          </button>
        </div>

        <p style={{ ...paragraph, color: theme.colors.textSecondary, fontSize: 12 }}>
          Cantonese Mahjong (Hong Kong Rules)
        </p>

        <h3 style={sectionTitle}>The Basics</h3>
        <p style={paragraph}>
          Mahjong is played by 4 players with 144 tiles. Each player starts with 13 tiles.
          On your turn, you draw a tile (giving you 14) and then discard one.
        </p>
        <p style={paragraph}>
          <span style={term}>Goal:</span> Be the first to complete a winning hand —
          <span style={term}> 4 sets + 1 pair</span> (14 tiles total).
        </p>
        <p style={paragraph}>
          A <span style={term}>set</span> is either a <span style={term}>sequence</span> (e.g. Bamboo 3-4-5)
          or <span style={term}>three of a kind</span> (e.g. three Dots 7).
        </p>

        <h3 style={sectionTitle}>Tile Types</h3>
        <p style={paragraph}>
          <span style={term}>Bamboo (B1-B9)</span> — green suit, numbered 1-9<br />
          <span style={term}>Characters (C1-C9)</span> — red suit, numbered 1-9<br />
          <span style={term}>Dots (D1-D9)</span> — blue suit, numbered 1-9<br />
          <span style={term}>Winds</span> — East, South, West, North<br />
          <span style={term}>Dragons</span> — Fa (green), Chung (red), Bak (white)<br />
          <span style={term}>Bonus</span> — Flowers and Seasons (auto-set aside)
        </p>

        <h3 style={sectionTitle}>Claiming Tiles</h3>
        <p style={paragraph}>
          When another player discards a tile, you may be able to <span style={term}>claim</span> it
          to complete a set. An orange bar appears at the bottom with your options:
        </p>
        <p style={paragraph}>
          <span style={term}>Sheung (Chow)</span> — Claim to complete a sequence (e.g. you have B3, B4
          and someone discards B5). Only from the player before you.<br /><br />
          <span style={term}>Pong</span> — Claim to make three of a kind (e.g. you have two D7
          and someone discards a third). From any player.<br /><br />
          <span style={term}>Kong</span> — Claim to make four of a kind. From any player.<br /><br />
          <span style={term}>Mah Jong!</span> — Claim the tile to complete your winning hand!
        </p>
        <p style={paragraph}>
          You have <span style={term}>15 seconds</span> to decide. If you don't click, you automatically pass.
          Claimed tiles are placed face-up and locked.
        </p>

        <h3 style={sectionTitle}>Scoring</h3>
        <p style={paragraph}>
          In Cantonese rules, you need a minimum of <span style={term}>3 faan</span> (points) to win.
          Common ways to score:
        </p>
        <p style={paragraph}>
          <span style={term}>All Pongs</span> — all sets are three-of-a-kind (3 faan)<br />
          <span style={term}>Mixed One Suit</span> — one suit + winds/dragons (3 faan)<br />
          <span style={term}>All One Suit</span> — tiles all from one suit (7 faan)<br />
          <span style={term}>Dragon Pong</span> — three of a dragon (1 faan each)<br />
          <span style={term}>Seat/Round Wind</span> — three of your wind (1 faan each)<br />
          <span style={term}>Self-draw</span> — win by drawing the tile yourself (1 faan)
        </p>

        <h3 style={sectionTitle}>Tips for Beginners</h3>
        <p style={paragraph}>
          1. <span style={term}>Watch the discards.</span> If many tiles of a suit have been discarded,
          avoid chasing sequences in that suit.<br /><br />
          2. <span style={term}>Keep your options open early.</span> Don't commit to a specific hand too soon.
          Discard isolated tiles first (winds you don't need, random singles).<br /><br />
          3. <span style={term}>Pong beats Sheung.</span> If two players want the same discard, Pong wins.
          Mah Jong beats everything.<br /><br />
          4. <span style={term}>Think about faan.</span> You need 3 faan minimum. Going for all-pongs or
          a single suit early can guide your strategy.<br /><br />
          5. <span style={term}>Don't be afraid to pass.</span> Claiming a Sheung reveals tiles and limits
          your hand. Sometimes it's better to wait.
        </p>

        <div style={{ height: 40 }} />
      </div>
    </>
  );
}
