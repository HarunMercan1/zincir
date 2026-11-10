// Sekmeler, ortak durum, bildirim
const App = {tab: 'chain', day: today(), ex: 'hang'};

function show(tab) {
  App.tab = tab;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (!document.getElementById('tab-' + tab)) tab = App.tab = 'chain';
  document.querySelectorAll('main > section').forEach(s => s.hidden = s.id !== 'tab-' + tab);
  render();
  try { localStorage.setItem('zincir-tab', tab); } catch (e) {}
  window.scrollTo({top: 0});
}

function render() {
  updatePills();
  const el = document.getElementById('tab-' + App.tab);
  if (App.tab === 'ach') renderAch(el);
  if (App.tab === 'chain') renderChainTab(el);
  if (App.tab === 'log') renderLog(el);
  if (App.tab === 'stats') renderStats(el);
}

function updatePills() {
  document.getElementById('pill').textContent = streakInfo().cur;
  const x = xpInfo();
  document.getElementById('lvlPill').innerHTML = `${levelBadge(x, 26)}<span><small>${x.tier[1]}</small><i><b style="width:${x.cur / x.need * 100}%"></b></i></span>`;
}

function openDay(d) { if (d > today()) return; App.day = d; show('log'); }

let toastTimer;
function toast(html, action) {
  const t = document.getElementById('toast');
  t.innerHTML = html + (action ? ` <button>${action.label}</button>` : '');
  if (action) t.querySelector('button').onclick = () => { action.fn(); t.classList.remove('on'); };
  t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 4500);
}

Store.load();
Store.listeners.push(() => { if (App.tab !== 'log') render(); });
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => show(b.dataset.tab));
if (DEMO) document.getElementById('demo').hidden = false;
let startTab = 'chain';
try { startTab = localStorage.getItem('zincir-tab') || 'chain'; } catch (e) {}
show(startTab);
setInterval(updateStatus, 30000);

// ana ekrana eklenebilir / çevrimdışı (sadece http(s) üzerinden; dosyadan açınca atlanır)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
