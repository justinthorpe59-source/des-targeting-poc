/**
 * Hand-sketchy, academic-paper-style background illustrations (Searchlight
 * design pass) — redrawn in PA's colour tokens, not the reference's
 * warm/vintage palette. The "sketch" wobble comes from a native SVG
 * feTurbulence/feDisplacementMap filter rather than a hand-drawn-rendering
 * library (e.g. rough.js) — no new dependency for a background decoration.
 * Subtle/background-only by contract: callers control opacity and
 * placement, these components make no positioning decisions themselves.
 */
function SketchFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018 0.035" numOctaves={2} seed={7} result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale={3.2} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  )
}

export function SketchNetwork({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 220" className={className} aria-hidden focusable="false">
      <defs>
        <SketchFilter id="pa-sketch-network" />
      </defs>
      <g filter="url(#pa-sketch-network)" fill="none" stroke="var(--color-pa-grey-02)" strokeWidth={1.2}>
        <line x1="30" y1="40" x2="120" y2="20" />
        <line x1="120" y1="20" x2="200" y2="60" />
        <line x1="30" y1="40" x2="70" y2="120" />
        <line x1="120" y1="20" x2="140" y2="130" />
        <line x1="200" y1="60" x2="190" y2="150" />
        <line x1="70" y1="120" x2="140" y2="130" />
        <line x1="140" y1="130" x2="190" y2="150" />
        <line x1="70" y1="120" x2="50" y2="190" />
        <line x1="140" y1="130" x2="120" y2="195" />
      </g>
      <g filter="url(#pa-sketch-network)" fill="var(--color-pa-aqua-03)">
        <circle cx="30" cy="40" r="5" />
        <circle cx="120" cy="20" r="5" />
        <circle cx="200" cy="60" r="5" />
        <circle cx="70" cy="120" r="5" />
        <circle cx="140" cy="130" r="5" />
        <circle cx="190" cy="150" r="5" />
        <circle cx="50" cy="190" r="5" />
        <circle cx="120" cy="195" r="5" />
      </g>
    </svg>
  )
}

export function SketchDistribution({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 160" className={className} aria-hidden focusable="false">
      <defs>
        <SketchFilter id="pa-sketch-dist" />
      </defs>
      <g filter="url(#pa-sketch-dist)" fill="none" stroke="var(--color-pa-grey-02)" strokeWidth={1.2}>
        <line x1="20" y1="140" x2="240" y2="140" />
        <line x1="20" y1="140" x2="20" y2="20" />
        <path d="M 20 140 C 70 140, 80 30, 130 30 C 180 30, 190 140, 240 140" stroke="var(--color-pa-aqua-04)" strokeWidth={1.6} />
        {[50, 80, 110, 140, 170, 200].map((x) => (
          <line key={x} x1={x} y1="136" x2={x} y2="144" />
        ))}
      </g>
    </svg>
  )
}

// Scatter of points with a light trend line — Division comparison.
export function SketchScatter({ className }: { className?: string }) {
  const pts: Array<[number, number]> = [
    [40, 130], [62, 118], [78, 96], [96, 104], [112, 82], [130, 90],
    [150, 66], [168, 74], [188, 52], [206, 60], [224, 40],
  ]
  return (
    <svg viewBox="0 0 260 160" className={className} aria-hidden focusable="false">
      <defs>
        <SketchFilter id="pa-sketch-scatter" />
      </defs>
      <g filter="url(#pa-sketch-scatter)" fill="none" stroke="var(--color-pa-grey-02)" strokeWidth={1.2}>
        <line x1="20" y1="140" x2="240" y2="140" />
        <line x1="20" y1="140" x2="20" y2="20" />
        <line x1="30" y1="138" x2="235" y2="34" stroke="var(--color-pa-aqua-04)" strokeWidth={1.6} strokeDasharray="5 5" />
      </g>
      <g filter="url(#pa-sketch-scatter)" fill="var(--color-pa-aqua-03)">
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4} />
        ))}
      </g>
    </svg>
  )
}

// Network of linked nodes for Team drill-down is SketchNetwork above.

// Grid / matrix of cells with a few filled — Scenario workspace.
export function SketchGrid({ className }: { className?: string }) {
  const cols = 8
  const rows = 6
  const cell = 28
  const filled = new Set(['1-2', '3-1', '4-4', '2-5', '6-3', '5-0'])
  return (
    <svg viewBox={`0 0 ${cols * cell + 20} ${rows * cell + 20}`} className={className} aria-hidden focusable="false">
      <defs>
        <SketchFilter id="pa-sketch-grid" />
      </defs>
      <g filter="url(#pa-sketch-grid)">
        {Array.from({ length: rows }).flatMap((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const on = filled.has(`${c}-${r}`)
            return (
              <rect
                key={`${c}-${r}`}
                x={10 + c * cell}
                y={10 + r * cell}
                width={cell - 4}
                height={cell - 4}
                rx={2}
                fill={on ? 'var(--color-pa-aqua-02)' : 'none'}
                stroke="var(--color-pa-grey-02)"
                strokeWidth={1}
              />
            )
          }),
        )}
      </g>
    </svg>
  )
}

// Nested contour rings (solution-space surface) — Scenario library.
export function SketchSurface({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 200" className={className} aria-hidden focusable="false">
      <defs>
        <SketchFilter id="pa-sketch-surface" />
      </defs>
      <g filter="url(#pa-sketch-surface)" fill="none" stroke="var(--color-pa-grey-02)" strokeWidth={1.2}>
        {[70, 56, 42, 28, 14].map((r, i) => (
          <ellipse
            key={r}
            cx={130}
            cy={100}
            rx={r + 20}
            ry={r}
            stroke={i === 4 ? 'var(--color-pa-aqua-04)' : 'var(--color-pa-grey-02)'}
            strokeWidth={i === 4 ? 1.6 : 1.2}
          />
        ))}
        <circle cx={130} cy={100} r={3} fill="var(--color-pa-aqua-03)" stroke="none" />
      </g>
    </svg>
  )
}
