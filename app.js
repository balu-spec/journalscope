/* JournalScope app */
(function () {
'use strict';
const D = window.JDATA; const M = D.meta; const J = D.j;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const fmt = (v, d = 1) => v == null ? '–' : (+v).toLocaleString('en-GB', {maximumFractionDigits: d, minimumFractionDigits: 0});
const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200); };

/* ---------------- text processing ---------------- */
const STOP0 = 'a an the and or of in on for to with by at from as is are be into via its their our we this that these those using use used based analysis approach new de la le et des du der und fur di e y en el los las revista revue zeitschrift paper effect role impact evidence case toward towards among between within how what why does do can perspective insight framework'.split(' ');
const GENERIC0 = 'journal international research review studies study science sciences quarterly annals letters bulletin transactions proceedings advances frontiers perspectives series part section management world global'.split(' ');
let STOP, GENERIC;
function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
  return w;
}
STOP = new Set([...STOP0, ...STOP0.map(stem)]); GENERIC = new Set([...GENERIC0, ...GENERIC0.map(stem)]);
function toks(s, keepGeneric = true) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter(w => w.length > 1).map(stem).filter(w => !STOP.has(w) && (keepGeneric || !GENERIC.has(w)));
}

/* ---------------- tiers ---------------- */
const ABDC_T = {'A*': 4, 'A': 3, 'B': 2, 'C': 1};
const Q_T = {'Q1': 4, 'Q2': 3, 'Q3': 2, 'Q4': 1};
let CUSTOM = M.ajg ? {name: 'AJG 2024', builtin: true, map: {}, labels: ['4*', '4', '3', '2', '1']} : store.get('jf_custom', null);
function customVal(j) { if (!CUSTOM) return null; if (CUSTOM.builtin) return j.aj ?? null; for (const i of j.is) { const v = CUSTOM.map[i.replace('-', '')]; if (v != null) return v; } return null; }
function tierOf(j, scale) {
  if (scale === 'abdc') return ABDC_T[j.ab25] || 0;
  if (scale === 'sq') return Q_T[j.sq] || 0;
  if (scale === 'jq') return Q_T[j.jq] || 0;
  if (scale === 'cu') { const v = customVal(j); if (v == null) return 0; return CUSTOM.labels.length - CUSTOM.labels.indexOf(v); }
  return 0;
}
const SCALE_NAME = s => ({abdc: 'ABDC', sq: 'Scopus quartile', jq: 'JCR quartile', cu: CUSTOM ? CUSTOM.name : 'Custom'}[s] || s);
function tierLabel(scale, t) {
  if (!t) return 'not listed';
  if (scale === 'abdc') return ['', 'C', 'B', 'A', 'A*'][t];
  if (scale === 'sq' || scale === 'jq') return 'Q' + (5 - t);
  if (scale === 'cu') return CUSTOM.labels[CUSTOM.labels.length - t];
  return t;
}

/* ---------------- index ---------------- */
const pubName = j => j.p != null ? M.pubs[j.p] : '';
const grpName = j => j.g != null ? M.groups[j.g] : '';
const catTokCache = M.cats.map(c => toks(c));
const areaTokCache = M.areas.map(a => toks(a));
const forTok = {}; for (const k in M.for_) forTok[k] = toks(M.for_[k]);
const byIssn = new Map();
const df = new Map(); // document frequency of tokens across journals (title+cat)
J.forEach((j, i) => {
  j._i = i;
  j.is.forEach(s => { byIssn.set(s.replace('-', ''), j); });
  j._lt = j.t.toLowerCase();
  j._hay = (j.t + ' ' + (j.ab || '') + ' ' + pubName(j) + ' ' + grpName(j)).toLowerCase();
  j._tt = toks(j.t);
  j._ttg = new Set(toks(j.t, false));
  const ct = new Set(); (j.cat || []).forEach(([c]) => catTokCache[c].forEach(t => ct.add(t)));
  (j.ar || []).forEach(a => areaTokCache[a].forEach(t => ct.add(t)));
  if (j.for && forTok[j.for]) forTok[j.for].forEach(t => ct.add(t));
  j._ct = ct;
  j._cs = new Set((j.cat || []).map(c => c[0]));
  const seen = new Set([...j._ttg, ...ct]); seen.forEach(t => df.set(t, (df.get(t) || 0) + 1));
  const parts = []; ['abdc', 'jq', 'sq', ...(M.ajg ? ['cu'] : [])].forEach(s => { const t = tierOf(j, s); if (t) parts.push(s === 'cu' ? t * 0.8 + 0.2 : t); });
  j._qs = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length + parts.length * 0.15 + Math.log10(1 + (j.sjr || 0)) * 0.4 + Math.log10(1 + (j.jif || 0)) * 0.4 : Math.log10(1 + (j.sjr || 0)) * 0.3;
  if (j.sp && j.sp.fd != null) j._fd = +j.sp.fd;
  if (j.sp && j.sp.apc != null) j._apc = +j.sp.apc;
  if (j.ah && j.ah['22'] && j.ab25) j._up = ABDC_T[j.ab25] > ABDC_T[j.ah['22']]; else if (j.ab25 && !j.ah) j._new = true;
});
const NJ = J.length;
const idf = t => Math.log(1 + NJ / (1 + (df.get(t) || 0)));
const keyOf = j => j.is[0] || ('t:' + j.t);
const getByKey = k => byIssn.get(k.replace('-', '')) || J.find(j => keyOf(j) === k);

/* ---------------- state ---------------- */
const F = {abdc: new Set(), jq: new Set(), sq: new Set(), cu: new Set(), pubs: new Set(), area: '', cat: '', for: '', ajf: '', pubRaw: '', jif: null, sjr: null, h: null, fd: null, apc: null, country: '', oa: false, dia: false, speed: false, upgrade: false};
let LIVEQ = null;
let mode = 'title', query = '', sortBy = 'rel', viewMode = store.get('jf_view', 'cards'), shown = 40;
let SL = new Set(store.get('jf_sl', []));
let lastList = [];

/* ---------------- theme ---------------- */
const savedTheme = store.get('jf_theme', null); if (savedTheme) document.documentElement.dataset.theme = savedTheme;
$('#themeBtn').onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx; store.set('jf_theme', nx);
};

/* ---------------- tabs ---------------- */
function showView(v) {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach(x => x.classList.toggle('active', x.id === 'view-' + v));
  if (v === 'shortlist') renderShortlist();
  if (v === 'about') renderAbout();
  window.scrollTo({top: 0});
}
$$('.tab').forEach(b => b.onclick = () => showView(b.dataset.view));

/* ---------------- filter UI setup ---------------- */
$('#brandSub').textContent = `${NJ.toLocaleString('en-GB')} journals · ABDC 2025 · JCR 2025 · SCImago 2025` + (M.counts.speed ? ` · ${M.counts.speed.toLocaleString('en-GB')} with speed data` : '');
const areaSel = $('#fArea'); M.areas.map((a, i) => [a, i]).sort((a, b) => a[0].localeCompare(b[0])).forEach(([a, i]) => areaSel.add(new Option(a, i)));
$('#catList').innerHTML = M.cats.slice().sort().map(c => `<option value="${esc(c)}">`).join('');
const forSel = $('#fFor'); Object.entries(M.for_).forEach(([k, v]) => forSel.add(new Option(`${k} ${v}`, k)));
const cntSel = $('#fCountry'); M.countries.map((c, i) => [c, i]).sort((a, b) => a[0].localeCompare(b[0])).forEach(([c, i]) => cntSel.add(new Option(c, i)));

// publishers: groups + raw names
const gCount = new Map(), pCount = new Map();
J.forEach(j => { if (j.g != null) gCount.set(j.g, (gCount.get(j.g) || 0) + 1); else if (j.p != null) pCount.set(j.p, (pCount.get(j.p) || 0) + 1); });
const PUBOPTS = [...[...gCount].map(([g, n]) => ({k: 'g' + g, name: M.groups[g], n})), ...[...pCount].map(([p, n]) => ({k: 'p' + p, name: M.pubs[p], n}))].sort((a, b) => b.n - a.n);
function renderPubList() {
  const t = $('#fPubTxt').value.trim().toLowerCase();
  let opts = t ? PUBOPTS.filter(o => o.name.toLowerCase().includes(t)) : PUBOPTS.filter(o => o.k[0] === 'g' || o.n >= 25);
  const sel = PUBOPTS.filter(o => F.pubs.has(o.k) && !opts.includes(o));
  opts = [...sel, ...opts].slice(0, 120);
  $('#pubList').innerHTML = opts.map(o => `<label><input type="checkbox" data-k="${o.k}" ${F.pubs.has(o.k) ? 'checked' : ''}> ${esc(o.name)} <span class="n">${o.n.toLocaleString('en-GB')}</span></label>`).join('') || '<div class="muted" style="padding:8px">No match</div>';
}
$('#fPubTxt').oninput = renderPubList;
$('#pubList').onchange = e => { const k = e.target.dataset.k; if (!k) return; e.target.checked ? F.pubs.add(k) : F.pubs.delete(k); refresh(); };
renderPubList();

$$('.chips[data-f]').forEach(c => c.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const v = b.dataset.v || b.textContent.trim(); const set = F[c.dataset.f];
  set.has(v) ? set.delete(v) : set.add(v); refresh();
}));
const bindInput = (id, key, num) => { const el = $(id); el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => {
  F[key] = el.type === 'checkbox' ? el.checked : (num ? (el.value === '' ? null : +el.value) : el.value); refresh(); }); };
bindInput('#fArea', 'area'); bindInput('#fFor', 'for'); bindInput('#fPubRaw', 'pubRaw'); bindInput('#fCountry', 'country');
bindInput('#fJif', 'jif', 1); bindInput('#fSjr', 'sjr', 1); bindInput('#fH', 'h', 1); bindInput('#fFd', 'fd', 1); bindInput('#fApc', 'apc', 1);
bindInput('#fOa', 'oa'); bindInput('#fDia', 'dia'); bindInput('#fSpeed', 'speed'); bindInput('#fUpgrade', 'upgrade');
$('#fCatTxt').addEventListener('change', () => { F.cat = $('#fCatTxt').value.trim(); refresh(); });
$('#fCatTxt').addEventListener('input', () => { if (!$('#fCatTxt').value) { F.cat = ''; refresh(); } });
$('#toggleFilters').onclick = () => $('#filters').classList.toggle('open');

function resetFilters() {
  ['abdc', 'jq', 'sq', 'cu', 'pubs'].forEach(k => F[k].clear());
  Object.assign(F, {area: '', cat: '', for: '', ajf: '', pubRaw: '', jif: null, sjr: null, h: null, fd: null, apc: null, country: '', oa: false, dia: false, speed: false, upgrade: false});
  ['#fArea', '#fFor', '#fAjf', '#fPubRaw', '#fCountry', '#fJif', '#fSjr', '#fH', '#fFd', '#fApc', '#fCatTxt', '#fPubTxt'].forEach(s => $(s).value = '');
  ['#fOa', '#fDia', '#fSpeed', '#fUpgrade'].forEach(s => $(s).checked = false);
  renderPubList(); refresh();
}
$('#resetF').onclick = resetFilters;

// quick chips
$('#quick').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const q = b.dataset.q;
  if (q.includes(':')) { const [k, v] = q.split(':'); F[k].has(v) ? F[k].delete(v) : F[k].add(v); }
  else if (q === 'oa') { F.oa = !F.oa; $('#fOa').checked = F.oa; }
  else if (q === 'dia') { F.dia = !F.dia; $('#fDia').checked = F.dia; }
  else if (q === 'speed') { F.speed = !F.speed; $('#fSpeed').checked = F.speed; }
  else if (q === 'fast') { F.fd = F.fd === 30 ? null : 30; $('#fFd').value = F.fd ?? ''; }
  refresh();
});
function syncChips() {
  $$('.chips[data-f]').forEach(c => $$('button', c).forEach(b => b.classList.toggle('on', F[c.dataset.f].has(b.dataset.v || b.textContent.trim()))));
  $$('#quick button').forEach(b => { const q = b.dataset.q; let on = false;
    if (q.includes(':')) { const [k, v] = q.split(':'); on = F[k].has(v); } else if (q === 'fast') on = F.fd === 30; else on = !!F[q];
    b.classList.toggle('on', on); });
}

/* ---------------- custom list chips ---------------- */
function setupAjg() {
  if (!M.ajg) return;
  $('#fAjfWrap').hidden = false; const sel = $('#fAjf');
  Object.entries(M.ajg.fields).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => sel.add(new Option(v === k ? k : `${k} · ${v}`, k)));
  sel.addEventListener('change', () => { F.ajf = sel.value; refresh(); });
  const q = $('#quick'); [['cu:4*', 'AJG 4*'], ['cu:4', 'AJG 4'], ['cu:3', 'AJG 3']].forEach(([d, l]) => { const b = document.createElement('button'); b.dataset.q = d; b.textContent = l; q.insertBefore(b, q.querySelector('[data-q="oa"]')); });
  $('#cuDel').hidden = true;
  document.title = 'JournalScope (AJG edition)';
  $('.brand-name').innerHTML = 'JournalScope <span class="pill" title="Includes Chartered ABS AJG 2024. Private copy: do not publish.">AJG</span>';
  $('#brandSub').textContent = $('#brandSub').textContent.replace('SCImago 2025', 'SCImago 2025 · AJG 2024');
}
function setupCustom() {
  const w = $('#customFilterWrap');
  if (!CUSTOM) { w.hidden = true; return; }
  w.hidden = false; $('#customFilterLabel').textContent = CUSTOM.name;
  $('#customChips').innerHTML = CUSTOM.labels.map(l => `<button data-v="${esc(l)}">${esc(l)}</button>`).join('') + '<button data-v="none">Not listed</button>';
  if (!$('#pScale option[value=cu]')) $('#pScale').add(new Option(CUSTOM.name, 'cu'));
  else $('#pScale option[value=cu]').textContent = CUSTOM.name;
}

/* ---------------- matching ---------------- */
const ISSN_RE = /^\s*(\d{4})-?(\d{3}[\dxX])\s*$/;
function titleScore(j, q, qt) {
  if (j._lt === q) return 1000;
  let s = 0;
  if (j._lt.startsWith(q)) s = 600; else if ((' ' + j._lt).includes(' ' + q)) s = 400; else if (j._hay.includes(q)) s = 250;
  if (j.ab && j.ab.toLowerCase() === q) s = Math.max(s, 900);
  if (!s && qt.length) { const tt = new Set(j._tt); const hit = qt.filter(t => tt.has(t) || j._hay.includes(t)).length; if (hit === qt.length) s = 150 + hit * 10; }
  return s ? s + j._qs * 8 - j.t.length * 0.3 : 0;
}
function keywordScore(j, qt, qraw) {
  let s = 0, hit = 0; const tt = j._ttg;
  for (const t of qt) { const w = idf(t); let h = 0; if (tt.has(t)) h += 3; if (j._ct.has(t)) h += 2; if (h) { hit++; s += h * w; } }
  if (!hit) return 0;
  s *= Math.pow(hit / qt.length, 1.5);
  if (qraw.length > 3 && j._lt.includes(qraw)) s += 8;
  return s;
}
function passFilters(j) {
  if (F.abdc.size && !F.abdc.has(j.ab25 || 'none')) return false;
  if (F.jq.size && !F.jq.has(j.jq || 'none')) return false;
  if (F.sq.size && !F.sq.has(j.sq || 'none')) return false;
  if (F.cu.size && !F.cu.has(customVal(j) ?? 'none')) return false;
  if (F.area !== '' && !(j.ar || []).includes(+F.area)) return false;
  if (F.cat) { const ci = M.cats.indexOf(F.cat); if (ci >= 0) { if (!j._cs.has(ci)) return false; } else if (!(j.cat || []).some(([c]) => M.cats[c].toLowerCase().includes(F.cat.toLowerCase()))) return false; }
  if (F.for && j.for !== F.for) return false;
  if (F.ajf && j.ajf !== F.ajf) return false;
  if (F.pubs.size && !(F.pubs.has('g' + j.g) || F.pubs.has('p' + j.p))) return false;
  if (F.pubRaw && !pubName(j).toLowerCase().includes(F.pubRaw.toLowerCase())) return false;
  if (F.country !== '' && j.c !== +F.country) return false;
  if (F.jif != null && !(j.jif >= F.jif)) return false;
  if (F.sjr != null && !(j.sjr >= F.sjr)) return false;
  if (F.h != null && !(j.h >= F.h)) return false;
  if (F.fd != null && !(j._fd <= F.fd)) return false;
  if (F.apc != null && j._apc != null && j._apc > F.apc) return false;
  if (F.oa && !j.oa && !(j.sp && j.sp.oa === 'o')) return false;
  if (F.dia && !j.dia) return false;
  if (F.speed && j._fd == null && !(j.sp && (j.sp.sa || j.sp.dar))) return false;
  if (F.upgrade && !j._up) return false;
  return true;
}
const SORTS = {
  quality: (a, b) => b._qs - a._qs,
  jif: (a, b) => (b.jif ?? -1) - (a.jif ?? -1),
  sjr: (a, b) => (b.sjr ?? -1) - (a.sjr ?? -1),
  h: (a, b) => (b.h ?? -1) - (a.h ?? -1),
  cs: (a, b) => (b.sp?.cs ?? -1) - (a.sp?.cs ?? -1),
  fd: (a, b) => (a._fd ?? 1e9) - (b._fd ?? 1e9),
  title: (a, b) => a.t.localeCompare(b.t)
};
function compute() {
  const q = query.trim().toLowerCase(); let list;
  const im = q.match(ISSN_RE);
  if (im) { const j = byIssn.get(im[1] + im[2].toUpperCase()); list = j ? [{j, s: 1}] : []; }
  else if (!q) list = J.filter(passFilters).map(j => ({j, s: j._qs}));
  else if (mode === 'title') { const qt = toks(q); list = []; for (const j of J) { if (!passFilters(j)) continue; const s = titleScore(j, q, qt); if (s) list.push({j, s}); } }
  else { const qt = [...new Set(toks(q))].filter(t => df.has(t)); list = []; const lv = LIVEQ && LIVEQ.q === q ? LIVEQ.map : null;
    if (qt.length || lv) for (const j of J) { if (!passFilters(j)) continue; let s = qt.length ? keywordScore(j, qt, q) : 0; const l = lv && lv.get(j); if (l) s += 4 + 14 * l.sc; if (s) list.push({j, s: s + j._qs * 0.6}); } }
  if (sortBy === 'rel') list.sort((a, b) => b.s - a.s); else { const f = SORTS[sortBy]; list.sort((a, b) => f(a.j, b.j)); }
  return list.map(x => x.j);
}

/* ---------------- rendering ---------------- */
function badges(j, opts = {}) {
  const b = [];
  if (j.ab25) b.push(`<span class="bd abdc-${esc(j.ab25)}" title="ABDC 2025"><span class="k">ABDC</span>${esc(j.ab25)}</span>`);
  if (j.jq) b.push(`<span class="bd ${j.jq.toLowerCase()}" title="JCR quartile (JIF 2024)"><span class="k">JCR</span>${j.jq}${j.jif != null ? ' · IF ' + fmt(j.jif) : ''}</span>`);
  else if (j.jif != null) b.push(`<span class="bd"><span class="k">IF</span>${fmt(j.jif)}</span>`);
  if (j.sq) b.push(`<span class="bd ${j.sq.toLowerCase()}" title="Scopus best quartile (SJR 2025)"><span class="k">Scopus</span>${j.sq}${j.sjr != null ? ' · SJR ' + fmt(j.sjr, 2) : ''}</span>`);
  const cv = customVal(j); if (cv != null) b.push(`<span class="bd cu" title="${esc(CUSTOM.name)}"><span class="k">${esc(CUSTOM.name)}</span>${esc(cv)}</span>`);
  if (j.sp?.cs) b.push(`<span class="bd" title="CiteScore"><span class="k">CiteScore</span>${esc(j.sp.cs)}</span>`);
  if (j.h != null && !opts.compact) b.push(`<span class="bd" title="h-index (SCImago)"><span class="k">h</span>${j.h}</span>`);
  if (j._fd != null) b.push(`<span class="bd speed" title="Submission to first decision (publisher median)"><span class="k">1st decision</span>${j._fd}d</span>`);
  if (j.sp?.sa && !opts.compact) b.push(`<span class="bd speed" title="Submission to acceptance"><span class="k">to accept</span>${esc(j.sp.sa)}d</span>`);
  if (j.dia) b.push(`<span class="bd oa" title="Diamond open access: free to read and publish">Diamond OA</span>`);
  else if (j.oa || j.sp?.oa === 'o') b.push(`<span class="bd oa">Open access</span>`);
  if (j._up) b.push(`<span class="bd oa" title="ABDC rating improved since 2022">▲ ABDC ${esc(j.ah['22'])}→${esc(j.ab25)}</span>`);
  return b.join('');
}
function card(j, extra = '') {
  const pub = pubName(j);
  const cats = (j.cat || []).slice(0, 3).map(([c]) => M.cats[c]).join(' · ');
  return `<div class="jcard" data-k="${esc(keyOf(j))}">
    <div><div class="jt">${esc(j.t)}</div><div class="jsub">${esc(pub)}${j.c != null ? ' · ' + esc(M.countries[j.c]) : ''}${j.is.length ? ' · ' + j.is.join(', ') : ''}</div>
    ${cats ? `<div class="jsub">${esc(cats)}</div>` : (j.for ? `<div class="jsub">ABDC field: ${esc(M.for_[j.for] || j.for)}</div>` : '')}</div>
    <button class="star ${SL.has(keyOf(j)) ? 'on' : ''}" data-star="${esc(keyOf(j))}" title="Add to shortlist" aria-label="Add to shortlist">★</button>
    <div class="badges">${badges(j)}</div>${extra}</div>`;
}
function tableView(list) {
  return `<div class="tablewrap"><table><thead><tr><th></th><th>Journal</th><th>Publisher</th><th>ABDC</th><th>JCR Q</th><th>JIF</th><th>5y JIF</th><th>Scopus Q</th><th>SJR</th><th>h</th><th>CiteScore</th><th>1st dec.</th><th>Accept</th><th>APC $</th></tr></thead><tbody>${
    list.map(j => `<tr data-k="${esc(keyOf(j))}"><td><button class="star ${SL.has(keyOf(j)) ? 'on' : ''}" data-star="${esc(keyOf(j))}">★</button></td><td class="tt">${esc(j.t)}</td><td>${esc(grpName(j) || pubName(j)).slice(0, 40)}</td><td>${esc(j.ab25 || '')}</td><td>${j.jq || ''}</td><td class="num">${j.jif != null ? fmt(j.jif) : ''}</td><td class="num">${j.jif5 != null ? fmt(j.jif5) : ''}</td><td>${j.sq || ''}</td><td class="num">${j.sjr != null ? fmt(j.sjr, 2) : ''}</td><td class="num">${j.h ?? ''}</td><td class="num">${j.sp?.cs ?? ''}</td><td class="num">${j._fd != null ? j._fd + 'd' : ''}</td><td class="num">${j.sp?.sa ? j.sp.sa + 'd' : ''}</td><td class="num">${j.sp?.apc ?? ''}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderActive() {
  const a = [];
  const add = (label, fn) => a.push({label, fn});
  ['abdc', 'jq', 'sq', 'cu'].forEach(k => F[k].forEach(v => add(`${{abdc: 'ABDC', jq: 'JCR', sq: 'Scopus', cu: CUSTOM?.name}[k]}: ${v === 'none' ? 'not listed' : v}`, () => F[k].delete(v))));
  F.pubs.forEach(k => add(PUBOPTS.find(o => o.k === k)?.name || k, () => { F.pubs.delete(k); renderPubList(); }));
  if (F.area !== '') add('Area: ' + M.areas[F.area], () => { F.area = ''; $('#fArea').value = ''; });
  if (F.cat) add('Category: ' + F.cat, () => { F.cat = ''; $('#fCatTxt').value = ''; });
  if (F.for) add('FoR: ' + M.for_[F.for], () => { F.for = ''; $('#fFor').value = ''; });
  if (F.ajf) add('AJG field: ' + F.ajf, () => { F.ajf = ''; $('#fAjf').value = ''; });
  if (F.pubRaw) add('Publisher has: ' + F.pubRaw, () => { F.pubRaw = ''; $('#fPubRaw').value = ''; });
  if (F.country !== '') add('Country: ' + M.countries[F.country], () => { F.country = ''; $('#fCountry').value = ''; });
  [['jif', 'JIF ≥ '], ['sjr', 'SJR ≥ '], ['h', 'h ≥ '], ['fd', '1st decision ≤ '], ['apc', 'APC ≤ $']].forEach(([k, l]) => { if (F[k] != null) add(l + F[k], () => { F[k] = null; $('#f' + k[0].toUpperCase() + k.slice(1)).value = ''; }); });
  [['oa', 'Open access'], ['dia', 'Diamond OA'], ['speed', 'Has speed data'], ['upgrade', 'ABDC upgraded']].forEach(([k, l]) => { if (F[k]) add(l, () => { F[k] = false; $('#f' + k[0].toUpperCase() + k.slice(1)).checked = false; }); });
  $('#activeFilters').innerHTML = a.map((x, i) => `<span class="chip">${esc(x.label)} <b data-x="${i}" title="Remove">×</b></span>`).join('');
  $('#activeFilters').onclick = e => { const i = e.target.dataset.x; if (i == null) return; a[+i].fn(); refresh(); };
}
function render() {
  const list = lastList; const box = $('#results');
  const total = list.length;
  $('#rCount').innerHTML = `${total.toLocaleString('en-GB')} journals <small>${query ? (mode === 'keyword' ? 'matching keywords' : 'matching') : 'in view'}</small>`;
  $('#liveBtn').hidden = !(mode === 'keyword' && query.trim().length > 2);
  if (LIVEQ && LIVEQ.q === query.trim().toLowerCase()) $('#liveBtn').textContent = '✓ Live topic match on'; else $('#liveBtn').textContent = '⚡ Add journals publishing on this topic';
  if (!total) { box.innerHTML = `<div class="empty">No journals match. Try removing a filter${mode === 'title' && query ? ', or switch to <b>Keywords / topic</b> search' : ''}.</div>`; $('#moreBtn').hidden = true; return; }
  const slice = list.slice(0, shown);
  box.innerHTML = viewMode === 'table' ? tableView(slice) : slice.map(j => card(j, mode === 'keyword' && query ? whyLine(j) : '')).join('');
  $('#moreBtn').hidden = total <= shown; $('#moreBtn').textContent = `Show more (${(total - shown).toLocaleString('en-GB')} left)`;
}
function whyLine(j) {
  const qt = new Set(toks(query)); const tt = new Set(j._tt);
  const cats = (j.cat || []).map(([c]) => M.cats[c]).filter(c => toks(c).some(t => qt.has(t)));
  const tw = [...qt].filter(t => tt.has(t));
  const parts = []; if (tw.length) parts.push('title: <mark>' + tw.map(esc).join('</mark> <mark>') + '</mark>'); if (cats.length) parts.push('subject: <mark>' + cats.slice(0, 3).map(esc).join('</mark>, <mark>') + '</mark>');
  const l = LIVEQ && LIVEQ.q === query.trim().toLowerCase() && LIVEQ.map.get(j); if (l) parts.push(`<mark>${l.n} recent papers on this topic</mark> (OpenAlex)`);
  return parts.length ? `<div class="why">Matched on ${parts.join(' · ')}</div>` : '';
}
let rt; function refresh(resetShown = true) { if (resetShown) shown = 40; clearTimeout(rt); rt = setTimeout(() => { lastList = compute(); syncChips(); renderActive(); render(); }, 60); }
$('#moreBtn').onclick = () => { shown += 60; render(); };
$('#sortSel').onchange = e => { sortBy = e.target.value; refresh(); };
$$('#viewSeg button').forEach(b => { b.classList.toggle('on', b.dataset.v === viewMode); b.onclick = () => { viewMode = b.dataset.v; store.set('jf_view', viewMode); $$('#viewSeg button').forEach(x => x.classList.toggle('on', x === b)); render(); }; });
$$('#modeSeg button').forEach(b => b.onclick = () => { mode = b.dataset.mode; $$('#modeSeg button').forEach(x => x.classList.toggle('on', x === b));
  $('#q').placeholder = mode === 'title' ? 'Type a journal name, abbreviation or ISSN…' : 'Topics, e.g. consumer behaviour social media, supply chain resilience…'; hideSuggest(); refresh(); $('#q').focus(); });

/* search input + suggestions */
const qEl = $('#q'); let sgIdx = -1, sgList = [];
qEl.addEventListener('input', () => { query = qEl.value; refresh(); suggest(); });
qEl.addEventListener('keydown', e => {
  const box = $('#suggest'); if (!box.classList.contains('show')) return;
  if (e.key === 'ArrowDown') { sgIdx = Math.min(sgIdx + 1, sgList.length - 1); hlSg(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { sgIdx = Math.max(sgIdx - 1, -1); hlSg(); e.preventDefault(); }
  else if (e.key === 'Enter') { if (sgIdx >= 0) { openJournal(sgList[sgIdx]); hideSuggest(); } else hideSuggest(); }
  else if (e.key === 'Escape') { e.preventDefault(); hideSuggest(); }
});
document.addEventListener('click', e => { if (!e.target.closest('.search-input')) hideSuggest(); });
function hideSuggest() { $('#suggest').classList.remove('show'); sgIdx = -1; }
function hlSg() { $$('#suggest .sg').forEach((x, i) => x.classList.toggle('hl', i === sgIdx)); }
function suggest() {
  const q = qEl.value.trim().toLowerCase();
  if (mode !== 'title' || q.length < 2) { hideSuggest(); return; }
  sgList = lastSuggest(q); sgIdx = -1;
  const box = $('#suggest');
  if (!sgList.length) { hideSuggest(); return; }
  box.innerHTML = sgList.map(j => `<div class="sg" data-k="${esc(keyOf(j))}"><div><div class="s1">${esc(j.t)}</div><div class="s2">${esc(pubName(j))} · ${j.is.join(', ')}</div></div><div class="badges" style="margin:0;grid-column:auto">${badges(j, {compact: true}).split('</span><span').slice(0, 3).join('</span><span')}${''}</div></div>`).join('');
  box.classList.add('show');
}
function lastSuggest(q) {
  const im = q.match(ISSN_RE); if (im) { const j = byIssn.get(im[1] + im[2].toUpperCase()); return j ? [j] : []; }
  const qt = toks(q); const out = [];
  for (const j of J) { const s = titleScore(j, q, qt); if (s) out.push([s, j]); }
  return out.sort((a, b) => b[0] - a[0]).slice(0, 8).map(x => x[1]);
}
$('#suggest').addEventListener('click', e => { const r = e.target.closest('.sg'); if (r) { openJournal(getByKey(r.dataset.k)); hideSuggest(); } });

/* clicks on cards / stars (delegated) */
document.addEventListener('click', e => {
  const st = e.target.closest('[data-star]');
  if (st) { e.stopPropagation(); toggleStar(st.dataset.star); return; }
  const c = e.target.closest('.jcard, tbody tr[data-k], .simrow');
  if (c && c.dataset.k) openJournal(getByKey(c.dataset.k));
});
function toggleStar(k) {
  SL.has(k) ? SL.delete(k) : SL.add(k); store.set('jf_sl', [...SL]);
  $$(`[data-star="${CSS.escape(k)}"]`).forEach(b => b.classList.toggle('on', SL.has(k)));
  $('#slCount').textContent = SL.size; toast(SL.has(k) ? 'Added to shortlist' : 'Removed from shortlist');
  if ($('#view-shortlist').classList.contains('active')) renderShortlist();
}
$('#slCount').textContent = SL.size;

/* ---------------- CSV export ---------------- */
const CSV_COLS = [['Title', j => j.t], ['ISSNs', j => j.is.join(' ')], ['Publisher', pubName], ['Publisher group', grpName], ['Country', j => j.c != null ? M.countries[j.c] : ''],
  ['ABDC 2025', j => j.ab25 || ''], ['ABDC 2022', j => j.ah?.['22'] || ''], ['ABDC FoR', j => j.for ? j.for + ' ' + (M.for_[j.for] || '') : ''], ...(CUSTOM ? [[CUSTOM.name, j => customVal(j) ?? '']] : []), ...(M.ajg ? [['AJG 2021', j => j.aj21 || ''], ['AJG field', j => j.ajf || '']] : []),
  ['JCR quartile', j => j.jq || ''], ['JIF 2024', j => j.jif ?? ''], ['5-yr JIF', j => j.jif5 ?? ''], ['JCI', j => j.jci ?? ''], ['JCR rank', j => j.jrk || ''],
  ['Scopus quartile', j => j.sq || ''], ['SJR', j => j.sjr ?? ''], ['h-index', j => j.h ?? ''], ['Cites/doc (2y)', j => j.cpd ?? ''], ['CiteScore', j => j.sp?.cs ?? ''],
  ['Open access', j => j.dia ? 'Diamond' : (j.oa ? 'Yes' : '')], ['APC USD', j => j.sp?.apc ?? ''], ['Submission to first decision (days)', j => j.sp?.fd ?? ''],
  ['Submission to decision after review (days)', j => j.sp?.dar ?? ''], ['Submission to acceptance (days)', j => j.sp?.sa ?? ''], ['Acceptance to publication (days)', j => j.sp?.ap ?? ''],
  ['Scopus categories', j => (j.cat || []).map(([c, q]) => M.cats[c] + (q ? ` (Q${q})` : '')).join('; ')]];
function downloadCSV(list, name) {
  const cols = CSV_COLS; const q = v => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const rows = [cols.map(c => c[0]).join(','), ...list.map(j => cols.map(c => q(c[1](j))).join(','))];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.join('\n')], {type: 'text/csv'})); a.download = name; a.click();
}
$('#exportBtn').onclick = () => { if (lastList.length > 5000 && !confirm(`Export all ${lastList.length.toLocaleString('en-GB')} journals?`)) return; downloadCSV(lastList, 'journalscope_export.csv'); };

/* ---------------- similar journals ---------------- */
function similarity(a, b) {
  let s = 0, w = 0;
  if (a._cs.size && b._cs.size) { let inter = 0; a._cs.forEach(c => { if (b._cs.has(c)) inter++; }); s += 0.6 * inter / Math.sqrt(a._cs.size * b._cs.size); w += 0.6; }
  if (a.for && b.for) { s += 0.2 * (a.for === b.for ? 1 : (a.for.slice(0, 2) === b.for.slice(0, 2) ? 0.35 : 0)); w += 0.2; }
  if (a._ttg.size && b._ttg.size) { let inter = 0, wi = 0, wu = 0; const u = new Set([...a._ttg, ...b._ttg]); u.forEach(t => { const x = idf(t); wu += x; if (a._ttg.has(t) && b._ttg.has(t)) { inter++; wi += x; } }); s += 0.3 * (wi / wu); w += 0.3; }
  return w ? s / w : 0;
}
function findSimilar(j, scale, rel, n = 15) {
  const T = scale === 'any' ? 0 : tierOf(j, scale);
  const out = [];
  for (const k of J) {
    if (k === j) continue;
    if (scale !== 'any') {
      const t = tierOf(k, scale); if (!t) continue;
      if (T) {
        if (rel === 'same' && t !== T) continue; if (rel === 'up' && t <= T) continue; if (rel === 'down' && t >= T) continue; if (rel === 'sameup' && t < T) continue;
      }
    }
    let shares = false; for (const c of k._cs) if (j._cs.has(c)) { shares = true; break; }
    if (!shares && !(j.for && k.for === j.for)) { let tt = false; for (const t of k._ttg) if (j._ttg.has(t)) { tt = true; break; } if (!tt) continue; }
    const s = similarity(j, k); if (s > 0.12) out.push([s + k._qs * 0.01, s, k]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, n);
}

/* ---------------- drawer ---------------- */
let current = null;
function openJournal(j, push = true) {
  if (!j) return; current = j;
  const d = $('#drawer'); $('#drawerBody').innerHTML = drawerHTML(j);
  d.classList.add('show'); d.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('show'); d.scrollTop = 0;
  if (push) history.replaceState(null, '', '#j=' + encodeURIComponent(keyOf(j)));
  const defScale = j.ab25 ? 'abdc' : (j.sq ? 'sq' : (j.jq ? 'jq' : 'any'));
  $('#simScale').value = defScale; drawSimilar();
  $('#simScale').onchange = drawSimilar; $('#simRel').onchange = drawSimilar;
  $('#dClose').onclick = closeDrawer;
  $$('[data-cat]', d).forEach(b => b.onclick = () => { closeDrawer(); showView('search'); resetFilters(); F.cat = M.cats[+b.dataset.cat]; $('#fCatTxt').value = F.cat; refresh(); });
  loadOpenAlex(j);
}
function closeDrawer() { $('#drawer').classList.remove('show'); $('#scrim').classList.remove('show'); $('#drawer').setAttribute('aria-hidden', 'true'); history.replaceState(null, '', location.pathname + location.search); current = null; }
$('#scrim').onclick = closeDrawer;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && current) closeDrawer(); });

function drawSimilar() {
  const j = current; if (!j) return;
  const scale = $('#simScale').value, rel = $('#simRel').value;
  const T = scale === 'any' ? 0 : tierOf(j, scale);
  const res = findSimilar(j, scale, rel);
  $('#simNote').textContent = scale === 'any' ? 'Ranked by subject overlap across all lists.' : (T ? `This journal is ${SCALE_NAME(scale)} ${tierLabel(scale, T)}.` : `This journal is not in ${SCALE_NAME(scale)}; showing similar journals that are.`);
  $('#simOut').innerHTML = res.length ? res.map(([, s, k]) => `<div class="simrow" data-k="${esc(keyOf(k))}"><div><div class="jt">${esc(k.t)}</div><div class="jsub">${esc(grpName(k) || pubName(k))}</div><div class="badges" style="margin-top:5px">${badges(k, {compact: true})}</div></div><div class="score">${Math.round(s * 100)}% similar<div class="meter"><span style="width:${Math.round(s * 100)}%"></span></div><button class="star ${SL.has(keyOf(k)) ? 'on' : ''}" data-star="${esc(keyOf(k))}" style="margin-top:6px">★</button></div></div>`).join('') : '<div class="muted">No similar journals found for this combination. Try "Any tier" or another list.</div>';
}

function metric(v, l, s = '') { return `<div class="m"><div class="v">${v}</div><div class="l">${l}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`; }
function drawerHTML(j) {
  const pub = pubName(j), sp = j.sp || {};
  const hist = j.ab25 || j.ah ? (() => { const yrs = [['2016', j.ah?.['16']], ['2019', j.ah?.['19']], ['2022', j.ah?.['22']], ['2025', j.ab25]];
    return `<div class="hist">${yrs.map(([y, r]) => `<div class="hb"><div style="height:${r ? 14 + ABDC_T[r] * 14 : 4}px;${r ? '' : 'background:var(--line)'}">${r || ''}</div>${y}</div>`).join('')}</div>`; })() : '';
  const rk = [];
  if (j.ab25) rk.push(metric(j.ab25, 'ABDC 2025', j.for ? esc(j.for + ' ' + (M.for_[j.for] || '')) : ''));
  else rk.push(metric('–', 'ABDC 2025', 'Not listed'));
  rk.push(metric(j.jq || '–', 'JCR quartile', j.jrk ? 'Rank ' + esc(j.jrk) + ' in category' : (j.jif != null ? '' : 'Not in JCR')));
  rk.push(metric(j.sq || '–', 'Scopus quartile', j.sq ? 'Best category quartile' : 'Not in SCImago'));
  const cv = customVal(j); if (CUSTOM) rk.push(metric(cv != null ? esc(cv) : '–', esc(CUSTOM.name), cv == null ? 'Not listed' : (CUSTOM.builtin ? esc((j.aj21 ? 'AJG 2021: ' + j.aj21 : 'New in 2024') + (j.ajf ? ' · ' + j.ajf : '')) : '')));
  const mx = [];
  if (j.jif != null) mx.push(metric(fmt(j.jif), 'JIF 2024', j.jifns != null ? 'w/o self-cites ' + fmt(j.jifns) : ''));
  if (j.jif5 != null) mx.push(metric(fmt(j.jif5), '5-year JIF'));
  if (j.jci != null) mx.push(metric(fmt(j.jci, 2), 'JCI', 'Field-normalised'));
  if (sp.cs) mx.push(metric(esc(sp.cs), 'CiteScore', 'Scopus'));
  if (j.sjr != null) mx.push(metric(fmt(j.sjr, 3), 'SJR 2025'));
  if (j.h != null) mx.push(metric(j.h, 'h-index', 'SCImago'));
  if (j.cpd != null) mx.push(metric(fmt(j.cpd, 2), 'Cites / doc (2y)'));
  if (j.docs != null) mx.push(metric(j.docs.toLocaleString('en-GB'), 'Documents (2025)'));
  if (j.cites != null) mx.push(metric((+j.cites).toLocaleString('en-GB'), 'Total cites (JCR)'));
  if (sp.dl) mx.push(metric(esc(sp.dl), 'Downloads', 'Springer'));
  const tl = [['Submission to first decision', sp.fd], ['Submission to decision after review', sp.dar], ['Submission to acceptance', sp.sa], ['Acceptance to online publication', sp.ap]].filter(x => x[1] != null);
  const tmax = Math.max(...tl.map(x => +String(x[1]).replace(/,/g, '')), 1);
  const srcName = sp.src === 's' ? 'Springer Nature' : 'Elsevier';
  const spLinks = [];
  if (sp.src === 'e') spLinks.push(`<a href="${sp.u ? `https://www.sciencedirect.com/journal/${esc(sp.u)}/about/insights` : `https://www.sciencedirect.com/science/journal/${esc((j.is[0] || '').replace('-', ''))}`}" target="_blank" rel="noopener">Journal insights (Elsevier) ↗</a>`);
  if (sp.src === 's' && sp.u) spLinks.push(`<a href="https://link.springer.com/journal/${esc(sp.u)}" target="_blank" rel="noopener">Journal page (Springer) ↗</a>`);
  const speedHTML = tl.length || sp.apc || sp.ar ? `
    <div class="timeline">${tl.map(([l, v]) => `<div class="tl"><div>${l}</div><div class="track"><div class="fill" style="width:${Math.max(3, 100 * (+String(v).replace(/,/g, '')) / tmax)}%"></div></div><div class="d">${esc(v)} days</div></div>`).join('')}</div>
    <div class="mgrid" style="margin-top:12px">${sp.apc ? metric('$' + (+sp.apc).toLocaleString('en-GB'), 'APC (open access)', sp.oa === 'h' ? 'Hybrid: optional' : '') : ''}${sp.ar ? metric(esc(sp.ar) + '%', 'Acceptance rate') : ''}</div>
    <div class="muted" style="margin-top:8px;font-size:12px">Source: ${srcName} journal page / Journal Finder, collected 27 Oct 2026. Figures are publisher-reported medians/averages; first-decision times include desk rejections.</div>`
    : `<div class="muted">This publisher does not publish timeline data in a form we can collect. Check the journal's own site, or community trackers such as <a href="https://scirev.org/" target="_blank" rel="noopener">SciRev</a>.</div>`;
  const issn = j.is[0] || '';
  const links = [
    j.sid ? `<a href="https://www.scimagojr.com/journalsearch.php?q=${j.sid}&tip=sid" target="_blank" rel="noopener">SCImago profile ↗</a>` : '',
    j.sid ? `<a href="https://www.scopus.com/sourceid/${j.sid}" target="_blank" rel="noopener">Scopus source ↗</a>` : '',
    issn ? `<a href="https://mjl.clarivate.com/search-results?issn=${issn}" target="_blank" rel="noopener">Web of Science MJL ↗</a>` : '',
    `<a href="https://scholar.google.com/citations?view_op=search_venues&vq=${encodeURIComponent(j.t)}" target="_blank" rel="noopener">Google Scholar metrics ↗</a>`,
    `<a href="https://www.google.com/search?q=${encodeURIComponent('"' + j.t + '" journal aims and scope')}" target="_blank" rel="noopener">Aims &amp; scope ↗</a>`,
    (j.oa || j.dia) && issn ? `<a href="https://doaj.org/toc/${issn}" target="_blank" rel="noopener">DOAJ ↗</a>` : '',
    ...spLinks
  ].join('');
  return `<div class="d-head">
      <div class="d-title">${esc(j.t)}</div>
      <div class="jsub">${esc(pub)}${j.c != null ? ' · ' + esc(M.countries[j.c]) : ''}${j.is.length ? ' · ISSN ' + j.is.join(' / ') : ''}${j.cov ? ' · Scopus coverage ' + esc(j.cov) : ''}</div>
      <div class="badges">${badges(j)}</div>
      <div class="d-close"><button class="star ${SL.has(keyOf(j)) ? 'on' : ''}" data-star="${esc(keyOf(j))}" title="Shortlist">★</button><button class="icon-btn" id="dClose" aria-label="Close">✕</button></div>
    </div>
    <div class="d-body">
      <div class="sec"><h3>Rankings</h3><div class="mgrid">${rk.join('')}</div>${hist ? `<div style="margin-top:12px"><div class="l muted" style="font-size:12px;font-weight:600">ABDC rating history</div>${hist}</div>` : ''}</div>
      ${mx.length ? `<div class="sec"><h3>Citation metrics</h3><div class="mgrid">${mx.join('')}</div></div>` : ''}
      ${j.ax ? `<div class="sec"><h3>AJG 2024 indicators</h3><div class="mgrid">${[['so20', 'Scholarly output 2020'], ['so24', 'Scholarly output 2024'], ['chg', 'Change 2020 to 2024'], ['sdg', 'SDG content'], ['intl', 'International co-authorship'], ['col', 'Academic and non-academic collaboration'], ['pol', 'Citations in policy documents']].filter(([k]) => j.ax[k] != null && j.ax[k] !== '').map(([k, l]) => metric(esc(j.ax[k]), l)).join('')}</div><div class="muted" style="font-size:12px;margin-top:8px">Source: Chartered ABS Academic Journal Guide 2024.</div></div>` : ''}
      <div class="sec"><h3>Publishing timeline &amp; cost</h3>${speedHTML}</div>
      ${(j.cat || []).length ? `<div class="sec"><h3>Subject categories (Scopus)</h3>${j.cat.map(([c, q]) => `<div class="catrow"><button data-cat="${c}" title="Show all journals in this category">${esc(M.cats[c])}</button>${q ? `<span class="bd q${q}">Q${q}</span>` : ''}</div>`).join('')}</div>` : ''}
      <div class="sec"><h3>Similar journals</h3>
        <div class="simctl">
          <select id="simScale"><option value="abdc">ABDC</option><option value="sq">Scopus quartile</option><option value="jq">JCR quartile</option>${CUSTOM ? `<option value="cu">${esc(CUSTOM.name)}</option>` : ''}<option value="any">Any list</option></select>
          <select id="simRel"><option value="same">Same tier</option><option value="sameup">Same tier or higher</option><option value="up">Higher tier (stretch)</option><option value="down">Lower tier (safer)</option><option value="all">Any tier</option></select>
        </div>
        <div class="muted" id="simNote" style="font-size:12px;margin-bottom:6px"></div>
        <div id="simOut"></div>
      </div>
      <div class="sec" id="oaSec"><h3>Live from OpenAlex</h3><div class="muted">Loading…</div></div>
      <div class="sec"><h3>Check elsewhere</h3><div class="links">${links}</div></div>
    </div>`;
}

/* ---------------- OpenAlex live ---------------- */
const oaCache = new Map();
function oaParams() { const k = store.get('jf_oakey', ''), m = store.get('jf_oamail', ''); return (k ? '&api_key=' + encodeURIComponent(k) : '') + (m ? '&mailto=' + encodeURIComponent(m) : ''); }
async function loadOpenAlex(j) {
  const sec = $('#oaSec'); const key = keyOf(j);
  try {
    let data = oaCache.get(key);
    if (!data) {
      let src = null;
      for (const i of j.is) { const r = await fetch(`https://api.openalex.org/sources/issn:${i}?${oaParams().slice(1)}`); if (r.ok) { src = await r.json(); break; } }
      if (!src) throw new Error('not found');
      const sid = src.id.split('/').pop();
      const wr = await fetch(`https://api.openalex.org/works?filter=primary_location.source.id:${sid},type:article&sort=publication_date:desc&per_page=6&select=title,publication_date,doi,cited_by_count${oaParams()}`);
      const works = wr.ok ? ((await wr.json()).results || []) : [];
      data = {src, works}; oaCache.set(key, data);
    }
    if (current !== j) return;
    const s = data.src, st = s.summary_stats || {};
    const yrs = (s.counts_by_year || []).filter(y => y.year >= new Date().getFullYear() - 6).sort((a, b) => a.year - b.year);
    const ymax = Math.max(1, ...yrs.map(y => y.works_count));
    sec.innerHTML = `<h3>Live from OpenAlex</h3>
      <div class="mgrid">${metric((s.works_count || 0).toLocaleString('en-GB'), 'Works indexed')}${metric((s.cited_by_count || 0).toLocaleString('en-GB'), 'Total citations')}${st.h_index != null ? metric(st.h_index, 'h-index', 'OpenAlex') : ''}${st['2yr_mean_citedness'] != null ? metric(fmt(st['2yr_mean_citedness'], 2), '2-yr mean citedness', 'IF-like') : ''}${s.apc_usd ? metric('$' + s.apc_usd.toLocaleString('en-GB'), 'APC list price') : ''}${metric(s.is_oa ? 'Yes' : 'No', 'Fully OA')}${metric(s.is_in_doaj ? 'Yes' : 'No', 'In DOAJ')}</div>
      ${yrs.length ? `<div class="l muted" style="font-size:12px;font-weight:600;margin-top:12px">Articles per year</div><div class="hist">${yrs.map(y => `<div class="hb"><div style="height:${8 + 60 * y.works_count / ymax}px;font-size:10px">${y.works_count}</div>${y.year}</div>`).join('')}</div>` : ''}
      ${(s.topics || []).length ? `<div class="l muted" style="font-size:12px;font-weight:600;margin:12px 0 6px">Main research topics</div>${s.topics.slice(0, 10).map(t => `<span class="topic">${esc(t.display_name)}</span>`).join('')}` : ''}
      ${data.works.length ? `<div class="l muted" style="font-size:12px;font-weight:600;margin:12px 0 6px">Recent articles (check scope fit)</div><ol class="recent">${data.works.map(w => `<li>${w.doi ? `<a href="${esc(w.doi)}" target="_blank" rel="noopener">${esc(w.title)}</a>` : esc(w.title)} <span class="muted">· ${esc(w.publication_date || '')}</span></li>`).join('')}</ol>` : ''}
      ${s.homepage_url ? `<div class="links" style="margin-top:8px"><a href="${esc(s.homepage_url)}" target="_blank" rel="noopener">Journal homepage ↗</a></div>` : ''}`;
  } catch (e) {
    if (current !== j) return;
    sec.innerHTML = `<h3>Live from OpenAlex</h3><div class="muted">Live data unavailable (${esc(e.message || 'offline')}). This needs an internet connection; if it keeps failing, add a free OpenAlex key in About.</div>`;
  }
}

/* ---------------- Finder ---------------- */
// per-category term bags from journal titles
const catBag = M.cats.map(() => new Map()); const catN = new Array(M.cats.length).fill(0);
J.forEach(j => (j.cat || []).forEach(([c]) => { catN[c]++; const b = catBag[c]; j._ttg.forEach(t => b.set(t, (b.get(t) || 0) + 1)); }));
catBag.forEach((b, c) => { catTokCache[c].forEach(t => b.set(t, (b.get(t) || 0) + Math.max(2, catN[c] * 0.15))); });
const catDf = new Map(); catBag.forEach(b => b.forEach((_, t) => catDf.set(t, (catDf.get(t) || 0) + 1)));
const catNorm = catBag.map((b, c) => { let s = 0; b.forEach((v, t) => { const w = (v / Math.max(1, catN[c])) * Math.log(1 + M.cats.length / catDf.get(t)); s += w * w; }); return Math.sqrt(s) || 1; });
function paperTokens() {
  const t = $('#fTitle').value, a = $('#fAbs').value, k = $('#fKw').value;
  const tf = new Map(); const add = (s, w) => { toks(s, false).forEach(x => tf.set(x, (tf.get(x) || 0) + w)); };
  add(t, 2); add(a, 0.5); k.split(/[;,]/).forEach(ph => { const n = toks(ph, false).length; if (n) add(ph, 3 / Math.sqrt(n)); });
  [...tf.keys()].forEach(x => { if (!catDf.has(x) && !df.has(x)) tf.delete(x); });
  return tf;
}
let catScores = [], catOn = new Set();
function matchCats() {
  const tf = paperTokens(); if (!tf.size) { toast('Add a title or keywords first'); return false; }
  let tw = 0; tf.forEach(q => tw += q);
  catScores = catBag.map((b, c) => { let s = 0, cov = 0; tf.forEach((q, t) => { const v = b.get(t); if (v) { s += q * (v / Math.max(1, catN[c])) * Math.log(1 + M.cats.length / catDf.get(t)) ** 2; cov += q; } }); return [c, (s / catNorm[c]) * Math.pow(cov / tw, 1.2)]; })
    .filter(x => x[1] > 0 && catN[x[0]] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 14);
  const mx = catScores[0]?.[1] || 1; catScores = catScores.map(([c, s]) => [c, s / mx]);
  catOn = new Set(catScores.filter(x => x[1] >= 0.4).slice(0, 6).map(x => x[0]));
  if (!catOn.size && catScores.length) catOn.add(catScores[0][0]);
  drawCatChips(); return true;
}
function drawCatChips() {
  $('#catMatches').innerHTML = catScores.length ? catScores.map(([c, s]) => `<button class="chip ${catOn.has(c) ? 'on' : ''}" data-c="${c}" title="Match strength ${Math.round(s * 100)}%">${esc(M.cats[c])} <span style="opacity:.7">${Math.round(s * 100)}</span></button>`).join('') : '<span class="muted">No subject match. Try different keywords.</span>';
}
$('#catMatches').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; const c = +b.dataset.c; catOn.has(c) ? catOn.delete(c) : catOn.add(c); drawCatChips(); };
function fillTiers() { const s = $('#pScale').value; const opts = s === 'abdc' ? ['A*', 'A', 'B', 'C'] : (s === 'cu' ? CUSTOM.labels : ['Q1', 'Q2', 'Q3', 'Q4']);
  $('#pTier').innerHTML = opts.map((o, i) => `<option value="${opts.length - i}" ${(s === 'abdc' ? i === 1 : i === 0) ? 'selected' : ''}>${esc(o)}</option>`).join(''); }
$('#pScale').onchange = fillTiers; fillTiers();
/* live OpenAlex venue matching: which journals publish papers like this one? */
const oaVenueCache = new Map();
function oaQueries() {
  const kws = $('#fKw').value.split(/[;,]/).map(x => x.trim()).filter(Boolean).slice(0, 8);
  const q = s => /\s/.test(s) ? '"' + s.replace(/"/g, '') + '"' : s.replace(/[()"]/g, '');
  const out = [];
  if (kws.length) out.push(['(' + kws.map(q).join(' OR ') + ')', 1]);
  const tw = [...new Set(toks($('#fTitle').value, false))].filter(t => df.has(t) && t.length > 2).sort((x, y) => idf(y) - idf(x)).slice(0, 3);
  const raw = $('#fTitle').value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => tw.includes(stem(w)));
  const words = [...new Set(raw)].slice(0, 3);
  if (words.length >= 2) out.push([words.join(' AND '), 0.8]);
  return out;
}
async function oaVenues(qs = oaQueries()) {
  if (!qs.length) return null;
  const ck = JSON.stringify(qs); if (oaVenueCache.has(ck)) return oaVenueCache.get(ck);
  const yr = new Date().getFullYear() - 6; const counts = new Map(); let papers = 0;
  for (const [q, w] of qs) {
    const r = await fetch(`https://api.openalex.org/works?filter=${encodeURIComponent('title_and_abstract.search:' + q)},from_publication_date:${yr}-01-01,type:article&group_by=primary_location.source.id&per_page=200${oaParams()}`);
    if (!r.ok) throw new Error('OpenAlex ' + r.status);
    const d = await r.json(); papers += d.meta?.count || 0;
    (d.group_by || []).forEach(g => { if (!g.key || g.key === 'unknown') return; const id = g.key.split('/').pop(); const c = counts.get(id) || {n: 0, w: 0}; c.n += g.count; c.w += g.count * w; counts.set(id, c); });
  }
  const ids = [...counts.keys()].sort((x, y) => counts.get(y).w - counts.get(x).w).slice(0, 200);
  const res = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const r = await fetch(`https://api.openalex.org/sources?filter=ids.openalex:${ids.slice(i, i + 100).join('|')}&select=id,issn,works_count&per_page=100${oaParams()}`);
    if (!r.ok) break;
    (await r.json()).results.forEach(s => { const c = counts.get(s.id.split('/').pop()); const j = (s.issn || []).map(x => byIssn.get(x.replace('-', ''))).find(Boolean); if (j && c) { const prev = res.get(j); const sc = c.w / Math.sqrt(Math.max(50, s.works_count || 50)); if (!prev || prev.sc < sc) res.set(j, {sc, n: c.n}); } });
  }
  let mx = 0; res.forEach(v => mx = Math.max(mx, v.sc)); res.forEach(v => v.sc = mx ? v.sc / mx : 0);
  const out = {map: res, papers}; oaVenueCache.set(ck, out); return out;
}
let LIVE = null;
$('#matchBtn').onclick = async () => {
  if (!matchCats()) return;
  const btn = $('#matchBtn'); btn.disabled = true; btn.textContent = 'Checking published papers on OpenAlex…';
  try {
    LIVE = await oaVenues();
    if (LIVE && LIVE.map.size) {
      const agg = new Map(); LIVE.map.forEach((v, j) => (j.cat || []).forEach(([c]) => agg.set(c, (agg.get(c) || 0) + v.sc)));
      let mx = 0; agg.forEach(v => mx = Math.max(mx, v));
      const off = new Map(catScores);
      const all = new Set([...off.keys(), ...agg.keys()]);
      catScores = [...all].map(c => [c, 0.4 * (off.get(c) || 0) + 0.6 * ((agg.get(c) || 0) / (mx || 1))]).filter(x => x[1] > 0.03).sort((a, b) => b[1] - a[1]).slice(0, 14);
      const m2 = catScores[0]?.[1] || 1; catScores = catScores.map(([c, v]) => [c, v / m2]);
      catOn = new Set(catScores.filter(x => x[1] >= 0.4).slice(0, 6).map(x => x[0])); drawCatChips();
      $('#liveNote').innerHTML = `Live match: <b>${LIVE.papers.toLocaleString('en-GB')}</b> recent papers on OpenAlex use your keywords; ${LIVE.map.size} of the journals publishing them are in this database.`;
    } else $('#liveNote').textContent = 'Live match found no papers for these keywords; using offline subject matching only.';
  } catch (e) { LIVE = null; $('#liveNote').textContent = 'Offline subject matching only (live OpenAlex lookup unavailable: ' + e.message + ').'; }
  btn.disabled = false; btn.textContent = 'Match subject areas';
  $('#findBtn').scrollIntoView({behavior: 'smooth', block: 'center'});
};
$('#findBtn').onclick = async () => {
  if (!catScores.length) { await $('#matchBtn').onclick(); if (!catScores.length) return; }
  const tf = paperTokens(); const scale = $('#pScale').value; const T = +$('#pTier').value;
  const fd = $('#pFd').value === '' ? null : +$('#pFd').value, apc = $('#pApc').value === '' ? null : +$('#pApc').value;
  const oa = $('#pOa').checked, dia = $('#pDia').checked, listed = $('#pListed').checked;
  const excl = $('#pExcl').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const cs = new Map(catScores.filter(([c]) => catOn.has(c)));
  const qset = [...tf.keys()]; let qw = 0; qset.forEach(t => qw += idf(t) * tf.get(t));
  const live = LIVE && LIVE.map.size ? LIVE.map : null;
  const cand = [];
  for (const j of J) {
    let r1 = 0; for (const [c] of j.cat || []) { const v = cs.get(c); if (v) r1 = Math.max(r1, v) + 0.15 * v; }
    let r2 = 0; qset.forEach(t => { if (j._ttg.has(t)) r2 += idf(t) * tf.get(t); else if (j._ct.has(t)) r2 += 0.4 * idf(t) * tf.get(t); });
    r2 = qw ? r2 / qw : 0;
    let rel = Math.min(1.2, r1) * 0.65 + Math.min(1, r2 * 3) * 0.35;
    const lv = live ? live.get(j) : null;
    if (live) rel = lv ? 0.45 * rel + 0.55 * Math.min(1, 0.35 + lv.sc) : 0.6 * rel;
    if (rel < 0.25 || (!r1 && !lv && r2 < 0.2)) continue;
    const t = tierOf(j, scale); if (listed && !t) continue;
    if (fd != null && !(j._fd <= fd)) continue; if (apc != null && j._apc != null && j._apc > apc) continue;
    if (oa && !j.oa) continue; if (dia && !j.dia) continue;
    if (excl.length) { const p = (pubName(j) + ' ' + grpName(j)).toLowerCase(); if (excl.some(x => p.includes(x))) continue; }
    cand.push({j, t, rel, n: lv ? lv.n : 0});
  }
  const pick = f => cand.filter(f).sort((a, b) => (b.rel + b.j._qs * 0.04) - (a.rel + a.j._qs * 0.04)).slice(0, 10);
  const reach = pick(x => x.t > T && x.t <= T + 1), target = pick(x => x.t === T), safe = pick(x => x.t > 0 && x.t < T && x.t >= T - 1);
  const why = x => `<div class="why">Fit ${Math.round(Math.min(1, x.rel) * 100)}% · ${esc(SCALE_NAME(scale))} ${esc(tierLabel(scale, x.t))}${x.n ? ` · <mark>${x.n} similar papers</mark> since ${new Date().getFullYear() - 6}` : ''}</div>`;
  const col = (title, desc, arr) => `<div class="bucket"><h3>${title}</h3><p>${desc}</p>${arr.length ? arr.map(x => card(x.j, why(x))).join('') : '<div class="empty">None in this band. Loosen a preference or pick more subjects.</div>'}</div>`;
  const maxT = scale === 'cu' ? CUSTOM.labels.length : 4;
  $('#finderOut').innerHTML = `<div class="buckets">${col('🎯 Reach', T < maxT ? `One tier above your target (${esc(tierLabel(scale, T + 1))}). Worth a shot if the fit is strong.` : 'You are already aiming at the top tier.', T < maxT ? reach : [])}${col('✅ Target', `Your chosen tier (${esc(tierLabel(scale, T))}). Best balance of standing and odds.`, target)}${col('🛟 Safer', T > 1 ? `One tier below (${esc(tierLabel(scale, T - 1))}). Good back-ups if you need a faster outcome.` : 'No lower tier on this list.', T > 1 ? safe : [])}</div>`;
  $('#finderOut').scrollIntoView({behavior: 'smooth'});
};

$('#liveBtn').onclick = async () => {
  const q = query.trim().toLowerCase(); if (!q) return; const btn = $('#liveBtn');
  const words = q.replace(/[()"]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
  const oq = q.includes(' or ') || q.includes('"') ? q.replace(/ or /g, ' OR ').replace(/ and /g, ' AND ') : words.join(' AND ');
  btn.disabled = true; btn.textContent = 'Searching OpenAlex…';
  try { const r = await oaVenues([[oq, 1]]); if (r && r.map.size) { LIVEQ = {q, map: r.map}; toast(`${r.papers.toLocaleString('en-GB')} recent papers found; ${r.map.size} journals matched`); refresh(); } else toast('No recent papers found for these words'); }
  catch (e) { toast('Live lookup unavailable: ' + e.message); }
  btn.disabled = false; render();
};

/* ---------------- Shortlist ---------------- */
function renderShortlist() {
  const list = [...SL].map(getByKey).filter(Boolean);
  if (!list.length) { $('#slOut').innerHTML = '<div class="empty">Your shortlist is empty. Tap ★ on any journal.</div>'; return; }
  const rows = [
    ['Publisher', j => esc(pubName(j))], ['ABDC 2025', j => j.ab25 || '–', j => ABDC_T[j.ab25] || 0], ['ABDC 2022', j => j.ah?.['22'] || '–'], ...(M.ajg ? [['AJG 2021', j => j.aj21 || '–'], ['AJG field', j => esc(j.ajf || '–')]] : []),
    ...(CUSTOM ? [[esc(CUSTOM.name), j => esc(customVal(j) ?? '–'), j => tierOf(j, 'cu')]] : []),
    ['JCR quartile', j => j.jq || '–', j => Q_T[j.jq] || 0], ['JIF 2024', j => fmt(j.jif), j => j.jif ?? -1], ['5-year JIF', j => fmt(j.jif5), j => j.jif5 ?? -1], ['JCI', j => fmt(j.jci, 2), j => j.jci ?? -1],
    ['Scopus quartile', j => j.sq || '–', j => Q_T[j.sq] || 0], ['SJR', j => fmt(j.sjr, 3), j => j.sjr ?? -1], ['CiteScore', j => j.sp?.cs ?? '–', j => +(j.sp?.cs ?? -1)], ['h-index', j => j.h ?? '–', j => j.h ?? -1],
    ['First decision', j => j.sp?.fd != null ? j.sp.fd + ' days' : '–', j => j.sp?.fd != null ? -(+j.sp.fd) : -1e9],
    ['Decision after review', j => j.sp?.dar != null ? j.sp.dar + ' days' : '–', j => j.sp?.dar != null ? -(+j.sp.dar) : -1e9],
    ['Submission → acceptance', j => j.sp?.sa != null ? j.sp.sa + ' days' : '–', j => j.sp?.sa != null ? -(+String(j.sp.sa).replace(/,/g, '')) : -1e9],
    ['Acceptance → online', j => j.sp?.ap != null ? j.sp.ap + ' days' : '–', j => j.sp?.ap != null ? -(+j.sp.ap) : -1e9],
    ['APC (USD)', j => j.sp?.apc ? '$' + (+j.sp.apc).toLocaleString('en-GB') : '–', j => j.sp?.apc ? -j.sp.apc : -1e9], ['Open access', j => j.dia ? 'Diamond' : (j.oa ? 'Yes' : 'Hybrid/Subscription')],
    ['Categories', j => (j.cat || []).slice(0, 4).map(([c, q]) => esc(M.cats[c]) + (q ? ` (Q${q})` : '')).join('<br>') || '–']
  ];
  $('#slOut').innerHTML = `<div class="tablewrap"><table class="cmp"><thead><tr><th></th>${list.map(j => `<th><a href="#" data-open="${esc(keyOf(j))}">${esc(j.t)}</a> <button class="star on" data-star="${esc(keyOf(j))}" title="Remove">★</button></th>`).join('')}</tr></thead><tbody>${
    rows.map(([l, f, sc]) => { let best = null; if (sc && list.length > 1) { const v = list.map(sc); const m = Math.max(...v); if (m > -1e8 && m !== 0 && m !== -1 && v.filter(x => x === m).length < list.length) best = m; }
      return `<tr><td>${l}</td>${list.map(j => `<td class="${best != null && sc(j) === best ? 'best' : ''}">${f(j)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
  $$('[data-open]').forEach(a => a.onclick = e => { e.preventDefault(); openJournal(getByKey(a.dataset.open)); });
}
$('#slExport').onclick = () => downloadCSV([...SL].map(getByKey).filter(Boolean), 'journalscope_shortlist.csv');
$('#slClear').onclick = () => { if (!SL.size || !confirm('Clear your shortlist?')) return; SL.clear(); store.set('jf_sl', []); $('#slCount').textContent = 0; renderShortlist(); refresh(false); };
$('#slShare').onclick = async () => { const url = location.origin + location.pathname + '#sl=' + [...SL].map(encodeURIComponent).join(','); try { await navigator.clipboard.writeText(url); toast('Share link copied'); } catch (e) { prompt('Copy this link', url); } };

/* ---------------- About + custom import ---------------- */
function renderAbout() {
  const c = M.counts;
  $('#aboutStats').innerHTML = [[c.total, 'Journals in total'], [c.abdc, 'ABDC 2025 listed'], [c.jcr, 'With JIF (JCR 2025)'], [c.sjr, 'In SCImago / Scopus'], [c.speed || 0, 'With publisher speed data'], [M.cats.length, 'Subject categories']]
    .map(([n, l]) => `<div class="stat"><b>${(+n).toLocaleString('en-GB')}</b><span>${l}</span></div>`).join('');
  $('#aboutSources').innerHTML = Object.values(M.sources).map(s => `<li>${esc(s)}</li>`).join('');
  $('#oaKey').value = store.get('jf_oakey', ''); $('#oaMail').value = store.get('jf_oamail', '');
  $('#cuMsg').textContent = CUSTOM ? `Imported: ${CUSTOM.name} (${Object.keys(CUSTOM.map).length.toLocaleString('en-GB')} ISSNs; ratings ${CUSTOM.labels.join(', ')}).` : 'No custom list imported.';
}
$('#oaSave').onclick = () => { store.set('jf_oakey', $('#oaKey').value.trim()); store.set('jf_oamail', $('#oaMail').value.trim()); oaCache.clear(); toast('Saved'); };
function loadXLSX() { return window.XLSX ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load the Excel reader')); document.head.appendChild(s); }); }
function labelRank(l) { const m = String(l).match(/^(\d+(\.\d+)?)(\*)?/); if (m) return +m[1] + (m[3] ? 0.5 : 0); const a = {'A*': 4.5, 'A+': 4.4, 'A': 4, 'B': 3, 'C': 2, 'D': 1}[String(l).toUpperCase()]; if (a) return a; const q = String(l).match(/^Q([1-4])$/i); if (q) return 5 - +q[1]; return 0; }
$('#cuBtn').onclick = async () => {
  if (CUSTOM && CUSTOM.builtin) { $('#cuMsg').textContent = 'This version already includes AJG 2024, so importing another list is switched off.'; return; }
  const f = $('#cuFile').files[0]; if (!f) { toast('Choose a CSV or Excel file'); return; }
  try {
    await loadXLSX();
    const wb = XLSX.read(await f.arrayBuffer(), {type: 'array'});
    let best = null;
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {header: 1, raw: false, defval: ''});
      for (let h = 0; h < Math.min(rows.length, 30); h++) {
        const hdr = rows[h].map(x => String(x).trim()); const ic = hdr.map((x, i) => /issn/i.test(x) ? i : -1).filter(i => i >= 0);
        if (!ic.length) continue;
        let rc = hdr.findIndex((x, i) => !ic.includes(i) && /(rating|rank|grade|ajg|abs|tier|level|score|category|20\d\d)/i.test(x) && !/(field|subject|title|publisher)/i.test(x));
        if (rc < 0) continue;
        const map = {};
        for (const r of rows.slice(h + 1)) { const v = String(r[rc] ?? '').trim(); if (!v) continue; ic.forEach(i => { const s = String(r[i] ?? '').replace(/[^0-9xX]/g, '').toUpperCase(); if (s.length === 8) map[s] = v; }); }
        if (!best || Object.keys(map).length > Object.keys(best.map).length) best = {map, col: hdr[rc]};
        break;
      }
    }
    if (!best || !Object.keys(best.map).length) throw new Error('Could not find an ISSN column and a rating column');
    const labels = [...new Set(Object.values(best.map))].sort((a, b) => labelRank(b) - labelRank(a) || a.localeCompare(b));
    if (labels.length > 12) throw new Error(`The "${best.col}" column has ${labels.length} distinct values; it does not look like a rating`);
    CUSTOM = {name: $('#cuName').value.trim() || best.col || 'Custom list', map: best.map, labels};
    store.set('jf_custom', CUSTOM); setupCustom(); renderAbout(); refresh();
    const matched = J.filter(j => customVal(j) != null).length;
    toast(`Imported ${CUSTOM.name}: matched ${matched} journals`);
  } catch (e) { $('#cuMsg').textContent = 'Import failed: ' + e.message; }
};
$('#cuDel').onclick = () => { CUSTOM = null; store.set('jf_custom', null); F.cu.clear(); const o = $('#pScale option[value=cu]'); if (o) o.remove(); fillTiers(); setupCustom(); renderAbout(); refresh(); };

/* ---------------- boot ---------------- */
setupCustom(); setupAjg();
function fromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('j=')) { const j = getByKey(h.slice(2)); if (j) openJournal(j, false); }
  if (h.startsWith('sl=')) { h.slice(3).split(',').filter(Boolean).forEach(k => { if (getByKey(k)) SL.add(k); }); store.set('jf_sl', [...SL]); $('#slCount').textContent = SL.size; showView('shortlist'); }
}
refresh(); fromHash();
requestAnimationFrame(() => { $('#loading').classList.add('gone'); setTimeout(() => $('#loading').remove(), 400); });
})();
