import type { ReactNode } from 'react'

/**
 * The shared layout primitives for the M2 refinement pass (28 Sept 2026).
 *
 * Scenario Workspace is the benchmark for the whole app, so the constants it
 * established live here rather than being re-derived on every screen. Before
 * this, the seven other screens used five different section rhythms
 * (space-y-4/5/6/8/10) and four different sizes for the same page heading
 * (text-2xl/3xl/4xl/5xl) — the same role rendered differently depending on
 * which screen you were on.
 *
 * The benchmark, measured off Scenario Workspace:
 *   page rhythm   space-y-20 between major blocks, space-y-10 within one
 *   heading       display 4xl semibold, leading-[1.1], two lines —
 *                 first in Grey 04, second in Grey 03
 *   card title    display xl semibold, Grey 04
 *   eyebrow       body xs bold uppercase, tracking-[0.14em], Grey 03
 *   body          body sm, Grey 03
 *   card          rounded-pa-card, white, shadow-pa-card; p-8 panel,
 *                 p-6 grid card, p-5 small card; gap-5 between cards
 */

/** Major page block. Children are the sections; the rhythm between them is fixed. */
export function PageSections({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`space-y-20 pb-8 ${className}`}>{children}</section>
}

/** One block within a page — heading plus its content. */
export function Block({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-10 ${className}`}>{children}</div>
}

/**
 * Two-line page/section heading: bold first line, lighter second. The second
 * line is the screen's one-line explanation rather than a separate paragraph,
 * which is what keeps the benchmark's headings compact.
 */
export function SectionHeading({
  first,
  second,
  action,
}: {
  first: string
  second: string
  /** Optional right-hand control (nav arrows, a button) — sits on the heading's baseline row. */
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <h2 className="font-pa-display text-4xl font-semibold leading-[1.1] text-pa-grey-04">
        {first}
        <br />
        <span className="text-pa-grey-03">{second}</span>
      </h2>
      {action}
    </div>
  )
}

/** Small uppercase label above a figure or a list. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-pa-body text-xs font-bold uppercase tracking-[0.14em] text-pa-grey-03 ${className}`}>
      {children}
    </p>
  )
}

/**
 * A card. `pad` follows the benchmark's three sizes rather than each screen
 * picking its own: panel (p-8), grid card (p-6), small card (p-5).
 */
export function Card({
  children,
  pad = 'panel',
  className = '',
  testId,
}: {
  children: ReactNode
  pad?: 'panel' | 'grid' | 'small'
  className?: string
  testId?: string
}) {
  const padding = pad === 'panel' ? 'p-8' : pad === 'grid' ? 'p-6' : 'p-5'
  return (
    <div data-testid={testId} className={`rounded-pa-card bg-pa-white shadow-pa-card ${padding} ${className}`}>
      {children}
    </div>
  )
}
