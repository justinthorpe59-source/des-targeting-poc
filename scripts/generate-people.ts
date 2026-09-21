/**
 * Regenerates src/system1/data/people.seed.json from the deterministic
 * generator. Run with: npm run generate:data
 *
 * Same seed -> byte-identical output, every run. This script also validates
 * the result before writing, so a bad generator change fails loudly instead
 * of silently committing broken data.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { DATA_SEED, generatePeople } from '../src/system1/data/generatePeople'
import { validatePeople } from '../src/system1/data/validatePeople'
import { GRADES } from '../src/system1/data/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.join(__dirname, '../src/system1/data/people.seed.json')

const people = generatePeople(DATA_SEED)

const issues = validatePeople(people)
if (issues.length > 0) {
  console.error(`Validation failed: ${issues.length} issue(s)`)
  for (const issue of issues) {
    console.error(`  ${issue.id} · ${issue.field}: ${issue.problem}`)
  }
  process.exit(1)
}

writeFileSync(OUT_PATH, `${JSON.stringify(people, null, 2)}\n`, 'utf-8')

const byDivision = Object.fromEntries(
  Array.from(new Set(people.map((p) => p.division))).map((d) => [
    d,
    people.filter((p) => p.division === d).length,
  ]),
)
const byGrade = Object.fromEntries(
  GRADES.map((g) => [g, people.filter((p) => p.grade === g).length]).filter(([, count]) => count > 0),
)

console.log(`Wrote ${people.length} records to ${path.relative(process.cwd(), OUT_PATH)}`)
console.log(`  seed: ${DATA_SEED}`)
console.log(`  by division: ${JSON.stringify(byDivision)}`)
console.log(`  by grade: ${JSON.stringify(byGrade)}`)
console.log(`  validation: OK, 0 issues`)
