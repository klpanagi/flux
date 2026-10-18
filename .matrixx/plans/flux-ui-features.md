---
status: pending
revision: 1
---
# Flux Subscription Monitor — 4 High-Impact UI Features

## TL;DR

> **Quick Summary**: Add 4 frontend-only features to single-file `public/index.html` (no server changes): Cost Calculator, Usage Alerts w/ desktop notifications, Historical Usage Charts (localStorage + hand-rolled canvas), and Model Comparison view (2–4 models side-by-side).
>
> **Deliverables**:
> - 4 new tabs (Calculator, Alerts, History, Compare) wired into existing `showTab` system
> - CSS additions reusing variables + `.card/.metrics/.bar/.table` patterns
> - JS modules: calculator, alerts engine, snapshot store + canvas charts, comparison renderer
> - localStorage persistence for alerts config, snapshots, calculator defaults, comparison selection
> - Updated `refreshAll()` + lazy-load wiring
>
> **Estimated Effort**: Medium (single 142-line HTML file grows to ~700-900 lines; 1 file touched)
> **Parallel Execution**: YES — 3 waves (foundation → 4 parallel features → integration/polish)
> **Critical Path**: Task 1 (tabs+CSS+utils) → Tasks 2-5 (parallel features) → Task 10 (integration) → Task 11 (QA pass)

---

## Context

### Original Request
Implement 4 high-impact UI features for the Flux subscription monitor app (single-file HTML frontend + Bun server). App monitors OpenCode Go and CommandCode GOAT subscriptions. Features: (1) Cost Calculator/Estimator, (2) Usage Alerts & Thresholds, (3) Historical Usage Charts, (4) Model Comparison View. Requested: new tab structure, CSS additions, JS functions, localStorage approach, integration points, waves.

### Interview Summary
**Key Discussions**:
- Scope confirmed frontend-only in `public/index.html`; `src/server.ts` unchanged (existing `/api/usage/:id`, `/api/models/*`, `/api/subscriptions` reused as-is)
- No chart library — hand-rolled `<canvas>` 2D rendering (no new dependencies, keeps single-file constraint)
- Desktop notifications via Notification API with permission gate
- localStorage namespaced keys per feature

**Research Findings** (trinity explore + direct reads):
- `public/index.html` = 142 lines: CSS lines 9–84, tab bar 90–95, panels 96–117, JS 120–140. CSS vars line 10 (`--bg --surface --surface2 --border --text --muted --accent --accent2 --green --yellow --red --blue`)
- Tab switching `showTab(name)` line 122: hides `.tab-content`, toggles `.active`, lazy-loads `portfolio→loadPortfolio()`, `models→loadModels()`
- Global state line 121: `subs, allModels, sortCol, sortDir, filterText, filterProvider`
- Data flow `loadSubs→renderSubs→loadUsage(id)` per sub; `loadPortfolio()` fans out N `GET /api/usage/:id` sequentially; `pricing` dict line 130 (~130 keys `{i,o,c}` $/1M), `benchmarks` line 131 (~61 keys `{or,ii,ci,ai,url}`)
- `src/server.ts` 122 lines: `GET /api/subscriptions`, `POST /api/subscriptions`, `DELETE /api/subscriptions/:id`, `GET /api/usage/:id` (404/500 `{error}`), `GET /api/models/opencode-go`, `GET /api/models/commandcode`, static `/`→index.html
- Reusable classes: `.card .sub-card .grid .grid-2 .grid-3 .metrics .metric .bar .bar-fill(.green/.yellow/.red/.blue) .badge(.oc/.cc) table/th/td .price(.good/.mid/.high) .form .toolbar .empty .hidden .tab-content`

### Seraph Review
**Status**: Seraph consultation fired in background (`bg_7b3db266`); still running at plan generation time. Proceeding with auto-proceed policy; known gaps incorporated defensively below.
**Identified Gaps** (anticipated/addressed):
- Notification permission denied path → guardrail: silent in-app badge fallback, never block
- localStorage quota/corruption → guardrail: try/catch + schema version + cap snapshots
- Canvas on empty data → guardrail: `.empty` placeholder, never blank canvas
- Scope lock: no backend changes, no new npm deps, no framework

---

## Work Objectives

### Core Objective
Ship 4 new tabs in the existing single-file frontend, consistent with current dark theme and patterns, verified by agent-executed browser scenarios.

### Concrete Deliverables
- Extended tab bar: Portfolio, Subscriptions, Models & Prices, Calculator, Alerts, History, Compare
- Calculator UI + `calcCost()` + monthly projection
- Alerts UI + `checkAlerts()` + Notification integration + in-app alert badge
- History UI + snapshot collector + canvas line/bar charts + retention controls
- Compare UI + 2–4 model multi-select + side-by-side table + winner highlighting

### Definition of Done
- [ ] `python3 -c` or `bun --check` equivalent: `public/index.html` loads with zero console errors on all 7 tabs
- [ ] All 4 features persist across reload via localStorage
- [ ] `showTab()` + `refreshAll()` cover new tabs; existing 3 tabs unregressed

### Must Have
- Single-file constraint preserved (inline CSS/JS only, no `<link>`/`<script src>` additions except existing font)
- Reuse `pricing` dict (calculator + compare) and `benchmarks` dict (compare); reuse `.card/.metrics/.bar/.table/.price/.badge` styles
- Zero human-intervention verification (agent runs browser checks)

### Must NOT Have (Guardrails)
- NO changes to `src/server.ts`, `subscriptions.json` shape, or API contracts
- NO new npm dependencies, chart libraries, or frameworks
- NO secrets in code/examples (subscriptions.json contains live keys — never copy)
- NO blocking `alert()/confirm()` for new features (alerts use in-app banner + Notification API)
- NO unbounded localStorage growth (cap + prune); NO uncaught JSON.parse throws
- NO blank canvas or empty-div states — always `.empty` message or placeholder
- NO single generic `usagePercent` abstraction — per-provider metric mapping is MANDATORY: OpenCode = `rolling/weekly/monthly.percent`, CommandCode = `monthlyCredits $ remaining` + `fiveHour.used/cap` (read cap from API payload, NEVER hardcode $70)
- Per-feature size budget: ≤150 lines JS + ≤60 lines CSS each (file is 142 lines today; do not create an unmaintainable blob)
- Alerts are edge-triggered only (fire on threshold crossing + 5pt hysteresis re-arm, cooldown dedupe); NEVER notify per-poll; NEVER request Notification permission on page load
- History snapshots skip failed fetches (`d.error` → no record, never zero-fill); snapshot only from `loadPortfolio`/`refreshAll` completion; cap 500 entries + prune oldest
- NO new npm dependencies, chart libraries, or frameworks
- NO secrets in code/examples (subscriptions.json contains live keys — never copy)
- NO blocking `alert()/confirm()` for new features (alerts use in-app banner + Notification API)
- NO unbounded localStorage growth (cap + prune); NO uncaught JSON.parse throws
- NO blank canvas or empty-div states — always `.empty` message or placeholder

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION.** All verification by the executing agent (Playwright for browser UI). No "user manually tests" criteria.

### Test Decision
- **Infrastructure exists**: NO (no test framework, no `*.test.*`, no CI workflow found)
- **Automated tests**: None (single-file static frontend + thin Bun proxy; DOM/canvas/Notification behavior not unit-testable without harness — setting one up is out of scope)
- **Framework**: none
- **Agent-Executed QA Scenarios**: MANDATORY for every task (happy path + at least one negative case, exact selectors, evidence screenshots in `.matrixx/evidence/`)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation, blocks everything):
├── Task 1: Tab shell + CSS additions + shared JS utils + storage keys

Wave 2 (After Wave 1 — 4 independent features, all parallel):
├── Task 2: Cost Calculator
├── Task 3: Usage Alerts & Thresholds
├── Task 4: Historical Usage Charts
└── Task 5: Model Comparison View

Wave 3 (After Wave 2 — sequential integration):
├── Task 6: showTab/refreshAll wiring + nav overflow + final QA/polish
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 foundation | None | 2,3,4,5,6 | None (first) |
| 2 calculator | 1 | 6 | 3,4,5 |
| 3 alerts | 1 | 6 | 2,4,5 |
| 4 history | 1 | 6 | 2,3,5 |
| 5 compare | 1 | 6 | 2,3,4 |
| 6 integration | 2,3,4,5 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1 | task(category="source", load_skills=["frontend-state-data"], run_in_background=true) |
| 2 | 2,3,4,5 | 4× parallel dispatch after Wave 1 completes |
| 3 | 6 | final integration task |

---

## TODOs

- [ ] 1. Foundation: new tab shell + CSS additions + shared utils + storage schema

  **What to do**:
  - Add 4 `.tab` divs (`data-tab="calculator|alerts|history|compare"`, `onclick="showTab(...)"`) after Models tab (pattern: index.html:91-93); add 4 `div#<name>.tab-content.hidden` panels with skeleton `div#<feature>-content` containers (pattern: index.html:96-117)
  - CSS additions (append inside `<style>`, after line 83): `.alert-banner` (red/yellow variants), `.calc-grid`, `.compare-table td.winner` (green highlight), `.chart-wrap canvas{width:100%}`, `.threshold-row`, responsive `@media (max-width:768px)` stacking for compare table + calc form; reuse existing vars only
  - Shared JS utils appended near line 121: `store = {get(k,d), set(k,v)}` with try/catch + `flux_` prefix; `fmtUSD(n)`, `fmtNum(n)`; `debounce(fn,ms)`; storage keys constant `KEYS={alerts:'flux_alerts_v1',snaps:'flux_snaps_v1',calc:'flux_calc_v1',cmp:'flux_cmp_v1'}`
  - Extend `refreshAll()` (line 138) with hooks for new tabs (guard each with hidden-check like existing)

  **Must NOT do**:
  - No changes to server.ts, pricing/benchmarks dict shapes, or existing 3 tabs' markup
  - No external libs; no secrets in code

  **Recommended Agent Profile**:
  - **Category**: `source`
    - Reason: Structural HTML/CSS/JS shell work in a single file with precise anchor edits
  - **Skills**: [`frontend-state-data`]
    - `frontend-state-data`: localStorage schema + namespacing design
  - **Skills Evaluated but Omitted**:
    - `frontend-testing`: no test harness in scope; QA via Playwright scenarios instead

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (foundation)
  - **Blocks**: Tasks 2, 3, 4, 5, 6
  - **Blocked By**: None (can start immediately)

  **References**:
  **Pattern References** (existing code to follow):
  - `public/index.html:90-95` — tab bar markup to extend (copy `.tab` div pattern)
  - `public/index.html:96-117` — panel containers (`tab-content hidden` + inner content div)
  - `public/index.html:10` — CSS variables (use only these; no new palette)
  - `public/index.html:20,47,53-56,27-32,63-73` — `.card/.sub-card/.metrics/.metric/.bar/.table/.price` reuse targets
  - `public/index.html:122` — `showTab()` to extend with lazy-load branches
  - `public/index.html:138` — `refreshAll()` conditional-reload pattern

  **Acceptance Criteria**:
  - [ ] 7 tabs render in header; clicking each toggles `.active` + shows only its panel
  - [ ] No console errors on load; existing Portfolio/Subscriptions/Models tabs render as before
  - [ ] `localStorage` keys `flux_alerts_v1, flux_snaps_v1, flux_calc_v1, flux_cmp_v1` readable via `store.get` without throw on empty/corrupt

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: All 7 tabs switch without errors
    Tool: Playwright
    Preconditions: `bun src/server.ts` running, http://localhost:3000 open
    Steps:
      1. Navigate to http://localhost:3000, wait for `.tab[data-tab="portfolio"]` visible
      2. Click each: `[data-tab="subscriptions"]`, `[data-tab="models"]`, `[data-tab="calculator"]`, `[data-tab="alerts"]`, `[data-tab="history"]`, `[data-tab="compare"]`
      3. After each click assert `#<name>:not(.hidden)` and others `.hidden`
      4. Collect console errors → assert zero
      5. Screenshot: .matrixx/evidence/task-1-tabs.png
    Expected Result: 7-way switching works, no console errors
    Evidence: .matrixx/evidence/task-1-tabs.png

  Scenario: Corrupt localStorage does not break load
    Tool: Playwright
    Steps:
      1. Evaluate: localStorage.setItem('flux_alerts_v1','{{{corrupt')
      2. Reload page, assert body visible + no uncaught exception (console errors = 0 excluding the intentional corrupt read)
    Expected Result: App loads with defaults despite corrupt key
    Evidence: console log captured
  ```

  **Commit**: NO (foundation for waves 2–3; commit with Task 6)

- [ ] 2. Cost Calculator / Estimator (model + token inputs → per-request + monthly projection)

  **What to do**:
  - UI in `#calculator`: `.card` with `.form`: `select#calc-model` (populated from `allModels` ids that exist in `pricing`, grouped by provider), `input#calc-input-tok` (number, default from `flux_calc_v1` or 2000), `input#calc-output-tok` (default 1000), `input#calc-req-month` (default 10000), optional `input#calc-cache-pct` (0–100, default 0); results `.metrics` with 3 `.metric`: per-request cost, monthly projection, effective $/1M blended; breakdown line showing input/output/cache math
  - JS: `initCalculator()` (populate model select, restore defaults, attach `oninput`→debounced `calcCost()`), `calcCost()` reads pricing (`pricing[id].i/.o/.c`), formula `req = in/1e6*i + out/1e6*o + (cacheTok/1e6*c if cache)`, `month = req * reqMonth`; cache tokens = `inputTok * cachePct/100` priced at `c` instead of `i` for that share; handle `pricing[id]` missing → show `.empty` "no pricing data" (do NOT crash); `priceClass()` reuse for result coloring
  - Persist inputs to `flux_calc_v1` on change (debounced)

  **Must NOT do**:
  - No server calls; no changes to pricing dict; no `alert()` for validation (inline `.label` error text)

  **Recommended Agent Profile**:
  - **Category**: `source`
    - Reason: Formula-driven frontend logic + dynamic select population from existing dicts
  - **Skills**: [`frontend-state-data`]
    - `frontend-state-data`: input persistence + debounced recompute state
  - **Skills Evaluated but Omitted**:
    - `ccxt-rest`: no exchange/API work in this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:
  - `public/index.html:130` — `pricing` dict shape `{id:{i,o,c}}` (sole cost source)
  - `public/index.html:44-46,42-43` — `.form` + input/select styling to reuse
  - `public/index.html:53-56,136` — `.metrics/.metric` + `priceClass()` for result display
  - `public/index.html:132` — `allModels` population (model list source for select)

  **Acceptance Criteria**:
  - [ ] Selecting `muse-spark-1.3-contributor` (i=0.1, o=0.2) with in=1M, out=1M, 0% cache → per-request shows $0.30
  - [ ] Monthly = per-request × req count; cache share repriced at `c` rate
  - [ ] Unknown-price model shows "no pricing data" message, no exception
  - [ ] Reload restores last inputs from `flux_calc_v1`

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: Calculator math is correct
    Tool: Playwright
    Steps:
      1. showTab calculator; select model muse-spark-1.3-contributor
      2. Fill #calc-input-tok=1000000, #calc-output-tok=1000000, #calc-req-month=100
      3. Assert per-request text contains $0.30 and monthly contains $30.00
      4. Screenshot: .matrixx/evidence/task-2-calc-happy.png
    Expected Result: Correct arithmetic displayed
    Evidence: .matrixx/evidence/task-2-calc-happy.png

  Scenario: Missing pricing handled gracefully
    Tool: Playwright
    Steps:
      1. Select a model id with no pricing entry (e.g. a fresh upstream id) or clear select value via JS
      2. Assert "no pricing data" message visible, no console exception
      3. Screenshot: .matrixx/evidence/task-2-calc-noprice.png
    Expected Result: Graceful empty state
    Evidence: .matrixx/evidence/task-2-calc-noprice.png
  ```

  **Commit**: NO (groups with 6)

- [ ] 3. Usage Alerts & Thresholds (configurable thresholds + desktop notifications)

  **What to do**:
  - UI in `#alerts`: `.card` with per-scope threshold rows (`5h %`, `weekly %`, `monthly %`, `credits $ remaining`) — `input[type=number]`s `alert-5h, alert-weekly, alert-monthly, alert-credits`; `button#alert-test` (fires test notification/banner); `button#alert-perm` (requests Notification permission, shows current state); active-alerts list `div#alerts-active`
  - JS: `initAlerts()` (load `flux_alerts_v1` defaults e.g. `{h5:80,weekly:80,monthly:80,creditsMin:10}`, render inputs), `saveAlerts()` (persist on change), `checkAlerts()` called after every `loadUsage`/`loadPortfolio` completion: compares latest usage percents vs thresholds; on breach → in-app `.alert-banner` + `new Notification(title,{body})` ONLY if `Notification.permission==='granted'`; dedupe: fire once per (sub,scope) until usage drops 5pts below threshold (track `firedSet` in memory + persist last-fired in storage); never throw if Notification undefined
  - Badge: header alert dot (e.g. `#alert-dot` on Alerts tab) when any active breach

  **Must NOT do**:
  - No polling timers beyond existing refresh flow (reuse `loadUsage`/`refreshAll` triggers); no sound/vibration; no permission request on page load (only on user click)

  **Recommended Agent Profile**:
  - **Category**: `source`
    - Reason: Event-driven threshold engine wired into existing fetch lifecycle
  - **Skills**: [`frontend-state-data`]
    - `frontend-state-data`: threshold persistence + fired-state dedupe
  - **Skills Evaluated but Omitted**:
    - `telegram-bot`: notifications are local Notification API only, no bot integration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 4, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:
  - `public/index.html:126-127` — `loadUsage()` response shapes (opencode `{rolling,weekly,monthly}.percent`, commandcode credits/windowLimits) — threshold inputs to these fields
  - `public/index.html:128` — `pctClass()` (reuse red/yellow/green semantics for banner severity)
  - `public/index.html:126,129` — call sites where `checkAlerts()` must hook (after render)

  **Acceptance Criteria**:
  - [ ] Setting 5h threshold=1% triggers banner on next refresh when usage > 1%
  - [ ] With permission granted, a Notification is constructed (spy-able); with denied, banner still shows, no exception
  - [ ] Repeat refreshes do NOT re-fire for same breach (dedupe); clearing below threshold re-arms
  - [ ] Thresholds survive reload via `flux_alerts_v1`

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: Threshold breach shows banner
    Tool: Playwright
    Steps:
      1. showTab alerts; set #alert-5h=1; save
      2. Click .refresh-btn; wait 5s for usage loads
      3. Assert `.alert-banner` visible with subscription label
      4. Screenshot: .matrixx/evidence/task-3-alert-breach.png
    Expected Result: Banner appears for breached sub
    Evidence: .matrixx/evidence/task-3-alert-breach.png

  Scenario: Denied permission does not throw
    Tool: Playwright
    Steps:
      1. Override Notification.permission='denied' via JS
      2. Click #alert-test → assert in-app banner appears, zero console errors
      3. Screenshot: .matrixx/evidence/task-3-alert-denied.png
    Expected Result: Graceful fallback, no exception
    Evidence: .matrixx/evidence/task-3-alert-denied.png
  ```

  **Commit**: NO (groups with 6)

- [ ] 4. Historical Usage Charts (localStorage snapshots + hand-rolled canvas)

  **What to do**:
  - Collector: `snapshotUsage()` called at end of `loadPortfolio()` (and `refreshAll`): for each successfully fetched sub store `{t:Date.now(), subs:{<id>:{label,provider,pct5h,pctW,pctM,creditsLeft,req,cost}}}` under `flux_snaps_v1` (array, cap 500 entries, prune oldest; wrap in try/catch QuotaExceeded → drop oldest half and retry once)
  - UI in `#history`: `.toolbar` with `select#hist-sub` (All + per-sub from `subs`), `select#hist-range` (24h/7d/30d/all), `button#hist-clear` (confirm via inline double-click pattern, NOT `confirm()`); `div.chart-wrap > canvas#hist-canvas` + legend + `.empty` fallback
  - JS: `renderHistory()` filters snaps by sub+range, draws 1–3 lines (5h/weekly/monthly %) with axis labels + min/max, HiDPI scaling (`devicePixelRatio`), empty state when <2 points; `redraw on resize` (debounced); downsample to ≤200 points for perf
  - Retention note text ("stored locally, last N snapshots")

  **Must NOT do**:
  - No chart lib; no server persistence; no snapshot on failed fetches (`d.error` skipped); no `confirm()` dialog (use inline "click again to confirm" state on clear button)

  **Recommended Agent Profile**:
  - **Category**: `source`
    - Reason: Canvas 2D rendering + time-series store with pruning logic
  - **Skills**: [`frontend-state-data`, `time-series-fundamentals`]
    - `frontend-state-data`: snapshot schema + cap/prune persistence
    - `time-series-fundamentals`: downsampling, range filtering, axis scaling
  - **Skills Evaluated but Omitted**:
    - `grafana-dashboards`: no Grafana in this app; hand-rolled canvas instead

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:
  - `public/index.html:129` — `loadPortfolio()` fan-out loop (hook `snapshotUsage()` after loop)
  - `public/index.html:20,78` — `.card` + `.empty` for chart container states
  - `public/index.html:60-62` — `.toolbar` pattern for sub/range/clear controls

  **Acceptance Criteria**:
  - [ ] After 2+ refreshes, History shows ≥2 points and draws lines (canvas non-blank: sample pixels differ from bg)
  - [ ] Range filter changes point count; sub filter isolates one subscription
  - [ ] Clear button wipes `flux_snaps_v1` and shows `.empty`; reload keeps history (up to cap)
  - [ ] Quota error path prunes without throwing

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: History accumulates and renders
    Tool: Playwright
    Steps:
      1. Clear flux_snaps_v1; refresh twice (await loadPortfolio each)
      2. showTab history; assert canvas#hist-canvas visible with width>0
      3. Read pixel data via JS → assert not all background color
      4. Screenshot: .matrixx/evidence/task-4-history.png
    Expected Result: Chart drawn from snapshots
    Evidence: .matrixx/evidence/task-4-history.png

  Scenario: Empty history shows placeholder
    Tool: Playwright
    Steps:
      1. Clear storage + reload; showTab history
      2. Assert `.empty` message visible, canvas hidden or placeholder text
    Expected Result: No blank/broken canvas
    Evidence: screenshot .matrixx/evidence/task-4-history-empty.png
  ```

  **Commit**: NO (groups with 6)

- [ ] 5. Model Comparison View (2–4 models side-by-side)

  **What to do**:
  - UI in `#compare`: `.toolbar` with `select#cmp-1..4` (options from `allModels`, persisted `flux_cmp_v1` as id array) + add/remove slot buttons (min 2, max 4 slots); results `table.compare-table`: rows = Input $/1M, Output $/1M, Cache $/1M, Intel, Coding, Agentic, Context, Provider; columns = selected models; winner cell per numeric row gets `.winner` class (cheapest price / highest benchmark); missing data shows `—`
  - JS: `initCompare()` (populate selects after `loadModels()`, restore `flux_cmp_v1`, default first 2 priced models), `renderCompare()` builds table from `pricing` + `benchmarks` + `allModels` context; guard: duplicate model selection → inline hint, still renders; <2 valid selections → `.empty` prompt
  - Hook: call `initCompare()` at end of `loadModels()` if compare tab controls empty

  **Must NOT do**:
  - No changes to `filterModels/sortModels/renderModels`; no new sort logic; max 4 columns (reject 5th with inline hint, not alert)

  **Recommended Agent Profile**:
  - **Category**: `source`
    - Reason: Table renderer composing three existing data sources (allModels+pricing+benchmarks)
  - **Skills**: [`frontend-state-data`]
    - `frontend-state-data`: selection persistence across reloads
  - **Skills Evaluated but Omitted**:
    - `frontend-perf`: table is ≤4 cols; no virtualization needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3, 4)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:
  - `public/index.html:132-137` — `loadModels/filterModels/sortModels/renderModels` (model source + table pattern to mirror)
  - `public/index.html:130-131` — `pricing` + `benchmarks` dicts (comparison data)
  - `public/index.html:63-73` — table/th/td + `.price.good/.mid/.high` + `.sorted` patterns

  **Acceptance Criteria**:
  - [ ] Selecting 3 models renders 3-column table with correct prices from `pricing` and scores from `benchmarks`
  - [ ] Cheapest/highest cell per row carries `.winner`; ties highlight all tied
  - [ ] Selection persists via `flux_cmp_v1`; 5th model blocked with inline hint
  - [ ] Missing benchmark shows `—`, no crash

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: 3-model comparison renders with winners
    Tool: Playwright
    Steps:
      1. showTab models (to populate allModels), then showTab compare
      2. Set 3 selects to priced models (e.g. muse-spark-1.3-contributor, kimi-k3, deepseek-v4-flash)
      3. Assert table has 3 model columns + td.winner exists
      4. Screenshot: .matrixx/evidence/task-5-compare.png
    Expected Result: Side-by-side table with highlights
    Evidence: .matrixx/evidence/task-5-compare.png

  Scenario: Duplicate/empty selection handled
    Tool: Playwright
    Steps:
      1. Set two selects to same model → assert inline hint visible, table still renders
      2. Clear to 1 model → assert `.empty` prompt shown
    Expected Result: Graceful validation states
    Evidence: screenshot .matrixx/evidence/task-5-compare-edge.png
  ```

  **Commit**: NO (groups with 6)

- [ ] 6. Integration: showTab/refreshAll wiring + nav overflow + full QA/polish

  **What to do**:
  - Extend `showTab()` lazy-loads: `calculator→initCalculator/calcCost`, `alerts→initAlerts/renderAlerts`, `history→renderHistory`, `compare→initCompare/renderCompare` (only init-once where applicable); extend `refreshAll()` to refresh active new tab + always `snapshotUsage()` + `checkAlerts()` after usage loads
  - Nav overflow: `.tabs{overflow-x:auto; max-width:...}` + `white-space:nowrap` so 7 tabs fit mobile; verify header doesn't wrap-break at 360px
  - Full pass: remove dead code, verify no `console.log` leftovers, verify file still single-file (no external script/link added), final reload + tab-cycling smoke test

  **Must NOT do**:
  - No feature additions beyond wiring/polish; no server changes

  **Recommended Agent Profile**:
  - **Category**: `source`
    - Reason: Cross-feature integration + regression sweep over existing tabs
  - **Skills**: [`frontend-state-data`]
    - `frontend-state-data`: verify all 4 storage keys coexist without clobbering
  - **Skills Evaluated but Omitted**: none

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final, sequential)
  - **Blocks**: None
  - **Blocked By**: Tasks 2, 3, 4, 5

  **References**:
  - `public/index.html:122,138-139` — `showTab/refreshAll`/boot sequence (integration points)
  - `public/index.html:16-19` — `.tabs/.tab` (overflow fix location)

  **Acceptance Criteria**:
  - [ ] Cold load → all 7 tabs cycle with zero console errors; Portfolio/Subscriptions/Models unchanged
  - [ ] Refresh triggers snapshot append + alert check (verify via storage + banner when threshold=1%)
  - [ ] 360px viewport: tabs scroll horizontally, compare table scrolls (no layout break)

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: Full regression sweep
    Tool: Playwright
    Steps:
      1. Cold load; cycle all 7 tabs; assert each panel visible in turn, zero console errors
      2. Add-run: calculator compute, alerts threshold=1% → banner, history has points, compare 2 models
      3. Reload → assert all 4 features restored from localStorage
      4. Screenshot each tab: .matrixx/evidence/task-6-final-*.png
    Expected Result: Everything integrated, stateful, unregressed
    Evidence: .matrixx/evidence/task-6-final-*.png

  Scenario: Mobile 360px layout holds
    Tool: Playwright (viewport 360x800)
    Steps:
      1. Load, open compare with 4 models; assert horizontal scroll, no overlapping text
      2. Open calculator; assert form stacks vertically
      3. Screenshot: .matrixx/evidence/task-6-mobile.png
    Expected Result: No breakage at small width
    Evidence: .matrixx/evidence/task-6-mobile.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add calculator, alerts, history charts, model compare`
  - Files: `public/index.html`
  - Pre-commit: `bun src/server.ts` boots + `curl -s localhost:3000 | head -c 100` returns HTML; manual Playwright sweep above passes

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 6 (single squash) | `feat(ui): add calculator, alerts, history charts, model compare` | `public/index.html` | server boots; 7-tab Playwright sweep passes |

Single commit deliberate: all work lands in one file; intermediate states would churn the same hunks.

---

## Success Criteria

### Verification Commands
```bash
bun src/server.ts & sleep 2; curl -s http://localhost:3000 | grep -o 'data-tab="[a-z]*"'  # Expected: portfolio subscriptions models calculator alerts history compare
curl -s http://localhost:3000/api/subscriptions | head -c 200  # Expected: JSON array (existing API intact)
```

### Final Checklist
- [ ] All "Must Have" present (4 tabs, pricing reuse, persistence, zero-human QA)
- [ ] All "Must NOT Have" absent (no server diff: `git diff --stat src/server.ts` empty; no new deps in package.json; no secrets committed)
- [ ] Playwright evidence in `.matrixx/evidence/` for all 6 tasks (happy + negative each)

<!-- plan-persister: {"id":"flux-ui-features","updatedAt":"2026-10-18T12:18:46.042Z","sessionId":"ses_eb10dae8bffeBfRrpAOiu2vpWA","todoTotal":6,"todoCompleted":0} -->
