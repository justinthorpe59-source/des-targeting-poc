import { useEffect, useRef, useState } from 'react'

/**
 * A figure that counts to its new value instead of snapping.
 *
 * Used for headline numbers that change in response to something the user
 * did — an override landing, a scenario preset switching, a division's
 * forecast recomputing. The movement is the feedback: it says *this* number
 * is what your action changed.
 *
 * WHERE THIS MUST NOT BE USED
 * CLAUDE.md's M14 note is explicit that a live-updating preview must never
 * animate: Mass Adjustment's before/after rows recompute on every keystroke,
 * and M10's acceptance signal reads them mid-flight to prove the preview
 * matches what gets applied. An animated value would make that read return a
 * frame rather than the answer. Those rows stay static, deliberately.
 *
 * For everything else, the settled value is also written to `data-value` on
 * every frame, so a check can read the truth without waiting for the tween.
 *
 * Honours prefers-reduced-motion by rendering the value immediately.
 */
export function AnimatedFigure({
  value,
  format,
  className = '',
  testId,
}: {
  value: number
  /** Turns the tweened number into the string shown. Receives intermediate values. */
  format: (n: number) => string
  className?: string
  testId?: string
}) {
  const [shown, setShown] = useState(value)
  const fromRef = useRef(value)
  const frameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return

    /* Reduced motion is the same path with a zero duration rather than a
       separate branch — one code path, and no synchronous setState inside
       the effect. */
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduced ? 0 : 220 // --dur-pa-medium
    const start = performance.now()
    /* Matches --ease-pa-out: decelerating, so the number slows as it lands
       rather than stopping dead. */
    const ease = (t: number) => 1 - Math.pow(1 - t, 3)

    const step = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration)
      setShown(from + (to - from) * ease(t))
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = to
        setShown(to)
      }
    }
    frameRef.current = requestAnimationFrame(step)

    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
      fromRef.current = to
    }
  }, [value])

  return (
    <span data-testid={testId} data-value={value} className={className}>
      {format(shown)}
    </span>
  )
}
