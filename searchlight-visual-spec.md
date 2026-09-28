# Searchlight — Visual Build Spec (draft for Claude Code)

Compiled from the screenshot-derived design pass, 24 Sept 2026. This is a companion to the locked functional spec (CLAUDE.md) — read both before building any screen.

**Rule for Claude Code:** every `[role: x]` placeholder below must resolve against the PA colour/typography token file already in this repo (`src/index.css`). Do not invent a hex value or px size for any placeholder — if a token doesn't exist yet for a role, stop and flag it rather than approximating.

**What "screenshot reference" means here** *(clarified 26 Sept 2026)*
- The references are **images from other products** that informed the design pass — not mockups of Searchlight screens. A reference shows a *visual language* to adopt, not content to copy.
- Consequence: the reference's own data is never a source. Its trait count, its per-node granularity, its field labels belong to that product. **CLAUDE.md governs what the data is and what each element represents; the image governs only how it looks.** Two real errors came from missing this — an 8-cell Attributes grid transcribed from 8 NFT traits when the locked factor list is four, and one bubble per person when the model calls for one per team.
- This markdown is a *summary* of those images. For any screen not marked "no screenshot reference exists", read the image alongside this text: layout, spacing, proportion and composition come from the image; token mapping, explicit overrides and named rejects come from here.

**Precedence, when the two disagree**
1. Layout, spacing, proportion, composition, relative hierarchy → **the screenshot**.
2. Colour and type values, the named rejects, and anywhere this doc says the source material was inconsistent → **this doc**.
3. Behaviour, data, and what an element represents → **CLAUDE.md**, regardless of the image.
4. A genuine conflict between 1 and 2 → **stop and flag it**, do not pick silently.

---

## Global system (applies to all 8 screens except where a screen explicitly overrides it)

**Navigation**
- Top navigation bar, not a sidebar. Logo/wordmark left, primary nav links inline, utility icons (search/notifications) + profile right. Bar background is visually distinct (inverse/dark) from the page body beneath it.

**Page width — full bleed** *(added 26 Sept 2026)*
- The nav bar and the page body both run the full viewport width on every screen. The shell imposes no max-width.
- Content that would be unreadable at that measure keeps its **own** max-width — a paragraph set across 1700px is unreadable, so the constraint belongs on the text, not on the container. Same for any element with a natural size (e.g. a square visual): cap the element, not the page.

**Card/chip hierarchy**
- Two corner-radius sizes establish structure: outer "hero"/card radius ≈ 2× the inner chip/button radius. Treat this ratio as the system rule — one reference screen showed a flatter ratio; that was an inconsistency in the source material, not a second valid pattern.

**Surfaces and nesting** *(added 26 Sept 2026, learned on Individual Detail)*
- Prefer **few surfaces**. The reference's pattern is one main container per screen region, with internal sections divided by a header and a thin rule — not a separate bordered box per section. Giving every section its own border, radius and ring of page background produces competing surfaces and reads as clutter.
- Pieces nested **inside** a card — chips, item cards — should read as distinct through a **soft fill plus a hint of elevation**, not a border. A second boxed edge inside a card competes with the card's own.

**Status pill component (single shared component, two uses)**
- Shape: fully rounded (true pill, not rounded-rectangle), solid colour fill (not outline), centred label text.
- Use 1 — target workflow state: Modelled / Adjusted / Pending Sign-off / Proposed / Approved (5 distinct `[role: state-*]` colours).
  - **Corrected 26 Sept 2026.** This said four, omitting `Pending Sign-off`. That state is written by the sign-off gate and acted on by the Exceptions Queue — see CLAUDE.md's Target states. Five colours, not four.
- Use 2 — risk status: On track / At risk / Off track / Infeasible → green / amber / red gradient family. This same green→amber→red logic also drives the *fill* of the gap/forecast hero visualisation on Executive Summary and Division Comparison — it is not just a label pill there, it's a proportional gradient fill.

**Accordion component (single shared component, two uses)**
- One item expanded at a time; collapsed rows sit on a light tinted background, the expanded row switches to white/elevated.
- Collapsed row: label text left, circular icon-button right (+ to expand / × to collapse when expanded).
- Use 1 — Exceptions Queue: collapsed = person + flag type + severity; expanded = which check failed, the specific field/value vs. expected/threshold, and a resolve action routing into Manager Override for that person.
- Use 2 — Manager Override's real-time cross-check results: collapsed = pass/fail per check (team total / level-cohort norms / org goal integrity); expanded = the specific effect of the proposed change on that check.

**Typography roles**
- Aeonik Pro = primary/body. Orbikular = secondary/display, used sparingly (page titles / hero numerals only — do not apply broadly). Aeonik Fono = data/numeric values.
- Relative hierarchy locked: page-title > data-value > body ≈ card-label. Exact px/weight per role pending token extraction from the PA file.

**Illustration & motion**
- Illustration: hand-sketchy, academic-paper-style (network graphs, distribution curves, scatter plots), used subtly and sparingly in the background only — never as a hero/foreground element. Redraw in PA tokens; do not carry over any warm/aged-paper colouring from the original style reference.
- Motion: searchlight-beam-like sweep, fluid/organic — reserved for loading/thinking states and screen transitions specifically. Not a general decorative device.

**Explicit rejects (from prior failed pass — do not reproduce)**
- White rounded-corner cards with subtle drop shadows in a uniform grid (generic "AI dashboard" look).
- A plain donut/gauge chart used as "the signature visualisation" — does not count as custom.
- Brand colour reduced to a single generic accent with the rest of the palette (Aqua/Apricot/Lime/Rose) absent.
- Illustration reduced to a faint, barely-visible sliver.

---

## Number formatting and individual target order — locked 27 Sept 2026

Two global rules, applying to every screen in both systems.

### Currency and percentages

All formatting goes through `src/shared/format.ts`. No screen formats a
figure inline. Before this, every screen had its own habit and they disagreed
at scale boundaries — `£${n.toLocaleString()}k` printed "£5,820k" and
"£17,820k" for figures that are £5.8m and £17.8m, while Executive Summary's
hero used a separate two-decimal millions format.

| Range | Format | Example |
| --- | --- | --- |
| below £1,000 | full number | `£820` |
| £1,000 – £999,999 | thousands, no decimal | `£582k` |
| £1,000,000 and above | millions, one decimal | `£17.8m` |

Banding is decided on the **rounded** figure, so a value that rounds up across
a boundary moves band with it: 999.6k renders `£1.0m`, never `£1000k`.
Boundary cases are pinned in `scripts/verify-format.ts` (`npm run
verify:format`).

Percentages carry **one decimal place** (`87.4%`), except figures that are a
defined flat rate rather than a measurement, which stay whole: the 65%/85%
utilisation targets, the ±20% large-adjustment threshold, grade role factors,
and percentages the user typed into an adjustment field.

**Known trade-off, accepted:** one decimal at £m scale means a change under
~£50k on a multi-million total renders as no visible change. A 0.5% mass
adjustment on £5.8m shows `£5.8m → £5.8m`. The net-change line still states
the real delta (`+£20k (+0.3%)`), so the figure is never lost — but the
headline pair alone will not show it.

### Individual target display order

For everyone below Managing Consultant, the only target they carry is
**utilisation**, as a percentage. It is the lead figure — first, and most
prominent — everywhere an individual's target appears. The monetary
equivalent (day rate × utilisation × working days) stays visible as a
supporting figure, never the lead.

Managing Consultant and above additionally carry a sales target. Utilisation
still leads; the sales target gets its **own clearly labelled figure** and is
never folded into the utilisation-derived monetary one.

That last point corrected a real defect, not just an ordering: these screens
printed `combinedRevenueFor(person)`, which is billable **plus** sales added
together. For a Partner that single number silently merged two targets of
different kinds. The supporting figure is now billable revenue alone.

Applied via `IndividualTargetLead` / `IndividualTargetInline`
(`src/system1/components/IndividualTarget.tsx`) on Individual Detail, Manager
Override, Mass Adjustment, Overview & Population's roster cards, and the
Exceptions Queue's per-person rows.

**Note the third quantity.** None of the above is the *modelled target*
(baseline × capacity × role × economic). That is what the override and
sign-off workflow acts on, and it is unchanged. On Manager Override, Mass
Adjustment and the Exceptions Queue's sign-off rows, utilisation leads as
context while the modelled before/after remains the figure actually being
changed — those screens label it `modelled` explicitly so the two are not
confused.

---

## System 2 demo seed and goal spread — locked 27 Sept 2026

### System 2 opens pre-loaded

System 2 used to open on "No snapshot imported yet" and stay there until
someone manually approved records in System 1, exported, then imported.
Nothing in it was reviewable. `system2Store` now starts from a committed
snapshot at `src/system2/data/snapshot.seed.json`, generated by
`npm run generate:snapshot-seed`.

The seed is not separately invented data: the generator runs the real
`buildSnapshot()` over the seed population with every record Approved, so the
file is exactly what a genuine export of the seed population produces.
`exportedAt` is pinned, so regenerating is byte-identical.

Import/export is unchanged and still authoritative — a real import overwrites
the seed entirely (verified: approving 3 records and re-importing leaves
System 2 holding exactly 3). "Reset all demo data" restores this pre-imported
state rather than emptying it, so the demo never lands on a blocked screen.

Two traps worth remembering, both hit during the build:
- The import control lived only inside the empty state's early return, so
  seeding the store made the System 1 → System 2 hand-off unreachable. It now
  lives in the populated footer too.
- `persist` needed a version bump; without it an existing `records: []` in a
  visitor's localStorage rehydrates straight over the seed.

### Prior-year growth range widened

`GROWTH_RATE_RANGE` in `src/system2/engine/goals.ts` changed from
`[-0.05, 0.12]` to **`[-0.20, 0.45]`**.

The narrow range made "On track" unreachable by construction rather than by
chance. Expected achievement is target × capacity (mean 0.90) × trend (mean
0.95) ≈ target × 0.855, while the goal was target ÷ 1.035 × 1.1 ≈ target ×
1.063 — a forecast ratio of ~80% for every group. All three divisions came
out Infeasible, so Division Comparison, whose entire purpose is comparing
divisions, showed the same word three times.

This is the only available lever: the capacity range, the trend range and the
×1.1 goal multiplier are all locked in CLAUDE.md. Prior-year growth is a
fabrication parameter for synthetic demo data, not a locked figure.

The top end is **0.45, not the 0.40 first proposed** — at exactly 0.40 the
spread jumps from Infeasible straight to At risk and no group lands in the
Off track band, giving only three of the four statuses.

Resulting spread, all four statuses present:

| Group | Forecast | Confidence | Status |
| --- | --- | --- | --- |
| DES-wide | 87.0% | High | Off track |
| Design | 77.8% | Medium | Infeasible |
| Engineering | 80.3% | Low | Infeasible |
| Science | 107.4% | Low (concentration flagged) | At risk |
| Design / Studio South | 110.6% | High | On track |
| Engineering / Delivery | 85.1% | High | Off track |
| Design / Studio North | 59.1% | High | Infeasible |

**Divisions still show only two distinct statuses.** A sweep of the
surrounding range found no combination giving three distinct division
statuses *and* all four overall — each division sums two teams, which averages
the variation out. The full spread appears once a division is expanded.

The Medium/Low/Low division confidence spread and Science's concentration flag
are unaffected: both derive from the group key, not from goals.

Two verification fixtures had hard-coded trends and a hard-coded goal tuned to
the old range and broke immediately. They now derive their calibration from
the computed goal (`trendForRatio()`) or bound it against the range, so they
no longer pin an output that a demo-data parameter is free to change.

---

## Page background and card elevation — locked 27 Sept 2026

Applies to every card and panel in both systems.

### The page background was already the near-white token

The brief asked for the page to move to an ice-white/near-white PA token.
**It was already on it.** The shell has used `--color-pa-grey-wash`
(`#f9fafc`) throughout; the only token closer to white in the PA palette is
`--color-pa-white` (`#ffffff`) itself, which a page cannot be if white cards
are to read against it. No hex was invented and no closer token exists, so
the page background is unchanged.

What read as "light grey" was the **cards**, not the page. Several screens
filled their cards with `--color-pa-grey-01` (`#e8ecf2`) to manufacture an
edge — a workaround for the earlier "invisible container" problem, where a
white card on a near-white page had no visible boundary. That grey fill is
what the eye was picking up.

### Cards are now separated by elevation, not fill

Card surfaces are white, distinguished by a shadow rather than by a grey fill
or a hairline border. Three shared tokens, in `src/index.css`:

| Token | Value | Used for |
| --- | --- | --- |
| `--shadow-pa-card` | `0 2px 10px rgba(0,23,45,0.06)` | every resting card |
| `--shadow-pa-card-hover` | `0 4px 16px rgba(0,23,45,0.1)` | hover on an interactive card |
| `--shadow-pa-card-raised` | `0 6px 24px rgba(0,23,45,0.14)` | selected / expanded |

Tinted with the palette's own Dark Blue (`#00172d`) rather than neutral black,
so the shadow sits in the same colour family as everything else. The values
are the Scenario Workspace treatment the reference screenshot set, promoted
from inline classes to tokens so every card points at one definition.

Applied to all 8 screens. `--color-pa-grey-01` is still used, but only for
*nested* surfaces inside a card (attribute chips, icon badges, the accordion's
circular control) — never to give a top-level card its edge.

The accordion's collapsed row moved from a Grey 01 pill to white + resting
shadow, with the expanded row on the raised shadow, so the two states now
differ by elevation rather than by fill. Its circular control is Grey 01 in
both states; it used to invert to white on the collapsed row, which would now
be white-on-white.

`CrossCheckPanel` was also migrated off the pre-Searchlight `slate-*` palette
it had been left on. Zero `slate-` classes remain anywhere.

Verified by measuring computed styles on all 8 screens: page
`rgb(249,250,252)`, every `rounded-pa-card` surface white with a shadow, and
**zero** cards indistinguishable from the page.

---

## Design-direction reset — M1: tokens and neutral elevation (28 Sept 2026)

**Supersedes** the Aqua-led chrome described throughout this document and the
blue-tinted elevation locked on 27 Sept. Delivered as five milestones; this
entry covers M1 only.

### The direction

White is overwhelmingly dominant. Depth comes from shadows, subtle borders and
card boxes — not colour blocking. Structural chrome (navigation, dividers,
icons, elevation tints) becomes white or neutral grey. Pink is a single,
sparing accent for things that must draw the eye: primary actions, the
active/selected state, at most a chart's primary series. **If the interface
reads pink, the reset has been applied wrongly.**

### Milestones

| | Scope |
| --- | --- |
| **M1** | Accent token + neutral elevation *(this entry)* |
| **M2** | App shell chrome — nav bar, loader, background illustrations |
| **M3** | System 1 screens, blue use decided case by case |
| **M4** | System 2 screens, same |
| **M5** | Real profile photographs |

### Accent token

`--color-pa-accent: #f3809e` — this is **Rose 03, already in the PA palette**.
No hex was invented. It was effectively unused, so it carries no prior meaning
in this app.

Measured, not estimated:

| | Contrast | |
| --- | --- | --- |
| white on accent | **2.50:1** | fails AA — never use |
| Dark Blue on accent | **7.23:1** | passes AA |
| Grey 04 on accent | 3.85:1 | large text only |
| accent on white | **2.50:1** | below the 3:1 UI-component threshold |

Two consequences that constrain M2–M4:

1. **A pink button takes dark ink, not white.** Every primary button in the app
   is currently white-on-Aqua. Swapping the fill alone would fail AA on all of
   them. `--color-pa-accent-ink` is provided for this.
2. **Pink on white cannot carry a state by itself.** At 2.50:1 a 1px pink
   border or hairline underline is not distinguishable enough. A selected
   state needs a fill, a thicker mark, or a second non-colour cue.

There is also a **semantic collision to watch**: the Rose family already means
failure here — Rose 01 wash with Rose 04 text is "missing data", "check
failed", "Off track". A pink primary button will sit on screens that also show
pink failure chips. Raised now rather than discovered in M3.

### Neutral elevation

The five shadow tokens were tinted with Dark Blue to keep elevation in the
brand's colour family. They are now plain black alpha — same geometry, same
opacities, hue only:

| Token | Value |
| --- | --- |
| `--shadow-pa-chip` | `0 1px 3px rgba(0,0,0,0.06)` |
| `--shadow-pa-card` | `0 2px 10px rgba(0,0,0,0.06)` |
| `--shadow-pa-card-hover` | `0 4px 16px rgba(0,0,0,0.1)` |
| `--shadow-pa-card-raised` | `0 6px 24px rgba(0,0,0,0.14)` |
| `--shadow-pa-modal` | `0 24px 64px rgba(0,0,0,0.24)` |

Every remaining inline blue-tinted shadow was folded into these, plus the
override modal's backdrop. Verified by computed style across all 8 screens:
**zero** blue-tinted shadows or gradients remain.

One blue element is deliberately left for M2: `SearchlightLoader`'s Aqua panel
and radial beam. That is a colour-blocked surface rather than an elevation
tint, so it belongs with the app-shell chrome pass.

---

## System 1 — Individual Targeting

### 1. Overview & Population
- **Landing state:** bubble network. One uniform-size bubble per DES team (Design, Engineering, Science, etc.) — not one per person, not one per division.
- **Location filter:** Boston / Ireland / London / GITC as a filter control that narrows which team bubbles are visible. Location is not a bubble grouping.
- **Drill-in:** clicking a team bubble transitions the same screen (not a new route) into a team-level list state.
- **Team-level list state = full roster**, card-per-person:
  - Card structure top-to-bottom: overflow menu icon (top-right), centred avatar, centred name + role, centred status pill, divider, two contact/data rows, divider, two-column stat row (label left / value right), divider, two-button footer row (secondary + primary, equal width, filled pill).
  - Checkbox multi-select on each card, for Mass Adjustment population selection.
  - Footer button mapping: primary ("View") → Individual Detail for that person. Secondary ("Notes") → that person's manager-notes field.
  - Search/filter controls above the list.
- **Sync status:** "last synced with System 2" indicator + manual re-export action lives on this screen (this is the fallback path — Approve already writes live, so this is secondary, not primary).
- **Open / not yet specified:** bubble layout algorithm (force-directed vs fixed grid) — propose, don't invent silently. Pagination behaviour for large teams in the list state — not decided.

### 2. Individual Detail

**Built 26 Sept 2026.** This section has been rewritten to describe what was
actually built, after several rounds of review against the reference. Where
it now differs from the original draft, the reason is given inline so the
change is not mistaken for drift.

**One continuous card.** The whole screen is a single container — not a main
card plus separate cards beneath. Internal sections are divided by a thin
rule and a section header, never by their own border, radius or ring of page
background. *Changed from the original draft, which implied separate
sections: the reference uses one surface here, and five competing bordered
boxes was the result of following the draft literally.*

**Always visible** (this is the reference's density — nothing more):
- Identity row: small round avatar, bold name, grey subtext (`id · grade · division / team`), status pill right.
- Stat row: a large value + label paired with a secondary value + label.
- Action buttons: filled primary, soft-filled secondaries. Not outlined — the reference's secondary is a fill.
- A **compact status indicator only**: a slim single-line progress bar, no step numbers, no connecting nodes, no per-step labels. *The full labelled 5-step tracker was tried and removed — it occupied as much vertical height as the entire Attributes section to convey what the status pill beside it already conveys. `StatusPipeline` retains a `full` variant for Manager Override, where a transition is actually being made.*
- Attributes grid (below).
- The square visual (below).

**Right zone — resolved, was "needs Justin's call":** a plain **avatar/photo
placeholder**, not a cohort-comparison chart. Cohort Comparison is already on
this screen as its own tab, so a chart in the hero would duplicate it.

**Square sizing.** The zones are ≈58/42, but the square is **capped** (268px)
rather than taking a raw 42%. At a full-bleed ~1700px viewport an uncapped
42% produces a ~670px square that drags the card down and leaves a void
beside it. The cap is tuned so the square and the left column measure equal.

**Attributes** — 2×2 chip grid, one chip per target factor (role, capacity,
location, discipline), four chips total. Sits inside the single card as an
internal section, not as a separate box.
  - **Corrected 26 Sept 2026.** This previously said "strict 4-column × 2-row chip grid", i.e. 8 cells. That was transcribed from the reference image, which carries 8 NFT traits, and was never reconciled with CLAUDE.md's locked factor list — exactly four, "only these". Eight cells and "one chip per target factor" could not both be true.
  - Chip anatomy per the reference: muted label top-left, small **pill-shaped** percentage badge with a soft fill top-right, bold value below.
  - The badge shows each factor's real multiplier read as a percentage (capacity 0.69 → 69%, role 0.95 → 95%). Location and discipline have **no** badge: they select which baseline applies rather than scaling it, so there is no percentage to show and none should be invented.

**Lower area — one tab group, one panel at a time.** Tabs, in order:
`Explanation` / `Personal context` / `Recent updates` / `Cohort comparison`,
defaulting to Explanation.
  - *Explanation and Personal context were permanent blocks in the original draft. They became tabs because the reference never shows more than one thing in this region, and as always-visible sections they roughly doubled the screen's height for content a manager reads once.*
  - **Recent updates**: two-column history cards — timestamp + source-tag pill on the top line, bold headline, 2–3 line body. The tag is the audit actor, real data. Defaults to **2 entries**, matching the reference, with a "Show all N changes" reveal.
  - Consecutive identical entries (same action *and* same detail) collapse. Only consecutive ones, so a genuine later repeat after some other change still reads as its own event.
  - **Cohort comparison** lives here per the consolidation, never as a separate screen.

**Nesting treatment.** Pieces nested inside the card — attribute chips,
history cards — read through a soft fill plus a hint of elevation, **not** a
border. A second boxed edge inside the card competes with the card's own.

**Deliberately absent.** There is no caption line under the stat row. One was
built and removed: location is an Attributes chip, the modelled figure is the
stat row's secondary label (and the Explanation names it when there is no
override), and the override reason is the body of its own history card. It
restated three things rather than adding a fourth.

**Still not designed:** the plain-language factor explanation text block the
functional spec requires ("why this target differs from peers"). It now has a
home — the Explanation tab — but the copy itself is still the engine's
generated sentence, not designed content. No screenshot reference covers it.

### 3. Manager Override
*No screenshot reference exists for this screen — functional requirements are locked, visual layout is not.*
- Extend the card/pill language already established (Individual Detail + Team view), not a fresh style.
- Must surface the same plain-language factor explanation as Individual Detail before a manager acts.
- Live before/after ripple preview required: team/division aggregate totals, and the cohort-comparison average for others in the same comparison group.
- Override by % or direct value (manager's choice); reason field mandatory.
- Real-time cross-check against team total / level-cohort norms / org goal integrity, shown via the shared accordion component (see Global system) — pass/fail per check collapsed, specific effect on that check when expanded.
- A failed check, or a drastic/high-impact change, routes to a sign-off gate (2–3 person team leadership group) instead of applying immediately — this state needs a visual treatment (recommend: distinct from the normal apply-confirmation state, not just a disabled button).
- **Open:** modal/panel over Individual Detail vs. a standalone route — recommend modal, not decided.

### 4. Mass Adjustment
*No screenshot reference — functional requirements locked, layout open.*
- Same live-preview requirement as Manager Override.
- Percentage-only adjustment (not fixed value).
- Population is selected via Team view's checkbox multi-select — this screen picks up from that selection, it doesn't have its own separate population picker.
- Preview must show: exact number of people affected, before/after values, aggregate economic impact, and any policy breach/inconsistency flag — before the reason/confirm step.
- **Open:** entire visual layout undesigned.

### 5. Exceptions Queue
- Small eyebrow label (scope indicator — e.g. team/division), centred; large two-line centred heading beneath it.
- List of full-width rows built from the shared accordion component (see Global system): collapsed row shows person + flag type (missing data / extreme value / large adjustment) + severity; only one row expanded at a time.
- Expanded row shows which check failed, the specific field/value vs. expected/threshold, and a resolve action that routes into Manager Override for that person.

---

## System 2 — Organisational Operating

### 6. Executive Summary
- Header: bold org/product name + one-line grey subtitle, left; single icon, right. Large vertical whitespace above the body — this screen should feel calm and editorial, not dense.
- Two-column body, roughly 35/65 split.
- **Left column:** small label, one enormous numeral (the dominant element on the page) = **organisational goal figure**. Two small pill tags beneath it. One line of grey descriptive copy beneath the pills.
- **Right column, top:** the signature gap/forecast visualisation. Horizontal gradient-fill card, label + "Target [period]" secondary label top row, huge percentage figure = **forecast ratio** (expected achievement ÷ goal). Gradient fill colour carries risk status (green/amber/red) rather than a flat brand colour — the fill itself is the status indicator, not a separate pill.
- **Right column, below hero:** two equal small stat tiles = **coverage ratio** and **confidence rating**. Each: label, small line-icon, large numeral, small grey caption.
- **Below the fold:** Top Risks list — this is where the risk/exceptions drill-in (consolidated into this screen) actually lives. Reuse the stat-tile/list card language rather than inventing a new pattern.
- Footer: thin full-width rule, small caption left, page-index right. **Confirm before building:** the page-index element (e.g. "01/12") reads as a print/report artefact — decide if it's meaningful in an app context or should be dropped.

### 7. Division Comparison
**Built 27 Sept 2026.** Was marked "draft only, no screenshot reference" — built to
this section as the brief, with two corrections recorded below. It replaced two bar
charts above a dense 8-column table; each chart restated a figure now printed on the
card it sat above, so both were dropped rather than restyled.

- Same header treatment as Executive Summary (org name, one-line grey subtitle, single
  line-icon right), for continuity between the two sponsor-facing screens.
- **Row of division cards — three, not four.** This section previously listed them as
  "Boston / Ireland / London / GITC". **Those are the four locations, not divisions.**
  DES has three divisions (Design, Engineering, Science) and every one of them spans
  all four locations, so the "division name + location tag" this section also asked for
  cannot exist either — a division has no single location. Corrected to three division
  cards with no location tag.
- Each card sits on Grey 01 at `--radius-pa-card`, the weight of Executive Summary's
  stat tiles but wider: division name, status pill, the forecast ratio as a
  proportional bar whose **width is the ratio and hue is the risk status** (the same
  green/amber/red gradient device as the Executive Summary hero), then coverage,
  confidence, goal and headcount.
- Clicking a card expands teams **in place** — one division open at a time. The team
  cards render full-width beneath the whole row, not nested inside one grid cell: a
  three-column grid cannot hold a second row under a single card without collapsing
  the grid or squeezing the team cards into a third of the width.
- Team cards carry the same trio at the same visual weight, plus their **DES-wide**
  rank by absolute gap — computed across every team before nesting, so S2-M6's ranking
  signal survives the grouping.
- Top Risks (the Executive Summary component) renders beneath, **scoped** to the
  expanded division and its teams via a `scopeKey` prop; with nothing expanded it shows
  the full DES-wide list, exactly as Executive Summary does.

### 8. Scenario Workspace
**Register superseded 27 Sept 2026.** This section previously locked a deliberate
register break for this screen only — monospace bracketed labels (`[ N.04/11 ]`),
dotted-grid texture, thin rules, isometric line-icons, a dark terminal diff panel.
That is **no longer what this screen is.** A reference screenshot was supplied on
27 Sept with the explicit instruction that it is the design to replicate, not
inspiration, and that it supersedes the engineering-console register. The screen
now uses the same light card language as the rest of the app, which also removes
the one place the design deliberately contradicted itself. The old register is
kept nowhere — do not reintroduce it.

- Two-line section heading: bold first line in Grey 04, lighter second line in
  Grey 03, in brackets or as a subtitle (`Scenario Workspace / (Test before you
  commit)`). Circular prev/next pair top-right of each section — forward is a
  filled Dark Blue circle with a white arrow, back is a white circle with a thin
  Grey 02 border.
- **Row of four white cards = the four scenario examples** (not the four levers):
  "Raise the bar" (goal +5%), "<Division> capacity dip" (capacity lever),
  "Team-wide stretch" (+10% population adjustment), "Confidence check" (confidence
  lowered for a division). Baseline sits in the saved row as the default
  comparison state, never as a fifth numbered card.
  - Each card: bold title, two-line grey description, and a rounded Grey 01 badge
    bottom-left holding a single-weight line icon.
  - Active card is distinguished by elevation only — a deeper shadow, no border
    or fill change.
- **Numbered pagination strip** beneath the row, sitting on a thin full-width
  rule: `01`–`04`, active is a filled Dark Blue pill with white monospace text,
  inactive are white pills with a thin border. Selecting a pill and clicking a
  card are the same action.
- **Saved scenarios row:** a horizontally-scrolling carousel of white cards using
  the same card-and-arrow pattern, Baseline first, then each saved scenario with
  its save date. The section's arrows scroll the rail rather than moving the
  selection.
- **Diff panel** below both rows, fed by whichever card is selected in either
  row: one white card, two columns — "What changes" (the lever config as
  `before → after`) and "What it does" (expected achievement, gap, confidence,
  forecast ratio, same shape). Monospace for the figures, not for the labels. Not
  a dark terminal, and not syntax-highlighted.
  - The outcome column is **scoped to the lever's own group**, not fixed to
    DES-wide — lever 4 never cascades to parent rollups, so a division-scoped
    override reported at DES-wide reads as changing nothing at all. The column
    header names the group it is showing.

**Colour is mapped, never copied.** The reference's black is Dark Blue (#00172d),
the darkest token in the PA palette; its card radius resolves to
`--radius-pa-card` (16px), already inside the reference's 16-20px range. No hex
was introduced for this screen.

---

## Summary of what's still genuinely open

These need an answer (from Justin, or a proposal from Claude Code flagged as a judgement call, not a silent decision) before their screen can be built to the same standard as the rest:

1. ~~Individual Detail's right-hero visual (cohort chart vs. avatar)~~ — **resolved 26 Sept 2026: avatar/photo placeholder.** A chart would duplicate the Cohort comparison tab already on the screen.
2. Individual Detail's plain-language explanation block — **still undesigned.** It has a home (the Explanation tab) but the copy is the engine's generated sentence, not designed content.
3. Manager Override — overall layout beyond the now-specified cross-check accordion (panel vs. standalone route, sign-off gate visual treatment)
4. Mass Adjustment — full visual layout
5. Bubble-network sizing/positioning logic on Overview & Population
6. Executive Summary's page-index footer element — keep or drop
