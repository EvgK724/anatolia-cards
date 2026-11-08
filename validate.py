from pathlib import Path
import re,json
p=Path(__file__).parent;d=p/'dist'
s=(d/'data.js').read_text();a,b=s.split(';\nexport const sources = ');cards=json.loads(a.removeprefix('export const cards = '));sources=json.loads(b.rstrip(';\n'))
assert len(cards)==15 and len({c['id'] for c in cards})==15
assert all(c['source'] in {s['id'] for s in sources} for c in cards)
assert all(len(c['body'].split()) <= 43 for c in cards)
assert all(s['url'].startswith('https://') for s in sources)
for f in [*d.glob('*.html'),*d.glob('*.js'),*d.glob('*.css'),*d.glob('*.webmanifest'),p/'README.md',p/'SOURCES.md']:
 assert not re.search('[\u2014\u2015\u2e3a\u2e3b]',f.read_text()),f
m=json.loads((d/'manifest.webmanifest').read_text())
for i in m['icons']:assert (d/i['src']).is_file()
assert (d/'sw.js').is_file()
assert m['id']==m['scope']==m['start_url']=='./'
assert (d/'fonts/OFL.txt').is_file()
css=(d/'style.css').read_text()
def lum(h):
 c=[int(h[i:i+2],16)/255 for i in (1,3,5)];c=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c];return sum(a*b for a,b in zip(c,[.2126,.7152,.0722]))
contrast={}
for name,bg,ink in re.findall(r'body\[data-theme=(\w+)\]\{--bg:(#[0-9a-f]+);--ink:(#[0-9a-f]+)',css):
 ratio=(lum(ink)+.05)/(lum(bg)+.05);contrast[name]=round(ratio,2);assert ratio>=4.5,(name,ratio)
 assert lum(bg)<.12,(name,bg)
assert len(contrast)==7
print(json.dumps({'cards':len(cards),'sources':len(sources),'dark_palette_contrast':contrast,'forbidden_dashes':0,'checks':'PASS'},ensure_ascii=False,indent=2))
