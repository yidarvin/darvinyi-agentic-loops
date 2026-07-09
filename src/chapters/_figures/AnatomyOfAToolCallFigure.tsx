// AnatomyOfAToolCallFigure: the figure for "Anatomy of a Tool Call".
// The structure it encodes: one tool call is the same information in two
// representations. The top lane is the typed surface your harness holds
// (tool_use / tool_result blocks); the bottom lane is the token stream the model
// actually generates and consumes. The API boundary between them serializes tool
// definitions down and parses emissions back up. Execution happens off-stream, in
// your code, with the model not involved, and the result re-enters as tokens on
// the next turn. Inline SVG, themed with the CSS variables, ASCII labels so it
// stays crisp and prose-lint clean.
export function AnatomyOfAToolCallFigure() {
  return (
    <svg
      viewBox="0 0 780 440"
      className="w-full min-w-[660px]"
      role="img"
      aria-label="One tool call in two representations. Top lane, the typed surface your harness holds: a tools array declared once, a tool_use block the model emits with id, name, and input and stop_reason tool_use, your code executing the tool off-stream, and a tool_result block you send back in a user turn. Bottom lane, the token stream the model runs on: the tool schema serialized into the cached prefix, the emission generated as a learned token format rather than a separate channel, and the result serialized back into the prefix. The API layer between the lanes serializes definitions down and parses emissions up, and next turn the model reads the result tokens and continues."
      fill="none"
    >
      <rect x="1" y="1" width="778" height="438" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      <text x="22" y="28" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// one tool call, two representations of the same thing"}
      </text>
      <text x="22" y="52" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        {"// typed surface: what your harness holds"}
      </text>
      <text x="22" y="236" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        {"// token stream: what the model runs on"}
      </text>

      <defs>
        <marker id="tc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
      </defs>

      {/* the API boundary: the dashed line is where typed blocks become tokens */}
      <line x1="30" y1="200" x2="750" y2="200" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="390" y="195" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent-dim)">
        {"// the API layer"}
      </text>

      {/* top-lane horizontal flow: define ...decides... emit -> execute -> return */}
      <path d="M 185 110 L 221 110" stroke="var(--comment)" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#tc-arrow)" />
      <path d="M 375 110 L 411 110" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#tc-arrow)" />
      <path d="M 565 110 L 596 110" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#tc-arrow)" />

      {/* crossing arrows: serialize down, parse up */}
      <path d="M 110 154 L 110 266" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#tc-arrow)" />
      <path d="M 300 266 L 300 156" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#tc-arrow)" />
      <path d="M 675 154 L 675 266" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#tc-arrow)" />
      <text x="118" y="178" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">serialize</text>
      <text x="292" y="178" textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent)">parse (API layer)</text>
      <text x="683" y="178" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">serialize</text>

      {/* next turn: the result tokens feed the model's next read */}
      <path d="M 675 356 L 675 396 L 300 396 L 300 358" stroke="var(--accent-dim)" strokeWidth="1.5" markerEnd="url(#tc-arrow)" />
      <text x="487" y="386" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">
        {"next turn: the model reads the result and continues"}
      </text>

      {/* ---- TOP LANE: typed blocks ---- */}

      {/* define */}
      <rect x="35" y="68" width="150" height="84" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="110" y="90" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">tools[]</text>
      <text x="110" y="110" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">{"{ name, description,"}</text>
      <text x="110" y="126" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">{"  input_schema }"}</text>
      <text x="110" y="144" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">declared once</text>

      {/* emit */}
      <rect x="225" y="68" width="150" height="84" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.4" />
      <text x="300" y="90" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">tool_use</text>
      <text x="300" y="110" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">{"{ id, name, input }"}</text>
      <text x="300" y="144" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">stop_reason: tool_use</text>

      {/* execute */}
      <rect x="415" y="68" width="150" height="84" rx="8" fill="var(--surface)" stroke="var(--border)" strokeDasharray="4 4" />
      <text x="490" y="90" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">run_tool()</text>
      <text x="490" y="110" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">your code executes</text>
      <text x="490" y="144" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">the model is not called</text>

      {/* return */}
      <rect x="600" y="68" width="150" height="84" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="675" y="90" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">tool_result</text>
      <text x="675" y="110" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">{"{ tool_use_id,"}</text>
      <text x="675" y="126" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">{"  content }"}</text>
      <text x="675" y="144" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">sent in a user turn</text>

      {/* ---- BOTTOM LANE: tokens ---- */}

      {/* under define */}
      <rect x="35" y="270" width="150" height="84" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="110" y="294" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">{"schema -> tokens"}</text>
      <text x="110" y="313" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">in the cached prefix</text>
      <text x="110" y="337" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">costs tokens every call</text>

      {/* under emit */}
      <rect x="225" y="270" width="150" height="84" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.3" />
      <text x="300" y="294" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">generated tokens</text>
      <text x="300" y="314" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent-dim)">{"<|tool_use|>read_file"}</text>
      <text x="300" y="338" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">not a special channel</text>

      {/* under execute: off-stream */}
      <rect x="415" y="270" width="150" height="84" rx="8" fill="var(--surface)" stroke="var(--border)" strokeDasharray="4 4" opacity="0.55" />
      <text x="490" y="306" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">no tokens here:</text>
      <text x="490" y="324" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">your code runs</text>

      {/* under return */}
      <rect x="600" y="270" width="150" height="84" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="675" y="294" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">{"result -> tokens"}</text>
      <text x="675" y="313" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">appended to prefix</text>
      <text x="675" y="337" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">read next turn</text>
    </svg>
  );
}
