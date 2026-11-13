// Seviye / XP ve başarımlar
const LEVELS = [ // [başlangıç seviyesi, ad, renk1, renk2]
  [1,  'Paslı Halka',   '#8a5a3a', '#4a2c18'],
  [3,  'Demir Halka',   '#9aa3b5', '#4b5263'],
  [6,  'Çelik Halka',   '#cfe3f5', '#5b7a99'],
  [10, 'Bronz Halka',   '#f0b07a', '#9a5a26'],
  [15, 'Gümüş Halka',   '#ffffff', '#9aa6bd'],
  [20, 'Altın Halka',   '#fff1a8', '#e09400'],
  [30, 'Platin Halka',  '#e8fbff', '#7fd4e8'],
  [40, 'Elmas Halka',   '#d9f6ff', '#5b8cff'],
];
const XP_RULES = {set: 10, pr: 50, full: 50, chainPerDay: 2, chainCap: 30};
const lvlNeed = L => 50 * L * (L - 1); // L. seviyeye ulaşmak için toplam XP

function xpInfo() {
  let xp = 0, best = {}, run = 0, prev = null;
  const log = {sets: 0, prs: 0, full: 0, chain: 0};
  for (const d of workedDays()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1; prev = d;
    for (const e of EXALL) for (const v of Store.sets(d, e.id)) {
      xp += XP_RULES.set; log.sets += XP_RULES.set;
      if (best[e.id] && v > best[e.id]) { xp += XP_RULES.pr; log.prs += XP_RULES.pr; }
      best[e.id] = Math.max(best[e.id] || 0, v);
    }
    if (isFull(d)) { xp += XP_RULES.full; log.full += XP_RULES.full; }
    const cb = Math.min(run, XP_RULES.chainCap) * XP_RULES.chainPerDay; xp += cb; log.chain += cb;
  }
  let L = 1; while (lvlNeed(L + 1) <= xp) L++;
  const tier = [...LEVELS].reverse().find(t => L >= t[0]);
  const nextTier = LEVELS.find(t => t[0] > L);
  return {xp, L, tier, nextTier, cur: xp - lvlNeed(L), need: lvlNeed(L + 1) - lvlNeed(L), log};
}

function levelBadge(info, size = 96) {
  const [, , c1, c2] = info.tier;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="lvl-svg">
    <defs><linearGradient id="lg${size}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <path d="M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z" fill="#0f121b" stroke="url(#lg${size})" stroke-width="6" stroke-linejoin="round"/>
    <path d="M50 16 L80 33 L80 67 L50 84 L20 67 L20 33 Z" fill="url(#lg${size})" opacity=".14"/>
    <text x="50" y="62" text-anchor="middle" font-family="Bebas Neue, Impact" font-size="40" fill="url(#lg${size})">${info.L}</text>
  </svg>`;
}

// --- başarımlar ---
const totalOf = id => sum(Object.keys(Store.data).map(d => total(d, id)));
const bestOf = id => Math.max(0, ...Object.keys(Store.data).flatMap(d => Store.sets(d, id)));
const fullDays = () => workedDays().filter(isFull).length;
const TIERS = ['Bronz', 'Gümüş', 'Altın', 'Efsane'];

const ACH = [
  {cat: 'Zincir', ic: '⛓', name: 'Kırılmaz Zincir', desc: 'En uzun zincir', unit: 'gün', val: () => streakInfo().best, t: [7, 30, 100, 365]},
  {cat: 'Zincir', ic: '✅', name: 'Altın Halka', desc: 'Tam gün sayısı', unit: 'gün', val: fullDays, t: [5, 25, 75, 200]},
  {cat: 'Zincir', ic: '📅', name: 'Sadakat', desc: 'Toplam antrenman günü', unit: 'gün', val: () => workedDays().length, t: [10, 50, 150, 365]},
  {cat: 'Zincir', ic: '🔁', name: 'Geri Dönüş', desc: 'Kırılan zincirden sonra 7 gün', unit: 'kez', val: () => streakInfo().segs.slice(1).filter(s => s.len >= 7).length, t: [1, 3, 5, 10]},
  {cat: 'Hacim', ic: '💪', name: 'Şınav Makinesi', desc: 'Toplam şınav', unit: 'tekrar', val: () => totalOf('push'), t: [100, 1000, 5000, 20000]},
  {cat: 'Hacim', ic: '🔄', name: 'Çelik Karın', desc: 'Toplam mekik', unit: 'tekrar', val: () => totalOf('sit'), t: [100, 1000, 5000, 20000]},
  {cat: 'Hacim', ic: '🧗', name: 'Barfiks Ustası', desc: 'Toplam barfiks', unit: 'tekrar', val: () => totalOf('pull'), t: [50, 500, 2000, 10000]},
  {cat: 'Hacim', ic: '🪝', name: 'Pençe', desc: 'Toplam asılı kalma', unit: 'dk', val: () => Math.floor(totalOf('hang') / 60), t: [10, 60, 300, 1000]},
  {cat: 'Hacim', ic: '🧱', name: 'Beton Gövde', desc: 'Toplam plank', unit: 'dk', val: () => Math.floor(totalOf('plank') / 60), t: [10, 60, 300, 1000]},
  {cat: 'Güç', ic: '🚀', name: 'Patlayıcı', desc: 'Tek sette en çok şınav', unit: 'tekrar', val: () => bestOf('push'), t: [25, 40, 60, 100]},
  {cat: 'Güç', ic: '🦾', name: 'Çekiş Gücü', desc: 'Tek sette en çok barfiks', unit: 'tekrar', val: () => bestOf('pull'), t: [8, 12, 20, 30]},
  {cat: 'Güç', ic: '🎯', name: 'Karın Duvarı', desc: 'Tek sette en çok mekik', unit: 'tekrar', val: () => bestOf('sit'), t: [25, 40, 60, 100]},
  {cat: 'Dayanıklılık', ic: '⏱', name: 'Demir Tutuş', desc: 'Tek sette asılı kalma', unit: 'sn', val: () => bestOf('hang'), t: [60, 90, 120, 180]},
  {cat: 'Dayanıklılık', ic: '🗿', name: 'Heykel', desc: 'Tek sette plank', unit: 'sn', val: () => bestOf('plank'), t: [150, 240, 360, 600]},
  {cat: 'Dayanıklılık', ic: '🔥', name: 'Hacim Canavarı', desc: 'Tek günde set sayısı', unit: 'set', val: () => Math.max(0, ...workedDays().map(d => sum(EXALL.map(e => Store.sets(d, e.id).length)))), t: [16, 20, 25, 35]},
  {cat: 'Dayanıklılık', ic: '⭐', name: 'Seviye Avcısı', desc: 'Ulaşılan seviye', unit: 'seviye', val: () => xpInfo().L, t: [5, 10, 20, 40]},
];

function achState(a) {
  const v = a.val(), lvl = a.t.filter(x => v >= x).length, next = a.t[lvl];
  const lo = lvl ? a.t[lvl - 1] : 0;
  return {v, lvl, next, p: next ? (v - lo) / (next - lo) : 1};
}
const achKey = () => ACH.map(a => achState(a).lvl).join(',');

function renderAch(el) {
  const info = xpInfo(), st = ACH.map(a => ({a, ...achState(a)}));
  const earned = sum(st.map(x => x.lvl)), maxE = ACH.length * 4;
  const cats = [...new Set(ACH.map(a => a.cat))];
  const near = st.filter(x => x.next).sort((a, b) => b.p - a.p).slice(0, 3);

  el.innerHTML = `
  <section class="lvl-hero card">
    <div class="lvl-badge">${levelBadge(info, 130)}</div>
    <div class="lvl-main">
      <small>SEVİYE ${info.L}</small>
      <b style="background:linear-gradient(90deg,${info.tier[2]},${info.tier[3]});-webkit-background-clip:text;background-clip:text;color:transparent">${info.tier[1]}</b>
      <div class="xp-bar"><i style="width:${info.cur / info.need * 100}%;background:linear-gradient(90deg,${info.tier[3]},${info.tier[2]})"></i></div>
      <div class="xp-txt"><span><b>${info.cur}</b> / ${info.need} XP</span><span>Seviye ${info.L + 1} için ${info.need - info.cur} XP</span></div>
      ${info.nextTier ? `<div class="muted" style="font-size:13px;margin-top:6px">Sıradaki metal: <b style="color:${info.nextTier[2]}">${info.nextTier[1]}</b> (seviye ${info.nextTier[0]})</div>` : ''}
    </div>
    <div class="xp-split">
      <div><span>Setler</span><b>${info.log.sets}</b></div>
      <div><span>Rekorlar</span><b>${info.log.prs}</b></div>
      <div><span>Tam günler</span><b>${info.log.full}</b></div>
      <div><span>Zincir bonusu</span><b>${info.log.chain}</b></div>
      <div class="tot"><span>Toplam XP</span><b>${info.xp}</b></div>
    </div>
  </section>

  <div class="xp-rules muted">XP nasıl kazanılır: her set <b>+${XP_RULES.set}</b> · rekor set <b>+${XP_RULES.pr}</b> · tam gün <b>+${XP_RULES.full}</b> · zincirin her günü <b>+${XP_RULES.chainPerDay}×zincir uzunluğu</b> (en çok +${XP_RULES.chainCap * XP_RULES.chainPerDay})</div>

  <h2>Metal yolu</h2>
  <div class="metal-road">${LEVELS.map(t => `<div class="metal ${info.L >= t[0] ? 'on' : ''} ${t === info.tier ? 'cur' : ''}" style="--m1:${t[2]};--m2:${t[3]}">
    <i></i><b>${t[1].replace(' Halka', '')}</b><small>Sv. ${t[0]}</small></div>`).join('')}</div>

  ${near.length ? `<h2>Hedefe en yakın</h2><div class="near">${near.map(x => `<div class="card nr">
    <span class="nr-ic">${x.a.ic}</span><div><b>${x.a.name} · ${TIERS[x.lvl]}</b><small>${x.a.desc}: ${x.v} / ${x.next} ${x.a.unit}</small>
    <div class="ap-bar"><i style="width:${x.p * 100}%"></i></div></div><em>%${Math.floor(x.p * 100)}</em></div>`).join('')}</div>` : ''}

  <h2>Başarımlar · ${earned} / ${maxE} kademe</h2>
  ${cats.map(c => `<div class="ach-cat">${c}</div><div class="ach-grid">${st.filter(x => x.a.cat === c).map(x => `
    <div class="card ach t${x.lvl}">
      <div class="ach-top"><span class="ach-ic">${x.a.ic}</span><div class="pips">${x.a.t.map((_, i) => `<i class="${i < x.lvl ? 'on' : ''}"></i>`).join('')}</div></div>
      <b>${x.a.name}</b>
      <small>${x.lvl ? TIERS[x.lvl - 1] + ' · ' : ''}${x.a.desc}</small>
      <div class="ap-bar"><i style="width:${x.p * 100}%"></i></div>
      <div class="ap-txt">${x.next ? `${x.v} / ${x.next} ${x.a.unit} → ${TIERS[x.lvl]}` : `${x.v} ${x.a.unit} · TAMAMLANDI 👑`}</div>
    </div>`).join('')}</div>`).join('')}
  `;
}
