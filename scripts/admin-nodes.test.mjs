import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const data=JSON.parse(await readFile('src/data/cities.json','utf8')),records=JSON.parse(await readFile('scripts/data/user-cities-826/cities.json','utf8'))
const requireRaw=await readFile('scripts/data/ne_50m_populated_places.geojson','utf8')
test('Administrative roles come from explicit source attributes, independent of population rank',()=>{
 for(const city of data){assert.ok(['capital','regional','other'].includes(city.adminRole));assert.ok(city.adminSource);assert.equal(city.isCapital,city.adminRole==='capital')}
 for(const record of records){const city=data.find(c=>c.referenceIds?.includes(record.id));if(record.admin_level)assert.equal(city.adminLevel,record.admin_level);if(record.selection.is_capital)assert.equal(city.adminRole,'capital');if(['municipality','special_administrative_region','taiwan_municipality'].includes(record.admin_level)&&!record.selection.is_capital)assert.equal(city.adminRole,'regional')}
 assert.equal(data.find(c=>c.name==='Beijing').adminRole,'capital');assert.equal(data.find(c=>c.name==='Shanghai').adminRole,'regional');assert.equal(data.find(c=>c.id==='ne-1159151377').adminRole,'regional');assert.equal(data.find(c=>c.id==='ref-CHN-340800').adminRole,'other')
})
test('Missing administrative attributes are not inferred from display rank or population',()=>{
 const raw=JSON.parse(requireRaw),ordinary=raw.features.filter(f=>['Populated place','Historic place','Scientific station'].includes(f.properties.FEATURECLA)&&f.properties.ADM0CAP!==1)
 for(const f of ordinary){const c=data.find(c=>c.id==='ne-'+f.properties.NE_ID);if(!c.referenceIds?.length)assert.equal(c.adminRole,'other')}
})

