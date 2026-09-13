# System 1 — Individual Targeting Console
### Project memory & working agreement for Claude Code

---

## Context

PA (global consultancy) POC — two-system concept:
- **System 1: Individual Targeting** (this project)
- **System 2: Organisational Operating** (separate, later)

Scope: Design, Engineering & Science (DES) division — Boston, Ireland, London, GITC.
Population: ~50 synthetic people.

---

## What System 1 is

System 1 is a tool that helps a line manager and target owner set a target for each person that's realistic, fair, and genuinely personal — not just the output of a formula. The agreed factors (role, capacity, location, discipline) give a defensible baseline, but the manager's own knowledge of that person — their strengths, weaknesses, interests, and goals — is what turns that baseline into something the person will actually recognise as theirs and that reflects where they can add real value, rather than a generic number applied top-down. Because PA is a large, varied consultancy with genuinely different businesses, teams and people sitting inside it, there's no single sensible way to say "here's how everyone should spend their time" — so the system has to let managers bring that personal judgement in, while still keeping the output explainable and consistent enough to trust at scale. It should also be able to take direction back from the organisational view (System 2 — fast-follow, not in this POC) and translate that into suggested individual target changes a manager can accept, adjust or reject. Every recommendation stays traceable to a reason, whether it came from the model, the manager's personal knowledge, or (eventually) a suggestion from the organisational level.

**The model's output is a starting point, never a decision. The manager always has final say.**

---

## Locked model logic

- **Target factors:** role/grade, capacity, location, discipline (only these — historic performance, personal circumstances, and project allocation are explicitly excluded and require separate policy approval before ever being added)
- **Formula:** modelled target = cohort baseline × capacity factor × role factor × economic factor
- Expressed as a **range**, not a false-precision point (e.g. ±15%)
- **Personal context:** freeform manager notes (strengths, interests, goals) — inform the explanation and override reasoning, not the formula itself. Model factors stay clean and governable; personal judgement lives in the override layer.
- **Manager override:** always allowed, either as a **%** adjustment or a **direct value** — both, manager's choice. Model never blocks. Model may flag an outlier for the manager's own sense-check only — it cannot force or veto a change.
- **Mass adjustment:** percentage only, applied to a filtered population, with a live before/after preview and aggregate impact shown before applying.
- **Reason required** on every override, individual or mass — no exceptions.
- **Employee view shows everything**, including the manager's raw personal notes. Write notes knowing the employee will read them — this is a transparency-by-design decision, not a technical afterthought.

## Target states

`Modelled → Adjusted → Proposed → Approved`

Only **Approved** records are included in the snapshot export to System 2.

## Exceptions queue — validation thresholds

- **Missing data** → any required field empty (capacity, economic factor, role, location, baseline)
- **Extreme value** → capacity outside 0.5–1.0, or final target more than ~25% from the team average
- **Large adjustment** → manual change over ±20% → flagged for review, never blocked

## Fast-follow (explicitly NOT in this POC)

- System 2 → System 1 feedback loop (org-level risk/capacity signals suggesting individual target changes back to managers)

## Locked dataset defaults

These are fixed numbers, not examples — build to them exactly so both systems produce consistent, explainable results.

- **Population:** 50 synthetic records, seeded/reproducible (re-running the generator must produce identical output)
- **Divisions & baseline (£k):** Design 92, Engineering 100, Science 96
- **Teams:** 2 per division (e.g. Studio North/South, Platform/Delivery, Research/Applied)
- **Locations:** Boston, Ireland, London, GITC
- **Grade → role factor:** Grade 2 Analyst 0.85, Grade 3 Engineer 1.0, Grade 4 Senior Engineer 1.15, Grade 5 Lead 1.3, Grade 6 Principal 1.5
- **Capacity:** random 0.6–1.0 per record
- **Economic factor:** random 0.9–1.15 per record
- **Target range band:** modelled ± 15% (this is the locked figure — the earlier "e.g." elsewhere in this doc refers to this same number)

---

## Screens (11) — free navigation (sidebar/tabs), shared state underneath

All screens read/write the same single data store. An override on Individual Detail must be reflected immediately in Overview totals, the Population list, and the Exceptions queue — these are not disconnected mockups.

1. **Overview / home** — population summary (counts, % modelled vs adjusted, aggregate totals, open exceptions)
2. **Population view** — filterable list (division, team, location)
3. **Individual detail** — factor breakdown, plain-language explanation, personal context, change history for this person
4. **Manager override** — % or direct value, reason required, revert option
5. **Cohort comparison** — person vs team avg vs division avg
6. **What-if sandbox** — non-committing recalculation as inputs are tweaked
7. **Exceptions queue** — flagged records (missing data / extreme value / large adjustment)
8. **Mass adjustment** — filtered population, % change, live preview, aggregate impact
9. **Employee view** — read-only, own target + explanation + notes, anonymised cohort averages only (no peer-level data)
10. **Audit / change log** — full history across all records: who, what, when, why
11. **Snapshot export** — Approved records only, one-way hand-off to System 2 (schema TBD at M13)

Approve action (Proposed → Approved) is folded into Individual Detail (single record) and Population view (bulk), not a separate screen.

---

## Milestone / PR plan

Each milestone = its own branch + its own PR, reviewed before merging to main.

Each entry below includes its **acceptance signal** — the concrete way to know it's actually done, not just built.

- **M0** — Project setup, shared state, navigation shell, tooling (see below). *Done when:* navigating between two placeholder screens updates a shared value in real time, localStorage persistence + a "Reset to seed data" action both work, playwright-mcp is registered and can inspect the running app, graphify is installed and can answer a query about the codebase, and the personal `frontend-components` skill (set up once, outside this repo) is confirmed active in this project.
- **M1** — Data model + synthetic dataset (50 people, seeded/reproducible). *Done when:* regenerating the dataset twice produces byte-identical output.
- **M2** — Baseline targeting engine. *Done when:* recalculating the same record twice gives the same modelled target and range.
- **M3** — Overview/home. *Done when:* every number shown matches an independent sum/count over the actual record set, and updates live if the data changes.
- **M4** — Population view. *Done when:* every combination of division/team/location filter returns exactly the matching records, no more, no fewer.
- **M5** — Individual detail (explanation). *Done when:* the explanation text cites the selected record's actual factor values, not placeholder text.
- **M6** — Cohort comparison. *Done when:* the team/division average shown matches an independent manual calculation for at least one test record.
- **M7** — What-if sandbox. *Done when:* changing inputs recalculates live without altering the underlying stored record until explicitly applied.
- **M8** — Manager override (personal notes, reason, final say). *Done when:* an override updates state to Adjusted, preserves the original modelled value, and appears correctly in both Individual Detail and Population view.
- **M9** — Exceptions queue. *Done when:* it flags exactly the records that violate the locked thresholds — verified against a hand-built test case with a known answer.
- **M10** — Mass adjustment. *Done when:* the preview shown before applying matches exactly what's applied after confirming, for a test population.
- **M11** — Approve workflow (Proposed → Approved). *Done when:* approving moves a record's state correctly, and only Approved records appear in a snapshot preview.
- **M12** — Employee view. *Done when:* it shows the same explanation and notes as Individual Detail, with zero peer-level or named-colleague data visible.
- **M13** — Snapshot export. *Done when:* the exported file contains only Approved records and matches the locked schema.
- **M14** — Demo polish (react-bits). *Done when:* a full run-through of the core journey (Overview → Population → Individual → Override → Mass adjust → Approve → Export) completes with no visual or functional errors.

---

# System 2 — Organisational Operating

## Context

Scoped to **DES only** (Design, Engineering & Science — Boston, Ireland, London, GITC) for this POC — not the whole of PA. All logic below applies within that one part of the business.

## What System 2 is

System 2 is the tool that tells leadership whether the organisation is actually going to hit its goal — not just whether enough individual targets have been allocated on paper to theoretically cover it. Its job is to separate ambition (coverage) from reality (forecast), because a target list that adds up doesn't mean delivery is likely: a leader needs to know if headroom is thin, confidence is low, or the whole thing depends on a handful of people or teams. It should let a leader test a change (more capacity here, a different goal there) and see the effect before committing to anything, and it must be willing to say a goal is simply infeasible under current constraints rather than quietly stretching individual targets until the numbers appear to work. It doesn't diagnose individual underperformance or make employment-related judgments — its unit of decision is the plan, its assumptions, and the aggregate delivery risk, not any one person.

## Locked users & jobs

- **Sponsor/leadership** — "Tell me clearly whether DES is going to hit its goal, and where the real risk sits, without me reconstructing it myself."
- **Division/team leader** — "Show me if my part of the business is on track, and what I could realistically change if it's not."
- **Scenario analyst** — "Let me test interventions quickly and package the clearest one up for leadership, without being the final decision-maker."

## Locked model logic

- **Expected achievement** = Target × (capacity utilisation × team historical trend)
- **Confidence** = simulated High/Medium/Low, labelled illustrative only — not derived from real data, must be visibly flagged as such in the UI
- **Concentration risk** = an organisational-level flag only. It must never feed back into individual targets in System 1 for this POC — the response to concentration is a resourcing/planning decision, not a target increase on high performers.
- Team drill-down does **not** apportion the org goal down to team level — each team compares its own allocated target to its own expected achievement, ranked by absolute contribution to the gap.

## Locked dataset defaults (System 2 additions)

- **Capacity utilisation:** random 0.75–1.05 per record (feeds expected achievement)
- **Team historical trend:** random 0.85–1.05 per record (feeds expected achievement)
- **Organisational goal default:** sum of modelled targets across the imported snapshot (so coverage starts near 100% by construction), adjustable via the Scenario Workspace's "change goal" lever

## Risk status thresholds

- **On track** → forecast ratio ≥100% and confidence not Low
- **At risk** → forecast ratio 90–100%, OR confidence Low, OR concentration flagged
- **Off track** → forecast ratio <90%
- **Infeasible** → goal can't be met even at maximum feasible capacity

## Exception thresholds

- **Missing forecast data** → a team/division missing expected achievement or confidence
- **Infeasible** → expected achievement can't reach the goal even at maximum assumed capacity
- **Low confidence, high reliance** → Low confidence but responsible for >30% of expected achievement
- **Large unexplained gap** → forecast >20% below goal with no scenario tested against it yet

## Scenario Workspace — locked levers (POC scope)

- Change the organisational goal
- Change capacity for a team/division
- Apply a population-wide target adjustment (reuses System 1's mass-adjust mechanism)
- Change expected achievement/confidence for a selected group
- *(Out of scope for POC: pricing changes, moving capacity between teams)*

## Fast-follow (explicitly NOT in this POC)

- System 2 → System 1 feedback loop (org-level risk/capacity suggesting individual target changes back to managers)

## Screens (6) — free navigation, shared state within System 2

1. **Executive summary** — goal, coverage, forecast, gap, confidence, top risk drivers
2. **Division comparison** — coverage/forecast/confidence/status side by side across divisions
3. **Team drill-down** — teams ranked by contribution to the gap
4. **Scenario workspace** — the four locked levers, baseline vs scenario comparison
5. **Scenario library** — save named scenarios, compare multiple side by side
6. **Exceptions/risk flags** — flagged divisions/teams per the thresholds above

## Milestone / PR plan

Graphify and playwright-mcp are already set up from System 1 — no need to redo M0-level tooling.

Each entry below includes its **acceptance signal**.

- **S2-M0** — System 2 module setup, navigation shell, shared conventions. *Done when:* switching between System 1 and System 2 preserves each system's own state independently, and both read/write to their own localStorage keys without collision.
- **S2-M1** — Snapshot ingestion (reads System 1's Approved-only export, defines the data contract). *Done when:* importing a snapshot with N approved records produces exactly N records in System 2 — no silent drops or duplicates.
- **S2-M2** — Aggregation engine (rollups by division/team). *Done when:* team totals sum to their division's total, and division totals sum to the DES-wide total, for a hand-checked test case.
- **S2-M3** — Risk status engine. *Done when:* the same inputs always produce the same risk status (deterministic — this is the doc's own success signal for this capability).
- **S2-M4** — Executive summary screen. *Done when:* every figure shown matches the aggregation engine's output for at least one manually verified case.
- **S2-M5** — Division comparison screen. *Done when:* every division present in the imported snapshot appears, with no omissions.
- **S2-M6** — Team drill-down screen. *Done when:* teams are ranked by absolute gap contribution, verified against a manual calculation.
- **S2-M7** — Scenario workspace (four levers). *Done when:* running a scenario changes the result for the lever being tested while baseline stays untouched.
- **S2-M8** — Scenario library. *Done when:* a saved scenario, reopened later, shows exactly the same result it showed when saved.
- **S2-M9** — Exceptions/risk flags screen. *Done when:* it catches every record that violates a locked threshold in a hand-built test case with a known answer.
- **S2-M10** — Demo polish. *Done when:* a full run-through of the core journey (import snapshot → executive summary → drill-down → run a scenario → save it) completes with no visual or functional errors.

---

## Cross-system architecture — critical rule

Both systems live in **one app with a top-level switcher** between System 1 and System 2, in the same monorepo.

**System 2 must never read System 1's live data directly.** It only ever sees data that has passed through the explicit Snapshot Export step (System 1, M13 → System 2, S2-M1). Do not wire the two systems to a shared live data store for convenience — this breaks the one-way hand-off boundary the sponsor has agreed to for this POC, and the demo needs to visibly show the hand-off happening, not silently sync in the background.

## State persistence

- State auto-saves to **localStorage**, per system, so a browser refresh mid-demo doesn't lose overrides, approvals, or scenarios.
- A single **"Reset all demo data"** control (in the app shell, not buried in either system) restores both systems to the original seeded dataset and clears System 2's imported snapshot. Build this in at M0 — don't leave it as an afterthought, since it's what makes the demo safely repeatable.
- localStorage is per-browser/per-device only — this is a demo convenience, not real persistence, and should never be described to the sponsor as if it were.

---

## Tech stack

**React + Vite + TypeScript** — one monorepo, one app, switcher between System 1 and System 2

## Tooling — setup mechanism for each

Each of these needs to be wired up the *correct* way for how Claude Code actually uses it — not just mentioned in a prompt. Mentioning a repo in a prompt makes Claude Code rediscover it from scratch every time; these are set up once, at M0, so they work automatically from then on.

- **playwright-mcp** — **MCP server.** Register at M0 with `claude mcp add` (exact command in the repo's README: https://github.com/microsoft/playwright-mcp). Once registered, Claude Code can click through and inspect the running app in every session without being asked — this is the project's core self-verification method, not optional polish.
- **graphify** — **Skill/plugin.** Install at M0 — it installs itself as a Claude Code skill (https://github.com/Graphify-Labs/graphify). Maps the codebase into a queryable knowledge graph so Claude Code can query structure instead of re-reading files as the project grows. Use `graphify query` / `graphify explain` / `graphify path` over raw file reads once the graph exists.
- **react-bits** — **Not referenced directly.** A custom skill — `~/.claude/skills/frontend-components/SKILL.md`, installed once on your machine (personal scope, applies to every Claude Code project, not just this repo) — tells Claude Code to check react-bits for a matching component before hand-building any UI element, and to install what it needs via react-bits' own CLI (TS + Tailwind variant) rather than copying by hand. Triggers automatically at M14/S2-M10, no manual reminder needed. Source: https://github.com/DavidHDev/react-bits
- **remotion** — not in scope for the POC. Fast-follow idea: a generated walkthrough video once System 1 is working, for stakeholders who can't attend a live demo. No setup now.

---

## Working process

- Work mostly in **plan mode** (shift-tab twice), not default mode
- Before writing code on a new milestone: interview first — what's the core problem, who's it for, what does success look like, what should this *not* do — summarise back before implementation starts
- Verify every milestone with playwright-mcp before marking it done — don't just trust the code
- Use a fresh Claude Code session/tab to review completed work when something feels off — it spots bugs the building session misses due to context noise
- Update this file when a bug is found and fixed, so the same mistake doesn't repeat
- Periodically strip anything from this file that's redundant or no longer relevant — don't let it bloat

## Communication style for this project

Simple language, bullet points, not long prose — unless explicitly asked otherwise.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
