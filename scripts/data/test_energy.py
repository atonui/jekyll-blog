"""Catch wrong joins, misleading missing values, and irreproducible snapshots."""
import copy
import json
import tempfile
import unittest
from pathlib import Path

from energy import build_dataset, publish_snapshot


CODES = ['KEN', 'CHN', 'BRA', 'DEU', 'USA', 'LUX', 'ZAF', 'IND', 'UGA', 'TZA']


def fixture():
    countries = [{'id': c, 'name': '<Kenya>' if c == 'KEN' else c,
                  'region': {'id': 'SSF', 'value': 'Sub-Saharan Africa'}} for c in CODES]
    countries.append({'id': 'WLD', 'name': 'World', 'region': {'id': 'NA', 'value': 'Aggregates'}})
    result = {'countries': [{'pages': 1, 'page': 1, 'total': 11}, countries]}
    for code, value in [('EG.USE.ELEC.KH.PC', 200), ('NY.GDP.PCAP.PP.KD', 6000)]:
        rows = [{'countryiso3code': c, 'date': str(y), 'value': value}
                for y, codes in [(2024, CODES + ['WLD']), (2025, ['USA', 'LUX'])] for c in codes]
        result[code] = [{'pages': 1, 'page': 1, 'total': len(rows), 'lastupdated': '2026-10-08'}, rows]
    return result


class EnergyTests(unittest.TestCase):
    def test_no_qualifying_year_has_an_explicit_unavailable_fallback(self):
        f = fixture(); f['EG.USE.ELEC.KH.PC'][1][0]['value'] = None
        d = build_dataset(f, '2026-11-09T17:13:49Z')
        self.assertIsNone(d['defaultYear'])
        with tempfile.TemporaryDirectory() as tmp:
            path = publish_snapshot(d, f, Path(tmp))
            svg = (path / 'fallback.svg').read_text()
            fallback = (path / 'fallback.html').read_text()
            self.assertIn('Comparison unavailable', svg)
            self.assertIn('No sufficiently covered observation year', fallback)
            self.assertNotIn('None', svg + fallback)

    def test_joins_by_country_and_year_and_excludes_aggregates(self):
        data = build_dataset(fixture(), '2026-11-09T17:13:49Z')
        self.assertEqual(data['defaultYear'], 2024)
        self.assertEqual(data['coverage']['2024'], 10)
        self.assertEqual(data['coverage']['2025'], 2)
        self.assertNotIn('WLD', [c['code'] for c in data['countries']])
        self.assertEqual(data['observations'][0], {'country': 'BRA', 'year': 2024, 'electricity': 200, 'income': 6000})

    def test_null_stays_missing_and_zero_is_preserved(self):
        f = fixture()
        f['EG.USE.ELEC.KH.PC'][1][0]['value'] = None
        f['EG.USE.ELEC.KH.PC'][1][1]['value'] = 0
        d = build_dataset(f, '2026-11-09T17:13:49Z')
        rows = {r['country']: r for r in d['observations'] if r['year'] == 2024}
        self.assertIsNone(rows['KEN']['electricity'])
        self.assertEqual(rows['CHN']['electricity'], 0)
        self.assertEqual(d['coverage']['2024'], 9)
        self.assertNotIn(2025, [r['year'] for r in d['observations'] if r['country'] == 'KEN'])

    def test_rejects_duplicate_partial_and_invalid_provider_data(self):
        for mutate in [
            lambda f: f['EG.USE.ELEC.KH.PC'][0].update(pages=2),
            lambda f: f['EG.USE.ELEC.KH.PC'][0].update(total=99),
            lambda f: f['EG.USE.ELEC.KH.PC'][1].__setitem__(0, copy.deepcopy(f['EG.USE.ELEC.KH.PC'][1][1])),
            lambda f: f['EG.USE.ELEC.KH.PC'][1][0].update(value=-1),
            lambda f: f['NY.GDP.PCAP.PP.KD'][1][0].update(value=float('inf')),
        ]:
            with self.subTest(mutation=mutate):
                f = fixture(); mutate(f)
                with self.assertRaises(ValueError): build_dataset(f, '2026-11-09T17:13:49Z')

    def test_static_output_is_safe_immutable_and_from_same_snapshot(self):
        f = fixture(); d = build_dataset(f, '2026-11-09T17:13:49Z')
        self.assertEqual(d['snapshotId'], build_dataset(f, '2026-11-09T17:13:49Z')['snapshotId'])
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); path = publish_snapshot(d, f, root)
            before = {str(p.relative_to(root)): p.read_bytes() for p in root.rglob('*') if p.is_file()}
            publish_snapshot(d, f, root)
            after = {str(p.relative_to(root)): p.read_bytes() for p in root.rglob('*') if p.is_file()}
            self.assertEqual(before, after)
            self.assertEqual(json.loads((path / 'energy.json').read_text())['snapshotId'], d['snapshotId'])
            fallback = (root / '_includes/generated/energy-income.html').read_text()
            self.assertIn('&lt;Kenya&gt;', fallback)
            self.assertNotIn('<Kenya>', fallback)
            self.assertIn(d['snapshotId'], fallback)
            self.assertIn('2024', (path / 'fallback.svg').read_text())
            with self.assertRaises(ValueError):
                changed = copy.deepcopy(d); changed['defaultYear'] = 2025
                publish_snapshot(changed, f, root)


if __name__ == '__main__': unittest.main()
