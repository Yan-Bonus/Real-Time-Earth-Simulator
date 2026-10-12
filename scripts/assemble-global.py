from PIL import Image
from pathlib import Path
import json, hashlib
root=Path(__file__).resolve().parent.parent
atlas=Image.new('RGB',(4096,2048))
for row in range(8):
 for col in range(16):
  with Image.open(root/'test-results/global-tiles'/f'{row}-{col}.jpg') as tile:
   if tile.size != (256,256): raise ValueError('Invalid tile dimensions')
   atlas.paste(tile,(col*256,row*256))
# Lossless assembly preserves the original decoded JPEG pixels.
p=root/'public/imagery/eox-2024-global.png'
atlas.save(p,optimize=True)
manifest_path=root/'public/imagery/global-manifest.json'
manifest=json.loads(manifest_path.read_text(encoding='utf8'))
manifest['atlas']={'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print(f'Global atlas: {p.stat().st_size} bytes, 4096x2048')
