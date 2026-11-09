"""Validate archived World Bank responses and publish the energy essay snapshot.

No network access occurs during a site build. Reproduce with:
python scripts/data/energy.py --responses PATH --retrieved-at ISO_TIMESTAMP
"""
import argparse
import gzip
import hashlib
import html
import json
import math
from pathlib import Path
import shutil
import tempfile

ELECTRICITY = 'EG.USE.ELEC.KH.PC'
INCOME = 'NY.GDP.PCAP.PP.KD'
REQUIRED = ('KEN', 'CHN', 'BRA', 'DEU', 'USA', 'LUX')
UNITS = {'electricity': 'kWh per person per year', 'income': 'GDP per capita, PPP (constant 2021 international $)'}


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def records(response):
    if not isinstance(response, list) or len(response) != 2 or not isinstance(response[0], dict) or not isinstance(response[1], list):
        raise ValueError('Expected World Bank metadata and records')
    meta, rows = response
    if int(meta.get('pages', 0)) != 1 or int(meta.get('page', 0)) != 1 or int(meta.get('total', -1)) != len(rows):
        raise ValueError('Incomplete World Bank response; all pages are required')
    return rows


def build_dataset(responses: dict, retrieved_at: str) -> dict:
    countries = {}
    for row in records(responses['countries']):
        if row['region']['id'] == 'NA':
            continue
        code = row['id']
        if code in countries or len(code) != 3 or not code.isalpha():
            raise ValueError('Duplicate or invalid economy code')
        countries[code] = {'code': code, 'name': row['name'], 'region': row['region']['value']}
    measures = {}
    for code in (ELECTRICITY, INCOME):
        values = {}
        for row in records(responses[code]):
            country = row['countryiso3code']
            if country not in countries:
                continue
            year = int(row['date'])
            if not 1960 <= year <= 2100:
                raise ValueError('Invalid observation year')
            key = (country, year)
            value = row['value']
            if key in values:
                raise ValueError('Duplicate country-year observation')
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0):
                raise ValueError('Expected finite nonnegative measure or null')
            values[key] = value
        measures[code] = values
    observations = []
    for country, year in sorted(set(measures[ELECTRICITY]) | set(measures[INCOME])):
        electricity = measures[ELECTRICITY].get((country, year))
        income = measures[INCOME].get((country, year))
        if electricity is not None or income is not None:
            observations.append({'country': country, 'year': year, 'electricity': electricity, 'income': income})
    if not observations:
        raise ValueError('No usable observations')
    years = sorted({r['year'] for r in observations})
    coverage = {str(y): sum(r['year'] == y and r['electricity'] is not None and r['income'] is not None for r in observations) for y in years}
    threshold = max(coverage[str(y)] for y in years[-5:]) * .9
    eligible = [y for y in years if coverage[str(y)] >= threshold and all(
        any(r['country'] == c and r['year'] == y and r['electricity'] is not None and r['income'] is not None for r in observations) for c in REQUIRED)]
    domains = {}
    for measure in UNITS:
        positive = [r[measure] for r in observations if r[measure] is not None and r[measure] > 0]
        if not positive:
            raise ValueError('No positive values for chart domain')
        domains[measure] = [10 ** math.floor(math.log10(min(positive))), 10 ** math.ceil(math.log10(max(positive)))]
        if domains[measure][0] == domains[measure][1]: domains[measure][1] *= 10
    hashes = {code: hashlib.sha256(canonical(value).encode()).hexdigest() for code, value in sorted(responses.items())}
    digest = hashlib.sha256(canonical(hashes).encode()).hexdigest()[:12]
    return {'schemaVersion': 1, 'snapshotId': f'{retrieved_at[:10]}-{digest}', 'retrievedAt': retrieved_at,
            'sourceUpdatedAt': responses[ELECTRICITY][0].get('lastupdated'),
            'defaultYear': max(eligible) if eligible else None, 'defaultCountries': ['KEN'],
            'units': UNITS, 'domains': domains, 'years': years, 'coverage': coverage,
            'countries': sorted(countries.values(), key=lambda c: c['code']), 'observations': observations,
            'rawChecksums': hashes}


def static_svg(dataset):
    year = dataset['defaultYear']
    if year is None:
        return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 180" role="img" aria-labelledby="title">'
                '<title id="title">Comparison unavailable</title><rect width="1080" height="180" fill="white"/>'
                '<text x="24" y="76" font-family="Arial,sans-serif" font-size="24">Comparison unavailable</text>'
                '<text x="24" y="116" font-family="Arial,sans-serif" font-size="18">No sufficiently covered observation year meets this comparison’s requirements.</text></svg>')
    rows = [r for r in dataset['observations'] if r['year'] == year and all(r[m] is not None and r[m] > 0 for m in UNITS)]
    w, h, left, right, top, bottom = 1080, 650, 92, 1038, 45, 538
    def position(value, measure, a, b):
        lo, hi = dataset['domains'][measure]
        return a + (math.log10(value) - math.log10(lo)) / (math.log10(hi) - math.log10(lo)) * (b-a)
    esc = html.escape
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc">',
             f'<title id="title">Electricity and income, {year}</title>',
             '<desc id="desc">Each dot is an economy. Both axes use logarithmic scales. Kenya is highlighted. The data table contains exact values.</desc>',
             '<rect width="1080" height="650" fill="#ffffff"/>',
             '<g font-family="Arial,sans-serif" font-size="16" fill="#536171">']
    for measure, vertical in [('electricity', False), ('income', True)]:
        lo, hi = dataset['domains'][measure]
        for exponent in range(math.ceil(math.log10(lo)), math.floor(math.log10(hi))+1):
            v = 10 ** exponent
            label = f'{v/1000:g}k' if v >= 1000 else str(v)
            if vertical:
                p = position(v, measure, bottom, top)
                parts.append(f'<path d="M{left},{p:.2f}H{right}" stroke="#e9edf0"/><text x="{left-14}" y="{p+5:.2f}" text-anchor="end">{label}</text>')
            else:
                p = position(v, measure, left, right)
                parts.append(f'<path d="M{p:.2f},{top}V{bottom}" stroke="#e9edf0"/><text x="{p:.2f}" y="{bottom+29}" text-anchor="middle">{label}</text>')
    for r in sorted(rows, key=lambda r: r['country'] == 'KEN'):
        x = position(r['electricity'], 'electricity', left, right)
        y = position(r['income'], 'income', bottom, top)
        kenya = r['country'] == 'KEN'
        parts.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="5" fill="{"#ba4a22" if kenya else "#adbcca"}" stroke="white" stroke-width="1.5"/>')
        if kenya: parts.append(f'<text x="{x+12:.2f}" y="{y-11:.2f}" fill="#9c3b18" font-weight="bold">Kenya</text>')
    parts += [f'<text x="{left}" y="22" fill="#293644">Income per person · constant 2021 international $</text>',
              f'<text x="{right}" y="{bottom+66}" text-anchor="end">Electricity · kWh per person per year</text>',
              f'<text x="{left}" y="624">{year} · logarithmic axes · {len(rows)} economies · World Bank / IEA</text>', '</g></svg>']
    return ''.join(parts)


def static_html(dataset):
    esc = html.escape
    if dataset['defaultYear'] is None:
        return ('<div class="chart-fallback"><p class="chart-static-note">Comparison unavailable. '
                'No sufficiently covered observation year meets this comparison’s requirements. '
                'Missing observations have not been replaced with data from another year.</p></div>')
    names = {c['code']: c['name'] for c in dataset['countries']}
    rows = [r for r in dataset['observations'] if r['year'] == dataset['defaultYear'] and r['electricity'] is not None and r['income'] is not None]
    rows.sort(key=lambda r: names[r['country']])
    table = ''.join(f'<tr><th scope="row">{esc(names[r["country"]])}</th><td>{r["year"]}</td><td>{r["electricity"]:,.2f}</td><td>{r["income"]:,.2f}</td></tr>' for r in rows)
    snapshot = dataset['snapshotId']
    return (f'<div class="chart-fallback"><img src="/assets/data/development/{snapshot}/fallback.svg" width="1080" height="650" alt="Electricity and income in {dataset["defaultYear"]}; Kenya highlighted. Both axes are logarithmic." loading="lazy">'
            f'<p class="chart-static-note">Static view · {dataset["defaultYear"]} · snapshot {esc(snapshot)}. Interactive controls appear when the chart is ready.</p></div>'
            '<details class="chart-data"><summary>View the data table</summary><div class="chart-table-scroll" tabindex="0" role="region" aria-label="Electricity and income data">'
            f'<table><caption>World Bank · {dataset["defaultYear"]}. Electricity: kWh/person/year. Income: PPP, constant 2021 international $.</caption>'
            f'<thead><tr><th scope="col">Economy</th><th scope="col">Year</th><th scope="col">Electricity</th><th scope="col">Income</th></tr></thead><tbody>{table}</tbody></table></div></details>')


def publish_snapshot(dataset: dict, responses: dict, root: Path) -> Path:
    root = Path(root)
    parent = root / 'assets/data/development'
    parent.mkdir(parents=True, exist_ok=True)
    target = parent / dataset['snapshotId']
    payload = canonical(dataset) + '\n'
    if target.exists() and (target / 'energy.json').read_text() != payload:
        raise ValueError('Cannot overwrite an immutable snapshot')
    fallback = static_html(dataset)
    if not target.exists():
        stage = Path(tempfile.mkdtemp(prefix='.candidate-', dir=parent))
        try:
            (stage / 'energy.json').write_text(payload)
            (stage / 'fallback.svg').write_text(static_svg(dataset))
            (stage / 'fallback.html').write_text(fallback)
            manifest = {k: v for k, v in dataset.items() if k not in ('observations', 'countries')}
            manifest['sources'] = [{'provider': 'World Bank', 'indicator': code, 'url': f'https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&per_page=20000&date=1990:2025', 'upstream': upstream, 'license': 'CC BY 4.0'} for code, upstream in [(ELECTRICITY, 'IEA'), (INCOME, 'ICP / World Bank')]]
            manifest['countryMetadataUrl'] = 'https://api.worldbank.org/v2/country?format=json&per_page=400'
            (stage / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
            stage.rename(target)
        finally:
            if stage.exists(): shutil.rmtree(stage)
    archive = root / 'research-data/development' / dataset['snapshotId']
    archive.mkdir(parents=True, exist_ok=True)
    for code, response in responses.items():
        (archive / f'{code}.json.gz').write_bytes(gzip.compress(canonical(response).encode(), mtime=0))
    include = root / '_includes/generated/energy-income.html'
    include.parent.mkdir(parents=True, exist_ok=True)
    include.write_text(fallback)
    pointer = {'schemaVersion': 1, 'current': dataset['snapshotId'], 'snapshots': sorted(p.name for p in parent.iterdir() if p.is_dir() and not p.name.startswith('.'))}
    (parent / 'index.json').write_text(json.dumps(pointer, indent=2) + '\n')
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--responses', type=Path, required=True)
    parser.add_argument('--retrieved-at', required=True)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    responses = {}
    for code in ('countries', ELECTRICITY, INCOME):
        path = args.responses / f'{code}.json'
        responses[code] = json.loads(path.read_text() if path.exists() else gzip.decompress(path.with_suffix('.json.gz').read_bytes()))
    dataset = build_dataset(responses, args.retrieved_at)
    print(publish_snapshot(dataset, responses, args.root))
