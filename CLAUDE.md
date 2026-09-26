# System 1 — Individual Targeting Console
### Project memory & working agreement for Claude Code

---

## Context

PA (global consultancy) POC — two-system concept:
- **System 1: Individual Targeting** (this project)
- **System 2: Organisational Operating** (separate, later)

Scope: Design, Engineering & Science (DES) division — Boston, Ireland, London, GITC.
Population: 60 synthetic people.

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

`Modelled → Adjusted → Pending Sign-off → Proposed → Approved`

Only **Approved** records are included in the snapshot export to System 2.

**Corrected 26 Sept 2026.** This read as four states, omitting `Pending
Sign-off`. That state is real and load-bearing: the real-time cross-check
routes a failed check or a drastic change into it instead of applying
immediately, the Exceptions Queue's sign-off section acts on it, and
`approveSignOff`/`rejectSignOff` move records out of it. It was added by the
sign-off gate after this line was written and never reflected here. The
status pill and the Individual Detail progress tracker both carry all five;
the tracker abbreviates it to "Sign-off" for width.

## Exceptions queue — validation thresholds

- **Missing data** → any required field empty (capacity, economic factor, role, location, baseline)
- **Extreme value** → capacity outside 0.5–1.0, or final target more than ~25% from the team average
- **Large adjustment** → manual change over ±20% → flagged for review, never blocked

## Fast-follow (explicitly NOT in this POC)

- System 2 → System 1 feedback loop (org-level risk/capacity signals suggesting individual target changes back to managers)

## Locked dataset defaults

These are fixed numbers, not examples — build to them exactly so both systems produce consistent, explainable results.

- **Population:** 60 synthetic records, seeded/reproducible (re-running the generator must produce identical output). `POPULATION_SIZE = 60` in `generatePeople.ts` is the source of truth; the committed `people.seed.json` is its output. This read 50 until 25 Sept 2026 — a stale figure left behind by the dataset rework, corrected to match the code rather than regenerating the data, since every verified figure in both systems derives from the 60-record set.
- **Divisions & baseline (£k):** Design 92, Engineering 100, Science 96
- **Teams:** 2 per division (e.g. Studio North/South, Platform/Delivery, Research/Applied)
- **Locations:** Boston, Ireland, London, GITC
- **Grade → role factor:** Grade 2 Analyst 0.85, Grade 3 Engineer 1.0, Grade 4 Senior Engineer 1.15, Grade 5 Lead 1.3, Grade 6 Principal 1.5
- **Capacity:** random 0.6–1.0 per record
- **Economic factor:** random 0.9–1.15 per record
- **Target range band:** modelled ± 15% (this is the locked figure — the earlier "e.g." elsewhere in this doc refers to this same number)

---

## Screens (5 — consolidated 25 Sept 2026, supersedes the original 11) — free navigation, shared state underneath

**Built and merged 25 Sept 2026 (PRs #30–#37).** `src/system1/screens/` now holds exactly these 5 files. See "Consolidation plan" further down for what moved where, and for the two pieces of screen 1 below that are described here but deliberately not built yet — the bubble-per-team landing state and the team-level card roster, which belong to the visual rebuild.

All screens read/write the same single data store. An override on Individual Detail must be reflected immediately in Overview totals, the Population list, and the Exceptions queue — these are not disconnected mockups.

1. **Overview & Population** (merges old #1 Overview/home + #2 Population view) — population summary stats, plus the population view itself. Population view's landing state is a bubble network: one uniform-size bubble per DES team (not per person, not per division), with location (Boston/Ireland/London/GITC) as a filter control that narrows which team bubbles show. Clicking a team bubble drills the same screen into a team-level list state — full roster, card-per-person, with search/filter, per-person status pill, checkbox multi-select (feeds Mass Adjustment), and per-card actions (View → Individual Detail, Notes → that person's manager-notes field). Also carries "last synced with System 2" status + manual re-export action (replaces old #11 Snapshot export as a dedicated screen — Approve already writes live, so this is the fallback path, not primary).
2. **Individual detail** (absorbs old #5 Cohort comparison as a tab/panel) — factor breakdown, plain-language explanation, personal context, change history for this person, cohort comparison as a tab/panel rather than a separate screen.
3. **Manager override** (absorbs old #6 What-if sandbox as its live preview) — % or direct value, reason required, revert option, live before/after ripple preview on team/division aggregates and cohort averages (this preview *is* what the sandbox screen would have shown — no separate sandbox needed). Real-time cross-check results (team total / level-cohort norms / org goal integrity) shown via the shared accordion component (see Design direction below) — pass/fail per check collapsed, specific effect on that check when expanded. A failed check or high-impact change routes to a sign-off gate (2–3 person team leadership group) instead of applying immediately.
4. **Exceptions queue** — accordion list (same shared component as Manager Override's cross-check display): collapsed row = person + flag type (missing data / extreme value / large adjustment) + severity; one row expands at a time to show which check failed, the field/value vs. threshold, and a resolve action routing into Manager Override for that person.
5. **Mass adjustment** — filtered population (fed by Overview & Population's checkbox multi-select, not its own separate picker), percentage-only change, live preview (number of people affected, before/after values, aggregate economic impact, policy-breach flags) before the reason/confirm step.

**Cut entirely from the POC build:**
- **Employee view** (old #9) — deprioritised; sits outside the manager's journey and doesn't evidence the sponsor decision.
- **Audit / change log** (old #10) — deprioritised as a standalone screen; per-person change history still lives on Individual Detail. A population-wide audit view is a fast-follow, not in this POC.

Approve action (Proposed → Approved) is folded into Individual Detail (single record) and Overview & Population's team-level list state (bulk), not a separate screen.

---

## Milestone / PR plan

**Note (25 Sept 2026): this list is a historical record of the original 11-screen build — every milestone below is done and merged (see git log). It's now stale against the consolidated 5-screen structure above. Don't use it to plan new work. The consolidation that followed it is also done (see "Consolidation plan"); the live phase is now the visual rebuild against `searchlight-visual-spec.md`.**

Each milestone = its own branch + its own PR, reviewed before merging to main.

Each entry below includes its **acceptance signal** — the concrete way to know it's actually done, not just built.

- **M0** — Project setup, shared state, navigation shell, tooling (see below). *Done when:* navigating between two placeholder screens updates a shared value in real time, localStorage persistence + a "Reset to seed data" action both work, playwright-mcp is registered and can inspect the running app, graphify is installed and can answer a query about the codebase, and the personal `frontend-components` skill (set up once, outside this repo) is confirmed active in this project.
- **M1** — Data model + synthetic dataset (60 people, seeded/reproducible). *Done when:* regenerating the dataset twice produces byte-identical output.
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
- Team drill-down does **not** apportion the org goal down to team level — each team compares its own expected achievement to its own goal, ranked by absolute contribution to the gap.
- **Gap** = goal − expected achievement (goal-based, not target-based), computed at whichever level (DES-wide, division, team) is being shown.

## Locked dataset defaults (System 2 additions)

- **Capacity utilisation:** random 0.75–1.05 per record (feeds expected achievement)
- **Team historical trend:** random 0.85–1.05 per record (feeds expected achievement)
- **Organisational goal:** prior-year revenue (fabricated per team, seeded/deterministic) × 1.1, rolled up to division and DES-wide by summing — never a slice of the DES-wide figure apportioned back down. Adjustable at the DES-wide level only via the Scenario Workspace's "change goal" lever.

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

## Screens (3 — consolidated 25 Sept 2026, supersedes the original 6) — free navigation, shared state within System 2

**Built and merged 25 Sept 2026 (PRs #30–#37).** `src/system2/screens/` now holds exactly these 3 files. See "Consolidation plan" below for what moved where.

1. **Executive summary** (absorbs old #6 Exceptions/risk flags as a drill-in) — goal, coverage, forecast, gap, confidence, plus a Top Risks list below the fold using the same accordion/list component as System 1's Exceptions Queue (replaces a standalone Exceptions/Risk Flags screen).
2. **Division comparison** (absorbs old #3 Team drill-down as an expand-in-place interaction) — coverage/forecast/confidence/status side by side across divisions; clicking a division expands it in place into a nested row of team cards at the same level of detail (replaces a standalone Team drill-down screen).
3. **Scenario workspace** (absorbs old #5 Scenario library as a panel) — the four locked levers, baseline vs scenario comparison, with a saved/named-scenarios panel built into the same screen (replaces a standalone Scenario library screen).

## Milestone / PR plan

**Note (25 Sept 2026): this list is a historical record of the original 6-screen build — every milestone below is done and merged (see git log; S2-M10 demo polish is complete). It's now stale against the consolidated 3-screen structure above. Don't use it to plan new work. The consolidation that followed it is also done (see "Consolidation plan"); the live phase is now the visual rebuild against `searchlight-visual-spec.md`.**

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

## Consolidation plan — DONE (merged 25 Sept 2026, PRs #30–#37)

**Status: complete.** The 11 System 1 screens are now 5 and the 6 System 2 screens are now 3, on `main`. Kept here as the record of what moved where, so nobody re-litigates a merge or goes looking for a deleted screen. The next phase is the visual rebuild — see `searchlight-visual-spec.md` and Design direction below.

**Route count, corrected 26 Sept 2026.** The consolidation's acceptance signal was "exactly 5 System 1 routes and 3 System 2 routes", and it was met at merge. The visual rebuild then changed it deliberately: System 1 is now **4 screen components across 5 route paths**. Manager Override became a modal over Individual Detail — the visual spec's own recommendation, decided rather than drifted into. `/system1/override/:id` still resolves, so the Exceptions Queue's resolve action and the roster's Notes button keep working; it renders Individual Detail with the modal already open. The person-less `/system1/override` route and its top-nav link are gone, since an override with no subject has nothing to show. All five consolidated screens still exist and are all still reachable — one of them simply isn't a route of its own. Not a regression; the record just needed correcting.

**System 1 — what happened:**
- `Overview.tsx` + `Population.tsx` → `OverviewPopulation.tsx`, one route `/system1/overview`.
- `SnapshotExport.tsx` → folded into `OverviewPopulation.tsx` as a System 2 sync strip (last-synced status + manual re-export). Its record-by-record preview table was dropped; `buildSnapshot()` is untouched.
- `CohortComparison.tsx` → deleted outright. The Searchlight pass had already extracted the shared `CohortComparisonPanel` and embedded it on Individual Detail, so the standalone screen was pure duplication.
- `WhatIfSandbox.tsx` → `FactorSandbox` inside `ManagerOverride.tsx`. The override form already previewed the *final* value live; what moved is recalculation of the *modelled* target from the factors. Added "Use as direct value", so exploring a change and committing it with a reason is one flow.
- `EmployeeView.tsx` → deleted (cut from POC).
- **Audit/change log — checked, none existed.** `auditLog` is store state only, rendered inline on Individual Detail. There was no standalone screen under any filename. Nothing was deleted.
- **`SignOffQueue.tsx` — checked, it was NOT the Exceptions Queue renamed.** Exceptions Queue is a read-only list of live threshold violations recomputed every render; Sign-off Queue was an approval inbox over `Pending Sign-off` records with approve/reject, required notes, and batch entries grouped by `batchId`, calling four store actions nothing else uses. It moved to `components/SignOffSection.tsx` and is hosted by **Exceptions Queue, not Manager Override** — both are reviewer inboxes over the same population, and only the queue can hold mass-adjustment *batch* entries, which have no single person and would have become unreachable on a per-person screen. All 7 inbound `/system1/signoff` links repointed.

**System 2 — what happened:**
- `RiskExceptions.tsx` → `components/RiskExceptionsSection.tsx`, the Top Risks section at the foot of `ExecutiveSummary.tsx`.
- `TeamDrillDown.tsx` → expand-in-place inside `DivisionComparison.tsx`. Teams keep their **DES-wide** rank by absolute gap, computed before nesting, so the S2-M6 ranking signal still holds.
- `ScenarioLibrary.tsx` → `components/SavedScenariosPanel.tsx` inside `ScenarioWorkspace.tsx`, replacing its simpler saved list.

**Verified at merge** (playwright, against the running app, each merge re-running the acceptance signals of the screens it merged into): M3, M4, M5, M6, M7, M8, M9, M13, S2-M4, S2-M5, S2-M6, S2-M7, S2-M8, plus all 11 node verify scripts and a full two-journey run-through with zero console errors. Every `data-testid` from the deleted screens was preserved, so those signals remain runnable.

**Deliberately deferred to the visual phase** (both need `searchlight-visual-spec.md`, which the architectural pass did not open):
- Overview & Population's landing state is still M4's per-person bubble clusters. The spec's one-uniform-bubble-per-team landing + team-level card roster with checkbox multi-select is **not built yet** — it is the largest genuinely new piece of the visual rebuild.
- Exceptions Queue and Manager Override still render as tables/panels, not the shared accordion component.

**Known defect, pre-existing, not caused by the consolidation:** Mass Adjustment fails its own M10 signal — the per-person preview shows *combined revenue* (`combinedRevenueFor`) while applying writes an override on the *modelled target*. Two different quantities; all rows mismatch. Verified byte-identical on pre-consolidation `main`. Being fixed separately.

## Design direction — Searchlight

This section did not previously exist in this file — it captures decisions made in a separate design working session and is being recorded here for the first time (25 Sept 2026).

- **Proposition name:** Searchlight.
- **Overall feel:** clean, crisp, and clear; uses PA's own design-system colours and typography (token file shared directly with Claude Code in this repo, not reproduced here — confirm the token file's location/name before building and flag if it can't be found rather than inventing values).
- **Motion:** a searchlight-beam-like sweep, fluid and organic — reserved specifically for loading/thinking states and screen transitions. Not a general decorative device used elsewhere.
- **Data visualisation:** mostly standard, trustworthy charts (bar/line); a small number of signature custom visualisations reserved for key moments only (e.g. Executive Summary's gap/forecast figure). A plain donut/gauge does not count as a "signature visualisation" — this was tried and explicitly rejected.
- **Illustration:** hand-sketchy, academic-paper-style technical diagrams (network graphs, distribution curves, scatter plots, grid/matrix patterns) used subtly and sparingly in the background only, never as a hero/foreground element. Redraw in PA's actual colour tokens — do not carry over any warm/vintage colouring from style references used during design exploration.
- **Full screen-by-screen visual spec:** see `searchlight-visual-spec.md` in the repo root. It covers the shared component system (navigation, card/chip radius hierarchy, the status pill component, the accordion component used by both Exceptions Queue and Manager Override, typography roles) plus per-screen structure for all 8 consolidated screens, an explicit list of rejected patterns from a prior failed design pass, and a list of what's still genuinely undesigned and needs a decision before it can be built.
- **Verification requirement:** after building each screen's visual pass, take a screenshot and compare it line-by-line against that screen's section in `searchlight-visual-spec.md` — colour, type, spacing, layout, and the specific content mappings called out there. Report deviations explicitly rather than silently approximating. This replaces relying on taste-skill/emil-design-eng to drive the design — use those only as a final checklist, not as the thing generating decisions.

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
