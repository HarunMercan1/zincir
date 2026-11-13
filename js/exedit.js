// Hareketleri düzenle: ekle, ad/ikon/birim değiştir, gizle / geri getir
const EX_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#fb7185', '#22d3ee', '#a3e635', '#f97316', '#c084fc', '#2dd4bf', '#facc15'];
const EX_ICONS = ['🏋️', '🦵', '🤸', '🏃', '🚴', '🧘', '🥊', '🏊', '⛹️', '🤾', '🪢', '🦶', '💥', '⚡', '🔥', '🎯'];
const exCopy = () => JSON.parse(JSON.stringify(EXALL));
const exHasData = id => Object.values(Store.data).some(r => r[id] && r[id].length);

function openExEditor(editId) {
  let box = document.getElementById('exed');
  if (!box) { box = document.createElement('div'); box.id = 'exed'; box.className = 'exed'; document.body.appendChild(box); }
  const shown = EXALL.filter(e => !exHidden(e)), hidden = EXALL.filter(exHidden), t = today();
  const form = e => `<form class="exf" data-id="${e ? e.id : ''}">
      <div class="exf-row">
        <input name="icon" class="exf-ic" value="${e ? e.icon : EX_ICONS[0]}" maxlength="4" aria-label="İkon">
        <input name="name" value="${e ? e.name.replace(/"/g, '&quot;') : ''}" placeholder="Hareketin adı (ör. Squat)" maxlength="24" required>
      </div>
      <div class="exf-icons">${EX_ICONS.map(i => `<button type="button" data-ic="${i}">${i}</button>`).join('')}</div>
      <div class="exf-unit">
        <label><input type="radio" name="unit" value="tekrar" ${!e || !e.timed ? 'checked' : ''}> Tekrar sayısı</label>
        <label><input type="radio" name="unit" value="sn" ${e && e.timed ? 'checked' : ''}> Süre (saniye)</label>
      </div>
      <div class="exf-btns"><button class="exf-ok">${e ? 'Kaydet' : 'Ekle'}</button><button type="button" class="exf-cancel">Vazgeç</button></div>
      ${e ? '' : `<small class="muted">Bugünden itibaren tam gün için bu hareket de gerekir (${shown.length + 1}/${shown.length + 1}). Geçmiş günlerin değişmez.</small>`}
    </form>`;
  const row = e => editId === e.id ? form(e) : `<div class="exr" style="--c:${e.color}">
      <span class="exr-ic">${e.icon}</span>
      <div class="exr-n"><b>${e.name}</b><small>${e.timed ? 'saniye' : 'tekrar'}${e.from > '2000-01-01' ? ` · ${fmtD(e.from)} itibarıyla` : ''}</small></div>
      ${exHidden(e) ? `<button data-show="${e.id}">Geri getir</button>` : `<button data-edit="${e.id}">Düzenle</button><button data-hide="${e.id}" class="exr-hide">Gizle</button>`}
    </div>`;
  box.innerHTML = `<div class="exed-box">
    <div class="exed-h"><b>Hareketler</b><button class="exed-x" aria-label="Kapat">✕</button></div>
    <p class="muted exed-sub">Tam gün için bugün <b>${exOn(t).length}</b> hareketin hepsi gerekiyor.</p>
    <div class="exed-list">${shown.map(row).join('')}</div>
    ${editId === 'new' ? form(null) : '<button class="exed-add" data-edit="new">＋ Yeni hareket ekle</button>'}
    ${hidden.length ? `<h4>Gizlenenler</h4><p class="muted exed-sub">Kayıtları duruyor; tam gün için gerekmiyor.</p><div class="exed-list">${hidden.map(row).join('')}</div>` : ''}
  </div>`;
  box.hidden = false; document.body.classList.add('locked');

  const close = () => { box.hidden = true; box.innerHTML = ''; document.body.classList.remove('locked'); render(); };
  box.onclick = ev => { if (ev.target === box) close(); };
  box.querySelector('.exed-x').onclick = close;
  box.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openExEditor(b.dataset.edit));
  box.querySelectorAll('[data-hide]').forEach(b => b.onclick = () => {
    const e = EXM[b.dataset.hide];
    if (shown.length <= 1) { toast('En az bir hareket kalmalı'); return; }
    if (!confirm(`"${e.name}" gizlensin mi?\nBugünden itibaren tam gün için gerekmez. Eski kayıtları silinmez, istediğin zaman geri getirebilirsin.`)) return;
    const l = exCopy(); const x = l.find(y => y.id === e.id); x.hid = [...(x.hid || []), [t, null]];
    ExList.set(l); openExEditor();
  });
  box.querySelectorAll('[data-show]').forEach(b => b.onclick = () => {
    const l = exCopy(); const x = l.find(y => y.id === b.dataset.show);
    x.hid = x.hid.map(g => g[1] ? g : [g[0], t]);
    ExList.set(l); openExEditor(); toast(`${x.icon} ${x.name} geri geldi`);
  });
  const f = box.querySelector('.exf');
  if (!f) return;
  f.querySelectorAll('[data-ic]').forEach(b => b.onclick = () => { f.elements.icon.value = b.dataset.ic; });
  f.querySelector('.exf-cancel').onclick = () => openExEditor();
  f.elements.name.focus();
  f.onsubmit = ev => {
    ev.preventDefault();
    const name = f.elements.name.value.trim(), icon = f.elements.icon.value.trim() || '🏋️', timed = f.elements.unit.value === 'sn';
    if (!name) return;
    if (EXALL.some(e => e.id !== f.dataset.id && e.name.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) { toast('Bu adda bir hareket zaten var'); return; }
    const l = exCopy();
    if (f.dataset.id) {
      const x = l.find(y => y.id === f.dataset.id);
      if (!!x.timed !== timed && exHasData(x.id) && !confirm('Bu hareketin eski kayıtları var. Birimi değiştirirsen eski sayılar yeni birimle okunur (ör. 20 tekrar → 20 sn). Devam edilsin mi?')) return;
      Object.assign(x, {name, icon, timed, unit: timed ? 'sn' : 'tekrar'});
      if (!timed) delete x.timed;
    } else {
      const used = new Set(EXALL.map(e => e.color));
      const id = 'x' + Date.now().toString(36);
      l.push({id, name, icon, unit: timed ? 'sn' : 'tekrar', ...(timed ? {timed: true} : {}),
        color: EX_COLORS.find(c => !used.has(c)) || EX_COLORS[l.length % EX_COLORS.length], from: t});
      App.ex = id; Log.val = null;
    }
    ExList.set(l); openExEditor();
    toast(f.dataset.id ? '✓ Kaydedildi' : `${icon} ${name} eklendi`);
  };
}
