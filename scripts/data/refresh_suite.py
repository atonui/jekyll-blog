"""Fetch, validate, and publish one complete development-chart data edition."""
import concurrent.futures
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import time
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from energy import ELECTRICITY, INCOME, records
from suite import (POPULATION, PAPERS, build_suite, publish_suite,
                   graphql_rows, metric_key)

WORLD_BANK = "https://api.worldbank.org/v2"
ATLAS = "https://atlas.hks.harvard.edu/api/graphql"
MAX_RESPONSE_BYTES = 100_000_000
MEASURES = ("electricity", "income", "population", "papers", "papersPerMillion", "complexity")


def read_json(url, *, data=None, headers=None, timeout=45, attempts=3):
    request = Request(url, data=data, headers={"User-Agent": "KibetKoech-development-data-refresh/1.0", **(headers or {})})
    error = None
    for attempt in range(attempts):
        try:
            with urlopen(request, timeout=timeout) as response:
                body = response.read(MAX_RESPONSE_BYTES + 1)
                if len(body) > MAX_RESPONSE_BYTES:
                    raise ValueError(f"Response too large: {url}")
                return json.loads(body)
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            error = exc
            if attempt + 1 < attempts:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Failed to fetch {url}: {error}") from error


def world_bank_url(indicator, year):
    query = urlencode({"format": "json", "per_page": 20000, "date": f"1990:{year}"})
    return f"{WORLD_BANK}/country/all/indicator/{indicator}?{query}"


def atlas_query(query):
    payload = json.dumps({"query": query}).encode()
    return read_json(ATLAS, data=payload, headers={"Content-Type": "application/json"})


def fetch_responses(year=None):
    """Fetch every required provider response as a batch; fail the batch on any error."""
    year = year or datetime.now(timezone.utc).year
    country_url = f"{WORLD_BANK}/country?{urlencode({'format':'json','per_page':400})}"
    wb_urls = {"countries": country_url}
    wb_urls.update({code: world_bank_url(code, year) for code in (ELECTRICITY, INCOME, POPULATION, PAPERS)})
    queries = {
        "atlas_countries": "{ locationCountry { countryId iso3Code nameEn } }",
        "atlas_eci": f"{{ countryYear(yearMin: 1995, yearMax: {year}, productClass: HS92) {{ countryId year eci }} }}",
    }
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        futures = {pool.submit(read_json, url): name for name, url in wb_urls.items()}
        futures.update({pool.submit(atlas_query, query): name for name, query in queries.items()})
        results = {}
        failures = []
        for future, name in futures.items():
            try:
                results[name] = future.result()
            except Exception as exc:
                failures.append(f"{name}: {exc}")
    if failures:
        raise RuntimeError("Refresh batch failed; no data were published: " + "; ".join(failures))
    for name in ("countries", ELECTRICITY, INCOME, POPULATION, PAPERS):
        records(results[name])
    atlas_rows = graphql_rows(results["atlas_eci"], "countryYear")
    latest = max((row.get("year") for row in atlas_rows if isinstance(row.get("year"), int)), default=None)
    if latest is None:
        raise ValueError("Atlas returned no valid country-year observations")
    results["atlas_probe"] = atlas_query(
        f"{{ countryYear(yearMin: {latest}, yearMax: {latest}, productClass: HS92) {{ countryId year eci }} }}"
    )
    graphql_rows(results["atlas_countries"], "locationCountry")
    graphql_rows(results["atlas_probe"], "countryYear")
    return results


def validate_refresh(previous, candidate):
    """Reject material coverage loss and missing required figure economies."""
    old_rows = previous.get("observations", [])
    new_rows = candidate.get("observations", [])
    old_index = {(r["country"], r["year"]): r for r in old_rows}
    new_index = {(r["country"], r["year"]): r for r in new_rows}
    lost = {}
    for measure in MEASURES:
        before = {key for key, row in old_index.items() if row.get(measure) is not None}
        after = {key for key, row in new_index.items() if row.get(measure) is not None}
        missing = before - after
        if before and len(missing) / len(before) > 0.10:
            raise ValueError(f"{measure}: loss of {len(missing)}/{len(before)} previously valid keys, more than 10%")
        lost[measure] = len(missing)
    for figure_id, figure in previous.get("figures", {}).items():
        current = candidate.get("figures", {}).get(figure_id)
        if current is None:
            raise ValueError(f"Figure missing from candidate: {figure_id}")
        x, y = (metric_key(figure[k]) for k in ("x", "y"))
        default_year = current.get("defaultYear")
        if default_year is None:
            raise ValueError(f"Figure {figure_id} has no valid comparison year")
        for country in figure.get("required", []):
            matches = [r for r in new_rows if r["country"] == country and r.get(x) is not None and r.get(y) is not None]
            if current.get("kind") == "scatter":
                retained = any(r["year"] == default_year for r in matches)
            else:
                years = current.get("years", [])
                start_year = min(years) if years else default_year
                retained = any(start_year <= r["year"] <= default_year for r in matches)
            if not retained:
                raise ValueError(f"Figure {figure_id} lost required economy {country} from its valid comparison range")
    revisions = {measure: sum(
        old.get(measure) is not None and new_index[key].get(measure) is not None and old[measure] != new_index[key][measure]
        for key, old in old_index.items() if key in new_index
    ) for measure in MEASURES}
    return {"lostKeys": lost, "revisedValues": revisions, "oldObservations": len(old_rows), "newObservations": len(new_rows)}


def is_unchanged(previous, candidate):
    # Provider row ordering and retrieval metadata can change without changing
    # the materialised dataset. Only create a new edition when published data
    # or its chart defaults/domains actually change.
    stable_fields = ("countries", "observations", "figures", "domains", "units", "labels",
                     "mappingVersion", "classification", "unmappedAtlasCodes")
    return all(previous.get(key) == candidate.get(key) for key in stable_fields)


def current_dataset(root):
    pointer = Path(root) / "assets/data/development/suite-index.json"
    if not pointer.exists():
        raise ValueError("No accepted suite snapshot is available to refresh")
    current = json.loads(pointer.read_text())["current"]
    return json.loads((pointer.parent / current / "suite.json").read_text())


def write_summary(root, candidate, validation=None, unchanged=False, snapshot=None):
    lines = ["## Development chart data refresh", "", f"Snapshot: `{snapshot or candidate['snapshotId']}`"]
    if unchanged:
        lines.extend(["", "No source data changed; no commit or deployment was created."])
    elif validation:
        lines.extend(["", f"Observations: {validation['oldObservations']} → {validation['newObservations']}", "", "Revised existing values: " + ", ".join(f"{k} {v}" for k, v in validation["revisedValues"].items())])
        lines.extend(["", "Figure defaults:"])
        lines.extend(f"- {fid}: {figure['defaultYear']}" for fid, figure in candidate["figures"].items())
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as stream:
            stream.write("\n".join(lines) + "\n")


def refresh(root):
    root = Path(root)
    previous = current_dataset(root)
    responses = fetch_responses()
    retrieved = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    candidate = build_suite(responses, retrieved)
    if is_unchanged(previous, candidate):
        write_summary(root, candidate, unchanged=True, snapshot=previous["snapshotId"])
        return {"changed": False, "snapshot": previous["snapshotId"]}
    validation = validate_refresh(previous, candidate)
    publish_suite(candidate, responses, root)
    write_summary(root, candidate, validation=validation)
    return {"changed": True, "snapshot": candidate["snapshotId"], "validation": validation}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    print(json.dumps(refresh(args.root), sort_keys=True))
