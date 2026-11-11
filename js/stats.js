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
const fmtU = (id, v) => EXM[id].timed ? fmtV(id, v) : `${fmtV(id, v)} ${EXM[id].unit}`;
const ago = d => { const n = diffDays(d, today()); return n === 0 ? 'bugün' : n === 1 ? 'dün' : `${n} gün önce`; };
// grafik tooltip'lerinde birimli sayı
const tipLabel = id => ({callbacks: {label: c => `${c.dataset.label}: ${c.raw === null ? '—' : fmtU(id, c.raw)}`}});
// az veri uyarısı
const few = (n, min, what = 'antrenman') => n < min ? `<span class="warn">⚠ ${min} ${what}dan önce pek anlamlı değil (şu an ${n}).</span> ` : '';
// sıradaki yuvarlak hedef: 58 → 60, 141 → 150, 6 → 8
function nextGoal(v, step) { const g = Math.floor(v / step) * step + step; return {g, left: g - v}; }
try { Object.assign(ST, JSON.parse(localStorage.getItem('zincir-st') || '{}'), {charts: []}); } catch (e) {}

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
  const remember = () => { try { localStorage.setItem('zincir-st', JSON.stringify({ex: ST.ex, range: ST.range})); } catch (e) {} };
  el.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { ST.ex = b.dataset.ex; remember(); renderStats(el); });
  el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { ST.range = b.dataset.r; remember(); renderStats(el); });
  const body = el.querySelector('#stBody');
  if (!workedDays().filter(inRange).length) { body.innerHTML = '<p class="muted" style="padding:40px 0">Bu aralıkta veri yok.</p>'; return; }
  ex ? renderExStats(body, ex) : renderOverview(body);
}

function chart(canvasId, cfg) { const c = new Chart(document.getElementById(canvasId), cfg); ST.charts.push(c); return c; }

/* ================= GENEL ================= */
function renderOverview(el) {
  const days = workedDays().filter(inRange), cds = calDays(), t = today();
  const reps = sum(days.flatMap(d => ['push', 'sit', 'pull'].flatMap(id => Store.sets(d, id))));
  const secs = sum(days.flatMap(d => ['hang', 'plank'].flatMap(id => Store.sets(d, id))));
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

  // --- düz cümleyle özet ---
  const ins = [], lastD = days[days.length - 1], prevD = days[days.length - 2];
  if (lastD) {
    const chips = EX.map(e => { const a = total(lastD, e.id), b = prevD ? total(prevD, e.id) : 0;
      return a ? `<i class="chip-ex" style="--c:${e.color}">${e.icon} ${fmtU(e.id, a)}${prevD && b ? ' ' + deltaTag(a - b) : ''}</i>` : ''; }).join('');
    ins.push(['mid', `<b>Son antrenman ${lastD === t ? 'bugün' : ago(lastD)}</b> (${fmtD(lastD)}) · ${doneCount(lastD)}/5 hareket${prevD ? ', öncekine göre:' : ':'}<span class="chips-row">${chips}</span>`]);
  }
  let prCount = 0;
  const prs7 = EX.map(e => { let best = 0, last = null; exDays(e.id).forEach(d => { const m = Math.max(...Store.sets(d, e.id)); if (m > best) { if (best && diffDays(d, t) < 7) { prCount++; last = m; } best = m; } }); return last ? `<b style="color:${e.color}">${e.name}</b> ${fmtU(e.id, last)}` : null; }).filter(Boolean);
  ins.push(prCount ? ['gold', `Son 7 günde <b>${prCount} rekor</b> 🏆 · ${prs7.join(' · ')}`] : ['mid', 'Son 7 günde yeni rekor yok. Küçük bir artış bile yeter.']);
  const weak = EX.map(e => ({e, s: exStreakInfo(e.id)})).sort((a, b) => a.s.cur - b.s.cur || b.s.breaks - a.s.breaks)[0];
  const strong = EX.map(e => ({e, s: exStreakInfo(e.id)})).sort((a, b) => b.s.cur - a.s.cur)[0];
  if (weak && strong && weak.e !== strong.e) ins.push([weak.s.cur ? 'mid' : 'bad', `En sağlam zincir <b style="color:${strong.e.color}">${strong.e.name}</b> (${strong.s.cur} gün), en zayıfı <b style="color:${weak.e.color}">${weak.e.name}</b> (${weak.s.cur} gün${weak.s.breaks ? `, ${weak.s.breaks} kırılma` : ''}).`]);
  if (bestProg) ins.push(['good', `En çok gelişen hareket <b style="color:${bestProg.e.color}">${bestProg.e.name}</b>: ilk antrenmanlara göre <b>%${bestProg.p}</b> ${bestProg.p >= 0 ? 'artış' : 'düşüş'}.`]);

  el.innerHTML = `
  <div class="card insight">${ins.map(([c, h]) => `<p class="ins ${c}">${h}</p>`).join('')}</div>
  <div class="kpis big">
    ${kpi(reps, 'Toplam tekrar', '🔁', 'şınav + mekik + barfiks')}
    ${kpi(fmtSec(secs), 'Toplam süre', '⏱', 'asılı + plank')}
    ${kpi(days.length, 'Antrenman günü', '📅', `${cds.length} günde`)}
    ${kpi(WD[topWd[1]], 'En istikrarlı gün', '⭐', `${topWd[0]} antrenman`)}
    ${kpi(bestProg ? '+' + bestProg.p + '%' : '—', 'En çok gelişen', '🚀', bestProg ? bestProg.e.name : '')}
    ${kpi(Math.round(days.length / cds.length * 100) + '%', 'Katılım', '🎯', `${cds.length} günün ${days.length}'i`)}
  </div>

  ${levelHTML()}

  <h2>Gelişim · ilk antrenmanlar → son antrenmanlar</h2>
  <div class="prog">
    ${prog.map(x => `<div class="card pg" style="--c:${x.e.color}">
      <div class="pg-h"><span>${x.e.icon} ${x.e.name}</span>${x.p === null ? '' : pctTag(x.p)}</div>
      <div class="pg-v">${x.p === null ? '<span class="muted">az veri</span>' : `<small>${fmtV(x.e.id, x.first)}</small> → <b>${fmtV(x.e.id, x.last)}</b>`}</div>
      <div class="pg-c"><canvas id="sp-${x.e.id}"></canvas></div>
      <small class="muted">günlük toplam ${x.e.unit}</small></div>`).join('')}
  </div>

  <h2>Gelişim radarı</h2><div class="card ch h300"><div class="chi"><canvas id="cRadar"></canvas></div></div>
  ${ovExtraHTML(days)}
  <h2>Aktivite haritası</h2>
  <div class="card"><div class="heat" id="heat"></div>
    <div class="hleg">Az <i class="hc"></i><i class="hc l1"></i><i class="hc l2"></i><i class="hc l3"></i><i class="hc l4"></i><i class="hc l5"></i> Çok · renk = o gün kaç hareket yapıldı</div></div>`;

  // sparkline'lar
  prog.forEach(x => {
    if (x.s.length < 1) return;
    chart('sp-' + x.e.id, {type: 'line', data: {labels: x.s.map(p => fmtD(p.d)), datasets: [{data: x.s.map(p => p.tot), borderColor: x.e.color, borderWidth: 2.5, pointRadius: 0, tension: .35, fill: true,
      backgroundColor: ctx => grad(ctx, x.e.color)}]},
      options: {plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => fmtU(x.e.id, c.raw)}}}, scales: {x: {display: false}, y: {display: false, min: 0}}, interaction: {intersect: false, mode: 'index'}}});
  });

  // radar: gelişim %
  const rp = prog.filter(x => x.p !== null);
  chart('cRadar', {type: 'radar', data: {labels: rp.map(x => x.e.name), datasets: [
    {label: 'Başlangıç', data: rp.map(() => 100), borderColor: '#3a4058', backgroundColor: '#3a405833', pointRadius: 0, borderDash: [4, 4]},
    {label: 'Şimdi (başlangıca göre %)', data: rp.map(x => 100 + x.p), borderColor: '#ff8a1f', backgroundColor: '#ff8a1f33', pointBackgroundColor: rp.map(x => x.e.color), pointRadius: 5}]},
    options: {plugins: {legend: {position: 'bottom'}}, scales: {r: {grid: {color: '#1d2234'}, angleLines: {color: '#1d2234'}, ticks: {display: false}, pointLabels: {color: '#eef1fb', font: {size: 12, weight: 600}}, suggestedMin: 0}}}});

  renderHeat(el.querySelector('#heat'));
  ovExtraCharts(days);
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
// set sıraları her grafikte aynı renkte: 1. set sarı, 2. mavi, 3. pembe, 4. yeşil, 5. mor
const SETC = ['#ffd166', '#38bdf8', '#f472b6', '#34d399', '#a78bfa', '#fb923c'];
const TREND_MIN = 5; // tahmin için gereken en az antrenman

function renderExStats(el, e) {
  const s = series(e.id), id = e.id, cds = calDays(), t = today();
  if (!s.length) { el.innerHTML = `<p class="muted" style="padding:40px 0">${e.name} için bu aralıkta veri yok.</p>`; return; }
  const all = s.flatMap(x => x.s);
  const best = Math.max(...all), bestAt = s.find(x => x.s.includes(best));
  const bestDay = s.reduce((m, x) => x.tot > m.tot ? x : m, s[0]);
  // bugünkü oturum öncekinden az setliyse henüz bitmemiş say: trend/karşılaştırmaya katma
  const L = s[s.length - 1], ongoing = L.d === t && s.length > 1 && L.s.length < s[s.length - 2].s.length;
  const done = ongoing ? s.slice(0, -1) : s, dtots = done.map(x => x.tot);
  const k = Math.max(1, Math.min(3, Math.floor(done.length / 3)));
  const gro = done.length > 1 ? pct(avg(dtots.slice(-k)), avg(dtots.slice(0, k))) : null;
  const sd = Math.sqrt(avg(dtots.map(v => (v - avg(dtots)) ** 2)));
  const consist = dtots.length > 1 ? Math.max(0, Math.round(100 - sd / avg(dtots) * 100)) : null;
  const drops = done.filter(x => x.drop !== null).map(x => x.drop);
  const sum7 = (a, b) => sum(exDays(id).filter(d => d > addDays(t, -a) && d <= addDays(t, -b)).map(d => total(d, id)));
  const w1 = sum7(7, 0), w0 = sum7(14, 7);
  let run = 0, prs = 0; exDays(id).forEach(d => Store.sets(d, id).forEach(v => { if (v > run) { if (run) prs++; run = v; } }));
  const canTrend = done.length >= TREND_MIN;
  const x0 = s[0].d, lr = canTrend ? linreg(done.map(p => [diffDays(x0, p.d), p.tot])) : null;
  const proj = lr ? Math.max(0, lr.m * (diffDays(x0, t) + 30) + lr.b) : null;
  const maxSets = Math.min(SETC.length, Math.max(...s.map(x => x.s.length)));
  const posAvg = Array.from({length: maxSets}, (_, i) => avg(s.filter(x => x.s[i] !== undefined).map(x => x.s[i])));
  const last = done[done.length - 1], prev = done[done.length - 2];
  const U = v => fmtV(id, v), unitW = e.timed ? '' : ' ' + e.unit;

  // --- düz cümleyle özet ---
  const ins = [];
  if (prev) {
    const df = last.tot - prev.tot;
    ins.push(df > 0 ? ['good', `Son antrenmanda (${fmtD(last.d)}) toplam <b>${U(last.tot)}${unitW}</b> yaptın, öncekinden <b>${U(df)}${unitW} fazla</b>.`]
      : df < 0 ? ['bad', `Son antrenmanda (${fmtD(last.d)}) toplam <b>${U(last.tot)}${unitW}</b> yaptın, öncekinden <b>${U(-df)}${unitW} az</b>.`]
      : ['mid', `Son antrenmanda toplam <b>${U(last.tot)}${unitW}</b>, öncekiyle aynı.`]);
  } else ins.push(['mid', `İlk antrenmanında toplam <b>${U(last.tot)}${unitW}</b> yaptın.`]);
  ins.push(['gold', `Rekor setin <b>${U(best)}${unitW}</b> (${fmtD(bestAt.d)})${bestAt === last && prs ? ', son antrenmanda kırdın 🏆' : ''}.`]);
  if (posAvg.length > 1) {
    const worst = posAvg.slice(1).map((v, i) => [1 - v / posAvg[i], i]).sort((a, b) => b[0] - a[0])[0];
    ins.push(['mid', `En sert düşüş <b>${worst[1] + 1}. setten ${worst[1] + 2}. sete</b>: ortalama %${Math.round(worst[0] * 100)}.`]);
  }
  if (!canTrend) ins.push(['mid', `Trend ve tahmin için en az <b>${TREND_MIN} antrenman</b> gerekiyor. Şu an ${done.length} tane var.`]);
  else ins.push([lr.m >= 0 ? 'good' : 'bad', `Gidişat: antrenman başı toplamın günde ortalama <b>${lr.m >= 0 ? '+' : ''}${U(lr.m)}${unitW}</b> değişiyor.`]);
  const gSet = nextGoal(best, e.timed ? 10 : 5), gTot = nextGoal(Math.max(...dtots), e.timed ? 30 : 10);
  ins.push(['goal', `🎯 Sıradaki hedefler: tek sette <b>${U(gSet.g)}${unitW}</b> (${U(gSet.left)} kaldı) · bir antrenmanda <b>${U(gTot.g)}${unitW}</b> (${U(gTot.left)} kaldı).`]);

  const cls = v => v === null ? '' : v > 0 ? 'good' : v < 0 ? 'bad' : '';
  el.innerHTML = `
  <div class="ex-hero card" style="--c:${e.color}">
    <div class="eh-ic">${e.icon}</div>
    <div class="eh-main"><b>${e.name}</b><span>${s.length} antrenman · ${all.length} set · ${fmtD(s[0].d)} → ${fmtD(s[s.length - 1].d)}</span></div>
    <div class="eh-big gold"><small>Rekor set</small><b>${U(best)}</b><span>${fmtD(bestAt.d)}</span></div>
    <div class="eh-big ${cls(gro)}"><small>Gelişim</small><b>${gro === null ? '—' : (gro >= 0 ? '+' : '') + gro + '%'}</b><span>ilk → son antrenmanlar</span></div>
  </div>

  <div class="card insight">${ins.map(([c, h]) => `<p class="ins ${c}">${h}</p>`).join('')}</div>

  <div class="tgroup"><h3>📦 Hacim <small>ne kadar yaptın</small></h3><div class="tiles">
    ${tile(U(sum(all)), 'Toplam ' + e.unit, 'tüm zamanlar')}
    ${tile(s.length, 'Antrenman', `${cds.length} günün ${s.length}'inde yaptın`)}
    ${tile(all.length, 'Set', `antrenman başı ${avg(s.map(x => x.s.length)).toFixed(1)} set`)}
    ${tile(U(w1), 'Son 7 gün', w0 ? `önceki 7 gün: ${U(w0)}` : 'önceki 7 günde kayıt yok', w0 ? cls(w1 - w0) : '')}
  </div></div>

  <div class="tgroup"><h3>💪 Performans <small>ne kadar iyisin</small></h3><div class="tiles">
    ${tile(U(best), 'Rekor set', fmtD(bestAt.d), 'gold')}
    ${tile(U(bestDay.tot), 'En iyi gün', fmtD(bestDay.d) + ' · toplam', 'gold')}
    ${tile(U(avg(all)), 'Set ortalaması', 'bir sette ortalama')}
    ${tile(U(avg(dtots)), 'Antrenman ortalaması', 'bir antrenmanda toplam')}
  </div></div>

  <div class="tgroup"><h3>📈 Gidişat <small>iyiye mi gidiyor</small></h3><div class="tiles">
    ${tile(gro === null ? '—' : (gro >= 0 ? '+' : '') + gro + '%', 'Gelişim', 'ilk antrenmanlara göre son antrenmanlar', cls(gro))}
    ${tile(prs, 'Kırılan rekor', 'tek sette kaç kez rekor kırdın', prs ? 'good' : '')}
    ${tile(drops.length ? '%' + Math.round(avg(drops) * 100) : '—', 'Yorgunluk', 'ilk setten son sete düşüş · azalması iyi')}
    ${tile(consist === null ? '—' : '%' + consist, 'Tutarlılık', '%100 = her antrenman aynı seviyede')}
    ${tile(lr ? (lr.m >= 0 ? '+' : '') + U(lr.m) : '—', 'Günlük trend', canTrend ? 'günde ortalama değişim' : `${TREND_MIN} antrenmandan sonra`, lr ? cls(lr.m) : 'off')}
    ${tile(proj !== null ? U(proj) : '—', '30 gün sonra', canTrend ? 'tahmini antrenman toplamı' : `${TREND_MIN} antrenmandan sonra`, lr ? '' : 'off')}
  </div></div>

  <h2>Antrenman toplamları</h2>
  <div class="card chc"><p class="how">Her nokta bir antrenmandaki toplam ${e.unit}. ${canTrend ? 'Beyaz çizgi son 7 antrenmanın ortalaması, turuncu kesik çizgi gidişata göre 14 günlük tahmin.' : `Tahmin çizgisi ${TREND_MIN} antrenmandan sonra çıkacak.`} Sarı nokta en iyi günün.</p>
    <div class="ch h300"><div class="chi"><canvas id="cMain"></canvas></div></div></div>

  <div class="grid2">
    <div><h2>Set set gelişim</h2><div class="card chc"><p class="how">${few(s.length, 3)}Her renk bir set sırası. Çizgi yükseliyorsa o set güçleniyor.</p>
      <div class="ch h260"><div class="chi"><canvas id="cPos"></canvas></div></div>
      <div class="setchips">${posAvg.map((_, i) => { const a = done.find(x => x.s[i] !== undefined), b = [...done].reverse().find(x => x.s[i] !== undefined);
        return `<span style="--sc:${SETC[i]}"><i></i>${i + 1}. set ${a && b && a !== b ? `${a.s[i]} → ${b.s[i]} ${deltaTag(b.s[i] - a.s[i])}` : (a ? a.s[i] : '')}</span>`; }).join('')}</div></div></div>
    <div><h2>Rekor merdiveni</h2><div class="card chc"><p class="how">Çubuk = o günün en iyi seti. <b class="gold">Sarı çubuk</b> = o gün rekor kırıldı, sarı çizgi = o güne kadarki rekor.</p>
      <div class="ch h260"><div class="chi"><canvas id="cPR"></canvas></div></div></div></div>
  </div>
  <h2>Yorgunluk eğrisi</h2><div class="card chc"><p class="how">${few(s.length, 3)}Her setin ortalaması. Setler arasında ne kadar düştüğünü gösterir. Düşüş azaldıkça dayanıklılığın artıyor demektir.</p>
      <div class="ch h260"><div class="chi"><canvas id="cFat"></canvas></div></div></div>

  <h2>İlk antrenman vs son antrenman</h2>
  <div class="card vs" style="--c:${e.color}">${vsHTML(e, done[0], done[done.length - 1])}${ongoing ? '<p class="muted" style="margin-top:8px;font-size:12px">Bugünkü antrenman devam ettiği için son tamamlanan antrenmanla karşılaştırıldı.</p>' : ''}</div>

  ${exExtraHTML(e, s)}

  <h2>Antrenman geçmişi</h2>
  <div class="card tbl-wrap"><table class="tbl" style="--c:${e.color}">
    <thead><tr><th>Tarih</th><th>Setler</th><th>Toplam</th><th>Öncekine göre</th><th>En iyi set</th><th>Yorgunluk</th></tr></thead>
    <tbody>${[...s].reverse().map((x, i, arr) => {
      const p = arr[i + 1], isPR = x.best === best;
      return `<tr><td>${fmtD(x.d)} <small>${WD[wdIdx(x.d)]}</small></td>
        <td><div class="chips">${x.s.map((v, j) => `<i class="${v === best ? 'pr' : ''}" style="--sc:${SETC[j] || '#888'}">${v}</i>`).join('')}</div></td>
        <td><b>${U(x.tot)}</b></td><td>${p ? deltaTag(x.tot - p.tot) : ''}</td>
        <td>${x.best}${isPR ? ' 🏆' : ''}</td><td>${x.drop === null ? '—' : '%' + Math.round(x.drop * 100)}</td></tr>`;
    }).join('')}</tbody></table></div>`;

  // ana grafik: takvim ekseni; tahmin sadece yeterli veri varsa
  const ext = []; if (canTrend) for (let i = 1; i <= 14; i++) ext.push(addDays(t, i));
  const labels = [...cds, ...ext];
  const totMap = Object.fromEntries(s.map(x => [x.d, x.tot]));
  const ma = labels.map(d => { if (!canTrend || totMap[d] === undefined || (ongoing && d === t)) return null; const idx = s.findIndex(x => x.d === d), w = s.slice(Math.max(0, idx - 6), idx + 1); return +avg(w.map(x => x.tot)).toFixed(1); });
  const ds = [{label: 'Antrenman toplamı', data: labels.map(d => totMap[d] ?? null), borderColor: e.color, backgroundColor: ctx => grad(ctx, e.color), fill: true, tension: .3, spanGaps: true, borderWidth: 3,
    pointRadius: labels.map(d => d === bestDay.d ? 8 : 5), pointBackgroundColor: labels.map(d => d === bestDay.d ? '#ffd166' : ongoing && d === t ? '#0f121b' : e.color),
    pointBorderColor: e.color, segment: {borderDash: c => ongoing && c.p1DataIndex === cds.length - 1 ? [4, 4] : undefined}}];
  if (canTrend) ds.push({label: 'Son 7 antrenman ort.', data: ma, borderColor: '#ffffffaa', borderWidth: 2, pointRadius: 0, spanGaps: true, tension: .4},
    {label: 'Tahmin', data: labels.map(d => Math.max(0, +(lr.m * diffDays(x0, d) + lr.b).toFixed(1))), borderColor: '#ff8a1f', borderDash: [6, 6], borderWidth: 2, pointRadius: 0});
  chart('cMain', {type: 'line', data: {labels: labels.map(fmtD), datasets: ds},
    options: {interaction: {intersect: false, mode: 'index'}, plugins: {legend: {position: 'bottom', display: canTrend}, tooltip: tipLabel(id)}, scales: {x: {grid: {display: false}, ticks: {maxTicksLimit: 12}}, y: {min: 0, title: {display: true, text: e.unit}}}}});

  // set sırası bazında: her set kendi renginde
  chart('cPos', {type: 'line', data: {labels: s.map(x => fmtD(x.d)), datasets: posAvg.map((_, i) => ({
    label: `${i + 1}. set`, data: s.map(x => x.s[i] ?? null), borderColor: SETC[i], backgroundColor: SETC[i], tension: .3, spanGaps: true, pointRadius: 4, borderWidth: 3}))},
    options: {interaction: {intersect: false, mode: 'index'}, plugins: {legend: {position: 'bottom'}, tooltip: tipLabel(id)}, scales: {x: {grid: {display: false}, ticks: {maxTicksLimit: 8}}, y: {min: 0}}}});

  // rekor merdiveni: rekor kırılan gün sarı, diğerleri gri
  let mx = 0; const stair = s.map(x => (mx = Math.max(mx, x.best)));
  const broke = s.map((x, i) => i > 0 && stair[i] > stair[i - 1]); // ilk gün rekor "kırmak" sayılmaz
  chart('cPR', {type: 'bar', data: {labels: s.map(x => fmtD(x.d)), datasets: [
    {type: 'line', label: 'O güne kadarki rekor', data: stair, stepped: true, borderColor: '#ffd166', borderWidth: 3, pointRadius: 0},
    {label: 'Günün en iyi seti', data: s.map(x => x.best), backgroundColor: broke.map(b => b ? '#ffd166' : '#3a4058'), borderRadius: 6}]},
    options: {plugins: {legend: {position: 'bottom'}, tooltip: tipLabel(id)}, scales: {x: {grid: {display: false}, ticks: {maxTicksLimit: 8}}, y: {min: 0}}}});

  // yorgunluk: set renkleriyle, tooltip'te düşüş yüzdesi
  chart('cFat', {type: 'bar', data: {labels: posAvg.map((v, i) => i ? [`${i + 1}. set`, `▼ %${Math.round((1 - v / posAvg[0]) * 100)}`] : '1. set'), datasets: [{label: 'Ortalama', data: posAvg.map(v => +v.toFixed(1)),
    backgroundColor: posAvg.map((_, i) => SETC[i]), borderRadius: 8}]},
    options: {plugins: {legend: {display: false}}, scales: {x: {grid: {display: false}}, y: {min: 0, title: {display: true, text: e.unit}}}}});

  exExtraCharts(e, s);
}

function tile(v, l, sub = '', cls = '') { return `<div class="tile ${cls}"><b>${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`; }


function vsHTML(e, a, b) {
  if (a.d === b.d) return '<p class="muted">Karşılaştırma için en az 2 antrenman gerekir.</p>';
  const n = Math.max(a.s.length, b.s.length), mx = Math.max(...a.s, ...b.s);
  return `<div class="vs-h"><span>${fmtD(a.d)} <small>ilk</small></span><span>${fmtD(b.d)} <small>son</small></span></div>` +
    Array.from({length: n}, (_, i) => `<div class="vs-r"><span class="vs-n">${i + 1}</span>
      <div class="vs-l"><div style="width:${(a.s[i] || 0) / mx * 100}%">${a.s[i] ?? ''}</div></div>
      <div class="vs-rr"><div style="width:${(b.s[i] || 0) / mx * 100}%;background:${SETC[i] || 'var(--c)'}">${b.s[i] ?? ''}</div></div>
      <span>${a.s[i] !== undefined && b.s[i] !== undefined ? pctTag(pct(b.s[i], a.s[i])) : ''}</span></div>`).join('') +
    `<div class="vs-r tot"><span class="vs-n">Σ</span><b>${fmtV(e.id, a.tot)}</b><b>${fmtV(e.id, b.tot)}</b><span>${pctTag(pct(b.tot, a.tot))}</span></div>`;
}
