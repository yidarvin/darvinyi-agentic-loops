// PromptCachingEconomicsFigure shows the architectural consequence of prefix matching:
// a byte-stable head can reuse KV state, while a dynamic field before the boundary
// invalidates the downstream prefix.
export function PromptCachingEconomicsFigure() {
  return (
    <svg
      viewBox="0 0 960 560"
      className="w-full min-w-[900px]"
      role="img"
      aria-label="Three agent requests share a stable system, tools, and reference prefix before a cache boundary, allowing requests two and three to read cached KV state. A failure example places a changing timestamp first, causing the rest of its prefix to miss."
      fill="none"
    >
      <defs>
        <marker id="prompt-cache-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="var(--accent)" />
        </marker>
        <marker id="prompt-cache-danger-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="var(--danger)" />
        </marker>
      </defs>

      <rect x="1" y="1" width="958" height="558" rx="10" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="30" y="34" fontFamily="var(--font-mono)" fontSize="14" fill="var(--fg-muted)">
        {"// cache boundary = final byte-stable block"}
      </text>
      <text x="752" y="34" fontFamily="var(--font-mono)" fontSize="14" fill="var(--fg-muted)">
        {"// reusable attention state"}
      </text>

      <rect x="730" y="55" width="198" height="276" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.65" />
      <text x="750" y="84" fontFamily="var(--font-mono)" fontSize="16" fill="var(--accent)">
        KV CACHE
      </text>
      <text x="750" y="109" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg-muted)">
        processed keys + values
      </text>
      <line x1="750" y1="125" x2="908" y2="125" stroke="var(--border)" />
      <text x="750" y="158" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        req_01: write prefix
      </text>
      <text x="750" y="191" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        req_02: cache read
      </text>
      <text x="750" y="224" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        req_03: cache read
      </text>
      <text x="750" y="270" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg-muted)">
        skip stable-prefix prefill
      </text>
      <text x="750" y="292" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg-muted)">
        prefill only fresh suffix
      </text>

      <RequestRow y={70} request="req_01" result="cache write" resultColor="var(--fg-muted)" />
      <RequestRow y={156} request="req_02" result="cache read" resultColor="var(--accent)" />
      <RequestRow y={242} request="req_03" result="cache read" resultColor="var(--accent)" />

      <path d="M696 105 H720" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#prompt-cache-arrow)" />
      <path d="M696 191 H720" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#prompt-cache-arrow)" />
      <path d="M696 277 H720" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#prompt-cache-arrow)" />

      <line x1="30" y1="356" x2="928" y2="356" stroke="var(--border)" />
      <text x="30" y="387" fontFamily="var(--font-mono)" fontSize="14" fill="var(--danger)">
        FAILURE: dynamic content inside the reusable prefix
      </text>

      <text x="30" y="438" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        req_bad
      </text>
      <rect x="130" y="407" width="128" height="54" rx="5" fill="var(--surface)" stroke="var(--danger)" strokeOpacity="0.9" />
      <text x="194" y="430" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--danger)">
        timestamp
      </text>
      <text x="194" y="448" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg-muted)">
        changes per call
      </text>
      <rect x="258" y="407" width="110" height="54" rx="5" fill="var(--surface)" stroke="var(--border)" />
      <text x="313" y="440" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        system
      </text>
      <rect x="368" y="407" width="100" height="54" rx="5" fill="var(--surface)" stroke="var(--border)" />
      <text x="418" y="440" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        tools
      </text>
      <rect x="468" y="407" width="154" height="54" rx="5" fill="var(--surface)" stroke="var(--border)" />
      <text x="545" y="440" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        stable reference
      </text>
      <line x1="628" y1="397" x2="628" y2="471" stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="628" y="492" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--danger)">
        misplaced boundary
      </text>
      <path d="M258 434 H694" stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#prompt-cache-danger-arrow)" />
      <text x="716" y="439" fontFamily="var(--font-mono)" fontSize="13" fill="var(--danger)">
        first divergence
      </text>
      <text x="716" y="458" fontFamily="var(--font-mono)" fontSize="13" fill="var(--danger)">
        downstream prefix misses
      </text>

      <text x="479" y="532" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fill="var(--fg-muted)">
        stable → volatile: keep retrieval, tool results, and the latest turn after the cache seam
      </text>
    </svg>
  );
}

function RequestRow({
  y,
  request,
  result,
  resultColor,
}: {
  y: number;
  request: string;
  result: string;
  resultColor: string;
}) {
  return (
    <g>
      <text x="30" y={y + 35} fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        {request}
      </text>
      <rect x="130" y={y} width="110" height="54" rx="5" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.7" />
      <text x="185" y={y + 33} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        system
      </text>
      <rect x="240" y={y} width="100" height="54" rx="5" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.7" />
      <text x="290" y={y + 33} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        tools
      </text>
      <rect x="340" y={y} width="166" height="54" rx="5" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.7" />
      <text x="423" y={y + 33} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        stable reference
      </text>
      <line x1="518" y1={y - 8} x2="518" y2={y + 62} stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="518" y={y - 14} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
        boundary
      </text>
      <rect x="530" y={y} width="166" height="54" rx="5" fill="var(--surface)" stroke="var(--border)" />
      <text x="613" y={y + 25} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">
        retrieved memory +
      </text>
      <text x="613" y={y + 42} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">
        latest user turn
      </text>
      <text x="130" y={y + 76} fontFamily="var(--font-mono)" fontSize="12" fill={resultColor}>
        {result}
      </text>
    </g>
  );
}
