// İstatistik ek görselleri: tablolar, ısı tabloları, zaman çizelgeleri
function weekList(n) { const t = today(), ws = addDays(t, -wdIdx(t)); const out = []; for (let i = n - 1; i >= 0; i--) out.push(addDays(ws, -7 * i)); return out; }
const inWeek = (d, w) => d >= w && d < addDays(w, 7);
const heatBg = (v, max, color) => v ? `background:${alpha(color, .12 + .7 * Math.min(1, v / max))};color:${v / max > .55 ? '#000' : 'var(--text)'}` : 'color:#4b5270';
const wkLabel = w => `${fmtD(w)} – ${fmtD(addDays(w, 6))}`;
const dTag = (a, b) => b ? deltaTag(a - b) : '';

/* ---------- SEVİYE ---------- */
// tek setteki en iyi değere göre kaba genel kondisyon eşikleri: Başlangıç, Orta, İleri, Elit
const LEVEL_T = {hang: [20, 45, 90, 150], plank: [30, 60, 120, 240], push: [10, 25, 45, 70], sit: [15, 30, 50, 80], pull: [1, 5, 12, 20]};
const LEVEL_N = ['Acemi', 'Başlangıç', 'Orta', 'İleri', 'Elit'];
function levelOf(id) {
  const best = Math.max(0, ...exDays(id).flatMap(d => Store.sets(d, id))), t = LEVEL_T[id] || (EXM[id].timed ? [20, 45, 90, 150] : [5, 15, 30, 50]);
  const lv = t.filter(x => best >= x).length, lo = lv ? t[lv - 1] : 0, hi = t[lv];
  return {best, lv, hi, p: hi ? (best - lo) / (hi - lo) : 1};
}

/* ---------- ANALİZ: plato, güç/dayanıklılık, tempo (tüm zamanlar) ---------- */
const PLATEAU_N = 3; // bu kadar antrenmandır rekor yoksa plato
function exAnalysis(id) {
  const t = today();
  let ss = exDays(id).map(d => { const s = Store.sets(d, id); return {d, s, tot: sum(s), best: Math.max(...s), first: s[0], ret: s.length > 1 ? avg(s.slice(1)) / s[0] : null}; });
  // bugünkü oturum öncekinden az setliyse henüz bitmemiş: hesaba katma
  const L = ss[ss.length - 1];
  if (L && L.d === t && ss.length > 1 && L.s.length < ss[ss.length - 2].s.length) ss = ss.slice(0, -1);
  const n = ss.length, k = Math.max(1, Math.min(3, Math.floor(n / 3)));
  // plato: son rekordan (tek set ya da toplam) bu yana kaç antrenman geçti
  let bB = 0, bT = 0, lastPR = 0;
  ss.forEach((x, i) => { if (x.best > bB || x.tot > bT) lastPR = i; bB = Math.max(bB, x.best); bT = Math.max(bT, x.tot); });
  const since = n ? n - 1 - lastPR : 0;
  // güç = ilk set, dayanıklılık = sonraki setlerin ilk sete oranı
  const firsts = ss.map(x => x.first), rets = ss.filter(x => x.ret !== null).map(x => x.ret);
  const kr = Math.max(1, Math.min(3, Math.floor(rets.length / 3)));
  const power = n ? avg(firsts.slice(-k)) : null, powerD = n > 1 ? pct(avg(firsts.slice(-k)), avg(firsts.slice(0, k))) : null;
  const endur = rets.length ? avg(rets.slice(-kr)) : null, endurD = rets.length > 1 ? Math.round((avg(rets.slice(-kr)) - avg(rets.slice(0, kr))) * 100) : null;
  // tempo: tek setteki en iyinin günlere göre eğimi
  // tempo: son 8 antrenmandaki en iyi setin günlere göre eğimi (eski dönem bugünkü hızı bozmasın)
  const rc = ss.slice(-8), lr = n >= TREND_MIN ? linreg(rc.map(x => [diffDays(rc[0].d, x.d), x.best])) : null;
  const perWeek = lr ? lr.m * 7 : null, perWeekP = lr ? Math.round(lr.m * 7 / Math.max(1, avg(rc.map(x => x.best))) * 100) : null;
  const plateau = n > PLATEAU_N && since >= PLATEAU_N, L2 = levelOf(id); let eta = null;
  if (lr && lr.m > 0 && L2.hi && !plateau) { const x = (L2.hi - lr.b) / lr.m; eta = addDays(rc[0].d, Math.max(diffDays(rc[0].d, t) + 1, Math.ceil(x))); }
  return {ss, n, since, plateau, power, powerD, endur, endurD, perWeek, perWeekP, eta, lvl: L2};
}
const plateauTip = e => e.timed ? 'Bir gün tam dinlen, sonra ilk sette 5 sn fazlasını hedefle.' : 'Bir gün tam dinlen, sonra ilk sette 1 tekrar fazlasını hedefle.';
const signed = (v, f = x => x) => (v >= 0 ? '+' : '−') + f(Math.abs(v));

function levelHTML() {
  return `<h2>Seviyen</h2>
  <div class="lvls">${EX.map(e => { const A = exAnalysis(e.id), L = A.lvl; return `<div class="card lvl" style="--c:${e.color}">
    <div class="lvl-h"><span>${e.icon} ${e.name}</span><b>${LEVEL_N[L.lv]}</b></div>
    <div class="lvl-pips">${LEVEL_N.slice(1).map((_, i) => `<i><u style="width:${i < L.lv ? 100 : i === L.lv ? Math.round(L.p * 100) : 0}%"></u></i>`).join('')}</div>
    <small>En iyi set <b>${L.best ? fmtU(e.id, L.best) : '—'}</b>${L.hi ? ` · ${LEVEL_N[L.lv + 1]} için <b>${fmtU(e.id, L.hi - L.best)}</b> daha` : ' · zirvedesin'}</small>
    <small class="lvl-t">${A.perWeek === null ? `⏱ Tempo ve hedef tarihi ${TREND_MIN} antrenmandan sonra (şu an ${A.n})`
      : `⏱ Haftada <b class="${A.perWeek >= 0 ? 'up' : 'down'}">${signed(A.perWeek, v => fmtU(e.id, v))}</b> (%${A.perWeekP})${A.eta ? ` · ${LEVEL_N[L.lv + 1]} ~<b>${fmtD(A.eta)}</b>` : !L.hi ? '' : A.plateau ? ' · tarih plato bitince' : ' · bu tempoyla sonraki seviye yok'}`}</small>
    ${A.plateau ? `<small class="lvl-p">⏸ Plato: ${A.since} antrenmandır rekor yok. ${plateauTip(e)}</small>` : ''}
  </div>`; }).join('')}</div>
  <p class="how lvl-note">Seviye tek setteki en iyi değerine göre; eşikler genel kondisyon ölçütleri, kesin değil. Tempo, son 8 antrenmanda en iyi setinin haftalık değişimi; tarih bu tempo sürerse tahmini.</p>`;
}

function powerHTML() {
  const rows = EX.map(e => ({e, A: exAnalysis(e.id)})).filter(r => r.A.n);
  if (!rows.length) return '';
  return `<h2>Güç ve dayanıklılık</h2>
  <div class="card tbl-wrap"><p class="how"><b>Güç</b> = ilk setin (dinçken ne yapabildiğin). <b>Dayanıklılık</b> = sonraki setlerde ilk setin yüzde kaçını koruyabildiğin. Oklar ilk antrenmanlarına göre değişim. %70'in altındaki koruma, setler arası düşüşün sert olduğunu gösterir.</p>
  <table class="tbl"><thead><tr><th>Hareket</th><th>Güç</th><th>Dayanıklılık</th><th>Odak</th></tr></thead>
  <tbody>${rows.map(({e, A}) => { const focus = A.endur === null ? '—' : A.endur < .7 ? '🫁 Dayanıklılık' : (A.powerD !== null && A.powerD <= 0) ? '💥 Güç' : A.endur < .85 ? '🫁 Dayanıklılık' : '💥 Güç';
    return `<tr><td style="color:${e.color}"><b>${e.icon} ${e.name}</b></td>
    <td><b>${fmtU(e.id, A.power)}</b> ${A.powerD === null ? '' : pctTag(A.powerD)}</td>
    <td>${A.endur === null ? '<span class="muted">tek set</span>' : `<b>%${Math.round(A.endur * 100)}</b> ${A.endurD === null ? '' : `<span class="${A.endurD >= 0 ? 'up' : 'down'}">${A.endurD >= 0 ? '▲' : '▼'} ${Math.abs(A.endurD)} puan</span>`}`}</td>
    <td>${focus}</td></tr>`; }).join('')}</tbody></table></div>`;
}

/* ---------- GENEL BAKIŞ EKLERİ ---------- */
function ovExtraHTML(all = workedDays()) {
  const t = today(), cw = addDays(t, -wdIdx(t));
  const weeks = weekList(10).filter((w, i, arr) => all.some(d => inWeek(d, w)) || i === arr.length - 1);
  const mk = ds => ({n: ds.length, full: ds.filter(isFull).length,
    tot: Object.fromEntries(EX.map(e => [e.id, sum(ds.map(d => total(d, e.id)))]))});
  const rows = weeks.map(w => ({w, ...mk(all.filter(d => inWeek(d, w)))}));
  // bu hafta henüz bitmedi: geçen haftanın aynı noktasıyla kıyasla
  const curRow = rows.find(r => r.w === cw);
  if (curRow) curRow.cmp = mk(all.filter(d => d >= addDays(cw, -7) && d <= addDays(t, -7)));
  const maxT = Object.fromEntries(EX.map(e => [e.id, Math.max(1, ...rows.map(r => r.tot[e.id]))]));

  // rekorlar
  const prs = EX.map(e => {
    let best = 0, bd = '', cnt = 0, lastPR = '';
    exDays(e.id).forEach(d => Store.sets(d, e.id).forEach(v => { if (v > best) { if (best) { cnt++; lastPR = d; } best = v; bd = d; } }));
    const bestDay = exDays(e.id).map(d => ({d, v: total(d, e.id)})).sort((a, b) => b.v - a.v)[0];
    return {e, best, bd, cnt, lastPR, bestDay};
  });

  // hareket × haftanın günü
  const wdAvg = EX.map(e => WD.map((_, i) => { const ds = exDays(e.id).filter(d => wdIdx(d) === i); return ds.length ? avg(ds.map(d => total(d, e.id))) : 0; }));

  return `
  <h2>Haftalık özet</h2>
  <div class="card tbl-wrap"><p class="how">Her satır bir hafta. Hareket sütunlarında o haftanın toplamı, yanında bir önceki haftaya göre fark (bu hafta için: geçen haftanın aynı noktasına göre). Renk koyulaştıkça o hareketin en iyi haftasına yaklaşıyorsun.</p>
  <table class="tbl htbl"><thead><tr><th>Hafta</th><th>Gün</th><th>Tam</th>${EX.map(e => `<th style="color:${e.color}">${e.icon} ${e.name}</th>`).join('')}</tr></thead>
  <tbody>${[...rows].reverse().map((r, i, arr) => { const p = r.cmp || arr[i + 1]; return `<tr class="${r.w === cw ? 'cur' : ''}">
    <td><b>${wkLabel(r.w)}</b>${r.w === cw ? ' <small>bu hafta</small>' : ''}</td>
    <td>${r.n}<small>/7</small></td><td>${r.full ? '⭐'.repeat(Math.min(r.full, 7)) : '—'}</td>
    ${EX.map(e => `<td style="${heatBg(r.tot[e.id], maxT[e.id], e.color)}"><b>${r.tot[e.id] ? fmtV(e.id, r.tot[e.id]) : '—'}</b> ${p ? dTag(r.tot[e.id], p.tot[e.id]) : ''}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>

  <div class="grid2">
    <div><h2>Rekor tablosu</h2><div class="card tbl-wrap"><table class="tbl">
      <thead><tr><th>Hareket</th><th>Rekor set</th><th>En iyi gün</th><th>Kırılan</th><th>Son rekor</th></tr></thead>
      <tbody>${prs.map(p => `<tr><td style="color:${p.e.color}"><b>${p.e.icon} ${p.e.name}</b></td>
        <td><b class="gold">${p.best ? fmtV(p.e.id, p.best) : '—'}</b><small> ${p.bd ? fmtD(p.bd) : ''}</small></td>
        <td>${p.bestDay ? `<b>${fmtV(p.e.id, p.bestDay.v)}</b><small> ${fmtD(p.bestDay.d)}</small>` : '—'}</td>
        <td>${p.cnt ? p.cnt + ' 🏆' : '—'}</td><td>${p.lastPR ? ago(p.lastPR) : '—'}</td></tr>`).join('')}</tbody></table></div></div>
    <div><h2>Rekor zaman çizelgesi</h2><div class="card chc"><p class="how">${few(all.length, 3, 'antrenman gün')}Her nokta bir rekor kırılan gün (ilk gün sayılmaz). Boşluklar uzadıkça platoya giriyorsun demektir.</p>
      <div class="ch h260"><div class="chi"><canvas id="cPRt"></canvas></div></div></div></div>
  </div>

  <h2>Hangi gün hangi harekette iyisin</h2>
  <div class="card tbl-wrap"><p class="how">Haftanın günlerine göre ortalama antrenman toplamı. Satırdaki en koyu hücre o hareket için en verimli günün.</p>
  <table class="tbl htbl"><thead><tr><th></th>${WD.map(w => `<th>${w}</th>`).join('')}<th>En iyi</th></tr></thead>
  <tbody>${EX.map((e, i) => { const mx = Math.max(1, ...wdAvg[i]), bi = wdAvg[i].indexOf(Math.max(...wdAvg[i])); return `<tr><td style="color:${e.color}"><b>${e.icon} ${e.name}</b></td>
    ${wdAvg[i].map(v => `<td style="${heatBg(v, mx, e.color)}">${v ? fmtV(e.id, v) : '·'}</td>`).join('')}<td><b>${wdAvg[i][bi] ? WD[bi] : '—'}</b></td></tr>`; }).join('')}</tbody></table></div>`;
}

function ovExtraCharts(all = workedDays()) {
  if (!all.length) return;
  const f = all[0], t = today(), span = diffDays(f, t);
  // rekor zaman çizelgesi
  const pts = EX.flatMap((e, i) => { let best = 0; const out = []; exDays(e.id).forEach(d => { const m = Math.max(...Store.sets(d, e.id)); if (m > best) { if (best) out.push({x: diffDays(f, d), y: i, v: m}); best = m; } }); return out.map(p => ({...p, e})); });
  chart('cPRt', {type: 'scatter', data: {datasets: EX.map((e, i) => ({label: e.name, data: pts.filter(p => p.y === i), backgroundColor: e.color, pointRadius: 7, pointHoverRadius: 9, pointStyle: 'rectRot'}))},
    options: {plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${c.raw.e.name}: ${c.raw.v} ${c.raw.e.unit} · ${fmtD(addDays(f, c.raw.x))}`}}},
      scales: {x: {min: 0, max: Math.max(span, 7), ticks: {callback: v => fmtD(addDays(f, Math.round(v))), maxTicksLimit: 8}, grid: {display: false}},
        y: {min: -.5, max: EX.length - .5, afterBuildTicks: sc => { sc.ticks = EX.map((_, i) => ({value: i})); }, ticks: {callback: v => EX[v] ? EX[v].icon + ' ' + EX[v].name : ''}, grid: {color: '#1a1f30'}}}}});
}

/* ---------- HAREKET DETAYI EKLERİ ---------- */
function exExtraHTML(e, s) {
  const id = e.id, best = Math.max(...s.flatMap(x => x.s)), maxSets = Math.max(...s.map(x => x.s.length));
  const last = [...s].slice(-20);
  // dinlenme etkisi
  const buckets = {1: [], 2: [], 3: []};
  s.forEach((x, i) => { if (!i) return; const g = Math.min(3, diffDays(s[i - 1].d, x.d)); buckets[g].push(x); });
  const bRows = [[1, 'Ardışık gün'], [2, '1 gün ara'], [3, '2+ gün ara']].map(([g, l]) => ({g, l, n: buckets[g].length, tot: buckets[g].length ? avg(buckets[g].map(x => x.tot)) : 0, best: buckets[g].length ? avg(buckets[g].map(x => x.best)) : 0}));
  const bBest = bRows.filter(r => r.n).sort((a, b) => b.tot - a.tot)[0];
  // haftalık
  const weeks = weekList(10).filter(w => s.some(x => inWeek(x.d, w)));
  const wRows = weeks.map(w => { const xs = s.filter(x => inWeek(x.d, w)); return {w, n: xs.length, tot: sum(xs.map(x => x.tot)), avg: avg(xs.map(x => x.tot)), best: Math.max(...xs.map(x => x.best))}; });

  return `
  <h2>Set ısı tablosu</h2>
  <div class="card tbl-wrap"><p class="how">Her satır bir antrenman, her sütun bir set. Renk koyulaştıkça rekora yaklaşıyor. Yatayda sönmeyi, dikeyde gelişmeyi görürsün.</p>
  <table class="tbl htbl"><thead><tr><th>Tarih</th>${Array.from({length: maxSets}, (_, i) => `<th style="color:${SETC[i] || '#888'}">${i + 1}. set</th>`).join('')}<th>Toplam</th><th>Fark</th></tr></thead>
  <tbody>${[...last].reverse().map((x, i, arr) => { const p = arr[i + 1]; return `<tr><td><b>${fmtD(x.d)}</b> <small>${WD[wdIdx(x.d)]}</small></td>
    ${Array.from({length: maxSets}, (_, j) => x.s[j] === undefined ? '<td style="color:#2a3047">·</td>' : `<td style="${heatBg(x.s[j], best, e.color)}">${x.s[j]}${x.s[j] === best ? ' 🏆' : ''}</td>`).join('')}
    <td><b>${fmtV(id, x.tot)}</b></td><td>${p ? deltaTag(x.tot - p.tot) : ''}</td></tr>`; }).join('')}</tbody></table></div>

  <div class="grid2">
    <div><h2>Haftanın günleri</h2><div class="card chc"><p class="how">${few(s.length, 7)}Günlere göre ortalama antrenman toplamı. Hangi gün daha güçlüsün?</p>
      <div class="ch h240"><div class="chi"><canvas id="cExWd"></canvas></div></div></div></div>
    <div><h2>Dinlenme etkisi</h2><div class="card tbl-wrap"><p class="how">${few(s.length, 6)}Bir önceki antrenmandan kaç gün sonra yapınca daha iyi gidiyor?${bBest ? ` Şu an en verimlisi: <b style="color:${e.color}">${bBest.l.toLowerCase()}</b>.` : ''}</p>
      <table class="tbl"><thead><tr><th>Ara</th><th>Antrenman</th><th>Ort. toplam</th><th>Ort. en iyi set</th></tr></thead>
      <tbody>${bRows.map(r => `<tr class="${r === bBest ? 'cur' : ''}"><td><b>${r.l}</b></td><td>${r.n || '—'}</td><td>${r.n ? `<b>${fmtV(id, r.tot)}</b>` : '—'}</td><td>${r.n ? fmtV(id, r.best) : '—'}</td></tr>`).join('')}</tbody></table></div></div>
  </div>

  <div class="grid2">
    <div><h2>Haftalık gelişim</h2><div class="card tbl-wrap"><table class="tbl">
      <thead><tr><th>Hafta</th><th>Antr.</th><th>Toplam</th><th>Ort.</th><th>En iyi set</th></tr></thead>
      <tbody>${[...wRows].reverse().map((r, i, arr) => { const p = arr[i + 1]; return `<tr class="${i === 0 ? 'cur' : ''}"><td><b>${wkLabel(r.w)}</b></td><td>${r.n}</td>
        <td><b>${fmtV(id, r.tot)}</b> ${p ? dTag(r.tot, p.tot) : ''}</td><td>${fmtV(id, r.avg)}</td><td>${r.best}${r.best === best ? ' 🏆' : ''} ${p ? dTag(r.best, p.best) : ''}</td></tr>`; }).join('')}</tbody></table></div></div>
    <div><h2>Birikimli toplam</h2><div class="card chc"><p class="how">Başlangıçtan bu yana toplam ${e.unit}.</p>
      <div class="ch h240"><div class="chi"><canvas id="cExCum"></canvas></div></div></div></div>
  </div>`;
}

function exExtraCharts(e, s) {
  const wd = WD.map((_, i) => { const xs = s.filter(x => wdIdx(x.d) === i); return xs.length ? +avg(xs.map(x => x.tot)).toFixed(1) : 0; });
  const mx = Math.max(...wd);
  chart('cExWd', {type: 'bar', data: {labels: WD, datasets: [{label: 'Ort. toplam', data: wd, backgroundColor: wd.map(v => v === mx ? e.color : alpha(e.color, .4)), borderRadius: 6}]},
    options: {plugins: {legend: {display: false}, tooltip: tipLabel(e.id)}, scales: {x: {grid: {display: false}}, y: {min: 0, title: {display: true, text: e.unit}}}}});
  let acc = 0;
  chart('cExCum', {type: 'line', data: {labels: s.map(x => fmtD(x.d)), datasets: [{label: 'Birikimli', data: s.map(x => acc += x.tot), borderColor: e.color, backgroundColor: ctx => grad(ctx, e.color), fill: true, tension: .2, pointRadius: 3, borderWidth: 2.5}]},
    options: {interaction: {mode: 'index', intersect: false}, plugins: {legend: {display: false}, tooltip: tipLabel(e.id)}, scales: {x: {grid: {display: false}, ticks: {maxTicksLimit: 8}}, y: {min: 0}}}});
}
