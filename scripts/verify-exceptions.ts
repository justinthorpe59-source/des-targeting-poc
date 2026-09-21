/**
 * M9 acceptance-signal evidence: detectExceptions() must flag exactly the
 * records that violate the locked thresholds — verified against a
 * hand-built test case with a known answer, not the incidental output of
 * the real 50-person dataset. Run with: npm run verify:exceptions
 *
 * Each synthetic team below isolates one signal at a time (a single-member
 * team can never trigger a team-average deviation against itself, so its
 * capacity/missing-data/large-adjustment flag is never contaminated by
 * deviation noise, and vice versa).
 */
import { detectExceptions } from '../src/system1/engine/exceptions'
import type { Person } from '../src/system1/data/types'
import type { TargetRecord } from '../src/store/system1Store'

function person(overrides: Partial<Person> & { id: string }): Person {
  return {
    id: overrides.id,
    name: overrides.id,
    division: 'Design',
    team: 'DefaultTeam',
    location: 'Boston',
    grade: 'Consultant',
    roleFactor: 1.0,
    capacity: 0.8,
    economicFactor: 1.0,
    baseline: 100,
    dayRate: 800,
    utilisationTarget: 0.85,
    salesTarget: null,
    ...overrides,
  }
}

function target(personId: string, modelled: number, override?: TargetRecord['override']): TargetRecord {
  return { personId, status: override ? 'Adjusted' : 'Modelled', modelled, rangeLow: 0, rangeHigh: 0, notes: '', override }
}

// Team Alpha: 5 clean members (modelled=100) + 1 outlier (modelled=250).
// Average = (5*100+250)/6 = 125. Clean members: |100-125|/125=20% (<25%,
// not flagged). Outlier: |250-125|/125=100% (>25%, flagged).
const alphaPeople = ['A1', 'A2', 'A3', 'A4', 'A5'].map((id) => person({ id, team: 'Alpha' }))
alphaPeople.push(person({ id: 'A6', team: 'Alpha' }))
const alphaTargets = ['A1', 'A2', 'A3', 'A4', 'A5'].map((id) => target(id, 100))
alphaTargets.push(target('A6', 250))

// Team Beta: capacity below the locked 0.5-1.0 range.
const betaPeople = [person({ id: 'B1', team: 'Beta', capacity: 0.3 })]
const betaTargets = [target('B1', 100)]

// Team Gamma: capacity above the locked range.
const gammaPeople = [person({ id: 'G1', team: 'Gamma', capacity: 1.2 })]
const gammaTargets = [target('G1', 100)]

// Team Delta: two different missing-field scenarios, same team (both have
// a valid modelled=90, so neither pollutes the other's team average).
const deltaPeople = [
  person({ id: 'D1', team: 'Delta', capacity: undefined as unknown as number }),
  person({ id: 'D2', team: 'Delta', location: undefined as unknown as Person['location'] }),
]
const deltaTargets = [target('D1', 90), target('D2', 90)]

// Team Epsilon: E1's override is +30% (exceeds +/-20% -> large-adjustment).
// E2's override is +15% (within the band -> clean). Team average of final
// targets = (130+115)/2 = 122.5; both are within 25% of it, so neither
// picks up an extreme-value flag either - E2 should end up with zero flags
// despite having an override at all.
const epsilonPeople = [person({ id: 'E1', team: 'Epsilon' }), person({ id: 'E2', team: 'Epsilon' })]
const epsilonTargets = [
  target('E1', 100, { type: 'direct', value: 130, finalValue: 130, reason: 'test' }),
  target('E2', 100, { type: 'direct', value: 115, finalValue: 115, reason: 'test' }),
]

const people: Person[] = [...alphaPeople, ...betaPeople, ...gammaPeople, ...deltaPeople, ...epsilonPeople]
const targetsById: Record<string, TargetRecord> = {}
for (const t of [...alphaTargets, ...betaTargets, ...gammaTargets, ...deltaTargets, ...epsilonTargets]) {
  targetsById[t.personId] = t
}

const expected: Record<string, string[]> = {
  A1: [],
  A2: [],
  A3: [],
  A4: [],
  A5: [],
  A6: ['extreme-value'],
  B1: ['extreme-value'],
  G1: ['extreme-value'],
  D1: ['missing-data'],
  D2: ['missing-data'],
  E1: ['large-adjustment'],
  E2: [],
}

const result = detectExceptions({ people, targets: targetsById })

let failures = 0
for (const [id, expectedTypes] of Object.entries(expected)) {
  const actualFlags = result.get(id) ?? []
  const actualTypes = actualFlags.map((f) => f.type).sort()
  const expectedSorted = [...expectedTypes].sort()
  const match = JSON.stringify(actualTypes) === JSON.stringify(expectedSorted)
  console.log(`${id}: expected [${expectedSorted.join(', ')}] actual [${actualTypes.join(', ')}] ${match ? 'OK' : 'MISMATCH'}`)
  if (!match) failures++
}

// Also check nothing outside the expected set got flagged.
for (const id of result.keys()) {
  if (!(id in expected)) {
    console.log(`${id}: UNEXPECTED - flagged but not in the expected set at all`)
    failures++
  }
}

console.log()
console.log(`Total flagged (expected 6 of 12): ${result.size}`)

if (failures > 0) {
  console.error(`${failures} mismatch(es).`)
  process.exit(1)
}
console.log('All 12 records matched their expected exception set exactly.')
