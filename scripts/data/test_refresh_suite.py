import unittest

from refresh_suite import validate_refresh, is_unchanged


def dataset(observations=None):
    observations = observations or [
        {'country':'KEN','year':2023,'electricity':10,'income':20,'population':100,'papers':2,'papersPerMillion':20000,'complexity':-.2},
        {'country':'USA','year':2023,'electricity':30,'income':40,'population':200,'papers':4,'papersPerMillion':20000,'complexity':1.2},
    ]
    return {
        'snapshotId':'2026-11-09-abcd12345678','rawChecksums':{'source':'same'},'observations':observations,
        'figures':{'scatter':{'x':'complexity','y':'income','required':['KEN'],'kind':'scatter','defaultYear':2023,'years':[2023]},
                   'trajectory':{'x':'electricity','y':'income','required':['KEN','USA'],'kind':'trajectory','defaultYear':2023,'years':[2023]}},
    }

def coverage_dataset(observations):
    data=dataset(observations)
    data['figures']={}
    return data


class RefreshValidationTests(unittest.TestCase):
    def test_rejects_more_than_ten_percent_loss_of_existing_measure_keys(self):
        old=coverage_dataset([{'country':f'C{i:02d}','year':2020,'electricity':i+1,'income':i+1,'population':100,'papers':1,'papersPerMillion':10000,'complexity':i/10} for i in range(20)])
        new=coverage_dataset(old['observations'][:17])
        with self.assertRaisesRegex(ValueError,'more than 10%'):
            validate_refresh(old,new)

    def test_accepts_exactly_ten_percent_measure_key_loss(self):
        old=coverage_dataset([{'country':f'C{i:02d}','year':2020,'electricity':i+1,'income':i+1,'population':100,'papers':1,'papersPerMillion':10000,'complexity':i/10} for i in range(20)])
        new=coverage_dataset(old['observations'][:18])
        result=validate_refresh(old,new)
        self.assertEqual(result['lostKeys']['income'],2)

    def test_rejects_loss_of_required_economy_from_comparison(self):
        filler=[{'country':f'C{i:02d}','year':2020,'electricity':i+1,'income':i+1,'population':100,'papers':1,'papersPerMillion':10000,'complexity':i/10} for i in range(20)]
        old=dataset(filler+[dataset()['observations'][0],dataset()['observations'][1]])
        new=dataset(filler+[old['observations'][-1]])
        with self.assertRaisesRegex(ValueError,'required economy'):
            validate_refresh(old,new)

    def test_reports_historical_revisions_without_rejecting_them(self):
        old=dataset()
        revised=[dict(r) for r in old['observations']]
        revised[0]['income']=21
        result=validate_refresh(old,dataset(revised))
        self.assertEqual(result['revisedValues']['income'],1)

    def test_no_change_ignores_provider_order_checksum_only_changes(self):
        self.assertTrue(is_unchanged(dataset(),dataset()))
        changed=dataset();changed['rawChecksums']={'source':'new'}
        self.assertTrue(is_unchanged(dataset(),changed))
        changed['observations'][0]['income']=99
        self.assertFalse(is_unchanged(dataset(),changed))


if __name__=='__main__':
    unittest.main()
