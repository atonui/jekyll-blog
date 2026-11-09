import copy
import json
import tempfile
import unittest
import subprocess
import sys
from pathlib import Path

from test_energy import fixture, CODES
from suite import build_suite, publish_suite, figure_rows, static_svg


def suite_fixture():
    f = fixture()
    for code, value in [('SP.POP.TOTL', 500000), ('IP.JRN.ARTC.SC', 2.5)]:
        rows = [{'countryiso3code': c, 'date': '2024', 'value': value} for c in CODES]
        f[code] = [{'pages': 1, 'page': 1, 'total': len(rows), 'lastupdated': '2026-10-08'}, rows]
    f['atlas_countries'] = {'data': {'locationCountry': [{'countryId': 'country-'+str(i), 'iso3Code': c, 'nameEn': c} for i,c in enumerate(CODES)]}}
    rows = [{'countryId': 'country-'+str(i), 'year': 2024, 'eci': -.5 if c == 'KEN' else 1.2} for i,c in enumerate(CODES)]
    f['atlas_eci'] = {'data': {'countryYear': rows}}
    f['atlas_probe'] = {'data': {'countryYear': copy.deepcopy(rows)}}
    return f


class SuiteTests(unittest.TestCase):
    def test_cli_rebuilds_from_the_published_compressed_archive(self):
        f=suite_fixture();d=build_suite(f,'2026-11-09T18:25:00Z')
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)/'original';publish_suite(d,f,root)
            target=Path(tmp)/'rebuilt'
            result=subprocess.run([sys.executable,str(Path(__file__).with_name('suite.py')),'--responses',str(root/'research-data/development'/d['snapshotId']),'--retrieved-at',d['retrievedAt'],'--root',str(target)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(json.loads((target/'assets/data/development'/d['snapshotId']/'suite.json').read_text()),d)

    def test_static_science_marks_isolated_historical_observations(self):
        d=build_suite(suite_fixture(),'2026-11-09T18:25:00Z')
        original=next(r for r in d['observations'] if r['country']=='KEN' and r['year']==2024)
        for year,papers in [(2020,2.5),(2021,None),(2022,3.5),(2023,None)]:
            row=dict(original,year=year,papers=papers,papersPerMillion=None if papers is None else papers*2);d['observations'].append(row)
        d['domains']['year']['linear']=[2020,2024]
        d['domains']['papersPerMillion']['log']=[1,10]
        f=dict(d['figures']['science'],years=[2020,2021,2022,2023,2024])
        svg=static_svg(d,f)
        self.assertIn('KEN · 2022',svg)

    def test_preserves_signed_complexity_and_fractional_same_year_publications(self):
        d = build_suite(suite_fixture(), '2026-11-09T18:25:00Z')
        kenya = next(r for r in d['observations'] if r['country']=='KEN' and r['year']==2024)
        self.assertEqual(kenya['complexity'], -.5)
        self.assertEqual(kenya['papers'], 2.5)
        self.assertEqual(kenya['papersPerMillion'], 5)
        self.assertIsNone(next(r for r in d['observations'] if r['country']=='USA' and r['year']==2025)['papers'])
        self.assertEqual(d['figures']['complexity-income']['defaultYear'], 2024)

    def test_zero_or_missing_population_keeps_total_but_not_per_million(self):
        for population in [0, None]:
            f=suite_fixture();f['SP.POP.TOTL'][1][0]['value']=population
            d=build_suite(f,'2026-11-09T18:25:00Z')
            row=next(r for r in d['observations'] if r['country']=='KEN' and r['year']==2024)
            self.assertEqual(row['papers'],2.5);self.assertIsNone(row['papersPerMillion'])
            self.assertIsNone(d['figures']['science-complexity']['defaultYear'])
            self.assertEqual(d['figures']['complexity-income']['defaultYear'],2024)

    def test_rejects_graphql_errors_duplicate_keys_incomplete_probe_and_unknown_ids(self):
        mutations=[
          lambda f:f['atlas_eci'].update(errors=[{'message':'partial error'}]),
          lambda f:f['atlas_eci']['data']['countryYear'].append(copy.deepcopy(f['atlas_eci']['data']['countryYear'][0])),
          lambda f:f['atlas_probe']['data']['countryYear'].pop(),
          lambda f:f['atlas_eci']['data']['countryYear'][0].update(countryId='unknown'),
          lambda f:f['atlas_eci']['data']['countryYear'][0].update(eci=float('nan')),
        ]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                f=suite_fixture();mutate(f)
                with self.assertRaises(ValueError):build_suite(f,'2026-11-09T18:25:00Z')

    def test_optional_comparator_never_blocks_a_complexity_figure(self):
        f=suite_fixture()
        for source in ['atlas_eci','atlas_probe']:
            f[source]['data']['countryYear']=[r for r in f[source]['data']['countryYear'] if r['countryId']!='country-5']
        d=build_suite(f,'2026-11-09T18:25:00Z')
        self.assertEqual(d['figures']['complexity-income']['defaultYear'],2024)
        self.assertEqual(d['figures']['trajectories']['defaultYear'],2024)

    def test_publishing_is_immutable_escaped_and_leaves_energy_catalogue_untouched(self):
        f=suite_fixture();d=build_suite(f,'2026-11-09T18:25:00Z')
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);p=root/'assets/data/development/index.json';p.parent.mkdir(parents=True);p.write_text('original energy catalogue')
            target=publish_suite(d,f,root)
            self.assertEqual(p.read_text(),'original energy catalogue')
            fallback=(target/'complexity-income.html').read_text()
            self.assertIn('&lt;Kenya&gt;',fallback);self.assertNotIn('<Kenya>',fallback)
            self.assertIn('-0.5',fallback)
            self.assertEqual(json.loads((target/'suite.json').read_text())['snapshotId'],d['snapshotId'])
            before={str(p):p.read_bytes() for p in root.rglob('*') if p.is_file()}
            publish_suite(d,f,root)
            self.assertEqual(before,{str(p):p.read_bytes() for p in root.rglob('*') if p.is_file()})
            changed=copy.deepcopy(d);changed['observations'][0]['income']=99
            with self.assertRaises(ValueError):publish_suite(changed,f,root)


if __name__=='__main__':unittest.main()
