// Cihazlar arası eşitleme (Supabase). Kütüphane yok: Auth ve REST uçlarına doğrudan fetch.
// Fikir: her gün tek satır. "base" = o günün en son buluttakiyle eşit olduğu hâli.
// Yerel gün base'den farklıysa bu cihazda değişmiştir → gönder; değilse buluttakini al.
const SB_URL = 'https://bukmrjdwznljqdhvfgur.supabase.co';
const SB_KEY = 'sb_publishable_WKKhBwkgrpzsQJ7lmD8qhw_g6_NVLLe';
const SY_KEY = 'zincir-sync';

// anahtar sırası farklı olsa da aynı veri aynı metni versin (jsonb sırayı değiştirir)
const canon = o => JSON.stringify(Object.keys(o || {}).sort().reduce((a, k) => (a[k] = o[k], a), {}));

const Sync = {
  st: {session: null, pulled: null, base: {}},
  busy: false, again: false, timer: null, status: 'off', last: null, err: null,

  load() { try { Object.assign(this.st, JSON.parse(localStorage.getItem(SY_KEY) || '{}')); } catch (e) {} },
  keep() { try { localStorage.setItem(SY_KEY, JSON.stringify(this.st)); } catch (e) {} },
  get on() { return !DEMO && !!this.st.session; },

  async api(path, opt = {}, auth = true) {
    const h = {apikey: SB_KEY, 'Content-Type': 'application/json', ...(opt.headers || {})};
    if (auth) h.Authorization = 'Bearer ' + await this.token();
    const r = await fetch(SB_URL + path, {...opt, headers: h});
    const body = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error((body && (body.msg || body.message || body.error_description)) || 'HTTP ' + r.status), {status: r.status});
    return body;
  },
  setSession(b) {
    this.st.session = {access: b.access_token, refresh: b.refresh_token, exp: Date.now() + b.expires_in * 1000,
      email: b.user ? b.user.email : this.st.session.email, uid: b.user ? b.user.id : this.st.session.uid};
    this.keep();
  },
  async token() {
    const s = this.st.session;
    if (s.exp - Date.now() < 60e3) {
      try { this.setSession(await this.api('/auth/v1/token?grant_type=refresh_token', {method: 'POST', body: JSON.stringify({refresh_token: s.refresh})}, false)); }
      catch (e) { if (e.status === 400 || e.status === 401) this.logout(); throw e; }
    }
    return this.st.session.access;
  },

  // --- giriş: e-posta + şifre ---
  enter(b) {
    // bu cihazdaki kayıtlar başka bir hesabınsa yeni hesaba karışmasın
    if (b.user && this.st.owner && this.st.owner !== b.user.id) this.wipe();
    this.setSession(b);
    this.st.owner = this.st.session.uid;
    this.st.pulled = null; this.st.base = {}; this.keep();   // yeni bağlanan cihaz: önce buluttakini al
    hideAuth(); render(); this.run();
  },
  // bu cihazdaki yerel kayıtları ve hareket listesini sıfırla (bulut etkilenmez)
  wipe() {
    Store.data = {}; Store.save();
    ExList.apply(JSON.parse(JSON.stringify(EX_DEFAULT))); ExList.at = 0; ExList.dirty = false; ExList.save();
  },
  async login(email, password) {
    this.enter(await this.api('/auth/v1/token?grant_type=password', {method: 'POST', body: JSON.stringify({email, password})}, false));
  },
  async signup(email, password) {
    const b = await this.api('/auth/v1/signup', {method: 'POST', body: JSON.stringify({email, password})}, false);
    if (!b.access_token) throw new Error('User already registered');
    this.enter(b);
  },
  recover(email) {
    const back = location.origin + location.pathname;
    return this.api('/auth/v1/recover?redirect_to=' + encodeURIComponent(back), {method: 'POST', body: JSON.stringify({email})}, false);
  },
  setPassword(password) { return this.api('/auth/v1/user', {method: 'PUT', body: JSON.stringify({password})}); },
  // e-postadaki şifre sıfırlama linkinden dönüş: #access_token=…&type=recovery
  async fromLink() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.get('access_token') && !h.get('error_description')) return;
    history.replaceState(null, '', location.pathname + location.search);
    if (h.get('error_description')) { this.linkErr = h.get('error_description'); return; }
    try {
      const at = h.get('access_token');
      const user = await (await fetch(SB_URL + '/auth/v1/user', {headers: {apikey: SB_KEY, Authorization: 'Bearer ' + at}})).json();
      this.setSession({access_token: at, refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600, user});
      if (this.st.owner && this.st.owner !== this.st.session.uid) this.wipe();
      this.st.owner = this.st.session.uid;
      this.st.pulled = null; this.st.base = {}; this.keep();
      if (h.get('type') === 'recovery') this.recovering = true;
    } catch (e) { this.linkErr = e.message; }
  },
  // clean: bilinçli çıkış → bu cihazdaki kayıtlar silinir (bulutta duruyor); oturum düştüyse silinmez, sahip hatırlanır
  logout(clean = false) {
    const owner = clean ? undefined : this.st.owner;
    if (clean) this.wipe();
    this.st = {session: null, pulled: null, base: {}, owner}; this.keep(); this.status = 'off'; this.paint(); showAuth(); },

  // --- eşitleme ---
  schedule(ms = 800) { if (!this.on) return; clearTimeout(this.timer); this.timer = setTimeout(() => { this.timer = null; this.run(); }, ms); },
  async run() {
    if (!this.on) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true; this.status = 'busy'; this.paint();
    try {
      const exChanged = await this.syncEx();
      const changed = await this.pull() || exChanged;
      await this.push();
      this.status = 'ok'; this.err = null; this.last = new Date();
      if (changed) Store.save();
      // sayı yazılırken ekranı yeniden çizip yazılanı silme; yazma bitince çiz
      if (changed || this.stale) { const typing = document.activeElement && document.activeElement.tagName === 'INPUT'; this.stale = typing; if (!typing) render(); }
    } catch (e) {
      this.status = navigator.onLine ? 'err' : 'offline'; this.err = e.message;
    }
    this.busy = false; this.paint();
    if (this.again) { this.again = false; this.run(); }
  },
  async pull() {
    const q = '/rest/v1/zincir_days?select=day,sets,updated_at&order=updated_at' + (this.st.pulled ? '&updated_at=gt.' + encodeURIComponent(new Date(Date.parse(this.st.pulled) - 60e3).toISOString()) : '');
    const rows = await this.api(q);
    let changed = false;
    for (const r of rows) {
      const remote = canon(r.sets), local = canon(Store.data[r.day]), base = this.st.base[r.day];
      // bu cihazda değişmemişse (ya da cihaz yeni bağlandıysa) bulut kazanır
      if (base === undefined || local === base) {
        if (local !== remote) {
          if (Object.keys(r.sets).length) Store.data[r.day] = r.sets; else delete Store.data[r.day];
          changed = true;
        }
        this.st.base[r.day] = remote;
      }
      this.st.pulled = r.updated_at;   // sorguda 1 dk geri sarılıyor: aynı anda yazılan satırlar kaçmasın
    }
    this.keep();
    return changed;
  },
  // hareket listesi: bu cihazda değiştiyse gönder, değilse buluttakini al
  async syncEx() {
    if (ExList.dirty) {
      const at = ExList.at;
      await this.api('/rest/v1/zincir_meta?on_conflict=user_id', {method: 'POST', body: JSON.stringify([{user_id: this.st.session.uid, ex: EXALL}]),
        headers: {Prefer: 'resolution=merge-duplicates,return=minimal'}});
      if (ExList.at === at) { ExList.dirty = false; ExList.save(); }   // gönderirken yeniden değiştiyse bir sonraki turda gider
      return false;
    }
    const rows = await this.api('/rest/v1/zincir_meta?select=ex');
    const key = l => JSON.stringify(l.map(canon));
    if (rows.length && Array.isArray(rows[0].ex) && rows[0].ex.length && key(rows[0].ex) !== key(EXALL)) {
      ExList.apply(rows[0].ex); ExList.save();
      return true;
    }
    return false;
  },
  async push() {
    const days = new Set([...Object.keys(Store.data), ...Object.keys(this.st.base)]);
    const rows = [...days].filter(d => canon(Store.data[d]) !== this.st.base[d])
      .map(d => ({user_id: this.st.session.uid, day: d, sets: Store.data[d] || {}}));
    if (!rows.length) return;
    await this.api('/rest/v1/zincir_days?on_conflict=user_id,day', {method: 'POST', body: JSON.stringify(rows),
      headers: {Prefer: 'resolution=merge-duplicates,return=minimal'}});
    for (const r of rows) this.st.base[r.day] = canon(r.sets);
    this.keep();
  },

  // --- arayüz: üst sağdaki hesap düğmesi ---
  paint() {
    renderAcct();
    const bk = document.getElementById('backup'); if (bk) renderBackup(bk);
  },
};

let acctOpen = false;
function renderAcct() {
  const el = document.getElementById('acct'); if (!el) return;
  const s = Sync.st.session;
  if (DEMO || !s) { el.innerHTML = ''; return; }
  const txt = {busy: 'Eşitleniyor…', ok: 'Eşitlendi' + (Sync.last ? ' · ' + Sync.last.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'}) : ''),
    err: 'Eşitlenemedi: ' + Sync.err, offline: 'İnternet yok; bağlanınca eşitlenecek', off: ''}[Sync.status] || '';
  el.innerHTML = `<button class="acct-btn" id="acctBtn" title="${s.email}">${s.email[0].toUpperCase()}<i class="acct-dot ${Sync.status}"></i></button>
    <div class="acct-menu" ${acctOpen ? '' : 'hidden'}>
      <b>${s.email}</b>
      <small>☁️ ${txt}</small>
      <button id="syNow">↻ Şimdi eşitle</button>
      <button id="syOut">Çıkış yap</button>
    </div>`;
  el.querySelector('#acctBtn').onclick = e => { e.stopPropagation(); acctOpen = !acctOpen; renderAcct(); };
  el.querySelector('.acct-menu').onclick = e => e.stopPropagation();
  el.querySelector('#syNow').onclick = () => Sync.run();
  el.querySelector('#syOut').onclick = async () => {
    if (!confirm('Bu cihazda hesaptan çıkılsın mı? Kayıtların hesabında kalır, bu cihazdan silinir.')) return;
    acctOpen = false;
    await Sync.run();   // bekleyen kayıtları önce gönder
    if (Sync.status !== 'ok' && !confirm('Son kayıtlar buluta gönderilemedi (' + (Sync.err || 'bağlantı yok') + '). Yine de çıkılsın mı? Gönderilmemişler kaybolur.')) { Sync.paint(); return; }
    Sync.logout(true); render();
  };
}
document.addEventListener('click', () => { if (acctOpen) { acctOpen = false; renderAcct(); } });

// --- giriş ekranı (zorunlu) ---
const AUTH_ERR = {
  'Invalid login credentials': 'E-posta veya şifre yanlış.',
  'User already registered': 'Bu e-postayla zaten hesap var. Giriş yap; şifren yoksa "Şifremi unuttum".',
  'Password should be at least 6 characters.': 'Şifre en az 6 karakter olmalı.',
  'Unable to validate email address: invalid format': 'E-posta adresi geçersiz.',
};
const authMsg = e => AUTH_ERR[e.message] || (e.status === 429 ? 'Çok fazla deneme; biraz bekleyip tekrar dene.'
  : navigator.onLine ? e.message : 'İnternet bağlantısı yok.');

function hideAuth() { const a = document.getElementById('auth'); a.hidden = true; a.innerHTML = ''; document.body.classList.remove('locked'); }

function showAuth(mode = 'login') {
  const a = document.getElementById('auth');
  a.hidden = false; document.body.classList.add('locked');
  const T = {
    login:  {h: 'Giriş yap', btn: 'Giriş yap', pw: true},
    signup: {h: 'Hesap oluştur', btn: 'Hesap oluştur', pw: true},
    forgot: {h: 'Şifremi unuttum', btn: 'Sıfırlama linki gönder', pw: false},
    newpw:  {h: 'Yeni şifreni belirle', btn: 'Şifreyi kaydet', pw: true},
  }[mode];
  const tabs = mode === 'login' || mode === 'signup';
  a.innerHTML = `<div class="auth-box">
    <div class="auth-brand"><span>⛓</span> ZİNCİRİ KIRMA</div>
    <p class="auth-sub">Kayıtların hesabında durur; telefonda ve bilgisayarda aynısını görürsün.</p>
    ${tabs ? `<div class="auth-tabs">
      <button type="button" data-m="login" class="${mode === 'login' ? 'on' : ''}">Giriş yap</button>
      <button type="button" data-m="signup" class="${mode === 'signup' ? 'on' : ''}">Hesap oluştur</button></div>` : `<h3>${T.h}</h3>`}
    <form id="authForm">
      ${mode === 'newpw' ? `<p class="auth-note">${Sync.st.session.email}</p>` : '<input type="email" id="auEmail" placeholder="E-posta" required autocomplete="email">'}
      ${T.pw ? `<input type="password" id="auPw" placeholder="${mode === 'login' ? 'Şifre' : 'Şifre (en az 6 karakter)'}" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">` : ''}
      <p class="auth-err" id="auErr"></p>
      <button class="auth-go" id="auGo">${T.btn}</button>
    </form>
    ${mode === 'login' ? '<button type="button" class="auth-link" data-m="forgot">Şifremi unuttum</button>' : ''}
    ${mode === 'forgot' ? '<button type="button" class="auth-link" data-m="login">← Girişe dön</button>' : ''}
  </div>`;
  a.querySelectorAll('[data-m]').forEach(b => b.onclick = () => showAuth(b.dataset.m));
  const f = a.querySelector('#authForm'), go = a.querySelector('#auGo'), err = a.querySelector('#auErr');
  const em = a.querySelector('#auEmail'), pw = a.querySelector('#auPw');
  if (Sync.linkErr) { err.textContent = 'Link geçersiz ya da süresi dolmuş: ' + Sync.linkErr; Sync.linkErr = null; }
  f.onsubmit = async ev => {
    ev.preventDefault(); go.disabled = true; err.className = 'auth-err'; err.textContent = '';
    try {
      if (mode === 'login') await Sync.login(em.value.trim(), pw.value);
      if (mode === 'signup') await Sync.signup(em.value.trim(), pw.value);
      if (mode === 'forgot') {
        await Sync.recover(em.value.trim());
        err.className = 'auth-ok'; err.textContent = '📧 E-postana link gönderildi. Linke bu cihazda tıkla, yeni şifreni belirle.';
      }
      if (mode === 'newpw') { await Sync.setPassword(pw.value); Sync.recovering = false; hideAuth(); toast('🔑 Şifren kaydedildi'); Sync.run(); }
    } catch (e) { err.textContent = authMsg(e); }
    go.disabled = false;
  };
}

Sync.load();
addEventListener('online', () => Sync.run());
// ekrana dönünce çek; uygulama arka plana atılırken bekleyen kaydı hemen gönder
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') Sync.run();
  else if (Sync.timer) { clearTimeout(Sync.timer); Sync.run(); }
});
// açıkken öbür cihazın girdiklerini de getir (sorgu sadece yeni satırları ister, ucuz)
setInterval(() => { if (document.visibilityState === 'visible' && !Sync.busy) Sync.run(); }, 15000);
