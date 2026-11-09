# Development chart data refresh

The chart suite refreshes on the first day of each month at 08:23 East Africa
Time. A maintainer can also start it from **Actions → Refresh development chart
data → Run workflow** on `main`.

The workflow fetches the World Bank/IEA/NSF series and the Harvard Atlas ECI
series as one batch. It validates response completeness, schema, duplicate
keys, numeric values, the Atlas latest-year probe, historical coverage, and
the economies required by each figure before writing an immutable snapshot.
More than 10% loss of previously valid country-year values for any measure, or
loss of a required figure economy from its valid comparison range, fails the
run. Historical revisions are included and summarized in the Actions run.

If the materialised dataset, chart defaults, or domains are unchanged, the run
does not commit or deploy. Otherwise it commits the snapshot, compressed source
responses, manifests, and generated fallbacks to `main`, then runs the normal
data/chart checks, production Jekyll build, search checks, and Lighthouse checks
before publishing the Pages artifact. The workflow uses the repository's
`GITHUB_TOKEN`; it does not require a personal access token. A failed fetch,
validation, archive, push, or build prevents deployment.

Each snapshot and its source archive is retained. The article prose is not
rewritten by data refreshes.
