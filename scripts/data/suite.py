"""Build the remaining development essay figures from archived provider responses."""
import argparse
import copy
import gzip
import hashlib
import html
import json
import math
from pathlib import Path
import shutil
import tempfile

from energy import build_dataset, canonical, records, ELECTRICITY, INCOME, REQUIRED

POPULATION = 'SP.POP.TOTL'
PAPERS = 'IP.JRN.ARTC.SC'
UNITS = {'electricity': 'kWh per person per year', 'income': 'PPP, constant 2021 international $',
         'population': 'people', 'papers': 'fractional publication count',
         'papersPerMillion': 'fractional publications per million people', 'complexity': 'HS92 goods-based ECI', 'year': 'observation year'}
LABELS = {'electricity':'Electricity consumption','income':'Income per person','complexity':'Economic complexity',
          'papers':'Scientific output','papersPerMillion':'Scientific output','year':'Year'}
FIGURES = {
 'trajectories': {'order':2,'title':'How economies move','subtitle':'Follow electricity use and income through time.','kind':'trajectory','x':'electricity','y':'income','required':list(REQUIRED),'countries':list(REQUIRED),'scale':'log','science':False,'source':'World Bank / IEA'},
 'complexity-income': {'order':3,'title':'Know-how and prosperity','subtitle':'How does the complexity of goods exports relate to income?','kind':'scatter','x':'complexity','y':'income','required':['KEN'],'countries':['KEN'],'scale':'log','science':False,'source':'World Bank / Harvard Growth Lab'},
 'science': {'order':4,'title':'Scientific output, in perspective','subtitle':'Compare publication output with and without adjusting for population.','kind':'series','x':'year','y':'science','required':['KEN'],'countries':['KEN','CHN','IND','BRA','DEU','USA'],'scale':'log','science':True,'source':'World Bank / NSF'},
 'energy-complexity': {'order':5,'title':'Power and productive capabilities','subtitle':'Explore electricity consumption alongside the complexity of goods exports.','kind':'scatter','x':'electricity','y':'complexity','required':['KEN'],'countries':['KEN'],'scale':'log','science':False,'source':'World Bank / IEA / Harvard Growth Lab'},
 'science-complexity': {'order':6,'title':'Research and economic complexity','subtitle':'Does greater publication output accompany more complex goods exports?','kind':'scatter','x':'science','y':'complexity','required':['KEN'],'countries':['KEN'],'scale':'log','science':True,'source':'World Bank / NSF / Harvard Growth Lab'},
}


def metric_key(metric, mode='perMillion'):
    return ('papers' if mode == 'total' else 'papersPerMillion') if metric == 'science' else metric


def valid_number(value, signed=False):
    return value is None or (not isinstance(value,bool) and isinstance(value,(int,float)) and math.isfinite(value) and (signed or value >= 0))


def graphql_rows(response, key):
    if not isinstance(response,dict) or response.get('errors') or not isinstance(response.get('data',{}).get(key),list):
        raise ValueError('Incomplete or failed Atlas GraphQL response')
    return response['data'][key]


def build_suite(responses: dict, retrieved_at: str) -> dict:
    base = build_dataset({k:responses[k] for k in ('countries',ELECTRICITY,INCOME)},retrieved_at)
    countries = {c['code']:c for c in base['countries']}
    by_key = {(r['country'],r['year']):dict(r, population=None,papers=None,papersPerMillion=None,complexity=None) for r in base['observations']}
    def entry(country,year):
        return by_key.setdefault((country,year),{'country':country,'year':year,'electricity':None,'income':None,'population':None,'papers':None,'papersPerMillion':None,'complexity':None})
    for indicator,measure in [(POPULATION,'population'),(PAPERS,'papers')]:
        seen=set()
        for row in records(responses[indicator]):
            country=row['countryiso3code']
            if country not in countries:continue
            year=int(row['date']);key=(country,year);value=row['value']
            if key in seen or not 1960<=year<=2100 or not valid_number(value):raise ValueError('Invalid or duplicate World Bank observation')
            seen.add(key);entry(country,year)[measure]=value
    mapping={}
    for row in graphql_rows(responses['atlas_countries'],'locationCountry'):
        if row['countryId'] in mapping:raise ValueError('Duplicate Atlas country identifier')
        mapping[row['countryId']]=row['iso3Code']
    atlas=graphql_rows(responses['atlas_eci'],'countryYear')
    probe=graphql_rows(responses['atlas_probe'],'countryYear')
    if not atlas or not probe:raise ValueError('Empty Atlas batch')
    def atlas_keys(rows):
        keys=set();result=set()
        for row in rows:
            key=(row['countryId'],row['year'])
            if key in keys or row['countryId'] not in mapping or not isinstance(row['year'],int) or not valid_number(row['eci'],signed=True):
                raise ValueError('Invalid or duplicate Atlas observation')
            keys.add(key);result.add((*key,row['eci']))
        return result
    all_keys=atlas_keys(atlas);probe_keys=atlas_keys(probe)
    latest=max(r['year'] for r in atlas)
    if any(r['year']!=latest for r in probe) or {r for r in all_keys if r[1]==latest}!=probe_keys:
        raise ValueError('Atlas latest-year completeness probe disagrees with batch')
    unmapped=set()
    for row in atlas:
        country=mapping[row['countryId']]
        if country not in countries:unmapped.add(country);continue
        entry(country,row['year'])['complexity']=row['eci']
    observations=[by_key[k] for k in sorted(by_key)]
    for row in observations:
        if row['papers'] is not None and row['population'] is not None and row['population']>0:
            row['papersPerMillion']=row['papers']*1000000/row['population']
    domains={}
    for measure in UNITS:
        values=[r[measure] for r in observations if r.get(measure) is not None]
        if not values:continue
        lo,hi=min(values),max(values);pad=(hi-lo)*.06 if hi!=lo else max(abs(hi)*.1,1)
        linear=[lo-pad,hi+pad] if measure=='complexity' else [0,hi+pad]
        if measure=='year':linear=[lo,hi] if lo!=hi else [lo-1,hi+1]
        positive=[v for v in values if v>0]
        domains[measure]={'linear':linear,'log':[min(positive)*.8,max(positive)*1.2] if positive else None}
    figures={}
    for figure_id,config in FIGURES.items():
        figure=copy.deepcopy(config);figure['id']=figure_id
        x,y=[metric_key(config[k]) for k in ('x','y')]
        complete=[r for r in observations if r[x] is not None and r[y] is not None]
        years=sorted({r['year'] for r in complete})
        coverage={str(year):sum(r['year']==year for r in complete) for year in years}
        threshold=max((coverage[str(year)] for year in years[-5:]),default=0)*.9
        eligible=[year for year in years if coverage[str(year)]>=threshold and all(any(r['year']==year and r['country']==c for r in complete) for c in config['required'])]
        figure.update(years=years,coverage=coverage,defaultYear=max(eligible) if eligible else None)
        figures[figure_id]=figure
    checksums={k:hashlib.sha256(canonical(v).encode()).hexdigest() for k,v in sorted(responses.items())}
    identity={'schemaVersion':1,'countries':base['countries'],'observations':observations,'figures':figures,'domains':domains,'rawChecksums':checksums}
    digest=hashlib.sha256(canonical(identity).encode()).hexdigest()[:12]
    return dict(identity,snapshotId=f'{retrieved_at[:10]}-{digest}',retrievedAt=retrieved_at,units=UNITS,labels=LABELS,
                mappingVersion='exact-iso3-v1',unmappedAtlasCodes=sorted(unmapped),classification='HS92',
                sourceUpdatedAt=responses[ELECTRICITY][0].get('lastupdated'),atlasLatestYear=latest)


def figure_rows(dataset,figure,mode='perMillion'):
    x,y=[metric_key(figure[k],mode) for k in ('x','y')]
    year=figure['defaultYear']
    if year is None:return []
    return [r for r in dataset['observations'] if (r['year']==year if figure['kind']=='scatter' else r['country'] in figure['countries'] and min(figure['years'])<=r['year']<=year) and (r[x] is not None or r[y] is not None)]


def static_svg(dataset,figure):
    esc=html.escape;year=figure['defaultYear'];title=esc(figure['title'])
    if year is None:return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 180" role="img"><title>{title}: unavailable</title><text x="24" y="80" font-family="Arial" font-size="24">No sufficiently covered observation year.</text></svg>'
    x,y=[metric_key(figure[k]) for k in ('x','y')]
    def scale(measure):return 'linear' if measure in ('year','complexity') else figure['scale']
    def domain(measure):
        if measure=='year':
            lo,hi=figure['years'][0],figure['years'][-1]
            return [lo,hi] if lo!=hi else [lo-1,hi+1]
        return dataset['domains'][measure][scale(measure)]
    def position(value,measure,a,b):
        mode=scale(measure);lo,hi=domain(measure);f=math.log10 if mode=='log' else lambda n:n
        return a+(f(value)-f(lo))/(f(hi)-f(lo))*(b-a)
    def valid(r):return all(r[m] is not None and (scale(m)!='log' or r[m]>0) for m in (x,y))
    rows=figure_rows(dataset,figure)
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 650" role="img"><title>{title} · {year}</title><rect width="1080" height="650" fill="white"/><g font-family="Arial,sans-serif" font-size="16" fill="#536171">']
    for measure,vertical in [(x,False),(y,True)]:
        lo,hi=domain(measure)
        ticks=[10**e for e in range(math.ceil(math.log10(lo)),math.floor(math.log10(hi))+1)] if scale(measure)=='log' else [lo+(hi-lo)*i/4 for i in range(5)]
        for v in ticks:
            p=position(v,measure,540,1030) if not vertical else position(v,measure,525,45)
            if not vertical:p=position(v,measure,85,1030)
            label=str(round(v)) if measure=='year' else f'{v:,.2f}'.rstrip('0').rstrip('.') if abs(v)<1000 else f'{v/1000:,.1f}k'
            if vertical:parts.append(f'<path d="M85,{p:.2f}H1030" stroke="#e7ecf0"/><text x="72" y="{p+5:.2f}" text-anchor="end">{label}</text>')
            else:parts.append(f'<path d="M{p:.2f},45V525" stroke="#e7ecf0"/><text x="{p:.2f}" y="556" text-anchor="middle">{label}</text>')
    palette=['#ba4a22','#245b8c','#7554a0','#9a6939','#43697a','#92576c'];codes=[c['code'] for c in dataset['countries'] if c['code']!='KEN']
    def colour(code):return palette[0] if code=='KEN' else palette[1+codes.index(code)%5]
    if figure['kind']=='scatter':
        for r in sorted(rows,key=lambda r:r['country'] in figure['countries']):
            if not valid(r):continue
            px,py=position(r[x],x,85,1030),position(r[y],y,525,45);selected=r['country'] in figure['countries']
            parts.append(f'<circle cx="{px:.2f}" cy="{py:.2f}" r="5" fill="{colour(r["country"]) if selected else "#b7c3ce"}" stroke="white"/>')
            if selected:parts.append(f'<text x="{px+10:.2f}" y="{py-10:.2f}" fill="{colour(r["country"])}">{r["country"]}</text>')
    else:
        endpoint_labels=[]
        for country in figure['countries']:
            series=sorted([r for r in rows if r['country']==country],key=lambda r:r['year']);path=[];last=None
            valid_years={r['year'] for r in series if valid(r)}
            for r in series:
                if not valid(r):last=None;continue
                px,py=position(r[x],x,85,1030),position(r[y],y,525,45)
                path.append(f'{"L" if last is not None and r["year"]==last+1 else "M"}{px:.2f},{py:.2f}');last=r['year']
                isolated=r['year']-1 not in valid_years and r['year']+1 not in valid_years
                first=r['year']==min(valid_years)
                if r['year']==year or isolated or first:
                    fill='white' if first and r['year']!=year else colour(country)
                    parts.append(f'<circle cx="{px:.2f}" cy="{py:.2f}" r="5" fill="{fill}" stroke="{colour(country)}"><title>{country} · {r["year"]}: {r[y]}</title></circle>')
                if r['year']==year:endpoint_labels.append({'country':country,'x':px,'y':py})
            parts.append(f'<path d="{" ".join(path)}" fill="none" stroke="{colour(country)}" stroke-width="2"/>')
        endpoint_labels.sort(key=lambda p:p['y'])
        for i,p in enumerate(endpoint_labels):p['ly']=max(60,p['y']-10,endpoint_labels[i-1]['ly']+20 if i else 60)
        for i in range(len(endpoint_labels)-1,-1,-1):endpoint_labels[i]['ly']=min(endpoint_labels[i]['ly'],515 if i==len(endpoint_labels)-1 else endpoint_labels[i+1]['ly']-20)
        for p in endpoint_labels:
            tx=p['x']-10 if p['x']>990 else p['x']+10
            if abs(p['ly']-p['y'])>20:parts.append(f'<line x1="{p["x"]:.2f}" y1="{p["y"]:.2f}" x2="{tx:.2f}" y2="{p["ly"]-5:.2f}" stroke="{colour(p["country"])}"/>')
            parts.append(f'<text x="{tx:.2f}" y="{p["ly"]:.2f}" text-anchor="{"end" if p["x"]>990 else "start"}" fill="{colour(p["country"])}">{p["country"]}</text>')
    parts.extend([f'<text x="85" y="23">{esc(LABELS[y])} · {esc(UNITS[y])}</text>',f'<text x="1030" y="593" text-anchor="end">{esc(LABELS[x])} · {esc(UNITS[x])}</text>',f'<text x="85" y="631">{year} · {esc(figure["source"])} · ECI axes are linear; other scales: {figure["scale"]}</text></g></svg>'])
    return ''.join(parts)


def fallback_html(dataset,figure):
    esc=html.escape;sid=dataset['snapshotId'];fid=figure['id'];year=figure['defaultYear']
    if year is None:return '<div class="chart-fallback"><p class="chart-static-note">No sufficiently covered observation year meets this comparison’s requirements.</p></div>'
    x,y=[metric_key(figure[k]) for k in ('x','y')];names={c['code']:c['name'] for c in dataset['countries']}
    rows=figure_rows(dataset,figure)
    def cell(v):return 'Unavailable' if v is None else f'{v:,.2f}'.rstrip('0').rstrip('.')
    body=''.join(f'<tr><th scope="row">{esc(names[r["country"]])}</th><td>{r["year"]}</td><td>{cell(r[x])}</td><td>{cell(r[y])}</td></tr>' for r in sorted(rows,key=lambda r:(names[r['country']],r['year'])))
    return (f'<div class="chart-fallback"><div class="chart-static-scroll" tabindex="0" role="region" aria-label="{esc(figure["title"])} static chart"><img src="/assets/data/development/{sid}/{fid}.svg" width="1080" height="650" alt="{esc(figure["title"])} · default year {year}. Exact values are in the table." loading="lazy"></div><p class="chart-static-note">Static view · {year} · snapshot {sid}. Scroll the static chart horizontally on narrow screens, or use the data table.</p></div>'
            f'<details class="chart-data"><summary>View the data table</summary><div class="chart-table-scroll" tabindex="0" role="region" aria-label="{esc(figure["title"])} data"><table><caption>{esc(figure["source"])} · default view through {year}. {esc(UNITS[x])}; {esc(UNITS[y])}. Snapshot {sid}.</caption><thead><tr><th scope="col">Economy</th><th scope="col">Year</th><th scope="col">{esc(LABELS[x])}</th><th scope="col">{esc(LABELS[y])}</th></tr></thead><tbody>{body}</tbody></table></div></details>')


def publish_suite(dataset: dict,responses: dict,root: Path) -> Path:
    root=Path(root);parent=root/'assets/data/development';parent.mkdir(parents=True,exist_ok=True)
    target=parent/dataset['snapshotId'];payload=canonical(dataset)+'\n'
    if target.exists() and (target/'suite.json').read_text()!=payload:raise ValueError('Cannot overwrite immutable suite snapshot')
    if not target.exists():
        stage=Path(tempfile.mkdtemp(prefix='.suite-candidate-',dir=parent))
        try:
            (stage/'suite.json').write_text(payload)
            manifest={k:v for k,v in dataset.items() if k not in ('observations','countries')}
            manifest['sources']={'worldBank':{'provider':'World Bank / IEA / NSF','indicators':[ELECTRICITY,INCOME,POPULATION,PAPERS],'query':'https://api.worldbank.org/v2/country/all/indicator/{indicator}?format=json&per_page=20000&date=1990:2025','license':'CC BY 4.0','retrievedAt':'2026-11-09T17:13:49Z'},'atlas':{'provider':'Harvard Growth Lab, Atlas of Economic Complexity','endpoint':'https://atlas.hks.harvard.edu/api/graphql','query':'{ countryYear(yearMin: 1995, yearMax: 2024, productClass: HS92) { countryId year eci } }','countryQuery':'{ locationCountry { countryId iso3Code nameEn } }','probeQuery':'{ countryYear(yearMin: 2024, yearMax: 2024, productClass: HS92) { countryId year eci } }','classification':'HS92','retrievedAt':dataset['retrievedAt'],'citation':'The Growth Lab at Harvard University. The Atlas of Economic Complexity. https://atlas.hks.harvard.edu','terms':'https://atlas.hks.harvard.edu/data-downloads/'}}
            manifest['methodology']={'papers':'NSF fractional counts; divide by same-year population and multiply by one million. Not a measure of research quality.','complexity':'Goods-export-based ECI, explicit HS92 classification. Not a comprehensive measure of domestic services.','joins':'Exact ISO3 plus year; no name matching or interpolation.','completeness':'Latest Atlas year agrees with an independently requested bounded probe.'}
            (stage/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
            for fid,figure in dataset['figures'].items():
                (stage/f'{fid}.svg').write_text(static_svg(dataset,figure));(stage/f'{fid}.html').write_text(fallback_html(dataset,figure))
            stage.rename(target)
        finally:
            if stage.exists():shutil.rmtree(stage)
    archive=root/'research-data/development'/dataset['snapshotId'];archive.mkdir(parents=True,exist_ok=True)
    for key,response in responses.items():(archive/f'{key}.json.gz').write_bytes(gzip.compress(canonical(response).encode(),mtime=0))
    includes=root/'_includes/generated';includes.mkdir(parents=True,exist_ok=True)
    for fid in dataset['figures']:(includes/f'{fid}.html').write_text((target/f'{fid}.html').read_text())
    old=parent/'suite-index.json';previous=json.loads(old.read_text()) if old.exists() else {'snapshots':[]}
    old.write_text(json.dumps({'schemaVersion':1,'current':dataset['snapshotId'],'snapshots':sorted(set(previous['snapshots']+[dataset['snapshotId']]))},indent=2)+'\n')
    return target


def load_responses(directory):
    directory=Path(directory)
    def read(name):
        plain=directory/f'{name}.json';compressed=directory/f'{name}.json.gz'
        return json.loads(plain.read_text() if plain.exists() else gzip.decompress(compressed.read_bytes()))
    responses={name:read(name) for name in ('countries',ELECTRICITY,INCOME,POPULATION,PAPERS)}
    if (directory/'atlas_countries.json').exists() or (directory/'atlas_countries.json.gz').exists():
        responses.update({name:read(name) for name in ('atlas_countries','atlas_eci','atlas_probe')})
    else:
        responses.update(atlas_countries=read('atlas_probe'),atlas_eci=read('atlas_global_hs92'),atlas_probe=read('atlas_2024_probe'))
    return responses


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--responses',type=Path,required=True);parser.add_argument('--retrieved-at',required=True);parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);args=parser.parse_args()
    responses=load_responses(args.responses)
    result=build_suite(responses,args.retrieved_at);print(publish_suite(result,responses,args.root))
    print(json.dumps({fid:{'defaultYear':f['defaultYear'],'coverage':f['coverage'].get(str(f['defaultYear']))} for fid,f in result['figures'].items()}))
