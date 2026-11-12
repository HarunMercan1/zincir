// Gerçek zincir çizimi: düz (yüzü dönük) ve yan halkalar sırayla, iç içe geçmiş.
const LINK = {L:124, H:72, T:14, S:26, P:98};
const PAL = {
  full:   ['#fff6c2','#ffc145','#ff7a00','#9c3300'],
  part:   ['#f0c9a0','#b8773e','#7a4519','#3d2008'],
  today:  ['#9aa3c0','#5b6380','#363c55','#1c2030'],
  none:   ['#4a5068','#30354a','#222636','#151821'],
  future: ['#4a5068','#30354a','#222636','#151821'],
  miss:   ['#a06060','#6a2f2f','#401a1a','#200c0c'],
};

const mixHex = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t).toString(16).padStart(2, '0')).join('');

// color verilirse "yapılan gün" halkaları o hareketin renginde parlar
function chainDefs(uid, color) {
  let s = '<defs>';
  const pal = color ? {...PAL, full: [mixHex(color, '#ffffff', .7), mixHex(color, '#ffffff', .25), color, mixHex(color, '#000000', .55)]} : PAL;
  for (const [k, c] of Object.entries(pal)) {
    s += `<linearGradient id="${uid}${k}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c[0]}"/><stop offset=".3" stop-color="${c[1]}"/>
      <stop offset=".7" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[3]}"/></linearGradient>`;
  }
  s += `<filter id="${uid}glow" x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation="7" result="b"/><feFlood flood-color="${color || '#ff7a00'}" flood-opacity=".75"/>
      <feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="${uid}sh"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".7"/></filter>
  </defs>`;
  return s;
}

function faceLink(x, cy, st, uid) {
  const {L, H, T} = LINK, g = `url(#${uid}${st})`;
  const glow = st === 'full' ? ` filter="url(#${uid}glow)"` : ` filter="url(#${uid}sh)"`;
  if (st === 'miss') {
    const r = H/2;
    const half = (dx, rot, side) => {
      const ex = side < 0 ? x - 10 : x + 10, ax = x + side*(L/2 - r);
      const d = `M${ex},${cy-H/2} H${ax} A${r},${r} 0 0 ${side<0?0:1} ${ax},${cy+H/2} H${ex}`;
      return `<g transform="translate(${dx},${side*-4}) rotate(${rot} ${ax} ${cy})">
        <path d="${d}" fill="none" stroke="${g}" stroke-width="${T}" stroke-linecap="butt"/>
        <path d="${d}" fill="none" stroke="#ff4d4d" stroke-width="2" opacity=".35" transform="translate(0,-3)"/></g>`;
    };
    return `<g filter="url(#${uid}sh)">${half(-7, -9, -1)}${half(7, 7, 1)}</g>
      <path d="M${x-3},${cy-14} l6,7 l-5,6 l6,8" stroke="#ff4d4d" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }
  const pulse = st === 'today'
    ? `<rect x="${x-L/2-6}" y="${cy-H/2-6}" width="${L+12}" height="${H+12}" rx="${H/2+6}" fill="none" stroke="#ff8a1f" stroke-width="2.5" stroke-dasharray="8 7" class="pulse"/>` : '';
  return `${pulse}<g${glow}>
    <rect x="${x-L/2+T/2}" y="${cy-H/2+T/2}" width="${L-T}" height="${H-T}" rx="${(H-T)/2}" fill="none" stroke="${g}" stroke-width="${T}"/>
    <rect x="${x-L/2+T/2}" y="${cy-H/2+T/2-3}" width="${L-T}" height="${H-T}" rx="${(H-T)/2}" fill="none" stroke="#fff" stroke-opacity="${st==='full'?.55:.18}" stroke-width="2.5" stroke-dasharray="${(L-T)*0.6} 400" stroke-dashoffset="-20"/>
  </g>`;
}

function sideLink(x, cy, st, uid) {
  const {L, S} = LINK, g = `url(#${uid}${st})`;
  const glow = st === 'full' ? ` filter="url(#${uid}glow)"` : ` filter="url(#${uid}sh)"`;
  if (st === 'miss') {
    const piece = (x0, rot, dy) => `<g transform="rotate(${rot} ${x0+(L/2-10)/2} ${cy}) translate(0,${dy})">
      <rect x="${x0}" y="${cy-S/2}" width="${L/2-10}" height="${S}" rx="${S/2}" fill="${g}"/></g>`;
    return `<g filter="url(#${uid}sh)">${piece(x-L/2, -8, 5)}${piece(x+10, 9, -5)}</g>
      <path d="M${x-2},${cy-16} l5,8 l-5,6 l5,9" stroke="#ff4d4d" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }
  return `<g${glow}>
    <rect x="${x-L/2}" y="${cy-S/2}" width="${L}" height="${S}" rx="${S/2}" fill="${g}"/>
    <line x1="${x-L/2+16}" y1="${cy+1}" x2="${x+L/2-16}" y2="${cy+1}" stroke="#000" stroke-opacity=".45" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="${x-L/2+14}" y1="${cy-S/2+5}" x2="${x+L/2-14}" y2="${cy-S/2+5}" stroke="#fff" stroke-opacity="${st==='full'?.6:.2}" stroke-width="2.5" stroke-linecap="round"/>
  </g>`;
}

// days: tarih dizisi (eskiden yeniye). Sonuç: svg string
let chainUid = 0;
// ex verilirse o hareketin zinciri çizilir (o gün o hareket yapıldı mı)
function chainSVG(days, {labels = true, ex = null, scale = .62} = {}) {
  const uid = 'c' + (chainUid++), {L, H, P} = LINK, cy = H/2 + 14;
  const W = L + (days.length - 1) * P + 20, Hh = labels ? H + 74 : H + 30;
  const xs = days.map((_, i) => 10 + L/2 + i*P);
  const st = days.map(d => ex ? exDayState(d, ex.id) : dayState(d));
  const hot = ex ? ex.color : '#ffc145';
  let faces = '', sides = '', lab = '';
  days.forEach((d, i) => {
    const part = i % 2 === 0 ? faceLink(xs[i], cy, st[i], uid) : sideLink(xs[i], cy, st[i], uid);
    const s = ex ? Store.sets(d, ex.id) : null;
    const tip = ex ? `${ex.name} · ${s.length ? s.join(' · ') + ` (${ex.timed ? fmtSec(sum(s)) : sum(s) + ' tekrar'})` : 'yapılmadı'}` : `${doneCount(d)}/5 hareket`;
    const wrap = `<g class="lk" data-d="${d}"${ex ? ` data-ex="${ex.id}"` : ''}><title>${fmtLong(d)} · ${tip}</title>${part}</g>`;
    i % 2 === 0 ? faces += wrap : sides += wrap;
    if (labels) {
      const t = d === today(), col = t ? '#fff' : st[i] === 'full' ? hot : st[i] === 'miss' ? '#c06060' : '#6b7390';
      lab += `<text x="${xs[i]}" y="${cy+H/2+30}" text-anchor="middle" font-size="13" fill="${col}" font-weight="${t?800:500}">${ex && s.length ? (ex.timed ? sum(s) + 'sn' : sum(s)) : WD[wdIdx(d)]}</text>
        <text x="${xs[i]}" y="${cy+H/2+50}" text-anchor="middle" font-size="17" fill="${col}" font-weight="800">${+d.slice(8)}</text>`;
    }
  });
  // yan halkalar üstte: düz halkaların deliğinden geçiyormuş gibi görünür
  return `<svg viewBox="0 0 ${W} ${Hh}" width="${W*scale}" height="${Hh*scale}" class="chain">${chainDefs(uid, ex && ex.color)}${faces}${sides}${lab}</svg>`;
}

// Zincir ilk antrenman gününden başlar (en fazla N gün geri); kısa ise ileriye boş halkalarla 7'ye tamamlanır.
function chainDays(t, N) {
  const first = streakInfo().first, back = addDays(t, -(N-1));
  const days = []; for (let d = first && first > back ? first : back; d <= t; d = addDays(d, 1)) days.push(d);
  while (days.length < 7) days.push(addDays(days[days.length-1], 1));
  return days;
}

function exChainsHTML(t) {
  const days = chainDays(t, 21);
  return EX.map(e => {
    const s = exStreakInfo(e.id), total30 = days.filter(d => d <= t && Store.sets(d, e.id).length).length;
    const status = s.doneToday ? '<span class="exc-ok">✓ bugün tamam</span>'
      : s.cur ? '<span class="exc-wait">⏳ bugün bekliyor</span>' : s.days ? '<span class="exc-broke">💥 koptu</span>' : '';
    return `<div class="card exc" style="--c:${e.color}">
      <div class="exc-h">
        <span class="exc-ic">${e.icon}</span>
        <div class="exc-n"><b>${e.name}</b>${status}</div>
        <div class="exc-s"><b>${s.cur}</b><small>gün 🔥</small></div>
        <div class="exc-m"><span>En uzun <b>${s.best}</b></span><span>Kırılma <b>${s.breaks}</b></span><span>${days.filter(d => d <= t).length} günde <b>${total30}</b></span></div>
      </div>
      <div class="chain-scroll exc-chain">${chainSVG(days, {ex: e, scale: .42})}</div>
    </div>`;
  }).join('');
}

const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

function renderChainTab(el) {
  const s = streakInfo(), t = today();
  const next = MILESTONES.find(m => m > s.cur) || s.cur + 100;
  const prev = [0, ...MILESTONES].filter(m => m <= s.cur).pop();
  const days = chainDays(t, 30);
  const rate = s.span ? Math.round(s.days / s.span * 100) : 0;
  const avgLen = s.segs.length ? (sum(s.segs.map(x => x.len)) / s.segs.length).toFixed(1) : 0;

  el.innerHTML = `
  <section class="hero">
    <div class="flame">🔥</div>
    <div class="streak-num">${s.cur}</div>
    <div class="streak-lbl">GÜNLÜK ZİNCİR</div>
    <div class="status" id="status"></div>
    <div class="ms">
      <div class="ms-track"><div class="ms-fill" style="width:${Math.min(100,(s.cur-prev)/(next-prev)*100)}%"></div></div>
      <div class="ms-txt"><span>${prev} gün</span><span>Sıradaki hedef <b>${next} gün</b> · ${next - s.cur} halka kaldı</span></div>
    </div>
  </section>

  <div class="chain-scroll" id="chainScroll">${chainSVG(days)}</div>
  <div class="chain-legend">
    <span><i class="lg full"></i>5/5 tam gün</span><span><i class="lg part"></i>Eksik gün</span>
    <span><i class="lg miss"></i>Kırık halka</span><span><i class="lg today"></i>Bugün bekliyor</span>
    <span class="muted">Halkaya tıkla → o günü aç</span>
  </div>

  <div class="kpis">
    ${kpi(s.best, 'En uzun zincir', '👑')}
    ${kpi(s.days, 'Antrenman günü', '📅')}
    ${kpi(rate + '%', 'İstikrar oranı', '🎯', `${s.span} günde ${s.days} gün`)}
    ${kpi(s.breaks, 'Kırılma', '💥')}
    ${kpi(avgLen, 'Ort. zincir uzunluğu', '⛓')}
    ${kpi(workedDays().filter(d => dayState(d) === 'full').length, '5/5 tam gün', '✅')}
  </div>

  <h2>Hareket zincirleri</h2>
  <div class="exc-list">${exChainsHTML(t)}</div>

  <h2>Hedef yolu</h2>
  <div class="road">${MILESTONES.map(m => `<div class="node ${s.best >= m ? 'on' : ''} ${m === next ? 'next' : ''}"><div class="dot">${s.best >= m ? '🔥' : m === next ? '🎯' : '🔒'}</div><b>${m}</b><small>gün</small></div>`).join('<div class="road-line"></div>')}</div>

  <div class="grid2">
    <div>
      <h2>Halka takvimi</h2>
      <div id="cal"></div>
    </div>
    <div>
      <h2>Zincir geçmişi</h2>
      <div class="card">${historyHTML(s)}</div>
    </div>
  </div>`;

  // takvim
  const months = [];
  const start = s.first && s.first < addDays(t, -40) ? s.first : addDays(t, -40);
  for (let d = new Date(t + 'T12:00:00'); ymd(d) >= start.slice(0, 8) + '01'; d.setMonth(d.getMonth() - 1, 1)) months.push(new Date(d));
  el.querySelector('#cal').innerHTML = months.map(m => calMonth(m)).join('');

  el.insertAdjacentHTML('beforeend', '<h2>Veri ve yedek</h2><div id="backup"></div>');
  renderBackup(el.querySelector('#backup'));

  // bugünün halkası ortada görünsün
  el.querySelectorAll('.chain-scroll').forEach(sc => {
    const lk = sc.querySelector(`[data-d="${t}"]`); if (!lk) return;
    const r = lk.getBoundingClientRect(), b = sc.getBoundingClientRect();
    sc.scrollLeft += r.left + r.width/2 - (b.left + b.width/2);
  });
  el.querySelectorAll('[data-d]').forEach(n => n.dataset.d <= t && n.addEventListener('click', () => {
    if (n.dataset.ex) { App.ex = n.dataset.ex; Log.val = null; }
    openDay(n.dataset.d);
  }));
  updateStatus();
}

function kpi(v, l, ic, sub = '') {
  return `<div class="card kpi"><div class="kpi-ic">${ic}</div><b>${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
}

function historyHTML(s) {
  if (!s.segs.length) return '<p class="muted">Henüz zincir yok.</p>';
  const mx = s.best;
  return [...s.segs].reverse().map((g, i) => {
    const isCur = s.alive && i === 0, isBest = g.len === mx;
    return `<div class="hist">
      <div class="hist-top"><span>${isCur ? '🔥 Şu anki' : `Zincir #${s.segs.length - i}`}${isBest ? ' 👑' : ''}</span><b>${g.len} gün</b></div>
      <div class="hist-bar"><div style="width:${g.len / mx * 100}%" class="${isCur ? 'cur' : ''}"></div></div>
      <small>${fmtD(g.start)} → ${fmtD(g.end)}</small></div>`;
  }).join('');
}

function calMonth(m) {
  const y = m.getFullYear(), mo = m.getMonth(), t = today();
  const first = new Date(y, mo, 1, 12), n = new Date(y, mo + 1, 0).getDate();
  const off = (first.getDay() + 6) % 7;
  let cells = WD.map(w => `<div class="cw">${w}</div>`).join('') + '<div></div>'.repeat(off);
  for (let i = 1; i <= n; i++) {
    const d = `${y}-${pad(mo+1)}-${pad(i)}`, st = dayState(d);
    cells += `<div class="cd ${st}${d === t ? ' is-today' : ''}" data-d="${d}" title="${fmtLong(d)} · ${doneCount(d)}/5"><span>${i}</span>${doneCount(d) && st !== 'full' ? `<em>${doneCount(d)}/5</em>` : ''}</div>`;
  }
  return `<div class="card cal"><div class="cal-h">${first.toLocaleDateString('tr-TR', {month:'long', year:'numeric'})}</div><div class="cal-g">${cells}</div></div>`;
}

function updateStatus() {
  const el = document.getElementById('status'); if (!el) return;
  const s = streakInfo(), t = today();
  if (!s.first) { el.innerHTML = 'İlk halkayı bugün tak.'; return; }
  if (doneCount(t)) {
    el.innerHTML = doneCount(t) === 5
      ? '<b>Bugünkü halka altın oldu.</b> 5/5 hareket tamam. 🏆'
      : `<b>Bugünkü halka takıldı.</b> ${doneCount(t)}/5 hareket. Altın halka için ${5 - doneCount(t)} hareket kaldı.`;
    return;
  }
  if (s.cur > 0) {
    const end = new Date(); end.setHours(24, 0, 0, 0); const ms = end - new Date();
    el.innerHTML = `⏳ Zincirin kırılmasına <b class="cd-time">${Math.floor(ms/36e5)} sa ${pad(Math.floor(ms%36e5/6e4))} dk</b> var`;
  } else el.innerHTML = '💥 Zincir koptu. Yeni zincir için bugün tek bir set yeter.';
}
