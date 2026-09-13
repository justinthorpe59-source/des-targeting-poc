/**
 * Deterministic PRNG (mulberry32) and small helpers built on it. Used only by
 * the offline generator script — the running app never calls Math.random()
 * for population data, it just reads the committed seed JSON.
 */

export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let t = seed >>> 0
  return function next() {
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform float in [min, max). */
export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

/** Uniform integer index into an array-like of given length. */
export function randIndex(rng: Rng, length: number): number {
  return Math.floor(rng() * length)
}

/** Weighted choice. `weights` must sum to 1 (not enforced, caller's responsibility). */
export function weightedChoice<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  const r = rng()
  let cumulative = 0
  for (let i = 0; i < items.length; i++) {
    cumulative += weights[i]
    if (r < cumulative) return items[i]
  }
  return items[items.length - 1]
}
