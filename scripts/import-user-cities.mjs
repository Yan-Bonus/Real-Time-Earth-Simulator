import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
const folder='scripts/data/user-cities-826'
export const normalizedName=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/市$/,'').replace(/[^\p{L}\p{N}]/gu,'')
export const asciiName=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()
export function distanceKm(a,b){const r=Math.PI/180,dlat=(a.latitude-b.latitude)*r,dlon=(a.longitude-b.longitude)*r,h=Math.sin(dlat/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(dlon/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,h)))}
export function matchCity(record,features){
 const exact=features.filter(f=>record.wikidata_id&&f.properties.WIKIDATAID===record.wikidata_id)
 if(exact.length===1){const f=exact[0],km=distanceKm(record,{longitude:f.geometry.coordinates[0],latitude:f.geometry.coordinates[1]});if(km<=200)return {feature:f,reason:'wikidata',distanceKm:km}}
 const names=new Set([record.name_en,record.name_zh,...record.aliases].map(normalizedName).filter(Boolean))
 const candidates=features.filter(f=>{const p=f.properties;const countryMatch=[p.ADM0_A3,p.SOV_A3].includes(record.country.iso3)||normalizedName(p.ADM0NAME)===normalizedName(record.country.name_en)||record.country.iso3==='CHN'&&['TWN','HKG','MAC'].includes(p.ADM0_A3);return countryMatch&&[p.NAME,p.NAME_EN,p.NAMEASCII,p.NAME_ZH,p.NAMEALT].some(name=>name&&names.has(normalizedName(name)))})
 const close=candidates.map(feature=>({feature,reason:'country-name-location',distanceKm:distanceKm(record,{longitude:feature.geometry.coordinates[0],latitude:feature.geometry.coordinates[1]})})).filter(x=>x.distanceKm<=80).sort((a,b)=>a.distanceKm-b.distanceKm)
 return close.length===1?close[0]:null
}
export async function importUserCities(){
 const manifest=JSON.parse(await readFile(folder+'/manifest.json','utf8'))
 for(const f of manifest.files){if(!/^[A-Za-z0-9.-]+$/.test(f.path))throw Error('Unexpected manifest path');const bytes=await readFile(folder+'/'+f.path);if(bytes.length!==f.bytes||createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw Error('Package integrity failed: '+f.path)}
 const records=JSON.parse(await readFile(folder+'/cities.json','utf8')),lines=(await readFile(folder+'/cities.jsonl','utf8')).trim().split(/\r?\n/).map(s=>JSON.parse(s));if(JSON.stringify(records)!==JSON.stringify(lines)||records.length!==826)throw Error('826-record sources disagree')
 const features=JSON.parse(await readFile('scripts/data/ne_50m_populated_places.geojson','utf8')).features
 const data=JSON.parse(await readFile('src/data/cities.json','utf8')),byId=new Map(data.map(c=>[c.id,c])),inputIds=new Set(),audit=[]
 for(const c of data){delete c.referenceIds}
 for(const record of records){if(inputIds.has(record.id)||!Number.isFinite(record.longitude)||!Number.isFinite(record.latitude)||Math.abs(record.longitude)>180||Math.abs(record.latitude)>90||record.coordinate_reference_system!=='EPSG:4326'||!asciiName(record.name_en))throw Error('Invalid city record: '+record.id);inputIds.add(record.id)
 const match=matchCity(record,features),matched=match&&byId.get('ne-'+match.feature.properties.NE_ID);let city=matched??byId.get('ref-'+record.id)
 if(!city){city={id:'ref-'+record.id,name:asciiName(record.name_en),localName:record.name_zh,country:record.country.name_en,longitude:record.longitude,latitude:record.latitude,rank:record.selection.is_capital?2:record.selection.urban_agglomeration_population_2025>=10000000?3:6,population:record.selection.urban_agglomeration_population_2025??0,source:'用户城市参考数据'};data.push(city);byId.set(city.id,city)}
 city.displayName=record.scope==='china'?record.name_zh.replace(/市$/,''):record.name_zh;city.localName=record.name_zh;city.countryLabel=record.country.name_zh;city.isCapital=record.selection.is_capital;
 city.referenceIds=[...city.referenceIds??[],record.id]
 audit.push({referenceId:record.id,name:record.name_en,cityId:city.id,action:matched?'existing':'added',matchReason:match?.reason??null,distanceKm:match?.distanceKm??null,coordinateRole:record.coordinate_role,coordinateSource:record.coordinate_source})
 }
 // Preserve explicit administrative attributes; scalerank remains a display filter only.
 const featureById=new Map(features.map(f=>['ne-'+f.properties.NE_ID,f.properties]))
 const recordById=new Map(records.map(r=>[r.id,r]))
 for(const city of data){
   const raw=featureById.get(city.id),record=city.referenceIds?.map(id=>recordById.get(id)).find(Boolean),classification=raw?.FEATURECLA??''
   const capital=record?record.selection.is_capital:raw?.ADM0CAP===1||classification==='Admin-0 capital'||classification==='Admin-0 capital alt'
   const regional=['Admin-1 capital','Admin-1 region capital','Admin-0 region capital'].includes(classification)||['municipality','special_administrative_region','taiwan_municipality'].includes(record?.admin_level)
   city.adminRole=capital?'capital':regional?'regional':'other';city.isCapital=capital
   if(record?.admin_level)city.adminLevel=record.admin_level;else delete city.adminLevel
   city.adminSource=[record&&'用户826城行政属性',raw&&'Natural Earth FEATURECLA/ADM0CAP'].filter(Boolean).join(' + ')
 }
 data.sort((a,b)=>a.rank-b.rank||b.population-a.population);await writeFile('src/data/cities.json',JSON.stringify(data));const report={input:records.length,existing:audit.filter(c=>c.action==='existing').length,added:audit.filter(c=>c.action==='added').length,total:data.length,sourceSha256:manifest.files.find(f=>f.path==='cities.json').sha256,policy:'Keep existing Natural Earth IDs/positions; match Wikidata or unambiguous same-country name within 80km; preserve all reference IDs; no nearest-neighbor-only merge',records:audit};await writeFile('scripts/data/user-cities-826/import-report.json',JSON.stringify(report,null,2));return report
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const r=await importUserCities();console.log({input:r.input,existing:r.existing,added:r.added,total:r.total,wideMatches:r.records.filter(x=>x.distanceKm>40)})}
