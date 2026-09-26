import { useId, useState, type ReactNode } from 'react'

/**
 * The shared accordion from searchlight-visual-spec.md's global system —
 * one component, two uses:
 *   Use 1 — Exceptions Queue: person + flag type + severity collapsed,
 *           failed check + field/value vs threshold + resolve action expanded.
 *   Use 2 — Manager Override's cross-check: pass/fail per check collapsed,
 *           that check's specific effect expanded.
 *
 * Spec behaviour, implemented here rather than per-screen:
 *   - exactly one item expanded at a time
 *   - collapsed rows sit on a light tint, the expanded row switches to
 *     white/elevated
 *   - label left, circular icon-button right: + to expand, x to collapse
 *
 * Nothing in the free react-bits catalogue covers this (its Components tier
 * is creative/animated widgets — Stepper, Dock, Infinite Menu; accordions
 * are Pro-tier App UI), so it is hand-built, as the frontend-components
 * skill requires be stated rather than silently skipped.
 */

export interface AccordionItem {
  id: string
  /** Left-hand label. Nodes allowed so callers can inline a StatusPill. */
  label: ReactNode
  /** Optional secondary line under the label, still in the collapsed row. */
  meta?: ReactNode
  content: ReactNode
  /** Forwarded to the row element so screen-level checks can target it. */
  testId?: string
  dataAttrs?: Record<string, string>
}

export function Accordion({
  items,
  defaultOpenId = null,
  testId,
}: {
  items: AccordionItem[]
  defaultOpenId?: string | null
  testId?: string
}) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId)
  const baseId = useId()

  if (items.length === 0) return null

  return (
    <div data-testid={testId} className="flex flex-col gap-3">
      {items.map((item) => {
        const isOpen = openId === item.id
        const panelId = `${baseId}-${item.id}-panel`
        return (
          <div
            key={item.id}
            data-testid={item.testId}
            data-open={isOpen ? 'true' : 'false'}
            {...(item.dataAttrs ?? {})}
            /* Reference shape language: a collapsed row is a stadium pill on
               a soft tint with no border; expanding switches it to white and
               elevated, and the corners relax to the card radius because the
               row is now tall enough that a stadium would bow absurdly.
               Rows are separated by a gap, not butted into a single list. */
            className={`overflow-hidden transition-all ${
              isOpen
                ? 'rounded-pa-card bg-pa-white shadow-[0_4px_20px_rgba(2,77,120,0.10)]'
                : 'rounded-full'
            }`}
            style={isOpen ? undefined : { background: 'var(--color-pa-grey-01)' }}
          >
            <button
              type="button"
              data-testid={item.testId ? `${item.testId}-toggle` : undefined}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className={`flex w-full items-center gap-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-04 ${
                isOpen ? 'px-7 pb-3 pt-6' : 'py-4 pl-7 pr-4'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2.5 font-pa-body text-base font-semibold text-pa-grey-04">
                  {item.label}
                </span>
                {item.meta && (
                  <span className="mt-1 block font-pa-body text-xs text-pa-grey-03">{item.meta}</span>
                )}
              </span>
              <span
                aria-hidden="true"
                /* White circle on the tinted collapsed row, tinted circle on
                   the white expanded row — the reference inverts it so the
                   control always reads against its own surface. */
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-pa-body text-lg leading-none text-pa-grey-04 transition-colors"
                style={{
                  background: isOpen ? 'var(--color-pa-grey-01)' : 'var(--color-pa-white)',
                }}
              >
                {isOpen ? '×' : '+'}
              </span>
            </button>

            {/* No divider rule: the reference's expanded panel is continuous
                with its header inside one white surface. */}
            <div id={panelId} hidden={!isOpen} className="px-7 pb-7">
              {item.content}
            </div>
          </div>
        )
      })}
    </div>
  )
}
