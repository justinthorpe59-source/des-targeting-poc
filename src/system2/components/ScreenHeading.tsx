import type { ReactNode } from 'react'

/**
 * Shared System 2 screen heading (Searchlight design pass) — Bricolage
 * Grotesque display title in Grey 04, Manrope body subtitle in Grey 03.
 * Executive Summary keeps its own larger hero title; these secondary screens
 * share this one for consistency.
 */
export function ScreenHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <h1 className="font-pa-display text-3xl font-semibold leading-tight text-pa-grey-04">{title}</h1>
      {children && <p className="mt-1 max-w-2xl font-pa-body text-sm text-pa-grey-03">{children}</p>}
    </div>
  )
}
