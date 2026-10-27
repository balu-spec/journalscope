"""Attach publisher speed metrics (Elsevier / Springer) to merged.json and write site/data.js"""
import json, os, re, sys
d = json.load(open('merged.json'))
J = d['j']
by = {}
for o in J:
    for i in o['is']: by[i.replace('-', '')] = o

def toint(v):
    if v is None: return None
    try: return int(str(v).replace(',', ''))
    except: return None

n = 0
def attach(rec, src, u):
    global n
    iss = [x for x in (rec.get('on'), rec.get('pr')) if x]
    o = None
    for i in iss:
        o = by.get(i.replace('-', '').upper())
        if o: break
    if not o and rec.get('_k'): o = by.get(rec['_k'])
    if not o: return False
    sp = {'src': src, 'u': u}
    for k in ('fd', 'dar', 'sa', 'ap', 'apc', 'ar'):
        v = toint(rec.get(k))
        if v is not None: sp[k] = v
    if rec.get('fda') and 'fd' not in sp:
        w = toint(rec['fda']); sp['fd'] = w * 7 if w is not None else None
    if rec.get('cs') not in (None, ''):
        try: sp['cs'] = float(rec['cs'])
        except: pass
    if rec.get('dl'): sp['dl'] = rec['dl']
    if rec.get('oa'): sp['oa'] = rec['oa']
    if len(sp) <= 2: return False
    if 'sp' in o and len(o['sp']) >= len(sp): return False
    o['sp'] = sp; n += 1
    return True

if os.path.exists('els_speed.json'):
    E = json.load(open('els_speed.json'))
    for k, rec in E.items():
        if 'u' not in rec: continue
        rec['_k'] = k
        attach(rec, 'e', rec['u'])
if os.path.exists('jf_speed.json'):
    F = json.load(open('jf_speed.json'))
    for issn, r in F.items():
        rec = {'on': issn, 'fd': r.get('fd'), 'ap': r.get('ap'), 'cs': r.get('cs'), 'apc': r.get('apc'),
               'oa': 'o' if r.get('oa') == 'FULL' else ('h' if r.get('oa') == 'HYBRID' else '')}
        o = by.get(issn.replace('-', '').upper())
        if o is not None and 'sp' in o and o['sp'].get('src') == 'e':
            for k in ('fd', 'ap', 'apc'):
                if k not in o['sp'] and toint(rec.get(k)) is not None: o['sp'][k] = toint(rec[k])
            if 'cs' not in o['sp'] and rec.get('cs'): o['sp']['cs'] = float(rec['cs'])
            continue
        attach(rec, 'e', '')
if os.path.exists('spr_speed.json'):
    S = json.load(open('spr_speed.json'))
    for k, rec in S.items():
        if not rec.get('on') and not rec.get('pr'): continue
        attach(rec, 's', k)
speed = sum(1 for o in J if 'sp' in o and ('fd' in o['sp'] or 'sa' in o['sp']))
d['meta']['counts']['speed'] = speed
d['meta']['sources']['speed'] = f'Publishing timelines, CiteScore and APCs from Elsevier (Journal Finder and ScienceDirect journal insights) and Springer Nature journal pages, collected 27 Oct 2026 ({speed} journals)'
print('attached', n, 'with timeline', speed)
OUT = 'data.js'
with open(OUT, 'w') as f:
    f.write('window.JDATA=')
    json.dump(d, f, separators=(',', ':'), ensure_ascii=False)
    f.write(';')
print('data.js', os.path.getsize(OUT) // 1024, 'KB')
