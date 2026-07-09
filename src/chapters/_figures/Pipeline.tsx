// Pipeline --- a chapter-specific figure. Inline SVG so it themes with the CSS
// variables and stays crisp at any width. This one draws the build loop the book
// is written with: the queue feeds Claude Code, which writes a chapter and updates
// the registry, which the site renders and Vercel deploys.
export function Pipeline() {
  return (
    <svg
      viewBox="0 0 640 220"
      className="w-full"
      role="img"
      aria-label="The build pipeline: queue to Claude Code to registry and chapter to deploy."
      fill="none"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="var(--comment)" />
        </marker>
      </defs>

      {/* queue */}
      <g>
        <rect x="8" y="80" width="120" height="60" rx="6" fill="var(--surface-2)" stroke="var(--border)" />
        <text x="68" y="105" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">
          queue.md
        </text>
        <text x="68" y="122" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
          ordered list
        </text>
      </g>

      <line x1="128" y1="110" x2="196" y2="110" stroke="var(--comment)" strokeWidth="1.5" markerEnd="url(#arrow)" />

      {/* claude code loop */}
      <g>
        <rect x="200" y="40" width="180" height="140" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.4" />
        <text x="290" y="62" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">
          // claude code
        </text>
        {["research", "build", "verify", "commit"].map((step, i) => (
          <g key={step}>
            <rect x="220" y={78 + i * 24} width="140" height="18" rx="3" fill="var(--surface-2)" stroke="var(--border)" />
            <text x="230" y={90 + i * 24} fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
              {String(i + 1)}. {step}
            </text>
          </g>
        ))}
      </g>

      <line x1="380" y1="110" x2="448" y2="110" stroke="var(--comment)" strokeWidth="1.5" markerEnd="url(#arrow)" />

      {/* outputs */}
      <g>
        <rect x="452" y="52" width="130" height="52" rx="6" fill="var(--surface-2)" stroke="var(--border)" />
        <text x="517" y="74" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
          chapter.mdx
        </text>
        <text x="517" y="90" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
          prose + figure + widget
        </text>

        <rect x="452" y="116" width="130" height="52" rx="6" fill="var(--surface-2)" stroke="var(--border)" />
        <text x="517" y="138" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
          registry.json
        </text>
        <text x="517" y="154" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
          the database
        </text>
      </g>

      {/* feedback edge: build can enqueue more (graph mode) */}
      <path
        d="M517,168 C517,200 68,200 68,142"
        stroke="var(--accent-dim)"
        strokeWidth="1.2"
        strokeDasharray="4 4"
        markerEnd="url(#arrow)"
      />
      <text x="292" y="214" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">
        a run may enqueue more (graph mode)
      </text>
    </svg>
  );
}
