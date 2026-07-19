// EvaluatingAgentsFigure: the evaluation flywheel for "Evaluating Agents".
// The diagram keeps public benchmarks outside the local decision loop.
export function EvaluatingAgentsFigure() {
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 720 460"
        className="min-w-[680px] w-full"
        role="img"
        aria-label="An evaluation flywheel connects a private task bank, isolated repeated trials, layered graders, evidence review, failure clusters, and agent changes. Public benchmarks calibrate the private loop from outside."
        fill="none"
      >
        <defs>
          <marker
            id="evaluating-agents-arrow"
            viewBox="0 0 8 8"
            refX="6.5"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--accent)" />
          </marker>
        </defs>

        <rect x="1" y="1" width="718" height="458" rx="10" fill="var(--surface-2)" stroke="var(--border)" />
        <text x="28" y="31" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
          {"// evaluation_flywheel"}
        </text>
        <text x="28" y="50" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
          local evidence decides. external benchmarks calibrate.
        </text>

        <rect x="523" y="18" width="169" height="35" rx="5" fill="var(--surface)" stroke="var(--border)" />
        <text x="537" y="39" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
          public benchmarks
        </text>
        <path
          d="M 523 39 C 450 39 365 44 245 76"
          stroke="var(--accent-dim)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          markerEnd="url(#evaluating-agents-arrow)"
        />

        <path d="M 236 116 H 264" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#evaluating-agents-arrow)" />
        <path d="M 452 116 H 480" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#evaluating-agents-arrow)" />
        <path d="M 581 173 V 250" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#evaluating-agents-arrow)" />
        <path d="M 480 307 H 454" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#evaluating-agents-arrow)" />
        <path d="M 264 307 H 236" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#evaluating-agents-arrow)" />
        <path d="M 139 250 V 173" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#evaluating-agents-arrow)" />

        <g>
          <rect x="44" y="78" width="192" height="95" rx="7" fill="var(--surface)" stroke="var(--accent-dim)" />
          <text x="60" y="102" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
            01 / task_bank
          </text>
          <text x="60" y="123" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
            real failures
          </text>
          <text x="60" y="142" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            clear pass or fail
          </text>
          <text x="60" y="158" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            capability + regression
          </text>
        </g>

        <g>
          <rect x="270" y="78" width="182" height="95" rx="7" fill="var(--surface)" stroke="var(--border)" />
          <text x="286" y="102" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
            02 / clean_trial
          </text>
          <text x="286" y="123" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
            agent + harness
          </text>
          <text x="286" y="142" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            fresh environment
          </text>
          <text x="286" y="158" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            repeat k times
          </text>
        </g>

        <g>
          <rect x="486" y="78" width="190" height="95" rx="7" fill="var(--surface)" stroke="var(--border)" />
          <text x="502" y="102" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
            03 / grader_stack
          </text>
          <text x="502" y="123" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
            outcome is primary
          </text>
          <text x="502" y="142" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            trajectory diagnoses
          </text>
          <text x="502" y="158" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            cost + safety constrain
          </text>
        </g>

        <g>
          <rect x="486" y="251" width="190" height="112" rx="7" fill="var(--surface)" stroke="var(--border)" />
          <text x="502" y="276" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
            04 / evidence
          </text>
          <text x="502" y="297" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
            distributions
          </text>
          <text x="502" y="316" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            pass@k and pass^k
          </text>
          <text x="502" y="333" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            costs, steps, traces
          </text>
          <text x="502" y="350" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            inspect score movers
          </text>
        </g>

        <g>
          <rect x="270" y="251" width="182" height="112" rx="7" fill="var(--surface)" stroke="var(--border)" />
          <text x="286" y="276" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
            05 / failure_cluster
          </text>
          <text x="286" y="297" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
            name the cause
          </text>
          <text x="286" y="316" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            tool, context, policy
          </text>
          <text x="286" y="333" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            environment, grader
          </text>
          <text x="286" y="350" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            or task defect
          </text>
        </g>

        <g>
          <rect x="44" y="251" width="192" height="112" rx="7" fill="var(--surface)" stroke="var(--border)" />
          <text x="60" y="276" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
            06 / change
          </text>
          <text x="60" y="297" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
            model + harness
          </text>
          <text x="60" y="316" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            prompt, tool, memory
          </text>
          <text x="60" y="333" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            verifier, permissions
          </text>
          <text x="60" y="350" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
            one falsifiable bet
          </text>
        </g>

        <line x1="44" y1="397" x2="676" y2="397" stroke="var(--border)" />
        <text x="44" y="421" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
          capability suite: seek headroom
        </text>
        <text x="436" y="421" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
          regression suite: guard the floor
        </text>
        <text x="44" y="442" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
          production traces refresh the task bank. no one score closes the loop.
        </text>
      </svg>
    </div>
  );
}
