from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent.parent
dist=root/'dist'
paths=['index.html','style.css','app.js','data.js','offline.js','manifest.webmanifest','icon.svg','icon-180.png','icon-192.png','icon-512.png','icon-maskable.png','fonts/golos-regular.ttf','fonts/golos-bold.ttf','fonts/OFL.txt']
files=[{'path':p,'sha256':hashlib.sha256((dist/p).read_bytes()).hexdigest()} for p in paths]
template=(root/'scripts/service-worker.template.js').read_text()
version=hashlib.sha256((template+json.dumps(files,sort_keys=True)).encode()).hexdigest()[:20]
worker=template.replace("__RELEASE_VERSION__",version).replace('__RELEASE_FILES__',json.dumps(files,ensure_ascii=False,separators=(',',':')))
(dist/'sw.js').write_text(worker)
print(json.dumps({'version':version,'assets':len(files),'bytes':sum((dist/p).stat().st_size for p in paths)}))
