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
 * REUSING 32 PHOTOGRAPHS ACROSS 60 PEOPLE
 * Confirmed 28 Sept 2026: imagery may be reused, so everyone gets a face and
 * the initials fallback becomes an edge case rather than the state of 28
 * records.
 *
 * Duplicates are therefore unavoidable, but *where* they land is not. People
 * are ordered by division then team then id, and assigned photo[i % 32]. Any
 * run of consecutive indices shorter than 32 is distinct, and no team has
 * more than 32 members — so **no two people in the same team ever share a
 * face**, which is the only place a manager would see two of them side by
 * side. Repeats fall across different teams, where they are effectively
 * invisible.
 *
 * Deterministic: the ordering is a stable sort over fixed data, so a person
 * keeps the same face on every screen and across reloads.
 *
 * The initials fallback stays for anyone the map somehow misses — it is now
 * unreachable with the seed population, and is kept as a guard rather than
 * as a design state.
 */

/* Root-absolute glob: the folder lives at the repo root, not under src/ or
   public/, and Vite resolves this from the project root and fingerprints
   each file into the build. Verified: all 32 are emitted. */
const PHOTO_URLS: string[] = Object.values(
  import.meta.glob('/photos/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
).sort()

/** Built once: every person id → a photo url. */
const photoByPersonId = new Map<string, string>()

function assignPhotos(people: Person[]): void {
  photoByPersonId.clear()
  const ordered = [...people].sort((a, b) =>
    a.division.localeCompare(b.division) || a.team.localeCompare(b.team) || a.id.localeCompare(b.id),
  )
  ordered.forEach((person, i) => photoByPersonId.set(person.id, PHOTO_URLS[i % PHOTO_URLS.length]))
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
