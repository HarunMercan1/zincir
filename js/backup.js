// Yedek indir / yükle. Veri sadece bu tarayıcıda durduğu için tek güvence bu.
const BK_KEY = 'zincir-last-backup';

function renderBackup(el) {
  let last = null; try { last = localStorage.getItem(BK_KEY); } catch (e) {}
  const days = workedDays().length, ago = last ? diffDays(last, today()) : null;
  const warn = days >= 3 && (ago === null || ago >= 7);
  el.innerHTML = `<div class="card bk ${warn ? 'warn' : ''}">
    <div class="bk-info">
      <span class="bk-ic">${warn ? '⚠️' : '💾'}</span>
      <div><b>${warn ? 'Yedek almanın zamanı geldi' : 'Verin güvende mi?'}</b>
      <small>Kayıtların sadece bu tarayıcıda duruyor (${days} gün, ${sum(workedDays().map(d => sum(EX.map(e => Store.sets(d, e.id).length))))} set).
      ${last ? `Son yedek: <b>${ago === 0 ? 'bugün' : ago + ' gün önce'}</b>.` : 'Henüz hiç yedek almadın.'}
      Tarayıcı verisini temizlersen her şey gider; ara sıra yedek indir.</small></div>
    </div>
    <div class="bk-btns">
      <button class="bk-dl" id="bkDl">⬇ Yedek indir</button>
      <label class="bk-ul">⬆ Yedekten yükle<input type="file" accept=".json,application/json" id="bkUl" hidden></label>
    </div></div>`;
  el.querySelector('#bkDl').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(Store.data, null, 1)], {type: 'application/json'}));
    a.download = `zincir-yedek-${today()}.json`; a.click();
    if (!DEMO) try { localStorage.setItem(BK_KEY, today()); } catch (e) {}
    toast('💾 Yedek indirildi'); renderBackup(el);
  };
  el.querySelector('#bkUl').onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    let obj; try { obj = JSON.parse(await f.text()); } catch (e) { toast('❌ Dosya okunamadı (JSON değil)'); return; }
    const err = validateBackup(obj); if (err) { toast('❌ Geçersiz yedek: ' + err); return; }
    const n = Object.keys(obj).length;
    if (!confirm(`Yedekte ${n} gün var. Şu anki verinin (${Object.keys(Store.data).length} gün) YERİNE yüklensin mi?`)) return;
    Store.data = obj; Store.emit(); render(); toast(`✅ Yedek yüklendi: ${n} gün`);
  };
}

function validateBackup(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return 'beklenen yapı bulunamadı';
  for (const [d, r] of Object.entries(o)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return `tarih hatalı: ${d}`;
    if (!r || typeof r !== 'object') return `${d} günü hatalı`;
    for (const [id, s] of Object.entries(r)) {
      if (!EXM[id]) return `bilinmeyen hareket: ${id}`;
      if (!Array.isArray(s) || !s.every(v => Number.isInteger(v) && v > 0)) return `${d} / ${id} setleri hatalı`;
    }
  }
  return null;
}
