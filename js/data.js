// Veri katmanı: hareketler, kayıt, tarih yardımcıları, zincir hesapları
const EX = [
  {id:'hang',  name:'Asılı kalma', unit:'sn',     timed:true, icon:'🪝', color:'#38bdf8'},
  {id:'plank', name:'Plank',       unit:'sn',     timed:true, icon:'🧱', color:'#a78bfa'},
  {id:'push',  name:'Şınav',       unit:'tekrar', icon:'💪', color:'#f472b6'},
  {id:'sit',   name:'Mekik',       unit:'tekrar', icon:'🔄', color:'#34d399'},
  {id:'pull',  name:'Barfiks',     unit:'tekrar', icon:'🧗', color:'#fbbf24'},
];
const EXM = Object.fromEntries(EX.map(e => [e.id, e]));
const KEY = 'zincir-v1';
const DEMO = new URLSearchParams(location.search).has('demo');
const SEED_KEY = 'zincir-seed-2';
const SEED = {
  '2026-11-09': {hang:[53,40,30,31], plank:[120,80,60], push:[20,15,7], sit:[15,6,9], pull:[5,4,3]},
  '2026-11-10': {hang:[58,28,30,25], plank:[90,75,75],  push:[15,15,7], sit:[11,7,6], pull:[6,5,3]},
};

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays = (s, n) => { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return ymd(d); };
const diffDays = (a, b) => Math.round((new Date(b+'T12:00:00') - new Date(a+'T12:00:00')) / 864e5);
const dateOf = s => new Date(s+'T12:00:00');
const fmtD = s => dateOf(s).toLocaleDateString('tr-TR', {day:'numeric', month:'short'});
const fmtLong = s => dateOf(s).toLocaleDateString('tr-TR', {weekday:'long', day:'numeric', month:'long'});
const WD = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const wdIdx = s => (dateOf(s).getDay()+6) % 7;
const sum = a => a.reduce((x, y) => x + y, 0);
const avg = a => a.length ? sum(a) / a.length : 0;
const today = () => ymd(new Date());
const fmtSec = s => s >= 3600 ? `${Math.floor(s/3600)} sa ${Math.floor(s%3600/60)} dk`
  : s >= 600 ? `${Math.floor(s/60)} dk${s%60 ? ` ${s%60} sn` : ''}` : `${s} sn`;

function demoData() {
  const o = {}; let seed = 11;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const skip = [33, 32, 21, 14, 13];
  for (let n = 48; n >= 1; n--) {
    if (skip.includes(n)) continue;
    const g = 1 + (48 - n) / 55, j = () => 0.88 + rnd() * 0.24, r = {};
    r.hang = [0,1,2,3].slice(0, 3 + (rnd() > .5)).map(i => Math.round((52 - i*8) * g * j()));
    if (rnd() > .12) r.plank = [0,1,2].map(i => Math.round((115 - i*28) * g * j()));
    if (rnd() > .08) r.push = [0,1,2].map(i => Math.round((19 - i*5) * g * j()));
    if (rnd() > .18) r.sit = [0,1,2].map(i => Math.round((15 - i*4) * g * j()));
    if (rnd() > .25) r.pull = [0,1,2].map(i => Math.max(1, Math.round((5 - i) * g * j())));
    o[addDays(today(), -n)] = r;
  }
  o[today()] = {hang:[61,48], push:[24]};
  return o;
}

const Store = {
  data: {},
  listeners: [],
  load() {
    if (DEMO) { this.data = demoData(); return; }
    let raw = null, seeded = false;
    try { raw = localStorage.getItem(KEY); seeded = !!localStorage.getItem(SEED_KEY); } catch (e) {}
    this.data = raw ? JSON.parse(raw) : {};
    // başlangıç günlerini bir kez ekle; o güne zaten kayıt varsa dokunma
    if (!seeded) for (const [d, r] of Object.entries(SEED)) if (!this.data[d]) this.data[d] = JSON.parse(JSON.stringify(r));
    try { localStorage.setItem(SEED_KEY, '1'); } catch (e) {}
    this.save();
  },
  save() { if (!DEMO) try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {} },
  emit() { this.save(); this.listeners.forEach(f => f()); if (typeof Sync !== 'undefined') Sync.schedule(); },
  sets(d, id) { return (this.data[d] && this.data[d][id]) || []; },
  addSet(d, id, v, at) {
    const r = this.data[d] = this.data[d] || {};
    const s = r[id] = r[id] || [];
    at === undefined ? s.push(v) : s.splice(at, 0, v);
    this.emit();
  },
  removeSet(d, id, i) {
    const r = this.data[d]; if (!r || !r[id]) return;
    const v = r[id].splice(i, 1)[0];
    if (!r[id].length) delete r[id];
    if (!Object.keys(r).length) delete this.data[d];
    this.emit();
    return v;
  },
};

// --- hesaplar ---
const total = (d, id) => sum(Store.sets(d, id));
const doneCount = d => EX.filter(e => Store.sets(d, e.id).length).length;
const workedDays = () => Object.keys(Store.data).filter(d => doneCount(d) > 0).sort();
const exDays = id => workedDays().filter(d => Store.sets(d, id).length);
const lastSession = (id, before) => exDays(id).filter(d => d < before).pop();

function dayState(d) {
  const c = doneCount(d), t = today();
  if (c === EX.length) return 'full';
  if (c > 0) return 'part';
  if (d === t) return 'today';
  if (d > t) return 'future';
  const f = workedDays()[0];
  return (!f || d < f) ? 'none' : 'miss';
}

// tek bir hareketin günlük durumu (hareket zinciri için)
function exDayState(d, id) {
  if (Store.sets(d, id).length) return 'full';
  const t = today();
  if (d === t) return 'today';
  if (d > t) return 'future';
  const f = exDays(id)[0];
  return (!f || d < f) ? 'none' : 'miss';
}

function exStreakInfo(id) {
  const segs = chainSegments(exDays(id)), t = today(), last = segs[segs.length-1];
  const alive = !!last && (last.end === t || last.end === addDays(t, -1));
  return {cur: alive ? last.len : 0, alive, doneToday: !!Store.sets(t, id).length,
    best: Math.max(0, ...segs.map(s => s.len)), days: exDays(id).length, breaks: Math.max(0, segs.length - 1) + (last && !alive ? 1 : 0)};
}

function chainSegments(days = workedDays()) {
  const out = []; let cur = null;
  for (const d of days) {
    if (cur && addDays(cur.end, 1) === d) { cur.end = d; cur.len++; }
    else { cur = {start:d, end:d, len:1}; out.push(cur); }
  }
  return out;
}

function streakInfo() {
  const segs = chainSegments(), t = today(), last = segs[segs.length-1];
  const alive = !!last && (last.end === t || last.end === addDays(t, -1));
  const days = workedDays(), first = days[0];
  return {
    cur: alive ? last.len : 0, alive, segs,
    best: Math.max(0, ...segs.map(s => s.len)),
    days: days.length,
    breaks: Math.max(0, segs.length - 1) + (last && !alive ? 1 : 0),
    span: first ? diffDays(first, t) + 1 : 0,
    first,
  };
}
