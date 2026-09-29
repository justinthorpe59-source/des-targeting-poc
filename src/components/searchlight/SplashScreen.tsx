import { useEffect, useRef, useState } from 'react'
import TechText from '../../vendor/react-bits/TechText'

/**
 * The splash shown when Searchlight is first opened in a browsing session.
 *
 * The wordmark is React Bits' `TechText`, vendored (see
 * `src/vendor/react-bits/README.md`). It draws to a canvas, self-centres in
 * its container and auto-fits — capping itself at 90% of the container's
 * width and 66% of its height — so the box below is sized to let the
 * configured 150px through at desktop widths and to shrink gracefully rather
 * than clip on narrow ones.
 *
 * Solid black is deliberate and local to this screen. It is the one surface
 * in the app that is not white; the design direction's white-dominant rule
 * describes the application itself, and a splash is the threshold to it, not
 * part of it. Nothing here leaks into the app's palette.
 *
 * MOTION
 * Both directions run off the motion-pass tokens — `--dur-pa-medium` in,
 * `--dur-pa-slow` out, `--ease-pa-out` for each — and touch only opacity and
 * transform.
 *
 * They are driven by one mechanism (a phase, transitioned inline) rather than
 * the usual `animate-pa-fade` class, and that is not a stylistic choice. The
 * shared keyframe animations are declared `both`, so a finished one keeps
 * applying its final `opacity: 1` keyframe, and a finished animation still
 * outranks an inline style — with the class on, the exit's opacity never
 * moved. Dropping the class on the way out does not rescue it either: when
 * the animation disappears in the same frame the inline value changes, the
 * browser never starts the opacity transition at all (measured: the element
 * reported a `transform` CSSTransition and no opacity one). Owning both ends
 * of the fade here avoids the conflict entirely.
 */

/** Matches --dur-pa-slow. The exit holds for this long before the app mounts. */
const EXIT_MS = 360

type Phase = 'entering' | 'shown' | 'leaving'

export function SplashScreen({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase] = useState<Phase>('entering')
  const leaving = phase === 'leaving'

  /* onEnter fires from a timeout. Holding the latest one in a ref — assigned
     in an effect, never during render — means a re-render of the parent
     cannot restart an exit that is already running. */
  const onEnterRef = useRef(onEnter)
  useEffect(() => {
    onEnterRef.current = onEnter
  })

  /* Flip to the settled phase on the frame after mount so the entrance has a
     value to transition from. */
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPhase((p) => (p === 'entering' ? 'shown' : p)))
    return () => cancelAnimationFrame(frame)
  }, [])

  /* Enter/Space anywhere on the splash, not only while the button holds
     focus — the button is the visible affordance, this is the shortcut. The
     button's own Enter/Space still fires natively; the phase guard makes the
     second call a no-op. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      setPhase('leaving')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!leaving) return
    /* Someone who has asked for less movement gets the same path with no
       wait — the same approach AnimatedFigure takes, rather than a separate
       branch. */
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => onEnterRef.current(), reduced ? 0 : EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [leaving])

  return (
    <div
      data-testid="splash"
      data-phase={phase}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black px-8"
      style={{
        opacity: phase === 'shown' ? 1 : 0,
        transform: leaving ? 'translateY(-12px)' : 'none',
        transition: leaving
          ? 'opacity var(--dur-pa-slow) var(--ease-pa-out), transform var(--dur-pa-slow) var(--ease-pa-out)'
          : 'opacity var(--dur-pa-medium) var(--ease-pa-out)',
      }}
    >
      {/* PA mark, top left. Served from public/ alongside the favicon rather
          than imported, so it is referenced by a stable path. The PNG carries
          its own alpha, so the red circle and grey dots sit straight on the
          black with no plate behind them.

          Sized in rem like everything else: at this project's 18px root, h-32
          is 144px tall and the 444x400 source gives ~160px wide. The inset is
          deliberately larger than the page's own px-8 gutter — at this size
          the mark needs room to sit in rather than being tucked against the
          corner. Absolute so it cannot disturb the centring of the wordmark
          beneath it, and inside the splash element so it fades with it. */}
      <img
        src="/pa-logo.png"
        alt="PA"
        data-testid="splash-logo"
        className="absolute left-16 top-16 h-32 w-auto"
      />

      {/* One column so the button can be positioned against the wordmark's
          own measure rather than against the viewport. */}
      <div className="w-full max-w-[860px]">
        {/* 280px tall. The component fits itself to 66% of this box, and the
            word's ink measures ~148px at the configured 150px, so 280 clears
            it (185px available) while leaving room above for the measurement
            label the sweep draws. Taller boxes only add dead space between
            the wordmark and the button. */}
        <div className="h-[280px] w-full">
          <TechText
            text="Searchlight"
            fontWeight={600}
            fontSize={150}
            reveal="letter"
            dashLength={4}
            dashGap={2}
            specks={15}
            color="#f8f3f3"
          />
        </div>

        {/* Left-of-centre under the wordmark rather than centred on it. The
            wordmark is centred in the 860px column, so an 8% inset sets the
            button against its opening letters. */}
        <div className="flex justify-start pl-[8%]">
          <button
            type="button"
            onClick={() => setPhase('leaving')}
            className="rounded-pa-chip bg-[var(--color-pa-accent)] px-6 py-3 font-pa-body text-base font-semibold text-[var(--color-pa-accent-ink)] transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Enter Searchlight
          </button>
        </div>
      </div>
    </div>
  )
}
