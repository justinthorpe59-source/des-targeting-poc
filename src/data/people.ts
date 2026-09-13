import peopleSeed from './people.seed.json'
import type { Person } from './types'

/**
 * The app's only source of population data. No runtime generation, no
 * Math.random() — this is the committed output of `npm run generate:data`.
 * "Reset to seed data" re-imports this same array back into the store.
 */
export const SEED_PEOPLE: Person[] = peopleSeed as Person[]
