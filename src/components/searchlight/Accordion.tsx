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
    <div data-testid={testId} className="flex flex-col gap-2">
      {items.map((item) => {
        const isOpen = openId === item.id
        const panelId = `${baseId}-${item.id}-panel`
        return (
          <div
            key={item.id}
            data-testid={item.testId}
            data-open={isOpen ? 'true' : 'false'}
            {...(item.dataAttrs ?? {})}
            className={`overflow-hidden rounded-pa-card border transition-colors ${
              isOpen
                ? 'border-pa-grey-01 bg-pa-white shadow-[0_2px_12px_rgba(2,77,120,0.07)]'
                : 'border-transparent bg-pa-grey-wash'
            }`}
          >
            <button
              type="button"
              data-testid={item.testId ? `${item.testId}-toggle` : undefined}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-04"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-pa-body text-sm font-medium text-pa-grey-04">
                  {item.label}
                </span>
                {item.meta && (
                  <span className="mt-0.5 block font-pa-body text-xs text-pa-grey-03">{item.meta}</span>
                )}
              </span>
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-pa-body text-sm leading-none transition-colors ${
                  isOpen ? 'bg-pa-aqua-05 text-pa-white' : 'bg-pa-white text-pa-grey-04'
                }`}
              >
                {isOpen ? '×' : '+'}
              </span>
            </button>

            <div id={panelId} hidden={!isOpen} className="border-t border-pa-grey-01 px-4 py-3">
              {item.content}
            </div>
          </div>
        )
      })}
    </div>
  )
}
