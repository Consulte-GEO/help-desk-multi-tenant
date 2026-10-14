#!/usr/bin/env python3
"""Check selected semantic token pairs, not whole-page WCAG conformance."""
from __future__ import annotations
import json, re, sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
css=(root/'web/design-tokens.css').read_text()
blocks=re.findall(r'(:root[^{}]*)\{([^{}]+)\}',css)
read=lambda s:dict(re.findall(r'(--[\w-]+)\s*:\s*([^;]+);',s))
common={}
for selector,body in blocks:
 if selector.strip()==':root[data-helpdesk-ds]': common.update(read(body))
brand=next(read(body) for selector,body in blocks if '[data-brand="consulte-geo"]' in selector)
dark=next(read(body) for selector,body in blocks if '[data-theme="dark"]' in selector and ':not' not in selector)
def resolve(value,tokens,depth=0):
 if depth>10:raise ValueError('cyclic token')
 return resolve(tokens[value[4:-1]],tokens,depth+1) if value.startswith('var(') else value

def luminance(color):
 if not re.fullmatch(r'#[0-9a-fA-F]{6}',color):raise ValueError('opaque sRGB only: '+color)
 rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
 rgb=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in rgb]
 return sum(a*b for a,b in zip(rgb,[.2126,.7152,.0722]))

def contrast(a,b):
 x,y=sorted([luminance(a),luminance(b)])
 return (y+.05)/(x+.05)
checks=[]
for theme in ['light','dark']:
 tokens={**common,**brand,**(dark if theme=='dark' else {})}
 pairs=[(fg,bg,4.5) for fg in ['--hd-ink','--hd-muted','--hd-subtle','--hd-brand-fg'] for bg in ['--hd-paper','--hd-surface','--hd-surface-2']]
 pairs += [(f'--hd-{tone}-fg',f'--hd-{tone}-bg',4.5) for tone in ['success','warning','danger','info','neutral']]
 pairs += [('--hd-nav-ink','--hd-nav',4.5),('--hd-nav-muted','--hd-nav',4.5),('--hd-nav-muted','--hd-nav-raised',4.5),('--hd-control-line','--hd-surface',3),('--hd-focus','--hd-surface',3)]
 for fg,bg,minimum in pairs:
  a,b=resolve(tokens[fg],tokens),resolve(tokens[bg],tokens);ratio=contrast(a,b)
  checks.append(dict(theme=theme,foreground=fg,background=bg,colors=[a,b],ratio=round(ratio,4),minimum=minimum,passed=ratio>=minimum))
# Gradient stop checks; disabled controls excluded. Not a raster/entire-gradient audit.
for color in ['#182863','#3E2D71','#C5117E']:
 ratio=contrast('#FFFFFF',color)
 checks.append(dict(theme='both',foreground='#FFFFFF',background='gradient stop',colors=['#FFFFFF',color],ratio=round(ratio,4),minimum=4.5,passed=ratio>=4.5))
report=dict(scope='Selected opaque semantic pairs and gradient stops; not full WCAG certification, images, alpha compositing or every rendered state.',checks=checks,passed=sum(c['passed'] for c in checks),failed=sum(not c['passed'] for c in checks))
print(json.dumps(report,ensure_ascii=False,indent=2));sys.exit(1 if report['failed'] else 0)
