export interface HBarRow {
  key: string
  label: string
  value: number
  display: string
  fill: string
}

/**
 * Standard token-styled horizontal bar chart (Searchlight design pass) — the
 * "properly styled standard chart" the locked spec reserves for these
 * screens (the custom signature visualisation stays on Executive Summary
 * only). Bars scale to the largest absolute value; labels in Manrope, values
 * in Space Mono. Pure CSS, no chart library. Bars render at their final
 * width directly — the searchlight loader carries this screen's one motion
 * moment, and a per-bar mount transition proved flaky (it could freeze
 * mid-grow) for no real gain.
 */
export function HBarChart({ rows }: { rows: HBarRow[] }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1)

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3">
          <div className="w-36 shrink-0 truncate font-pa-body text-xs text-pa-grey-04">{r.label}</div>
          <div className="relative h-6 flex-1 overflow-hidden rounded bg-pa-grey-01">
            <div
              className="absolute inset-y-0 left-0 rounded"
              style={{ width: `${(Math.abs(r.value) / max) * 100}%`, background: r.fill }}
            />
          </div>
          <div className="w-24 shrink-0 text-right font-pa-mono text-xs text-pa-grey-04">{r.display}</div>
        </div>
      ))}
    </div>
  )
}
