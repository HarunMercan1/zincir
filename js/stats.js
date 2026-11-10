// İstatistik sekmesi: genel bakış + hareket bazında derin analiz (Chart.js)
const ST = {ex: 'all', range: 'all', charts: []};

if (window.Chart) {
  Chart.defaults.color = '#8790ad';
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.borderColor = '#1a1f30';
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.tooltip.backgroundColor = '#1d2234';
  Chart.defaults.plugins.tooltip.borderColor = '#2a3047';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.maintainAspectRatio = false;
}

const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');
const pct = (a, b) => b ? Math.round((a - b) / b * 100) : null;
const pctTag = p => p === null ? '<span class="muted">—</span>' : `<span class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} %${Math.abs(p)}</span>`;
const fmtV = (id, v) => EXM[id].timed ? fmtSec(Math.round(v)) : (Math.round(v * 10) / 10);

function rangeStart() {
  const t = today();
  return ST.range === '7' ? addDays(t, -6) : ST.range === '30' ? addDays(t, -29) : (workedDays()[0] || t);
}
const inRange = d => d >= rangeStart() && d <= today();
function calDays() { const out = []; for (let d = rangeStart(); d <= today(); d = addDays(d, 1)) out.push(d); return out; }

// bir hareketin oturum serisi
function series(id) {
  return exDays(id).filter(inRange).map(d => {
    const s = Store.sets(d, id);
    return {d, s, tot: sum(s), best: Math.max(...s), drop: s.length > 1 ? 1 - s[s.length - 1] / s[0] : null};
  });
}

function linreg(pts) { // pts: [[x,y]]
  const n = pts.length; if (n < 2) return null;
  const mx = avg(pts.map(p => p[0])), my = avg(pts.map(p => p[1]));
  let nu = 0, de = 0; pts.forEach(([x, y]) => { nu += (x - mx) * (y - my); de += (x - mx) ** 2; });
  const m = de ? nu / de : 0; return {m, b: my - m * mx};
}

function renderStats(el) {
  ST.charts.forEach(c => c.destroy()); ST.charts = [];
  if (!window.Chart) { el.innerHTML = '<p class="muted" style="padding:40px 0">Grafik kütüphanesi yüklenemedi (internet gerekiyor).</p>'; return; }
  const ex = ST.ex === 'all' ? null : EXM[ST.ex];
  el.innerHTML = `
  <div class="st-bar">
    <div class="st-ex">
      <button data-ex="all" class="${!ex ? 'on' : ''}" style="--c:#ff8a1f">🔥 Genel</button>
      ${EX.map(e => `<button data-ex="${e.id}" class="${ex && ex.id === e.id ? 'on' : ''}" style="--c:${e.color}">${e.icon} ${e.name}</button>`).join('')}
    </div>
    <div class="st-range">
      ${[['7', '7 gün'], ['30', '30 gün'], ['all', 'Tümü']].map(([k, l]) => `<button data-r="${k}" class="${ST.range === k ? 'on' : ''}">${l}</button>`).join('')}
    </div>
  </div>
  <div id="stBody"></div>`;
  el.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { ST.ex = b.dataset.ex; renderStats(el); });
  el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { ST.range = b.dataset.r; renderStats(el); });
  const body = el.querySelector('#stBody');
  if (!workedDays().filter(inRange).length) { body.innerHTML = '<p class="muted" style="padding:40px 0">Bu aralıkta veri yok.</p>'; return; }
  ex ? renderExStats(body, ex) : renderOverview(body);
}

function chart(canvasId, cfg) { const c = new Chart(document.getElementById(canvasId), cfg); ST.charts.push(c); return c; }

/* ================= GENEL ================= */
function renderOverview(el) {
  const days = workedDays().filter(inRange), cds = calDays(), t = today();
  const allSets = days.flatMap(d => EX.flatMap(e => Store.sets(d, e.id)));
  const reps = sum(days.flatMap(d => ['push', 'sit', 'pull'].flatMap(id => Store.sets(d, id))));
  const secs = sum(days.flatMap(d => ['hang', 'plank'].flatMap(id => Store.sets(d, id))));
  const setCnt = d => sum(EX.map(e => Store.sets(d, e.id).length));
  const wk = from => sum(workedDays().filter(d => d >= from && d < addDays(from, 7)).map(setCnt));
  const ws = addDays(t, -wdIdx(t)), thisW = wk(ws), lastW = sum(workedDays().filter(d => d >= addDays(ws, -7) && d <= addDays(t, -7)).map(setCnt));
  const byWd = WD.map((_, i) => days.filter(d => wdIdx(d) === i));
  const topWd = byWd.map((a, i) => [a.length, i]).sort((a, b) => b[0] - a[0])[0];
  const prog = EX.map(e => {
    let s = series(e.id); const L = s[s.length - 1];
    if (L && L.d === t && s.length > 1 && L.s.length < s[s.length - 2].s.length) s = s.slice(0, -1); // bugün devam ediyor
    if (s.length < 2) return {e, p: null, s};
    const k = Math.max(1, Math.min(3, Math.floor(s.length / 3)));
    return {e, s, p: pct(avg(s.slice(-k).map(x => x.tot)), avg(s.slice(0, k).map(x => x.tot))), first: avg(s.slice(0, k).map(x => x.tot)), last: avg(s.slice(-k).map(x => x.tot))};
  });
  const bestProg = prog.filter(x => x.p !== null).sort((a, b) => b.p - a.p)[0];

  el.innerHTML = `
  <div class="kpis big">
    ${kpi(allSets.length, 'Toplam set', '🧮', `${days.length} günde`)}
    ${kpi(reps, 'Toplam tekrar', '🔁', 'şınav + mekik + barfiks')}
    ${kpi(fmtSec(secs), 'Toplam süre', '⏱', 'asılı + plank')}
    ${kpi((allSets.length / Math.max(1, days.length)).toFixed(1), 'Set / antrenman', '📦')}
    ${kpi(thisW, 'Bu hafta set', '📅', `geçen hafta aynı noktada: ${lastW} ${lastW ? (thisW >= lastW ? '▲' : '▼') : ''}`)}
    ${kpi(WD[topWd[1]], 'En istikrarlı gün', '⭐', `${topWd[0]} antrenman`)}
    ${kpi(bestProg ? '+' + bestProg.p + '%' : '—', 'En çok gelişen', '🚀', bestProg ? bestProg.e.name : '')}
    ${kpi(Math.round(days.length / cds.length * 100) + '%', 'Katılım', '🎯', `${cds.length} günün ${days.length}'i`)}
  </div>

  <h2>Gelişim · ilk antrenmanlar → son antrenmanlar</h2>
  <div class="prog">
    ${prog.map(x => `<div class="card pg" style="--c:${x.e.color}">
      <div class="pg-h"><span>${x.e.icon} ${x.e.name}</span>${x.p === null ? '' : pctTag(x.p)}</div>
      <div class="pg-v">${x.p === null ? '<span class="muted">az veri</span>' : `<small>${fmtV(x.e.id, x.first)}</small> → <b>${fmtV(x.e.id, x.last)}</b>`}</div>
      <div class="pg-c"><canvas id="sp-${x.e.id}"></canvas></div>
      <small class="muted">günlük toplam ${x.e.unit}</small></div>`).join('')}
  </div>

  <div class="grid2">
    <div><h2>Günlük set hacmi</h2><div class="card ch h300"><div class="chi"><canvas id="cVol"></canvas></div></div></div>
    <div><h2>Gelişim radarı</h2><div class="card ch h300"><div class="chi"><canvas id="cRadar"></canvas></div></div></div>
  </div>
  <div class="grid3">
    <div><h2>Set dağılımı</h2><div class="card ch h260"><div class="chi"><canvas id="cDough"></canvas></div></div></div>
    <div><h2>Haftanın günleri</h2><div class="card ch h260"><div class="chi"><canvas id="cWd"></canvas></div></div></div>
    <div><h2>Haftalık hacim</h2><div class="card ch h260"><div class="chi"><canvas id="cWeek"></canvas></div></div></div>
  </div>
  <h2>Aktivite haritası</h2>
  <div class="card"><div class="heat" id="heat"></div>
    <div class="hleg">Az <i class="hc"></i><i class="hc l1"></i><i class="hc l2"></i><i class="hc l3"></i><i class="hc l4"></i><i class="hc l5"></i> Çok · renk = o gün kaç hareket yapıldı</div></div>`;

  // sparkline'lar
  prog.forEach(x => {
    if (x.s.length < 1) return;
    chart('sp-' + x.e.id, {type: 'line', data: {labels: x.s.map(p => fmtD(p.d)), datasets: [{data: x.s.map(p => p.tot), borderColor: x.e.color, borderWidth: 2.5, pointRadius: 0, tension: .35, fill: true,
      backgroundColor: ctx => grad(ctx, x.e.color)}]},
      options: {plugins: {legend: {display: false}, tooltip: {enabled: true}}, scales: {x: {display: false}, y: {display: false}}, interaction: {intersect: false, mode: 'index'}}});
  });

  // günlük set hacmi: yığılmış çubuk
  chart('cVol', {type: 'bar', data: {labels: cds.map(fmtD), datasets: EX.map(e => ({label: e.name, data: cds.map(d => Store.sets(d, e.id).length), backgroundColor: e.color, borderRadius: 3, stack: 's'}))},
    options: {plugins: {legend: {position: 'bottom'}}, scales: {x: {stacked: true, grid: {display: false}, ticks: {maxTicksLimit: 10}}, y: {stacked: true, title: {display: true, text: 'set'}}}}});

  // radar: gelişim %
  const rp = prog.filter(x => x.p !== null);
  chart('cRadar', {type: 'radar', data: {labels: rp.map(x => x.e.name), datasets: [
    {label: 'Başlangıç', data: rp.map(() => 100), borderColor: '#3a4058', backgroundColor: '#3a405833', pointRadius: 0, borderDash: [4, 4]},
    {label: 'Şimdi (başlangıca göre %)', data: rp.map(x => 100 + x.p), borderColor: '#ff8a1f', backgroundColor: '#ff8a1f33', pointBackgroundColor: rp.map(x => x.e.color), pointRadius: 5}]},
    options: {plugins: {legend: {position: 'bottom'}}, scales: {r: {grid: {color: '#1d2234'}, angleLines: {color: '#1d2234'}, ticks: {display: false}, pointLabels: {color: '#eef1fb', font: {size: 12, weight: 600}}, suggestedMin: 0}}}});

  // donut
  chart('cDough', {type: 'doughnut', data: {labels: EX.map(e => e.name), datasets: [{data: EX.map(e => sum(days.map(d => Store.sets(d, e.id).length))), backgroundColor: EX.map(e => e.color), borderColor: '#0f121b', borderWidth: 3, hoverOffset: 8}]},
    options: {cutout: '62%', plugins: {legend: {position: 'bottom'}}}});

  // haftanın günleri
  chart('cWd', {type: 'bar', data: {labels: WD, datasets: [
    {label: 'Antrenman sayısı', data: byWd.map(a => a.length), backgroundColor: '#ff8a1f', borderRadius: 6, yAxisID: 'y'},
    {label: 'Ort. set', data: byWd.map(a => a.length ? +(avg(a.map(setCnt))).toFixed(1) : 0), type: 'line', borderColor: '#38bdf8', backgroundColor: '#38bdf8', tension: .3, yAxisID: 'y1'}]},
    options: {plugins: {legend: {position: 'bottom'}}, scales: {x: {grid: {display: false}}, y: {beginAtZero: true, ticks: {precision: 0}}, y1: {position: 'right', grid: {display: false}, beginAtZero: true}}}});

  // haftalık hacim
  const weeks = []; for (let w = addDays(ws, -7 * 7); w <= ws; w = addDays(w, 7)) weeks.push(w);
  chart('cWeek', {type: 'bar', data: {labels: weeks.map(w => fmtD(w)), datasets: [{label: 'Set', data: weeks.map(w => sum(workedDays().filter(d => d >= w && d < addDays(w, 7)).map(setCnt))),
    backgroundColor: weeks.map((w, i) => i === weeks.length - 1 ? '#ffb340' : '#7a4519'), borderRadius: 6}]},
    options: {plugins: {legend: {display: false}}, scales: {x: {grid: {display: false}}, y: {beginAtZero: true}}}});

  renderHeat(el.querySelector('#heat'));
}

function grad(ctx, color) {
  const {chart: c} = ctx; if (!c.chartArea) return alpha(color, .2);
  const g = c.ctx.createLinearGradient(0, c.chartArea.top, 0, c.chartArea.bottom);
  g.addColorStop(0, alpha(color, .45)); g.addColorStop(1, alpha(color, 0)); return g;
}

function renderHeat(el) {
  const t = today(), W = 26, lastMon = addDays(t, -wdIdx(t)), first = addDays(lastMon, -(W - 1) * 7);
  let out = '<div class="hcol hlab">' + WD.map((w, i) => `<span>${i % 2 ? '' : w}</span>`).join('') + '</div>';
  for (let w = 0; w < W; w++) {
    out += '<div class="hcol">';
    for (let k = 0; k < 7; k++) {
      const d = addDays(first, w * 7 + k);
      if (d > t) { out += '<i class="hc f"></i>'; continue; }
      const c = doneCount(d);
      out += `<i class="hc${c ? ' l' + c : ''}${d === t ? ' t' : ''}" title="${fmtLong(d)}: ${c}/5 hareket"></i>`;
    }
    out += '</div>';
  }
  el.innerHTML = out;
}

/* ================= HAREKET DETAYI ================= */
function renderExStats(el, e) {
  const s = series(e.id), id = e.id, cds = calDays(), t = today();
  if (!s.length) { el.innerHTML = `<p class="muted" style="padding:40px 0">${e.name} için bu aralıkta veri yok.</p>`; return; }
  const all = s.flatMap(x => x.s), tots = s.map(x => x.tot);
  const best = Math.max(...all), bestAt = s.find(x => x.s.includes(best));
  const bestDay = s.reduce((m, x) => x.tot > m.tot ? x : m, s[0]);
  // bugünkü oturum öncekinden az setliyse henüz bitmemiş say: trend/karşılaştırmaya katma
  const L = s[s.length - 1], ongoing = L.d === t && s.length > 1 && L.s.length < s[s.length - 2].s.length;
  const done = ongoing ? s.slice(0, -1) : s, dtots = done.map(x => x.tot);
  const k = Math.max(1, Math.min(3, Math.floor(done.length / 3)));
  const gro = done.length > 1 ? pct(avg(dtots.slice(-k)), avg(dtots.slice(0, k))) : null;
  const sd = Math.sqrt(avg(dtots.map(v => (v - avg(dtots)) ** 2)));
  const consist = dtots.length > 1 ? Math.max(0, Math.round(100 - sd / avg(dtots) * 100)) : null;
  const drops = s.filter(x => x.drop !== null).map(x => x.drop);
  const sum7 = (a, b) => sum(exDays(id).filter(d => d > addDays(t, -a) && d <= addDays(t, -b)).map(d => total(d, id)));
  const w1 = sum7(7, 0), w0 = sum7(14, 7);
  // rekor kırma sayısı
  let run = 0, prs = 0; exDays(id).forEach(d => Store.sets(d, id).forEach(v => { if (v > run) { if (run) prs++; run = v; } }));
  // trend & tahmin (gün bazlı x)
  const x0 = s[0].d, lr = linreg(done.map(p => [diffDays(x0, p.d), p.tot]));
  const proj = lr ? lr.m * (diffDays(x0, t) + 30) + lr.b : null;
  const perDay = lr ? lr.m : 0;
  const maxSets = Math.max(...s.map(x => x.s.length));
  const posAvg = Array.from({length: maxSets}, (_, i) => avg(s.filter(x => x.s[i] !== undefined).map(x => x.s[i])));

  el.innerHTML = `
  <div class="ex-hero card" style="--c:${e.color}">
    <div class="eh-ic">${e.icon}</div>
    <div class="eh-main"><b>${e.name}</b><span>${s.length} antrenman · ${all.length} set · ${fmtD(s[0].d)} → ${fmtD(s[s.length - 1].d)}</span></div>
    <div class="eh-big"><small>Rekor set</small><b>${fmtV(id, best)}</b><span>${fmtD(bestAt.d)}</span></div>
    <div class="eh-big"><small>Gelişim</small><b>${gro === null ? '—' : (gro >= 0 ? '+' : '') + gro + '%'}</b><span>ilk → son antrenmanlar</span></div>
  </div>

  <div class="tiles" style="--c:${e.color}">
    ${tile(fmtV(id, sum(all)), 'Toplam ' + e.unit)}
    ${tile(fmtV(id, avg(all)), 'Set ortalaması')}
    ${tile(fmtV(id, avg(tots)), 'Antrenman başına ort.')}
    ${tile(fmtV(id, bestDay.tot), 'En iyi gün', fmtD(bestDay.d))}
    ${tile(fmtV(id, w1), 'Son 7 gün', pctTag(pct(w1, w0)) + ' önceki 7 güne göre')}
    ${tile(drops.length ? '%' + Math.round(avg(drops) * 100) : '—', 'Yorgunluk düşüşü', 'ilk setten son sete')}
    ${tile(consist === null ? '—' : '%' + consist, 'Tutarlılık', 'günlük toplamların istikrarı')}
    ${tile(prs, 'Kırılan rekor', 'tek set bazında')}
    ${tile(lr ? (perDay >= 0 ? '+' : '') + fmtV(id, perDay) : '—', 'Günlük trend', 'günde ortalama artış')}
    ${tile(proj ? fmtV(id, Math.max(0, proj)) : '—', '30 gün sonra tahmin', 'antrenman başı toplam')}
    ${tile(avg(s.map(x => x.s.length)).toFixed(1), 'Ort. set sayısı')}
    ${tile(Math.round(s.length / cds.length * 100) + '%', 'Katılım', `${cds.length} günde ${s.length}`)}
  </div>

  <h2>Günlük toplam · 7 antrenman ortalaması · 14 günlük tahmin</h2>
  <div class="card ch h340"><div class="chi"><canvas id="cMain"></canvas></div></div>

  <div class="grid2">
    <div><h2>Set set gelişim</h2><div class="card ch h300"><div class="chi"><canvas id="cPos"></canvas></div></div></div>
    <div><h2>Rekor merdiveni</h2><div class="card ch h300"><div class="chi"><canvas id="cPR"></canvas></div></div></div>
  </div>
  <div class="grid2">
    <div><h2>Yorgunluk eğrisi · ortalama set değeri</h2><div class="card ch h260"><div class="chi"><canvas id="cFat"></canvas></div></div></div>
    <div><h2>Set değeri dağılımı</h2><div class="card ch h260"><div class="chi"><canvas id="cHist"></canvas></div></div></div>
  </div>

  <h2>İlk antrenman vs son antrenman</h2>
  <div class="card vs" style="--c:${e.color}">${vsHTML(e, done[0], done[done.length - 1])}${ongoing ? '<p class="muted" style="margin-top:8px;font-size:12px">Bugünkü antrenman devam ettiği için son tamamlanan antrenmanla karşılaştırıldı.</p>' : ''}</div>

  <h2>Antrenman geçmişi</h2>
  <div class="card tbl-wrap"><table class="tbl" style="--c:${e.color}">
    <thead><tr><th>Tarih</th><th>Setler</th><th>Toplam</th><th>Δ</th><th>En iyi</th><th>Düşüş</th></tr></thead>
    <tbody>${[...s].reverse().map((x, i, arr) => {
      const p = arr[i + 1], isPR = x.best === best;
      return `<tr><td>${fmtD(x.d)} <small>${WD[wdIdx(x.d)]}</small></td>
        <td><div class="chips">${x.s.map(v => `<i class="${v === best ? 'pr' : ''}">${v}</i>`).join('')}</div></td>
        <td><b>${fmtV(id, x.tot)}</b></td><td>${p ? deltaTag(x.tot - p.tot) : ''}</td>
        <td>${x.best}${isPR ? ' 🏆' : ''}</td><td>${x.drop === null ? '—' : '%' + Math.round(x.drop * 100)}</td></tr>`;
    }).join('')}</tbody></table></div>`;

  // ana grafik: takvim ekseni, boş günler boşluk
  const ext = []; for (let i = 1; i <= 14; i++) ext.push(addDays(t, i));
  const labels = [...cds, ...ext];
  const totMap = Object.fromEntries(s.map(x => [x.d, x.tot]));
  const ma = labels.map(d => { if (totMap[d] === undefined || (ongoing && d === t)) return null; const idx = s.findIndex(x => x.d === d), w = s.slice(Math.max(0, idx - 6), idx + 1); return +avg(w.map(x => x.tot)).toFixed(1); });
  chart('cMain', {type: 'line', data: {labels: labels.map(fmtD), datasets: [
    {label: 'Günlük toplam', data: labels.map(d => totMap[d] ?? null), borderColor: e.color, backgroundColor: ctx => grad(ctx, e.color), fill: true, tension: .3, spanGaps: true, borderWidth: 3,
      pointRadius: labels.map(d => totMap[d] === bestDay.tot && d === bestDay.d ? 7 : 3), pointBackgroundColor: labels.map(d => d === bestDay.d ? '#ffe9a8' : ongoing && d === t ? '#0f121b' : e.color),
      segment: {borderDash: c => ongoing && c.p1DataIndex === cds.length - 1 ? [4, 4] : undefined}},
    {label: '7 antrenman ort.', data: ma, borderColor: '#ffffffaa', borderWidth: 2, pointRadius: 0, spanGaps: true, tension: .4},
    {label: 'Trend / tahmin', data: lr ? labels.map(d => +(lr.m * diffDays(x0, d) + lr.b).toFixed(1)) : [], borderColor: '#ff8a1f', borderDash: [6, 6], borderWidth: 2, pointRadius: 0}]},
    options: {interaction: {intersect: false, mode: 'index'}, plugins: {legend: {position: 'bottom'}}, scales: {x: {grid: {display: false}, ticks: {maxTicksLimit: 12}}, y: {beginAtZero: true, title: {display: true, text: e.unit}}}}});

  // set pozisyonu bazında
  const pc = ['#ffffff', alpha(e.color, 1), alpha(e.color, .7), alpha(e.color, .45), alpha(e.color, .3)];
  chart('cPos', {type: 'line', data: {labels: s.map(x => fmtD(x.d)), datasets: Array.from({length: Math.min(maxSets, 5)}, (_, i) => ({
    label: `${i + 1}. set`, data: s.map(x => x.s[i] ?? null), borderColor: pc[i], backgroundColor: pc[i], tension: .3, spanGaps: true, pointRadius: 2, borderWidth: i ? 2 : 3}))},
    options: {interaction: {intersect: false, mode: 'index'}, plugins: {legend: {position: 'bottom'}}, scales: {x: {grid: {display: false}, ticks: {maxTicksLimit: 8}}, y: {beginAtZero: true}}}});

  // rekor merdiveni
  let mx = 0; const stair = s.map(x => (mx = Math.max(mx, x.best)));
  chart('cPR', {type: 'bar', data: {labels: s.map(x => fmtD(x.d)), datasets: [
    {type: 'line', label: 'Rekor', data: stair, stepped: true, borderColor: '#ffb340', borderWidth: 3, pointRadius: s.map((x, i) => i && stair[i] > stair[i - 1] ? 5 : 0), pointBackgroundColor: '#ffe9a8'},
    {label: 'Günün en iyi seti', data: s.map(x => x.best), backgroundColor: s.map((x, i) => x.best === stair[i] ? alpha(e.color, .9) : alpha(e.color, .35)), borderRadius: 4}]},
    options: {plugins: {legend: {position: 'bottom'}}, scales: {x: {grid: {display: false}, ticks: {maxTicksLimit: 8}}, y: {beginAtZero: true}}}});

  // yorgunluk eğrisi
  chart('cFat', {type: 'bar', data: {labels: posAvg.map((_, i) => `${i + 1}. set`), datasets: [{label: 'Ortalama', data: posAvg.map(v => +v.toFixed(1)),
    backgroundColor: posAvg.map((_, i) => alpha(e.color, 1 - i * .18)), borderRadius: 8}]},
    options: {plugins: {legend: {display: false}, tooltip: {callbacks: {afterLabel: c => c.dataIndex ? `1. sete göre %${Math.round((1 - posAvg[c.dataIndex] / posAvg[0]) * 100)} düşüş` : ''}}}, scales: {x: {grid: {display: false}}, y: {beginAtZero: true}}}});

  // histogram
  const lo = Math.min(...all), hi = Math.max(...all), bins = Math.min(10, Math.max(3, hi - lo + 1)), bw = Math.max(1, Math.ceil((hi - lo + 1) / bins));
  const hb = Array.from({length: Math.ceil((hi - lo + 1) / bw)}, (_, i) => lo + i * bw);
  chart('cHist', {type: 'bar', data: {labels: hb.map(b => bw > 1 ? `${b}–${b + bw - 1}` : `${b}`), datasets: [{label: 'Set sayısı', data: hb.map(b => all.filter(v => v >= b && v < b + bw).length),
    backgroundColor: alpha(e.color, .8), borderRadius: 4}]},
    options: {plugins: {legend: {display: false}}, scales: {x: {grid: {display: false}, title: {display: true, text: e.unit}}, y: {beginAtZero: true, ticks: {precision: 0}}}}});
}

function tile(v, l, sub = '') { return `<div class="tile"><b>${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`; }

function vsHTML(e, a, b) {
  if (a.d === b.d) return '<p class="muted">Karşılaştırma için en az 2 antrenman gerekir.</p>';
  const n = Math.max(a.s.length, b.s.length), mx = Math.max(...a.s, ...b.s);
  return `<div class="vs-h"><span>${fmtD(a.d)} <small>ilk</small></span><span>${fmtD(b.d)} <small>son</small></span></div>` +
    Array.from({length: n}, (_, i) => `<div class="vs-r"><span class="vs-n">${i + 1}</span>
      <div class="vs-l"><div style="width:${(a.s[i] || 0) / mx * 100}%">${a.s[i] ?? ''}</div></div>
      <div class="vs-rr"><div style="width:${(b.s[i] || 0) / mx * 100}%">${b.s[i] ?? ''}</div></div>
      <span>${a.s[i] !== undefined && b.s[i] !== undefined ? pctTag(pct(b.s[i], a.s[i])) : ''}</span></div>`).join('') +
    `<div class="vs-r tot"><span class="vs-n">Σ</span><b>${fmtV(e.id, a.tot)}</b><b>${fmtV(e.id, b.tot)}</b><span>${pctTag(pct(b.tot, a.tot))}</span></div>`;
}
