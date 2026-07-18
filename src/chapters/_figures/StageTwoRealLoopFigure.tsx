export function StageTwoRealLoopFigure() {
  return (
    <svg
      viewBox="0 0 940 590"
      className="min-w-[760px] w-full"
      role="img"
      aria-label="A Stage Two coding-agent loop routes a user task through context management, a streamed model turn, tool validation and permission checks, bounded tool execution, and a matching result. Valid tool calls execute after validation. Invalid or denied calls bypass execution and return a matching error result. Four guard bands recover from transient API errors, invalid tools, interrupted streams, and growing context."
      fill="none"
    >
      <title>Stage Two fault-containment loop</title>
      <defs>
        <marker
          id="stage-two-real-loop-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L7,3 z" fill="var(--accent)" />
        </marker>
      </defs>

      <rect x="1" y="1" width="938" height="588" rx="10" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="28" y="34" fontFamily="var(--font-mono)" fontSize="12" fill="var(--comment)">
        {"// stage_two: branch failure back into the loop"}
      </text>

      <rect x="28" y="58" width="884" height="62" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="47" y="84" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        api boundary
      </text>
      <text x="47" y="105" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg-muted)">
        transient 429, overload, or connection loss
      </text>
      <rect x="614" y="71" width="272" height="36" rx="18" fill="var(--surface-2)" stroke="var(--accent-dim)" />
      <text x="750" y="94" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">
        one retry owner + backoff + jitter
      </text>

      <rect x="42" y="169" width="178" height="92" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="60" y="200" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        context manager
      </text>
      <text x="60" y="223" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        count · cache · clear
      </text>
      <text x="60" y="242" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        compact · offload
      </text>

      <rect x="278" y="169" width="178" height="92" rx="8" fill="var(--surface)" stroke="var(--accent-dim)" />
      <text x="296" y="200" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        stream model turn
      </text>
      <text x="296" y="223" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        render deltas
      </text>
      <text x="296" y="242" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        preserve final message
      </text>

      <rect x="514" y="169" width="178" height="92" rx="8" fill="var(--surface)" stroke="var(--accent-dim)" />
      <text x="532" y="200" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        tool call
      </text>
      <text x="532" y="223" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        name + arguments
      </text>
      <text x="532" y="242" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        tool_use_id
      </text>

      <rect x="750" y="169" width="148" height="92" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="768" y="200" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        validate
      </text>
      <text x="768" y="223" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        schema · path
      </text>
      <text x="768" y="242" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        permission
      </text>

      <path d="M220 215 H278" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />
      <path d="M456 215 H514" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />
      <path d="M692 215 H750" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />
      <path d="M367 169 V120" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />
      <path d="M614 120 V169" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />

      <rect x="667" y="319" width="231" height="93" rx="8" fill="var(--surface)" stroke="var(--accent-dim)" />
      <text x="685" y="350" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        bounded execution
      </text>
      <text x="685" y="373" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        read · search · edit · shell
      </text>
      <text x="685" y="392" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        timeout + output cap
      </text>
      <path d="M824 261 V319" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />
      <text x="860" y="294" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fontWeight="600" fill="var(--fg)">
        valid call
      </text>
      <path d="M780 261 V280 H630 V365 H595" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />
      <text x="685" y="275" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fontWeight="600" fill="var(--fg)">
        invalid or denied
      </text>

      <rect x="352" y="319" width="243" height="93" rx="8" fill="var(--surface)" stroke="var(--accent-dim)" />
      <text x="370" y="350" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        matching tool_result
      </text>
      <text x="370" y="373" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        same tool_use_id
      </text>
      <text x="370" y="392" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        success or is_error: true
      </text>
      <path d="M667 365 H595" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />
      <path d="M474 319 V278 H367 V261" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />

      <rect x="42" y="319" width="232" height="93" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="60" y="350" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        completed response
      </text>
      <text x="60" y="373" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        no tool call + clean stop
      </text>
      <text x="60" y="392" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        return control to user
      </text>
      <path d="M278 215 H246 V319" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />

      <rect x="42" y="450" width="278" height="82" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="60" y="478" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        context boundary
      </text>
      <text x="60" y="500" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        stale results clear first; summaries last
      </text>
      <text x="60" y="518" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        files keep durable state outside the window
      </text>
      <path d="M220 261 V450" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />
      <path d="M320 491 H340 V280 H367 V261" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />

      <rect x="375" y="450" width="244" height="82" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="393" y="478" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        interrupted stream
      </text>
      <text x="393" y="500" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        no clean terminal event means no dispatch
      </text>
      <text x="393" y="518" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        close unresolved calls with an error result
      </text>
      <path d="M456 261 V450" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />
      <path d="M497 450 V430 H620 V280 H430 V261" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-two-real-loop-arrow)" />

      <rect x="674" y="450" width="224" height="82" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="692" y="478" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        stage three boundary
      </text>
      <text x="692" y="500" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        MCP · subagents · durable memory
      </text>
      <text x="692" y="518" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        sandbox and network isolation
      </text>
    </svg>
  );
}
