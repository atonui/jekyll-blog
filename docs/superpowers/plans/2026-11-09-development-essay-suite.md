# Development Essay Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining five screenshots with interactive trajectories, ECI comparisons, and scientific-output figures, retaining the merged energy chart and its archived share links.

**Architecture:** Add a versioned suite dataset built from the already audited World Bank responses and explicitly HS92 Atlas responses. A configurable renderer serves three scatterplots, one trajectory figure, and one scientific-output time-series; all use figure-local state, static fallbacks, consistent country colours, tables, and exports. Existing energy assets and their snapshot remain unchanged.

**Tech Stack:** Python standard library, vanilla JavaScript ES modules/SVG, Sass, Jekyll 4.4.1, Node's test runner. Inline execution continues under the approved design; one fresh final code reviewer.

**Spec:** `docs/superpowers/specs/2026-11-09-interactive-development-essay-design.md`

## Global Constraints

- No page-wide horizontal scrolling at 360px.
- Keep axis and control text at least 14px and touch controls at least 44px high.
- Keep ECI linear because negative values are meaningful.
- Browser charts load only same-origin versioned assets and do all filtering locally.
- An optional comparator with no observations remains named as unavailable and does not prevent other countries from appearing.
- Do not substitute another year, interpolate missing observations, or silently mix data editions.
- Monthly refresh remains the next separately testable milestone after this article release.

## Review Focus

- Atlas country IDs must resolve through its country catalogue and exact ISO codes; omitted/unmapped historical territories must be reported, not guessed.
- Fractional papers and negative ECI must survive normalization, tables, exports, and both scale settings.
- Zero/missing population must not produce infinite or misleading per-million values.
- Trajectory and time-series paths must break at missing years; an unavailable selected endpoint must not borrow another year.
- Six figures must not overwrite each other's URL state or accept arbitrary dataset paths; both scientific metric modes must restore correctly.

## Task 1: Suite dataset, coverage, and generated fallbacks

**Files:** create `scripts/data/suite.py`, `scripts/data/test_suite.py`, a suite snapshot under `assets/data/development/`, bounded compressed provider responses under `research-data/development/`, and generated fallbacks under `_includes/generated/`. Modify `_data/essay_charts.yml` with five figure definitions. Existing energy snapshot and index remain unchanged; suite has its own `suite-index.json`.

**Interfaces:** `build_suite(responses: dict, retrieved_at: str) -> dict` consumes country metadata, four World Bank indicators, Atlas country list/HS92 ECI, and a latest-year completeness probe. Produces country/year rows with electricity, income, population, papers, papersPerMillion, complexity; per-figure coverage/defaults/years/domains; source manifest with exact queries, classification, country mapping/version and checksums. `publish_suite(dataset, responses, root: Path) -> Path` stages immutable data, raw archives, default SVGs and HTML tables, and updates only the suite pointer.

- [ ] Write failing Python tests for exact mapping/years, negative ECI, fractional normalization (2.5 papers and population500000 ->5 per million), null/zero denominators, duplicate/error/truncated Atlas responses, figure-specific required economies, deterministic content identity, safe HTML, and unchanged energy assets.
- [ ] Run `python -m unittest discover -s scripts/data -p 'test_*.py'`; expect failure for absent suite module.
- [ ] Implement normalization and coverage selection. Derive content identity from normalized data plus raw checksums and schema version, so changes to derivation create new editions. Cross-check Atlas latest-year records with its separate bounded probe before accepting the batch. Fail if this disagrees or GraphQL reports errors.
- [ ] Implement static scatter/line SVGs with negative ECI axes, explicit actual years, sources and safe default tables. Keep fallback text readable on phones using a local scroll container rather than scaling a1080px figure down to300px. Missing years split paths.
- [ ] Run the Python suite; expect all tests to pass. Generate the real suite snapshot, record joined coverage per figure and verify retained energy assets have no diff. Commit.

## Task 2: Shared multi-figure model and renderer

**Files:** create `assets/js/charts/suite-model.mjs`, `suite-plot.mjs`, `suite.mjs`, `shared.mjs`, `scripts/test_suite_model.mjs`, `_includes/explorer-chart.html`; modify `_sass/_charts.scss`, `_layouts/default.html`, and article includes. Reuse existing `model.mjs` scale/SVG-export helpers without changing the merged energy chart's contract.

**Interfaces:** `suiteView(dataset, figure, state) -> {rows, points, segments, missing, logExcluded}`; `readSuiteState(params, dataset, figure) -> {state, warning}`; `suiteParams(state, snapshotId, figureId) -> URLSearchParams`; `suiteCsv(view, dataset, figure, state) -> string`; `plotSuite(dataset, figure, state, width, onInspect) -> SVGElement`. State is `{year,start,countries,scale,metric}`, with independent figure IDs, up to6 exact country codes, `log|linear`, and scientific mode `perMillion|total`.

- [ ] Write failing Node tests for linear negative ECI under log mode, exact-year joins, line gaps, missing endpoints, metric-mode normalization and units, CSV negative numbers/formula text, archived/invalid snapshot state, and preservation of unrelated chart query parameters.
- [ ] Run `node --test scripts/test_suite_model.mjs`; expect failure for missing module.
- [ ] Implement model and pure formatting/source metadata, then rerun the tests; expect success.
- [ ] Implement SVG scatter/trajectory/series rendering with stable full-range domains, selected-year markers, direct country labels, inspect selector and exact-year details. Keep graph creation separate from DOM enhancement and create exports at1080px regardless of viewport width.
- [ ] Implement native year/range/country/scale/science-mode controls, debounced rendering on slider input, cached same-origin loading, safe allowlisted snapshots, per-figure table/CSV/SVG output and immediately visible share links. Static fallbacks remain until enhancement succeeds; no autoplay.
- [ ] Reuse the approved visual style. Add page-only suite loading and verify that each chart retains its own year/metric/range state when another is manipulated. Commit after passing Python/Node suites and Jekyll build.

## Task 3: Article integrity, verification, and delivery

**Files:** modify `_posts/2024-11-06-how-do-countries-develop.md`, existing Jekyll CI workflow, and plan verification notes. Refresh the existing private preview project `appgprj_6af205b6868081918aa9bd978343fc3f` without changing access.

- [ ] Replace the remaining five figures, preserve all six original figures in a clearly labelled expandable historical section, and revise adjacent claims/conclusion to distinguish associations, goods-based ECI, research output, and efficiency. Keep the original publication date and permalink.
- [ ] Run all Python and Node tests, Jekyll production build, search checks, and Lighthouse regression checks. Verify all figure snapshot IDs agree with their own manifest, all default rows match exports, and unrelated articles do not load suite scripts.
- [ ] Inspect desktop and360px views; test country selection, independent years and share restoration, scientific metric switching, missing endpoints, ECI scale, keyboard inspection, static/failed-fetch fallback, and actual exports.
- [ ] Obtain a fresh whole-branch review, fix important findings with regression tests, publish a feature PR, refresh the private preview, and report exact URLs plus any verification limits. Do not merge or change production settings.

## Self-review

The task interfaces agree on metric keys and exact year semantics. All five new figures have a dataset definition, static fallback, interactive controls, table, provenance and exports. Required-country rules are per figure. The monthly refresh workflow is deliberately excluded until the reusable article suite is merged. No new platform/framework or user installation is required.
