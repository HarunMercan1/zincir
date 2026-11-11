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

  // --- giriş: e-postaya link gelir, link uygulamayı #access_token=… ile geri açar ---
  sendLink(email) {
    const back = location.origin + location.pathname;
    return this.api('/auth/v1/otp?redirect_to=' + encodeURIComponent(back), {method: 'POST', body: JSON.stringify({email, create_user: true})}, false);
  },
  async fromLink() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.get('access_token') && !h.get('error_description')) return;
    history.replaceState(null, '', location.pathname + location.search);
    if (h.get('error_description')) { toast('❌ Giriş linki: ' + h.get('error_description')); return; }
    try {
      const at = h.get('access_token');
      const user = await (await fetch(SB_URL + '/auth/v1/user', {headers: {apikey: SB_KEY, Authorization: 'Bearer ' + at}})).json();
      this.setSession({access_token: at, refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600, user});
      this.st.pulled = null; this.st.base = {}; this.keep();   // yeni bağlanan cihaz: önce buluttakini al
      toast('☁️ Giriş yapıldı: ' + user.email);
    } catch (e) { toast('❌ Giriş tamamlanamadı: ' + e.message); }
  },
  logout() { this.st = {session: null, pulled: null, base: {}}; this.keep(); this.status = 'off'; this.paint(); },

  // --- eşitleme ---
  schedule(ms = 1500) { if (!this.on) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), ms); },
  async run() {
    if (!this.on) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true; this.status = 'busy'; this.paint();
    try {
      const changed = await this.pull();
      await this.push();
      this.status = 'ok'; this.err = null; this.last = new Date();
      if (changed) { Store.save(); render(); }
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

  // --- arayüz: "Veri ve yedek" bölümündeki kart ---
  paint() {
    const el = document.getElementById('sync'); if (el) renderSync(el);
    const bk = document.getElementById('backup'); if (bk) renderBackup(bk);
  },
};

function renderSync(el) {
  if (DEMO) { el.innerHTML = ''; return; }
  const s = Sync.st.session;
  if (!s) {
    el.innerHTML = `<div class="card bk sy">
      <div class="bk-info"><span class="bk-ic">☁️</span><div><b>Telefon ve bilgisayar aynı veriyi görsün</b>
        <small id="syMsg">E-postanla giriş yap; kayıtların buluta yedeklenir ve giriş yaptığın her cihazda görünür.</small></div></div>
      <form class="sy-form" id="syForm">
        <input type="email" id="syEmail" placeholder="e-posta adresin" required autocomplete="email">
        <button class="bk-dl" id="syBtn">Giriş linki gönder</button>
      </form></div>`;
    const f = el.querySelector('#syForm'), em = f.querySelector('#syEmail'), btn = f.querySelector('#syBtn');
    f.onsubmit = async ev => {
      ev.preventDefault(); btn.disabled = true;
      try {
        await Sync.sendLink(em.value.trim());
        el.querySelector('#syMsg').innerHTML = `📧 <b>${em.value.trim()}</b> adresine link gönderildi. E-postadaki linke <b>bu cihazda</b> tıkla; uygulama açılıp giriş yapacak.`;
        toast('📧 Giriş linki gönderildi');
      } catch (e) { toast('❌ ' + e.message); }
      btn.disabled = false;
    };
    return;
  }
  const txt = {busy: 'Eşitleniyor…', ok: 'Eşitlendi' + (Sync.last ? ' · ' + Sync.last.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'}) : ''),
    err: 'Eşitlenemedi: ' + Sync.err, offline: 'İnternet yok; bağlanınca eşitlenecek', off: ''}[Sync.status] || '';
  el.innerHTML = `<div class="card bk sy">
    <div class="bk-info"><span class="bk-ic">${Sync.status === 'err' ? '⚠️' : '☁️'}</span><div><b>Bulut eşitleme açık</b>
      <small><b>${s.email}</b> · ${txt}</small></div></div>
    <div class="bk-btns"><button class="bk-ul" id="syNow">↻ Şimdi eşitle</button><button class="bk-ul" id="syOut">Çıkış</button></div></div>`;
  el.querySelector('#syNow').onclick = () => Sync.run();
  el.querySelector('#syOut').onclick = () => { if (confirm('Bu cihazda buluttan çıkılsın mı? Kayıtların bu cihazda kalır.')) Sync.logout(); };
}

Sync.load();
addEventListener('online', () => Sync.run());
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && Sync.run());
