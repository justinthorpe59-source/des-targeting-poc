import { GRADE_CODES, LOCATIONS, type Person } from './types'

/**
 * Structural check mirroring CLAUDE.md's "missing data" exception fields:
 * capacity, economic factor, role, location, baseline — plus the identity
 * fields every record needs regardless. Used by the generator script (fails
 * the build if the generator ever produces a bad record) and reusable later
 * by the M9 exceptions queue for the same rule.
 */
export interface ValidationIssue {
  id: string
  field: string
  problem: string
}

const REQUIRED_STRING_FIELDS: (keyof Person)[] = ['id', 'name', 'division', 'team', 'roleTitle']

export function validatePeople(people: Person[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seenIds = new Set<string>()

  for (const person of people) {
    const idLabel = person.id || '(missing id)'

    for (const field of REQUIRED_STRING_FIELDS) {
      const value = person[field]
      if (value === null || value === undefined || value === '') {
        issues.push({ id: idLabel, field, problem: 'empty' })
      }
    }

    if (person.id) {
      if (seenIds.has(person.id)) {
        issues.push({ id: idLabel, field: 'id', problem: 'duplicate' })
      }
      seenIds.add(person.id)
    }

    if (!LOCATIONS.includes(person.location)) {
      issues.push({ id: idLabel, field: 'location', problem: `invalid value ${String(person.location)}` })
    }

    if (!GRADE_CODES.includes(person.gradeCode)) {
      issues.push({ id: idLabel, field: 'gradeCode', problem: `invalid value ${String(person.gradeCode)}` })
    }

    if (person.roleFactor === null || person.roleFactor === undefined || Number.isNaN(person.roleFactor)) {
      issues.push({ id: idLabel, field: 'roleFactor', problem: 'empty' })
    }

    if (person.capacity === null || person.capacity === undefined || Number.isNaN(person.capacity)) {
      issues.push({ id: idLabel, field: 'capacity', problem: 'empty' })
    } else if (person.capacity < 0.6 || person.capacity > 1.0) {
      issues.push({ id: idLabel, field: 'capacity', problem: `out of locked generation range: ${person.capacity}` })
    }

    if (person.economicFactor === null || person.economicFactor === undefined || Number.isNaN(person.economicFactor)) {
      issues.push({ id: idLabel, field: 'economicFactor', problem: 'empty' })
    } else if (person.economicFactor < 0.9 || person.economicFactor > 1.15) {
      issues.push({
        id: idLabel,
        field: 'economicFactor',
        problem: `out of locked generation range: ${person.economicFactor}`,
      })
    }

    if (person.baseline === null || person.baseline === undefined || Number.isNaN(person.baseline)) {
      issues.push({ id: idLabel, field: 'baseline', problem: 'empty' })
    }
  }

  return issues
}
