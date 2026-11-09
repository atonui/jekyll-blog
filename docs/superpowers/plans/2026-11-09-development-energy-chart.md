# Development Energy Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver the approved first real-data interactive chart inside the existing article for visual review.

**Architecture:** Python validates and joins archived World Bank responses into an immutable snapshot and generates a static SVG and HTML table. A page-scoped vanilla JavaScript SVG renderer progressively enhances the same data with controls, exports, and shareable state. Jekyll remains the site builder; a private hosted copy provides a review preview.

**Tech Stack:** Python 3 standard library, browser ES modules, SVG, Sass, Jekyll 4.4.1; Node's built-in test runner for pure chart logic.

**Spec:** `docs/superpowers/specs/2026-11-09-interactive-development-essay-design.md`

## Global Constraints

- Start with one real-data chart for review before extending the system.
- Browser charts load only same-origin versioned assets and do all filtering locally.
- Keep axis and control text at least 14px and touch controls at least 44px high.
- No page-wide horizontal scrolling at 360px.
- Use equal-sized points. Kenya is highlighted initially. Selected countries have direct labels.
- Electricity is kWh per person per year. Income is GDP per capita, PPP, constant 2021 international dollars.
- Do not substitute another year, interpolate, invent the original raw data, or treat missing observations as zero.
- JavaScript is loaded only for pages that declare charts; fallbacks use the same snapshot.
- Automated monthly refresh and the remaining five figures follow the pilot's visual review, as the approved sequence specifies.

## Review Focus

- Partial World Bank pages must fail ingestion rather than quietly reduce country coverage.
- Null, zero, and negative observations must not become positive log points or change the selected year.
- Malformed or foreign snapshot IDs in share links must never become arbitrary fetch paths.
- Country names containing markup or spreadsheet formula prefixes must remain safe in HTML/CSV exports.
- Narrow layouts and no-JavaScript readers must retain source information and a usable table.

## Task 1: Reproducible energy/income snapshot and fallback

**Files:** create `scripts/data/energy.py`, `scripts/data/test_energy.py`, `_data/essay_charts.yml`, `assets/data/development/{snapshot}/energy.json`, `_includes/generated/energy-income.html`, and bounded `research-data/development/{snapshot}/*.json`; modify `_config.yml` to exclude research data and development documents from publication.

**Interfaces:** `build_dataset(responses: dict, retrieved_at: str) -> dict` validates complete World Bank pages and returns schema/snapshot metadata, country catalogue, observations, coverage, defaults, and full-history positive domains. `publish_snapshot(dataset: dict, responses: dict, root: Path) -> Path` produces immutable JSON, a source manifest, a static SVG, and the generated semantic fallback. The data uses `country`, `year`, `electricity`, and `income` fields; missing values are null. Required comparison codes are KEN/CHN/BRA/DEU/USA/LUX. Default-year coverage must reach 90% of the maximum among the five newest years.

- [x] Write failing unittest cases for aggregate exclusion, exact same-year joins, null/zero preservation, duplicate and partial-page rejection, default-year selection, deterministic IDs, and safe fallback escaping. Use small literal provider-shaped fixtures with 10 complete economies in 2024 and only 2 in 2025; expect default year 2024.
- [x] Run `python -m unittest discover -s scripts/data -p 'test_*.py'`; observe failure because the implementation is absent.
- [x] Implement the interfaces, with finite nonnegative input checks, no fuzzy country matching, explicit units, raw checksums, fixed domains, CSV-safe values, and atomic staging. A CLI accepts `--responses` and `--retrieved-at` to reproduce the audited snapshot without network requests.
- [x] Run the unittest suite; expect all tests to pass. Generate the real snapshot from retained audit responses; expect 141 matched economies in 2024, 40 in 2025, Kenya 2024 electricity 195.293727720461 and income 5841.59866001706.
- [x] Check immutable regeneration produces no diff; commit the task.

## Task 2: Chart model, interactions, and responsive renderer

**Files:** create `assets/js/charts/model.mjs`, `assets/js/charts/energy.mjs`, `scripts/test_chart_model.mjs`, `_includes/data-chart.html`, `_sass/_charts.scss`; modify `assets/css/main.scss`, `_layouts/default.html`, `_layouts/post.html`, and the target article.

**Interfaces:** `viewFor(dataset, state) -> {rows, points, missing, logExcluded}`; `parseState(searchParams, dataset, figureId) -> {state, warning}`; `shareParams(state, snapshotId, figureId) -> URLSearchParams`; `csvFor(rows, metadata) -> string`; `scaleValue(value, domain, range, scale) -> number`. State is `{year, countries, scale}`, with up to six available codes and scale `log` or `linear`. The renderer consumes this module, a same-origin allowlisted snapshot catalogue, and the include's element-scoped hooks.

- [x] Write failing Node tests for exact-year/missing/zero handling, invalid query and snapshot restoration, six-country limits, scale/domain behavior, and CSV formula escaping. Assert literal outcomes rather than source strings.
- [x] Run `node --test scripts/test_chart_model.mjs`; observe absent-module failures.
- [x] Implement pure model functions, run the same command, and expect success.
- [x] Implement responsive SVG rendering, labelled controls, country selection/search, direct selected labels, hover/focus/tap details, live status, reset, copy-link, CSV/SVG export, fixed domains, and table updates. Controls appear only after successful enhancement; failure leaves the static snapshot visible. Search and filtering stay in the browser.
- [x] Add scoped Sass and page-only module loading. Replace only the first figure, preserve its original image in an expandable historical section, and revise the adjacent causal sentence and updated-source note. Other five figures remain for the next milestone.
- [x] Build and inspect the actual article. Verify year changes, selection, reset, URL restoration, keyboard/touch, exports, failure/no-JS fallback, and 360px/desktop layout. Add a regression test before repairing any behavioral issue discovered.
- [x] Run Python and Node suites plus existing Jekyll/search/Lighthouse checks; commit the task.

## Task 3: Reviewable delivery

**Files:** update the existing Jekyll CI workflow to run the new deterministic tests; update this plan's checkboxes and record validation. The preview's hosting metadata belongs to a separate disposable preview checkout, not to the existing GitHub Pages source.

**Interfaces:** consume the generated Jekyll output unchanged for the private hosted review copy. Keep the production article URL and deployment workflow semantics intact.

- [x] Run the complete validation once inputs are final; inspect all output and the built article.
- [x] Have one fresh reviewer check the complete branch against the spec, this plan, test evidence, and the Review Focus list. Resolve important findings with failing regression tests and a passing full suite.
- [ ] Commit final changes, publish the feature branch through the authenticated GitHub connector, and open an implementation PR. Do not merge or replace the production site during this review milestone.
- [ ] Publish the verified output as a private hosted preview; return its exact successful URL with the implementation PR and any verification limits.

## Self-review and execution record

All pilot requirements map to the three tasks. The full six-figure system and monthly workflow are deliberately deferred until the first chart's visual review, per the approved spec. Pure logic is shared between rendering and exports; static generation and live data use the same snapshot. Rendering library choice: native SVG, avoiding a new frontend package toolchain. Execution proceeds inline under the user's approval, with one fresh reviewer at completion.

Validation on 9 November 2026: 5 Python tests and 8 Node tests passed; production Jekyll build, existing search checks, and existing Lighthouse regression checks passed. Browser verification covered desktop controls, exact-year missing states, invalid-link recovery, same-snapshot static/failure fallback, 360px layout (clientWidth equals scrollWidth), keyboard country inspection, share-link reveal, and actual CSV/SVG downloads. The actual SVG has a 1080×630 frame and complete units/provenance; the CSV retains full source precision. Mobile iframe download-event capture was unavailable, so export geometry is covered by deterministic tests and a verified top-level browser download. Fresh independent code review found no critical issues; its export and keyboard findings and the unavailable-default fallback were corrected with regression tests.
