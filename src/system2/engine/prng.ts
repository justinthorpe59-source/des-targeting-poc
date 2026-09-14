/**
 * Deterministic PRNG, independent of System 1's copy (src/system1/data/
 * prng.ts) even though the algorithm is the same well-known one
 * (mulberry32). System 2's code imports nothing at runtime from system1/
 * anywhere — the only thing shared across the boundary is the Snapshot
 * type contract, which is erased at compile time. Duplicating this tiny,
 * pure utility keeps that story unambiguous rather than saving a few
 * lines at the cost of a real import edge between the two systems.
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

/** Deterministic numeric seed from a string id — same id always yields the same seed, regardless of import order or what else is in the snapshot. */
export function seedFromId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}
