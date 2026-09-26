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
*Draft only — no screenshot reference, proposal to build from, not a locked spec.*
- Same header treatment as Executive Summary, for visual continuity between the two sponsor-facing screens.
- Row of division cards (Boston / Ireland / London / GITC), same visual weight as Executive Summary's small stat tiles but wider. Each card: division name + location tag, coverage ratio, forecast ratio (same green/amber/red gradient treatment as Executive Summary), confidence.
- Click expands the card in place (not a new screen) into a nested row of team cards beneath it, one level down, same coverage/forecast/confidence trio at the same visual weight.
- Reuses the Top Risks list component from Executive Summary, scoped to whichever division/team is expanded.

### 8. Scenario Workspace
**Deliberate register break — applies to this screen only.** Monospace bracketed section labels (e.g. `[ N.04/11 ]`), dotted-grid background texture, thin full-width rule lines, isometric line-icons, single high-contrast accent colour on white/black. Do not let this register bleed into any other screen, and do not apply the pill/card language from other screens here.
- Section pattern: bracketed index + chevron + label, thin rule extending full width from it, small pill action button top-right of the section.
- Large two-line heading; a slash mark immediately before the first word and after the last word of the second line.
- **4-column row = the four scenario examples** (not the four levers): "Raise the bar" (goal +5%), "Division B capacity dip" (capacity lever), "Team-wide stretch" (+10% population adjustment on a selected team), "Confidence check" (lowered confidence for a cohort). Baseline sits alongside as the default comparison state, not a fifth column.
  - Each column: numbered label ("// 002"), 2-line description, segmented progress indicator (solid fill = active/complete, dotted = remaining), bold short label, isometric line-icon bottom-aligned.
  - Active column is distinguished by colour only — number and label shift to accent colour, progress bar fully solid. No background fill or border change.
- **Second block, two-column layout:**
  - Left (~45%): dark terminal-style panel showing the selected scenario's config as a **human-readable structured diff** (e.g. `goal: £10.0m → £10.5m`, `capacity[Division B]: 0.85 → 0.78`) — styled in monospace/terminal aesthetic but is NOT real code. Corner tick-mark frame, filename-style label top-left, "Copy" pill top-right.
  - Right (~55%): heading + button + vertical list of saved/named scenarios (including Baseline). Active item gets a short vertical accent bar + full-opacity text; inactive items are greyed with no accent bar and no visible description.

---

## Summary of what's still genuinely open

These need an answer (from Justin, or a proposal from Claude Code flagged as a judgement call, not a silent decision) before their screen can be built to the same standard as the rest:

1. ~~Individual Detail's right-hero visual (cohort chart vs. avatar)~~ — **resolved 26 Sept 2026: avatar/photo placeholder.** A chart would duplicate the Cohort comparison tab already on the screen.
2. Individual Detail's plain-language explanation block — **still undesigned.** It has a home (the Explanation tab) but the copy is the engine's generated sentence, not designed content.
3. Manager Override — overall layout beyond the now-specified cross-check accordion (panel vs. standalone route, sign-off gate visual treatment)
4. Mass Adjustment — full visual layout
5. Bubble-network sizing/positioning logic on Overview & Population
6. Executive Summary's page-index footer element — keep or drop
