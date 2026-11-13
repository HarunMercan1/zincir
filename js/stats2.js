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

  return `
  <h2>Haftalık özet</h2>
  <div class="card tbl-wrap"><p class="how">Her satır bir hafta. Hareket sütunlarında o haftanın toplamı, yanında bir önceki haftaya göre fark (bu hafta için: geçen haftanın aynı noktasına göre). Renk koyulaştıkça o hareketin en iyi haftasına yaklaşıyorsun.</p>
  <table class="tbl htbl"><thead><tr><th>Hafta</th><th>Gün</th><th>Tam</th>${EX.map(e => `<th style="color:${e.color}">${e.icon} ${e.name}</th>`).join('')}</tr></thead>
  <tbody>${[...rows].reverse().map((r, i, arr) => { const p = r.cmp || arr[i + 1]; return `<tr class="${r.w === cw ? 'cur' : ''}">
    <td><b>${wkLabel(r.w)}</b>${r.w === cw ? ' <small>bu hafta</small>' : ''}</td>
    <td>${r.n}<small>/7</small></td><td>${r.full ? '⭐'.repeat(Math.min(r.full, 7)) : '—'}</td>
    ${EX.map(e => `<td style="${heatBg(r.tot[e.id], maxT[e.id], e.color)}"><b>${r.tot[e.id] ? fmtV(e.id, r.tot[e.id]) : '—'}</b> ${p ? dTag(r.tot[e.id], p.tot[e.id]) : ''}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>

  <h2>Rekor tablosu</h2><div class="card tbl-wrap"><table class="tbl">
      <thead><tr><th>Hareket</th><th>Rekor set</th><th>En iyi gün</th><th>Kırılan</th><th>Son rekor</th></tr></thead>
      <tbody>${prs.map(p => `<tr><td style="color:${p.e.color}"><b>${p.e.icon} ${p.e.name}</b></td>
        <td><b class="gold">${p.best ? fmtV(p.e.id, p.best) : '—'}</b><small> ${p.bd ? fmtD(p.bd) : ''}</small></td>
        <td>${p.bestDay ? `<b>${fmtV(p.e.id, p.bestDay.v)}</b><small> ${fmtD(p.bestDay.d)}</small>` : '—'}</td>
        <td>${p.cnt ? p.cnt + ' 🏆' : '—'}</td><td>${p.lastPR ? ago(p.lastPR) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ---------- HAREKET DETAYI EKLERİ ---------- */
function exExtraHTML(e, s) {
  const id = e.id, best = Math.max(...s.flatMap(x => x.s));
  // dinlenme etkisi
  const buckets = {1: [], 2: [], 3: []};
  s.forEach((x, i) => { if (!i) return; const g = Math.min(3, diffDays(s[i - 1].d, x.d)); buckets[g].push(x); });
  const bRows = [[1, 'Ardışık gün'], [2, '1 gün ara'], [3, '2+ gün ara']].map(([g, l]) => ({g, l, n: buckets[g].length, tot: buckets[g].length ? avg(buckets[g].map(x => x.tot)) : 0, best: buckets[g].length ? avg(buckets[g].map(x => x.best)) : 0}));
  const bBest = bRows.filter(r => r.n).sort((a, b) => b.tot - a.tot)[0];
  // haftalık
  const weeks = weekList(10).filter(w => s.some(x => inWeek(x.d, w)));
  const wRows = weeks.map(w => { const xs = s.filter(x => inWeek(x.d, w)); return {w, n: xs.length, tot: sum(xs.map(x => x.tot)), avg: avg(xs.map(x => x.tot)), best: Math.max(...xs.map(x => x.best))}; });

  return `
  <div class="grid2">
    <div><h2>Dinlenme etkisi</h2><div class="card tbl-wrap"><p class="how">${few(s.length, 6)}Bir önceki antrenmandan kaç gün sonra yapınca daha iyi gidiyor?${bBest ? ` Şu an en verimlisi: <b style="color:${e.color}">${bBest.l.toLowerCase()}</b>.` : ''}</p>
      <table class="tbl"><thead><tr><th>Ara</th><th>Antrenman</th><th>Ort. toplam</th><th>Ort. en iyi set</th></tr></thead>
      <tbody>${bRows.map(r => `<tr class="${r === bBest ? 'cur' : ''}"><td><b>${r.l}</b></td><td>${r.n || '—'}</td><td>${r.n ? `<b>${fmtV(id, r.tot)}</b>` : '—'}</td><td>${r.n ? fmtV(id, r.best) : '—'}</td></tr>`).join('')}</tbody></table></div></div>
    <div><h2>Haftalık gelişim</h2><div class="card tbl-wrap"><table class="tbl">
      <thead><tr><th>Hafta</th><th>Antr.</th><th>Toplam</th><th>Ort.</th><th>En iyi set</th></tr></thead>
      <tbody>${[...wRows].reverse().map((r, i, arr) => { const p = arr[i + 1]; return `<tr class="${i === 0 ? 'cur' : ''}"><td><b>${wkLabel(r.w)}</b></td><td>${r.n}</td>
        <td><b>${fmtV(id, r.tot)}</b> ${p ? dTag(r.tot, p.tot) : ''}</td><td>${fmtV(id, r.avg)}</td><td>${r.best}${r.best === best ? ' 🏆' : ''} ${p ? dTag(r.best, p.best) : ''}</td></tr>`; }).join('')}</tbody></table></div></div>
  </div>`;
}

/* ---------- YENİ: rekor geçmişi, son antrenmanlar kıyası, sıradaki hedef ---------- */
// tek setteki rekorun tüm zamanlar boyunca kırıldığı günler (ilk gün = başlangıç)
function prHistory(id) {
  let best = 0, prevD = null; const out = [];
  exDays(id).forEach(d => { const m = Math.max(...Store.sets(d, id)); if (m > best) { out.push({d, v: m, gain: best ? m - best : null, gap: prevD ? diffDays(prevD, d) : null}); best = m; prevD = d; } });
  return out;
}

function prHistHTML(e) {
  const h = prHistory(e.id), id = e.id, t = today();
  if (!h.length) return '';
  const lastPR = h[h.length - 1], rows = h.slice(-8).reverse();
  return `<div class="card tbl-wrap"><p class="how">Tek sette rekorunu kırdığın her gün. Son rekor <b>${ago(lastPR.d)}</b>${h.length > 1 ? `, ilk günden bu yana <b class="up">${signed(lastPR.v - h[0].v, v => fmtU(id, v))}</b>` : ''}.</p>
    <table class="tbl"><thead><tr><th>Tarih</th><th>Rekor set</th><th>Artış</th><th>Arada</th></tr></thead>
    <tbody>${rows.map(r => `<tr class="${r === lastPR ? 'cur' : ''}"><td><b>${fmtD(r.d)}</b> <small>${WD[wdIdx(r.d)]}</small></td>
      <td><b class="gold">${fmtU(id, r.v)}</b></td>
      <td>${r.gain === null ? '<span class="muted">başlangıç</span>' : `<span class="up">▲ ${fmtV(id, r.gain)}</span>`}</td>
      <td>${r.gap === null ? '—' : r.gap + ' gün'}</td></tr>`).join('')}</tbody></table>
    ${diffDays(lastPR.d, t) >= 7 ? `<p class="how" style="margin-top:8px">⚠ ${diffDays(lastPR.d, t)} gündür rekor yok.</p>` : ''}</div>`;
}

// son k antrenman ile ondan önceki k antrenmanı yan yana koyar
function recentCmpHTML(e, done) {
  const id = e.id, n = done.length;
  if (n < 4) return `<div class="card"><p class="how">Karşılaştırma için en az 4 tamamlanmış antrenman gerekiyor (şu an ${n}).</p></div>`;
  const k = Math.min(5, Math.floor(n / 2)), A = done.slice(-2 * k, -k), B = done.slice(-k);
  const m = (xs, f) => avg(xs.map(f));
  const drop = x => x.s.length > 1 ? (1 - x.s[x.s.length - 1] / x.s[0]) * 100 : null;
  const dropAvg = xs => { const v = xs.map(drop).filter(x => x !== null); return v.length ? avg(v) : null; };
  const rows = [
    ['İlk set', m(A, x => x.s[0]), m(B, x => x.s[0]), 'dinçken ne yapabildiğin'],
    ['En iyi set', m(A, x => x.best), m(B, x => x.best), ''],
    ['Antrenman toplamı', m(A, x => x.tot), m(B, x => x.tot), ''],
    ['Set sayısı', m(A, x => x.s.length), m(B, x => x.s.length), '', true],
  ];
  const dA = dropAvg(A), dB = dropAvg(B);
  return `<div class="card tbl-wrap"><p class="how">Son <b>${k}</b> antrenmanın ortalaması, ondan önceki ${k} antrenmanla kıyaslandı. Tek tek günlerin iniş çıkışı yerine gerçek yönü gösterir.</p>
    <table class="tbl"><thead><tr><th></th><th>Önceki</th><th>Son</th><th>Fark</th></tr></thead>
    <tbody>${rows.map(([l, a, b, sub, plain]) => `<tr><td><span class="rl">${l}</span>${sub ? ` <small>${sub}</small>` : ''}</td>
      <td>${plain ? a.toFixed(1) : fmtU(id, a)}</td><td><b>${plain ? b.toFixed(1) : fmtU(id, b)}</b></td><td>${pctTag(pct(b, a))}</td></tr>`).join('')}
    ${dA !== null && dB !== null ? `<tr><td><span class="rl">Setler arası düşüş</span> <small>azalması iyi</small></td><td>%${Math.round(dA)}</td><td><b>%${Math.round(dB)}</b></td>
      <td><span class="${dB <= dA ? 'up' : 'down'}">${dB <= dA ? '▲' : '▼'} ${Math.abs(Math.round(dB - dA))} puan</span></td></tr>` : ''}</tbody></table></div>`;
}

// düzen ve form kutuları (tüm zamanlar)
function habitHTML(e, done, best) {
  const id = e.id, t = today(), ds = exDays(id), st = exStreakInfo(id);
  const gaps = ds.slice(1).map((d, i) => ({d, g: diffDays(ds[i], d)}));
  const maxGap = gaps.reduce((m, x) => x.g > m.g ? x : m, {g: 0});
  const n30 = ds.filter(d => d > addDays(t, -30)).length, span30 = Math.min(30, diffDays(ds[0], t) + 1);
  const last = done[done.length - 1], last3 = done.slice(-3);
  const formL = last ? Math.round(last.best / best * 100) : null, form3 = last3.length ? Math.round(avg(last3.map(x => x.best)) / best * 100) : null;
  const fcls = v => v === null ? '' : v >= 95 ? 'good' : v < 80 ? 'bad' : '';
  return `<div class="tgroup"><h3>🔁 Düzen <small>ne sıklıkla yapıyorsun</small></h3><div class="tiles">
    ${tile(st.cur + ' gün', 'Hareket zinciri', `en uzun: ${st.best} gün`, st.cur ? 'good' : 'bad')}
    ${tile(gaps.length ? (avg(gaps.map(x => x.g))).toFixed(1).replace('.0', '') + ' gün' : '—', 'Ortalama ara', 'iki antrenman arası')}
    ${tile(maxGap.g > 1 ? (maxGap.g - 1) + ' gün' : '—', 'En uzun ara', maxGap.g > 1 ? `${fmtD(maxGap.d)} öncesi boşluk` : 'hiç gün kaçırmadın', maxGap.g > 1 ? '' : 'good')}
    ${tile(`${n30}/${span30}`, 'Son 30 gün', `günün %${Math.round(n30 / span30 * 100)}'inde yaptın`)}
  </div></div>
  <div class="tgroup"><h3>🔥 Form <small>rekoruna ne kadar yakınsın</small></h3><div class="tiles">
    ${tile(formL === null ? '—' : '%' + formL, 'Son antrenman', last ? `en iyi set ${fmtU(id, last.best)} · rekor ${fmtU(id, best)}` : '', fcls(formL))}
    ${tile(form3 === null ? '—' : '%' + form3, 'Son 3 antrenman', 'en iyi setlerin ortalaması / rekor', fcls(form3))}
    ${tile(last && best > last.best ? fmtU(id, best - last.best) : '🏆', 'Rekora kalan', last && best > last.best ? 'son antrenmana göre' : 'son antrenmanda rekordasın', last && best > last.best ? '' : 'gold')}
  </div></div>`;
}

// her set sırasının kendi rekoru (tüm zamanlar)
function setPRHTML(e) {
  const id = e.id, ds = exDays(id), n = Math.min(SETC.length, Math.max(0, ...ds.map(d => Store.sets(d, id).length)));
  const rows = Array.from({length: n}, (_, i) => {
    let b = 0, bd = null, lv = null, ld = null;
    ds.forEach(d => { const v = Store.sets(d, id)[i]; if (v === undefined) return; if (v > b) { b = v; bd = d; } lv = v; ld = d; });
    return {i, b, bd, lv, ld};
  }).filter(r => r.bd);
  return `<div class="card tbl-wrap"><p class="how">Her set sırasının ayrı rekoru. Sadece ilk sete değil, sonraki setlere de hedef koy.</p>
    <table class="tbl"><thead><tr><th>Set</th><th>Rekor</th><th>Son</th><th>Kalan</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td><span class="rl" style="color:${SETC[r.i]}">● ${r.i + 1}. set</span></td>
      <td><b class="gold">${fmtU(id, r.b)}</b> <small>${fmtD(r.bd)}</small></td>
      <td>${fmtU(id, r.lv)} <small>${fmtD(r.ld)}</small></td>
      <td>${r.lv >= r.b ? '<span class="up">🏆 rekorda</span>' : fmtU(id, r.b - r.lv)}</td></tr>`).join('')}</tbody></table></div>`;
}

// toplam hacimde sıradaki eşik
const MILES_R = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
const MILES_S = [600, 1800, 3600, 7200, 18000, 36000, 72000, 180000, 360000];
function mileInfo(e) {
  const id = e.id, t = today(), ds = exDays(id), tot = sum(ds.map(d => total(d, id)));
  const miles = e.timed ? MILES_S : MILES_R, next = miles.find(m => m > tot), prev = [...miles].reverse().find(m => m <= tot) || 0;
  const pace = sum(ds.filter(d => d > addDays(t, -14)).map(d => total(d, id))) / 14;
  const p = next ? Math.round((tot - prev) / (next - prev) * 100) : 100, eta = next && pace > 0 ? addDays(t, Math.ceil((next - tot) / pace)) : null;
  return {tot, next, prev, pace, p, eta};
}
function milestoneHTML(e) {
  const id = e.id, {tot, next, prev, pace, p, eta} = mileInfo(e);
  if (!next) return `<div class="card"><p class="how">Tüm eşikleri geçtin: toplam <b>${fmtU(id, tot)}</b> 🏆</p></div>`;
  return `<div class="card mile" style="--c:${e.color}"><p class="how">Başladığından beri toplam <b>${fmtU(id, tot)}</b>${prev ? ` · geçtiğin son eşik ${fmtU(id, prev)}` : ''}.</p>
    <div class="mile-h"><span>Sıradaki: <b>${fmtU(id, next)}</b></span><span>${fmtU(id, next - tot)} kaldı</span></div>
    <div class="mile-bar"><u style="width:${p}%"></u></div>
    <p class="how" style="margin-top:8px">${eta ? `Son 14 günün temposuyla (günde ~${fmtU(id, pace)}) <b>${fmtD(eta)}</b> civarı.` : 'Son 14 günde kayıt yok, tahmin yapılamıyor.'}</p></div>`;
}

/* ---------- GENEL SAYFA: hareket durumu, son rekorlar, aylık kıyas ---------- */
function exStatusHTML() {
  const rows = EX.map(e => {
    const id = e.id, ds = exDays(id); if (!ds.length) return null;
    const best = Math.max(...ds.flatMap(d => Store.sets(d, id))), lastD = ds[ds.length - 1];
    const form = Math.round(Math.max(...Store.sets(lastD, id)) / best * 100);
    return {e, st: exStreakInfo(id), lastD, form, m: mileInfo(e)};
  }).filter(Boolean);
  if (!rows.length) return '';
  const fc = v => v >= 95 ? 'up' : v < 80 ? 'down' : '';
  return `<h2>Hareket durumu</h2>
  <div class="card tbl-wrap"><p class="how"><b>Form</b> = son antrenmandaki en iyi setin, rekorunun yüzde kaçı. <b>Kilometre taşı</b> = başlangıçtan beri toplamda sıradaki eşiğe ilerleme.</p>
  <table class="tbl"><thead><tr><th>Hareket</th><th>Zincir</th><th>Son yapılış</th><th>Form</th><th>Kilometre taşı</th></tr></thead>
  <tbody>${rows.map(({e, st, lastD, form, m}) => `<tr><td style="color:${e.color}"><span class="rl" style="color:${e.color}">${e.icon} ${e.name}</span></td>
    <td>${st.cur ? `🔥 ${st.cur} gün` : '<span class="down">kırık</span>'}</td>
    <td>${ago(lastD)}</td>
    <td><span class="${fc(form)}">%${form}</span>${form >= 100 ? ' 🏆' : ''}</td>
    <td>${m.next ? `<div class="mini-mile" style="--c:${e.color}"><div class="mile-bar"><u style="width:${m.p}%"></u></div><small>${fmtU(e.id, m.tot)} / ${fmtU(e.id, m.next)}</small></div>` : '🏆 hepsi'}</td></tr>`).join('')}</tbody></table></div>`;
}

function recentPRsHTML() {
  const t = today(), all = EX.flatMap(e => prHistory(e.id).filter(r => r.gain !== null).map(r => ({...r, e}))).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 10);
  if (!all.length) return `<div class="card"><p class="how">Henüz kırılmış rekor yok. İlk antrenman gününden sonraki her yeni en iyi set burada listelenecek.</p></div>`;
  return `<div class="card tbl-wrap"><p class="how">Tüm hareketlerde tek sette kırdığın son rekorlar, yeniden eskiye.</p>
    <table class="tbl"><thead><tr><th>Tarih</th><th>Hareket</th><th>Rekor</th><th>Artış</th></tr></thead>
    <tbody>${all.map(r => `<tr class="${r.d === t ? 'cur' : ''}"><td>${fmtD(r.d)} <small>${ago(r.d)}</small></td>
      <td><span class="rl" style="color:${r.e.color}">${r.e.icon} ${r.e.name}</span></td>
      <td><b class="gold">${fmtU(r.e.id, r.v)}</b></td><td><span class="up">▲ ${fmtV(r.e.id, r.gain)}</span></td></tr>`).join('')}</tbody></table></div>`;
}

function monthCmpHTML() {
  const t = today(), ms = t.slice(0, 8) + '01', pms = addDays(ms, -1).slice(0, 8) + '01';
  const dayN = diffDays(ms, t), pEnd = addDays(pms, dayN) < ms ? addDays(pms, dayN) : addDays(ms, -1);
  const stat = (a, b) => {
    const ds = workedDays().filter(d => d >= a && d <= b);
    const v = timed => sum(ds.flatMap(d => EXALL.filter(e => !!e.timed === timed).flatMap(e => Store.sets(d, e.id))));
    const prs = EX.reduce((n, e) => n + prHistory(e.id).filter(r => r.gain !== null && r.d >= a && r.d <= b).length, 0);
    return {n: ds.length, full: ds.filter(isFull).length, reps: v(false), secs: v(true), prs};
  };
  const A = stat(pms, pEnd), B = stat(ms, t), has = A.n > 0;
  const rows = [['Antrenman günü', 'n'], ['Tam gün', 'full'], ['Toplam tekrar', 'reps'], ['Toplam süre', 'secs', fmtSec], ['Kırılan rekor', 'prs']];
  return `<div class="card tbl-wrap"><p class="how">Bu ayın ilk ${dayN + 1} günü, geçen ayın aynı günleriyle (${fmtD(pms)}–${fmtD(pEnd)}).${has ? '' : ' Geçen ayın bu döneminde kayıt yok.'}</p>
    <table class="tbl"><thead><tr><th></th><th>Geçen ay</th><th>Bu ay</th><th>Fark</th></tr></thead>
    <tbody>${rows.map(([l, k, f = x => x]) => `<tr><td><span class="rl">${l}</span></td><td>${has ? f(A[k]) : '—'}</td><td><b>${f(B[k])}</b></td>
      <td>${has ? (A[k] ? pctTag(pct(B[k], A[k])) : B[k] ? '<span class="up">▲ yeni</span>' : '=') : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}

// son tamamlanan antrenmanın her setine küçük bir artış ekleyip hedef öner
function nextTargetHTML(e, last, best) {
  const id = e.id, step = v => e.timed ? Math.max(2, Math.round(v * .05)) : 1;
  const tg = last.s.map(v => v + step(v)), tot = sum(tg);
  return `<div class="card nxt" style="--c:${e.color}"><p class="how">Son antrenmanın (${fmtD(last.d)}) her setine ${e.timed ? 'yaklaşık %5' : '1 tekrar'} eklendi. Hepsini tutturursan toplam <b>${fmtU(id, tot)}</b> (${signed(tot - last.tot, v => fmtU(id, v))}).</p>
    <div class="setchips">${tg.map((v, i) => `<span style="--sc:${SETC[i] || '#888'}"><i></i>${i + 1}. set <b>${fmtV(id, v)}</b> <small class="muted">(${fmtV(id, last.s[i])})</small>${v > best ? ' 🏆' : ''}</span>`).join('')}</div></div>`;
}
