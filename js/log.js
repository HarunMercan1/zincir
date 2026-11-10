// Antrenman girişi: hareket seçimi, sayaç / kronometre, set listesi, dinlenme sayacı
const Log = {
  val: null,          // ekrandaki sayı
  sw: null,           // kronometre {phase:'count'|'run', t0}
  rest: null,         // dinlenme bitiş zamanı (ms)
  restLen: 60,
};
try { Log.restLen = +localStorage.getItem('zincir-rest') || 60; } catch (e) {}

const bestEver = (id, exceptDay) => Math.max(0, ...Object.keys(Store.data).filter(d => d !== exceptDay).flatMap(d => Store.sets(d, id)));

function suggest(id, d) {
  const cur = Store.sets(d, id), ls = lastSession(id, d), prev = ls ? Store.sets(ls, id) : [];
  const n = cur.length;
  if (prev[n] !== undefined) return prev[n] + 1; // geçen seferi 1 geç
  if (cur.length) return cur[cur.length - 1];
  return prev.length ? prev[prev.length - 1] : (EXM[id].timed ? 30 : 10);
}

function renderLog(el) {
  const d = App.day, e = EXM[App.ex], t = today();
  if (Log.val === null) Log.val = suggest(e.id, d);
  const sets = Store.sets(d, e.id), ls = lastSession(e.id, d), prev = ls ? Store.sets(ls, e.id) : [];
  const n = sets.length, target = prev[n];
  const best = bestEver(e.id, d), tot = sum(sets), ptot = sum(prev);
  const mx = Math.max(1, ...sets, ...prev);

  el.innerHTML = `
  <div class="log-head">
    <button class="nav-day" data-step="-1">‹</button>
    <div class="log-day">
      <b>${d === t ? 'Bugün' : d === addDays(t, -1) ? 'Dün' : fmtD(d)}</b>
      <span>${fmtLong(d)}</span>
    </div>
    <button class="nav-day" data-step="1" ${d >= t ? 'disabled' : ''}>›</button>
    <label class="pick">📅<input type="date" id="pickDay" value="${d}" max="${t}"></label>
    <div class="day-badge ${dayState(d)}">${dayRingSVG(d)}<div><b>${doneCount(d)}/5</b><span>${doneCount(d) === 5 ? 'Altın halka!' : 'hareket'}</span></div></div>
  </div>

  <div class="ex-tabs">
    ${EX.map(x => {
      const xt = total(d, x.id), xl = lastSession(x.id, d), xp = xl ? total(xl, x.id) : 0;
      const p = xp ? Math.min(1, xt / xp) : (xt ? 1 : 0);
      return `<button class="ex-tab ${x.id === e.id ? 'on' : ''} ${xt ? 'done' : ''}" data-ex="${x.id}" style="--c:${x.color}">
        <span class="ex-ic">${x.icon}</span>
        <span class="ex-n">${x.name}</span>
        <span class="ex-v">${xt ? (x.timed ? fmtSec(xt) : xt) : '—'}${xt && xp && xt > xp ? ' 🏆' : ''}</span>
        <span class="ex-bar"><i style="width:${p * 100}%"></i></span>
        ${xt ? '<span class="ex-ok">✓</span>' : ''}
      </button>`;
    }).join('')}
  </div>

  <div class="log-grid" style="--c:${e.color}">
    <div class="card entry">
      <div class="entry-h">
        <span class="entry-ic">${e.icon}</span>
        <div><b>${e.name}</b><span>${n + 1}. set</span></div>
      </div>
      <div class="target">${target !== undefined
        ? `Geçen sefer (${fmtD(ls)}) ${n + 1}. set: <b>${e.timed ? fmtSec(target) : target}</b> → geçmek için <b class="c">${target + 1}+</b>`
        : ls ? `Geçen sefer ${prev.length} set yapmıştın. Bu ekstra set! 💪` : 'İlk kayıt, referans yok.'}</div>

      ${e.timed ? `
      <div class="sw" id="sw">
        <svg viewBox="0 0 220 220" class="sw-ring">
          <circle cx="110" cy="110" r="96" fill="none" stroke="#1d2234" stroke-width="14"/>
          <circle id="swArc" cx="110" cy="110" r="96" fill="none" stroke="var(--c)" stroke-width="14" stroke-linecap="round"
            stroke-dasharray="0 999" transform="rotate(-90 110 110)"/>
        </svg>
        <div class="sw-in"><div class="sw-t" id="swT">0</div><div class="sw-s" id="swS">${target ? `hedef ${target + 1} sn` : 'saniye'}</div></div>
      </div>
      <button class="big-btn" id="swBtn">▶ BAŞLAT</button>
      <div class="or">veya elle gir</div>` : ''}

      <div class="stepper">
        <button data-d="-5" class="st-s">−5</button>
        <button data-d="-1" class="st-b">−</button>
        <input type="number" id="val" inputmode="numeric" min="1" value="${Log.val}">
        <button data-d="1" class="st-b">+</button>
        <button data-d="5" class="st-s">+5</button>
      </div>
      <div class="unit">${e.unit}</div>
      ${prev.length || sets.length ? `<div class="quick">${[...new Set([...prev, ...sets])].sort((a, b) => a - b).map(v => `<button data-v="${v}">${v}</button>`).join('')}</div>` : ''}
      <button class="${e.timed ? 'mid-btn' : 'big-btn'}" id="save">✓ SETİ KAYDET</button>
      <div class="rest-pick">Dinlenme: ${[30, 60, 90, 120].map(s => `<button data-r="${s}" class="${Log.restLen === s ? 'on' : ''}">${s} sn</button>`).join('')}</div>
    </div>

    <div class="card setlist">
      <div class="sl-h">
        <div><span>Toplam</span><b>${e.timed ? fmtSec(tot) : tot}</b>${ptot && tot ? deltaTag(tot - ptot) : ''}</div>
        <div><span>Set</span><b>${n}</b></div>
        <div><span>En iyi set</span><b>${n ? Math.max(...sets) : '—'}</b></div>
        <div><span>Rekor</span><b>${Math.max(best, ...sets) || '—'}</b></div>
      </div>
      <div class="sl-cmp"><i class="now"></i>bugün <i class="was"></i>geçen sefer ${ls ? `(${fmtD(ls)})` : ''}</div>
      <div class="rows">
        ${Array.from({length: Math.max(n, prev.length)}, (_, i) => {
          const v = sets[i], p = prev[i], pr = v !== undefined && v > best;
          return `<div class="row ${v === undefined ? 'empty' : ''}">
            <span class="r-n">${i + 1}</span>
            <div class="r-bars">
              <div class="b now" style="width:${(v || 0) / mx * 100}%"><em>${v !== undefined ? (e.timed ? fmtSec(v) : v) : ''}${pr ? ' 🏆' : ''}</em></div>
              <div class="b was" style="width:${(p || 0) / mx * 100}%"></div>
            </div>
            <span class="r-d">${v !== undefined && p !== undefined ? deltaTag(v - p) : v === undefined ? '<small>bekliyor</small>' : '<small>ekstra</small>'}</span>
            ${v !== undefined ? `<button class="r-x" data-i="${i}" title="Sil">✕</button>` : '<span></span>'}
          </div>`;
        }).join('') || '<p class="muted" style="padding:20px 0">Henüz set yok. Soldan ilk seti gir.</p>'}
      </div>
    </div>
  </div>

  <h2>Günün özeti</h2>
  <div class="day-sum">
    ${EX.map(x => {
      const s = Store.sets(d, x.id);
      return `<button class="card ds ${s.length ? '' : 'off'}" data-ex="${x.id}" style="--c:${x.color}">
        <div class="ds-h">${x.icon} ${x.name}</div>
        <div class="ds-s">${s.length ? s.map(v => `<i>${v}</i>`).join('') : '<span class="muted">yapılmadı</span>'}</div>
        <b>${s.length ? (x.timed ? fmtSec(sum(s)) : sum(s) + ' tekrar') : ''}</b></button>`;
    }).join('')}
  </div>
  <div id="rest" class="rest" hidden>
    <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="25" fill="none" stroke="#2a3047" stroke-width="6"/>
      <circle id="restArc" cx="30" cy="30" r="25" fill="none" stroke="var(--fire2)" stroke-width="6" stroke-linecap="round" transform="rotate(-90 30 30)"/></svg>
    <div><span>Dinlenme</span><b id="restT">0:60</b></div>
    <button id="restAdd">+15</button><button id="restSkip">Atla ›</button>
  </div>`;

  // olaylar
  const $ = s => el.querySelector(s), val = $('#val');
  el.querySelectorAll('.nav-day').forEach(b => b.onclick = () => { App.day = addDays(d, +b.dataset.step); Log.val = null; renderLog(el); });
  $('#pickDay').onchange = ev => { if (ev.target.value && ev.target.value <= t) { App.day = ev.target.value; Log.val = null; renderLog(el); } };
  el.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { if (Log.sw) return; App.ex = b.dataset.ex; Log.val = null; renderLog(el); });
  el.querySelectorAll('.stepper button').forEach(b => b.onclick = () => { val.value = Math.max(1, (+val.value || 0) + +b.dataset.d); Log.val = +val.value; });
  el.querySelectorAll('.quick button').forEach(b => b.onclick = () => { val.value = b.dataset.v; Log.val = +val.value; });
  val.oninput = () => Log.val = +val.value;
  val.onkeydown = ev => { if (ev.key === 'Enter') saveSet(el); };
  val.onfocus = () => val.select();
  $('#save').onclick = () => saveSet(el);
  el.querySelectorAll('.r-x').forEach(b => b.onclick = () => {
    const i = +b.dataset.i, v = Store.removeSet(d, e.id, i);
    renderLog(el);
    toast(`${i + 1}. set silindi (${v})`, {label: 'Geri al', fn: () => { Store.addSet(d, e.id, v, i); renderLog(el); }});
  });
  el.querySelectorAll('.rest-pick button').forEach(b => b.onclick = () => {
    Log.restLen = +b.dataset.r; try { localStorage.setItem('zincir-rest', Log.restLen); } catch (er) {}
    el.querySelectorAll('.rest-pick button').forEach(x => x.classList.toggle('on', x === b));
  });
  if (e.timed) $('#swBtn').onclick = () => toggleSw(el, target);
  $('#restSkip').onclick = () => { Log.rest = null; tickRest(); };
  $('#restAdd').onclick = () => { if (Log.rest) Log.rest += 15000; };
  if (Log.sw) { $('#swBtn').textContent = '■ BİTİR'; tickSw(target); }
  tickRest();
}

function deltaTag(df) {
  return `<span class="dt ${df > 0 ? 'up' : df < 0 ? 'down' : 'eq'}">${df > 0 ? '▲' : df < 0 ? '▼' : '='}${df ? Math.abs(df) : ''}</span>`;
}

function dayRingSVG(d) {
  const p = doneCount(d) / 5, C = 2 * Math.PI * 20;
  return `<svg viewBox="0 0 50 50" width="46" height="46"><circle cx="25" cy="25" r="20" fill="none" stroke="#1d2234" stroke-width="6"/>
    <circle cx="25" cy="25" r="20" fill="none" stroke="${p === 1 ? '#ffb340' : '#b8773e'}" stroke-width="6" stroke-linecap="round"
    stroke-dasharray="${C * p} ${C}" transform="rotate(-90 25 25)"/></svg>`;
}

function saveSet(el, v) {
  const d = App.day, id = App.ex;
  v = v ?? parseInt(el.querySelector('#val').value, 10);
  if (!(v > 0)) { toast('Önce bir değer gir'); return; }
  const best = bestEver(id, null), wasDone = doneCount(d);
  Store.addSet(d, id, v);
  const i = Store.sets(d, id).length - 1;
  Log.val = suggest(id, d);
  if (d === today()) { Log.rest = Date.now() + Log.restLen * 1000; }
  renderLog(el);
  el.querySelector('.entry').classList.add('flash');
  document.getElementById('pill').textContent = streakInfo().cur;
  if (v > best && best > 0) { toast(`🏆 YENİ REKOR! ${EXM[id].name}: ${v} ${EXM[id].unit}`, {label: 'Geri al', fn: undo}); confetti(); }
  else if (doneCount(d) === 5 && wasDone < 5) { toast('⛓ 5/5! Bugünün halkası altın oldu.', {label: 'Geri al', fn: undo}); confetti(); }
  else toast(`✓ ${i + 1}. set kaydedildi: ${v} ${EXM[id].unit}`, {label: 'Geri al', fn: undo});
  function undo() { Store.removeSet(d, id, i); Log.rest = null; Log.val = v; renderLog(el); }
}

// kronometre: 3-2-1 sonra sayar, BİTİR'de seti otomatik kaydeder
function toggleSw(el, target) {
  if (!Log.sw) { Log.sw = {phase: 'count', t0: Date.now()}; Log.rest = null; el.querySelector('#swBtn').textContent = '■ BİTİR'; el.querySelector('#sw').classList.add('running'); tickSw(target); return; }
  const sw = Log.sw; Log.sw = null;
  if (sw.phase === 'count') { renderLog(el); return; }
  const secs = Math.floor((Date.now() - sw.t0) / 1000); // ekranda görünenle aynı
  if (secs < 1) { renderLog(el); return; }
  saveSet(el, secs);
}

function tickSw(target) {
  const t = document.getElementById('swT'), arc = document.getElementById('swArc'), s = document.getElementById('swS'), box = document.getElementById('sw');
  if (!Log.sw || !t) return;
  const el = Date.now() - Log.sw.t0;
  if (Log.sw.phase === 'count') {
    const left = 3 - Math.floor(el / 1000);
    if (left <= 0) { Log.sw = {phase: 'run', t0: Date.now()}; beep(880, .15); }
    else { t.textContent = left; s.textContent = 'hazırlan'; if (left !== tickSw.last) beep(440, .08); tickSw.last = left; }
  } else {
    const sec = el / 1000, goal = target ? target + 1 : 60, C = 2 * Math.PI * 96;
    t.textContent = Math.floor(sec);
    arc.setAttribute('stroke-dasharray', `${C * Math.min(1, sec / goal)} ${C}`);
    const beat = target && sec >= target + 1;
    box.classList.toggle('beat', !!beat);
    s.textContent = beat ? '🔥 geçtin, devam!' : target ? `hedef ${target + 1} sn` : 'saniye';
    if (beat && !tickSw.beeped) { beep(1200, .2); tickSw.beeped = true; }
  }
  if (Log.sw && Log.sw.phase === 'run' && el < 50) tickSw.beeped = false;
  requestAnimationFrame(() => tickSw(target));
}

function tickRest() {
  const box = document.getElementById('rest'); if (!box) return;
  if (!Log.rest) { box.hidden = true; return; }
  const left = Math.ceil((Log.rest - Date.now()) / 1000);
  if (left <= 0) { Log.rest = null; box.hidden = true; beep(660, .3); navigator.vibrate && navigator.vibrate([200, 100, 200]); toast('⏰ Dinlenme bitti. Sıradaki set!'); return; }
  box.hidden = false;
  document.getElementById('restT').textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
  const C = 2 * Math.PI * 25, tot = Math.max(Log.restLen, left);
  document.getElementById('restArc').setAttribute('stroke-dasharray', `${C * left / tot} ${C}`);
  clearTimeout(tickRest.t); tickRest.t = setTimeout(tickRest, 250);
}

let audioCtx;
function beep(f, dur) {
  try {
    audioCtx = audioCtx || new AudioContext();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = f; g.gain.value = .08; o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}

function confetti() {
  const cols = ['#ffb340', '#ff6a00', '#ffe9a8', '#38bdf8', '#f472b6', '#34d399'];
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i'); c.className = 'cf';
    c.style.cssText = `left:${Math.random() * 100}vw;background:${cols[i % cols.length]};animation-delay:${Math.random() * .3}s;animation-duration:${1.4 + Math.random()}s;transform:rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(c); setTimeout(() => c.remove(), 2800);
  }
}
