# Interactive development essay

Status: proposed for Allan's approval. The article-first approach is approved; this document specifies the implementation before product code is written.

Date: 9 November 2026 (Africa/Nairobi).

## Purpose and outcome

Replace the six static chart screenshots in “How Do Countries Develop?” with coherent, attractive interactive figures embedded in the essay. Readers should understand the opening comparison immediately, then be able to investigate countries, years, and alternative views. Build the chart and data infrastructure so another article can reuse it through configuration.

Start with one real-data chart for review before extending the system. Improve the evidence and presentation together: the charts reveal associations and country trajectories, not proof that electricity consumption or publication counts cause prosperity.

## What the user has decided

- Use this article as the pilot, with reusable components embedded in the existing site.
- Pull data automatically, produce visuals from it, and let readers manipulate those visuals.
- Work toward strong presentation on phones as well as desktop.
- Begin with income, electricity, complexity, and scientific output. Democracy and inequality can follow when needed for a specific question.

The technical and editorial defaults below are proposals by the implementer, rather than additional preferences attributed to the user.

## Existing site and evidence inspected

Repository: <https://github.com/atonui/jekyll-blog>, inspected at `c98a8283d82d4ed0dc1b6ae2c878a175243b5313`.

- `_config.yml` and `CNAME` identify `https://www.kibetkoech.com`.
- Jekyll, Liquid includes, Sass, and a small existing vanilla JavaScript search script; no existing Node application.
- `.github/workflows/jekyll.yml` builds with Ruby 3.1, checks search and Lighthouse fixes, and deploys GitHub Pages from main. Pull requests build without deploying.
- The essay is `_posts/2024-11-06-how-do-countries-develop.md`, with a stable `/writing/how-do-countries-develop/` permalink and legacy redirects.
- `_layouts/post.html` and `_sass/_refresh.scss` provide an editorial serif presentation. Article text currently sits in a 43rem container, inside a wider article.
- The six JPG figures are in `images/`. Inspection confirms overlapping labels, tiny type when scaled into the article, and captured Power BI interface elements. Selected-country points have no visible year labels.
- No CSV, workbook, PBIX, or raw research dataset was found in the repository. The Power BI link targets an authenticated personal report path. The original publication series is not clearly identified in its source list.

Consequently, new charts must be described as an updated analysis, not an exact reconstruction of the original dataset or statistical results.

## Approaches considered

| Approach | Benefit | Trade-off | Decision |
| --- | --- | --- | --- |
| Embed externally hosted interactive charts | Quick replacement of screenshots | Less control over design, interactions, and provider dependencies | Not selected |
| Reusable charts inside the current Jekyll article | Preserves the reading experience; reusable data and rendering; fits existing hosting | Requires a small refresh pipeline and chart code | Selected by Allan |
| Separate development-data explorer | Broad freedom to investigate indicators | Larger product and navigation work before improving the essay | Deferred |

## Scope and non-goals

First implement the energy/income scatterplot with a reproducible dataset, responsive controls, accessibility, and export. Review that working chart before replacing the remaining figures.

The complete article release covers all six existing analytical comparisons, built from reusable scatterplot, trajectory, and time-series components. It also includes source notes, shareable chart state, static fallbacks, and a monthly refresh workflow.

No site migration, separate app, accounts, database, live per-reader source requests, automatic prose rewriting, causal model, or general-purpose dashboard builder is required. Do not create a platform administration interface for this project.

Failures to avoid: impressive animation that obscures values; unreadable mobile labels; silently changing years; treating missing observations as zero; combining incompatible definitions; presenting old screenshots as current fallback data.

## Verified sources and data choices

Audit requests were made on 9 November 2026. World Bank requests used `v2/country/all/indicator/{code}?format=json&per_page=20000&date=1990:2025`. All four indicator responses reported source update date 8 October 2026. These are separate from the retrieval date and observation years.

| Measure | Source and identifier | Proposed treatment |
| --- | --- | --- |
| Electricity consumption | World Bank `EG.USE.ELEC.KH.PC`; upstream IEA | kWh per person per year; do not call this total energy use, power price, reliability, or access |
| Income | World Bank `NY.GDP.PCAP.PP.KD` | GDP per capita, PPP, constant 2021 international dollars; explicitly labelled and used consistently across countries and years |
| Population | World Bank `SP.POP.TOTL` | Same-country, same-year denominator for scientific output per million people |
| Scientific output | World Bank `IP.JRN.ARTC.SC`; upstream NSF | Preserve fractional counts and explain their meaning; this is neither an exhaustive paper count nor a quality measure |
| Economic complexity | Harvard Atlas `countryYear`, explicit `productClass: HS92` | Goods/trade-based ECI; do not describe it as a complete measure of all domestic goods and services |

The choice of World Bank publication series is a documented new choice: the original article's underlying publication dataset cannot be verified from the repository. The original GDP indicator is also insufficiently documented; the updated edition explicitly uses real PPP income. Do not imply the numerical results will match the old screenshots.

Country metadata comes from the World Bank country endpoint. Its current inventory contains 217 economies after excluding aggregate regions using the metadata's region field, rather than relying on the presence of a three-letter code. Join observations on economy code plus year. Use an explicit mapping for provider exceptions; never fuzzy-match country names automatically.

### Coverage confirmed in the audit

| Check | Result |
| --- | --- |
| Energy plus real PPP income, 2024 | 141 economies with both observations |
| Energy plus real PPP income, 2025 | 40 economies with both observations |
| Kenya energy plus real PPP income | All 35 years from 1990 through 2024 |
| Kenya, China, Brazil, Germany, US, Luxembourg, South Africa, India | All have matched energy/income observations through at least 2024 |
| Publication count plus population | 197 economies for each year 1996–2023 in this retrieval |
| Kenya HS92 ECI | Successful API retrieval for 1995–2024 |

The electricity series has observations for some economies in 2025. This does not make 2025 a suitable unqualified global opening view. The first chart opens at 2024 in this snapshot.

Harvard's public GraphQL endpoint was tested successfully for its country list and Kenya's explicitly selected HS92 ECI history. Global ECI coverage, pagination/record limits, and joins remain implementation acceptance checks; they have not been verified by the pilot probe. Website and Dataverse page probes returned HTTP 403, so bulk-download automation is not assumed to work. Harvard documents its API as changeable and recommends cached, bounded analytical requests rather than use as an application's live backend.

## Figure behaviour

| Existing comparison | Interactive replacement | Opening view |
| --- | --- | --- |
| Average electricity versus average income | Same-year country scatterplot | 2024; electricity on x, real PPP income on y; Kenya highlighted; positive axes logarithmic |
| Selected-country electricity versus income | Labelled country trajectories through time | Kenya, China, Brazil, Germany, US, Luxembourg; explicit start/end years and a selected-year marker |
| Income versus ECI | Country scatterplot | Newest sufficiently covered shared year; ECI on x, linear; real PPP income on y, logarithmic |
| Publications by country | Country time-series | Publications per million people; toggle to absolute fractional count; no connecting across missing years |
| Electricity versus ECI | Country scatterplot | Electricity on x, logarithmic; ECI on y, linear |
| Publications versus ECI | Country scatterplot | Publications per million people on x, logarithmic for positive values; ECI on y, linear |

For the first figure:

- A year slider and labelled year input cover available years. A searchable country selector highlights up to six economies, with Kenya selected initially. Other economies remain visible but subdued. A region filter is optional and belongs after the core chart works.
- Offer logarithmic versus linear axes for positive measures. State the active scales next to axis labels. Keep ECI linear because negative values are meaningful. Zero observations remain in tables and appear in an explicit excluded-from-log count.
- Use equal-sized points. Population bubble sizing is deferred, so visual weight does not silently become a third measure.
- Label selected economies, not every point. Hover, focus, and tap reveal the same values with country, year, units, and source precision. Country selection and the data table provide alternatives to targeting tiny marks.
- Show the selected year's eligible/shown/missing counts. Do not substitute a nearby observation if a selected economy lacks that year; name the missing series.
- Year changes move marks without autoplay. Respect reduced motion. Trajectory views use fixed full-range domains; scatterplots use snapshot-wide domains for their eligible years so changes are interpretable. A scale switch intentionally changes the domain/scale and is labelled.
- Each chart owns its own year and controls. There is no forced page-wide year because science and energy have different coverage. Country colours are stable across charts.
- Each figure can produce a share link that encodes its figure ID, snapshot ID, year/range, selected economies, metric mode, and scale. Invalid state falls back safely with a visible explanation; unselected controls are not silently overwritten.
- Export the displayed rows as CSV and the chart as SVG, with units, source attribution, observation years, and snapshot ID included.

For opening-year selection after refresh: each figure declares `required_economies` in its configuration. The energy/income figures require all six trajectory economies. ECI figures and the science time-series require Kenya; other selected comparators are optional because an economy such as Luxembourg may not have ECI observations. Choose the latest year meeting that figure's required-economy rule and at least 90% of the maximum joined economy coverage among the five newest observed years. If no new year qualifies, keep the previous valid default; on the first release, a figure without any qualifying year displays an honest unavailable state. An optional comparator with no observations remains named as unavailable and does not prevent other countries from appearing. Earlier manually selected years remain available with their coverage shown. Thresholds are metadata and tested rules, not hard-coded year numbers.

The new single-year scatterplots replace ambiguous multi-year averages. Do not reuse a trendline or correlation coefficient from the screenshots. Regression and correlation controls are deferred until their interpretation, transformations, and sample are explicitly specified.

## Presentation and accessibility

Retain the site's editorial character: serif headings and body text, white plotting surface, dark ink, fine gridlines, and restrained emphasis. Use a legible system sans-serif for chart axes, controls, and numeric details. Proposed accents are burnt orange for Kenya and blue/purple comparison colours; final shades must pass contrast checks. Pair selected colours with direct labels or distinct markers.

Let figures use more of the existing article width while retaining the current reading measure for prose. Scope the wider layout to this article and chart containers. At narrow widths, controls stack, legends wrap, and labels reduce rather than shrink. No page-wide horizontal scrolling at 360px. Keep axis and control text at least 14px and touch controls at least 44px high.

Use semantic figure headings and captions, labelled native inputs, visible focus, keyboard controls, a succinct live announcement after an intentional year change, and an expandable accessible data table. Do not place hundreds of marks in the tab order. Provide a static SVG and a default-view HTML data table generated from the same snapshot for no-JavaScript, failed enhancement, print, and RSS contexts. Loading failure leaves that fallback usable and dated accurately.

## Architecture and reuse

Keep Jekyll and GitHub Pages. Use a Python ingestion/validation script and compact static datasets. Browser charts load only same-origin versioned assets and do all filtering locally. JavaScript is loaded only for pages that declare charts; initialize figures near the viewport.

Proposed source structure:

- `scripts/data/`: source adapters, normalisation, coverage calculations, validation, and reproducible snapshot generation.
- `_data/essay_charts.yml`: declarative figure IDs, measures, defaults, labels, and source definitions.
- `_includes/data-chart.html`: reusable semantic wrapper, controls, fallback, source notes, and data-table entry point.
- `assets/js/charts/`: rendering, state, interactions, and shared formatting. Prefer lightweight SVG rendering; a small pinned local D3 distribution is acceptable if it reduces custom scale/axis code. Exact renderer and version are builder decisions, with license retained and no runtime CDN dependency.
- `_sass/_charts.scss`: scoped styling, imported through the current Sass entry point.
- `assets/data/development/{snapshot-id}/`: normalised data, source manifest, coverage report, static fallbacks, and generated default tables. A small current pointer identifies the latest accepted snapshot.
- `research-data/development/{snapshot-id}/`: bounded original provider responses and retrieval metadata, excluded from the published Jekyll site. Retain raw data used for the figures, not full product-level trade datasets.

Snapshot IDs combine retrieval date and a content hash. Manifest fields include schema version, provider URLs and query parameters, source update dates, retrieval timestamp, observation spans, units, upstream attribution/license, classification, country-map version, raw checksums, and validation results. Never silently overwrite an accepted snapshot. A share link containing an existing snapshot ID must continue to resolve after later releases.

## Refresh and publication

Proposed first-release policy: a monthly GitHub Actions schedule plus manual dispatch fetches and generates candidate updates, validates them, builds the candidate site, and runs the required checks. A passing update archives the snapshot, commits generated data and fallbacks, and publishes a complete Pages artifact automatically. It does not require Allan to merge a routine data update. Content and code changes still follow the repository's normal pull request process.

This policy is an implementer proposal to approve with this design, not a claim that the workflow is already configured. No ChatGPT reminder/automation is needed for the repository workflow.

Use the existing repository credentials model; do not add a personal access token merely to trigger another workflow. Commits made with the default workflow token do not normally trigger a new workflow, so explicitly run the candidate checks and Pages build/deploy in the refresh run using shared workflow jobs. Confirm allowed write permissions and branch protections before enabling the schedule. If main forbids automated generated-data commits, use a dedicated generated-data branch consumed by the same validated build/deploy process; do not weaken protections. The exact permitted write route is a builder integration choice. A failed archive push must prevent publication, and concurrent source changes must not be overwritten or replaced by a stale generated commit.

No-change runs create no commit. A failed fetch, GraphQL error, schema mismatch, duplicate country-year observation, invalid unit/classification, nonfinite number, unexpected negative positive-only measure, invalid denominator, or material coverage loss leaves the last accepted bundle intact. Missing observations themselves are valid and explicitly represented.

Stage all required sources together; a failure does not mix new World Bank data with old Atlas data inside a supposedly single new snapshot. Treat loss of a figure's required economy from its previously valid comparison range, or more than 10% of previously valid country-year keys for a required measure, as a validation failure requiring investigation. An optional comparator that never had ECI is not an ingestion failure. Other historical revisions are summarised, not automatically rejected solely for being revisions. Never delete old snapshots to repair a failed refresh.

## Editorial and historical integrity

Keep the original publication date and add a clearly visible updated-analysis date and dataset edition. Preserve all six original images in an expandable “Original 2024 figures” section labelled with their provenance limitations. Git history preserves the original prose; the updated article includes an editorial note explaining the revised definitions and analysis.

Do not invent the original raw data, equate a newly retrieved historical series with what was available in 2024, or promise exact reproducibility of the original charts. The first accepted new snapshot establishes reproducibility going forward.

Revise adjacent claims and the conclusion to distinguish association from causation, electricity from total energy, publication output from research quality, and measured trade complexity from the whole economy. Acknowledge that efficiency can accompany development. Proposed editorial changes are reviewed in the article implementation pull request. Future data-only refreshes do not rewrite prose or announce new conclusions.

## Sequence and acceptance

1. **First chart:** World Bank electricity and real PPP income; fixed audited snapshot; responsive scatterplot and core controls; source details, accessible table, same-snapshot static fallback, share link, CSV/SVG export. Present a hosted preview for review before extending the design. Do not require Allan to install a local toolchain.
2. **Rest of article:** Atlas global coverage and mapping checks; science normalisation; reuse components for all remaining comparisons; revise prose and preserve original figures. A selected country-year value must agree in the chart, tooltip, table, and CSV.
3. **Refresh:** monthly/manual workflow; automatic validated publication and revision summary; immutable archives and failure handling. Exercise an unchanged response, a genuine update, missing observations, a truncated provider response, and a failed source request.

Meaningful verification covers country/year joins, aggregate removal, fractional publication preservation, denominator handling, negative ECI, zero/log behaviour, coverage-driven year selection, schema/duplicate failures, and atomic candidate promotion. Browser checks cover mouse, keyboard, touch, URL restoration, the static fallback, export, and multiple charts on one page without state collisions.

Run the existing Jekyll build, search checks, and Lighthouse checks. Inspect the article at 360px, tablet, and desktop, with reduced motion and JavaScript disabled. Verify that pages without charts do not load chart assets. Review performance against the existing article before adding more chart code.

## Questions and builder discretion

No additional product choice is required before reviewing this design. Explicit implementer calls to approve are real PPP income, World Bank/NSF fractional publication counts, an initial 2024 energy/income view, progressive enhancement within Jekyll, and automatically published monthly data updates that pass validation. These choices can be changed without abandoning the selected article-first approach.

The builder chooses the precise SVG library, file decomposition, label-collision strategy, compression, and test runner within the constraints above. Full global ECI coverage, a supported preview route, and workflow write permissions must be confirmed during implementation; none is represented as already verified.

## Source references

- Current article: <https://www.kibetkoech.com/writing/how-do-countries-develop/>
- World Bank API: <https://datahelpdesk.worldbank.org/knowledgebase/articles/889392>
- Electricity: <https://data.worldbank.org/indicator/EG.USE.ELEC.KH.PC>
- Real PPP income: <https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.KD>
- Population: <https://data.worldbank.org/indicator/SP.POP.TOTL>
- Publications and fractional-count methodology: <https://databank.worldbank.org/metadataglossary/world-development-indicators/series/IP.JRN.ARTC.SC>
- Atlas access and restrictions: <https://github.com/harvard-growth-lab/api-docs/blob/main/atlas.md>
- Atlas downloads and source-specific citation requirements: <https://atlas.hks.harvard.edu/data-downloads/>
