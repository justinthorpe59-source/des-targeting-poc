import type { Person } from '../data/types'
import { SEED_PEOPLE } from '../data/people'

/**
 * The one place a person is pictured, for every screen in System 1.
 *
 * M5, 28 Sept 2026. Before this, each screen drew its own circle of initials
 * at its own size, so "a person" looked like three different things
 * depending where you were.
 *
 * Treatment, fixed here rather than per screen:
 *   - always a circle, always a 1:1 crop
 *   - `object-cover` with `object-top`, so a portrait is cropped to the face
 *     rather than squashed. These are full-body and half-body shots; a plain
 *     centre crop put several chins at the bottom edge of the circle.
 *   - a Grey 01 ring, so a light photo still reads as a distinct object
 *     against a white card
 *   - initials on Grey 01 as the fallback, identical in size and shape
 *
 * WHY NOT EVERYONE HAS A PHOTO
 * There are 32 photographs and 60 people. Cycling them would give the roster
 * two "different" colleagues with the same face, side by side, which is worse
 * than an honest gap — it is the kind of thing a manager notices immediately
 * and stops trusting the screen for. So 32 people get a photograph and 28
 * keep initials, which is also what a real system looks like when not
 * everyone has uploaded one.
 *
 * Who gets one is deterministic and spread: a stable hash per id, ranked,
 * lowest 32 take the photos. Seeded off the id rather than list position, so
 * the same person keeps the same face on every screen and across reloads,
 * and the photographed people are scattered across teams rather than
 * clustered at the top of the list.
 */

/* Root-absolute glob: the folder lives at the repo root, not under src/ or
   public/, and Vite resolves this from the project root and fingerprints
   each file into the build. Verified: all 32 are emitted. */
const PHOTO_URLS: string[] = Object.values(
  import.meta.glob('/photos/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
).sort()

/** Stable string hash — same id, same number, every run. */
function hashId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Built once: person id → photo url, for the 32 lowest-hashing ids.
 * Everyone else is absent from the map and falls back to initials.
 */
const photoByPersonId = new Map<string, string>()

function assignPhotos(people: Person[]): void {
  photoByPersonId.clear()
  const ranked = people.map((p) => ({ id: p.id, h: hashId(p.id) })).sort((a, b) => a.h - b.h)
  ranked.slice(0, PHOTO_URLS.length).forEach((entry, i) => photoByPersonId.set(entry.id, PHOTO_URLS[i]))
}

/* Assigned at module load against the seed population, so no screen has to
   remember to call it and every screen agrees on who has which face. */
assignPhotos(SEED_PEOPLE)

function photoFor(personId: string): string | undefined {
  return photoByPersonId.get(personId)
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Render sizes in use: 44px on the roster card, 56px on Individual Detail. */
export function PersonAvatar({
  person,
  size = 44,
  className = '',
}: {
  person: Person
  size?: number
  className?: string
}) {
  const src = photoFor(person.id)
  const box = { width: size, height: size }

  if (!src) {
    return (
      <span
        aria-hidden="true"
        data-testid="person-avatar"
        data-has-photo="false"
        style={{ ...box, fontSize: Math.round(size * 0.3) }}
        className={`flex shrink-0 items-center justify-center rounded-full bg-pa-grey-01 font-pa-mono font-bold text-pa-grey-04 ring-1 ring-pa-grey-01 ${className}`}
      >
        {initials(person.name)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      data-testid="person-avatar"
      data-has-photo="true"
      width={size}
      height={size}
      loading="lazy"
      style={box}
      className={`shrink-0 rounded-full object-cover object-top ring-1 ring-pa-grey-01 ${className}`}
    />
  )
}

/**
 * The large square portrait in Individual Detail's hero. Same source and
 * same assignment as the circular avatar, so a person's face is consistent
 * between the roster and their own page; only the shape and crop budget
 * differ. Falls back to the original placeholder glyph for the 28 people
 * without a photograph, so the hero never becomes an empty hole.
 */
export function PersonHeroImage({ person, className = '' }: { person: Person; className?: string }) {
  const src = photoFor(person.id)

  if (!src) {
    return (
      <div
        data-testid="detail-hero-visual"
        data-has-photo="false"
        aria-hidden="true"
        className={`flex aspect-square w-full items-center justify-center rounded-pa-card ${className}`}
        style={{ background: 'var(--color-pa-grey-01)' }}
      >
        <svg viewBox="0 0 24 24" className="h-2/5 w-2/5" fill="none" stroke="var(--color-pa-grey-02)" strokeWidth="1.4">
          <circle cx="12" cy="9" r="3.6" />
          <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" strokeLinecap="round" />
        </svg>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      data-testid="detail-hero-visual"
      data-has-photo="true"
      loading="lazy"
      className={`aspect-square w-full rounded-pa-card object-cover object-top ${className}`}
    />
  )
}
