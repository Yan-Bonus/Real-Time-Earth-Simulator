import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const m=JSON.parse(await readFile('public/imagery/global-manifest.json','utf8')),b=await readFile('public/imagery/'+m.atlas.file)
if(m.tiles.length!==128||m.width!==4096||m.height!==2048||m.tiles.some(t=>t.row<0||t.row>=8||t.col<0||t.col>=16)||new Set(m.tiles.map(t=>t.row+'/'+t.col)).size!==128||b.length!==m.atlas.bytes||createHash('sha256').update(b).digest('hex')!==m.atlas.sha256)throw Error('Incomplete global resource package')
if(b.readUInt32BE(16)!==4096||b.readUInt32BE(20)!==2048)throw Error('Invalid atlas dimensions')
console.log('Bundled global atlas verified: 128 tiles, 4096x2048, '+b.length+' bytes')
