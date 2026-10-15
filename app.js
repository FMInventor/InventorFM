/* Smart Pantry Pro — GitHub Pages + Supabase
   Nessun build: HTML + JS puro. */
'use strict';

/* ═════════════ Costanti ═════════════ */
const CATS = [
  { id: 'Carne e Pesce',    emoji: '🥩', food: true },
  { id: 'Frutta e Verdura', emoji: '🥦', food: true },
  { id: 'Latticini e Uova', emoji: '🧀', food: true },
  { id: 'Bevande',          emoji: '🥤', food: true },
  { id: 'Snack e Dolci',    emoji: '🍫', food: true },
  { id: 'Surgelati',        emoji: '🧊', food: true },
  { id: 'Altro',            emoji: '🥫', food: true },
  { id: 'Strumenti',        emoji: '🔧', food: false },
];
const FOOD_CATS = CATS.filter(c => c.food).map(c => c.id);
const UNITS = [
  ['pz', 'Pezzi (pz)'], ['g', 'Grammi (g)'], ['kg', 'Chili (kg)'],
  ['ml', 'Millilitri (ml)'], ['L', 'Litri (L)'], ['conf', 'Confezioni (conf)'],
];
const SOON_DAYS = 3;
const TABLES = ['products', 'lots', 'usage_log', 'shopping'];

const catOf = id => CATS.find(c => c.id === id) || CATS.find(c => c.id === 'Altro');
const $ = sel => document.querySelector(sel);
const norm = s => String(s || '').trim().toLowerCase();
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmtQty = n => Number(n).toLocaleString('it-IT', { maximumFractionDigits: 2 });
const round2 = n => Math.round(n * 100) / 100;

/* ═════════════ Date ═════════════ */
const pad = n => String(n).padStart(2, '0');
const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysLeft = s => Math.round((parseDay(s) - today()) / 86400000);
const fmtDate = s => parseDay(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const weekStart = date => {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunedì
  return d;
};

function lotStatus(lot) {
  if (!lot.expiry) return { cls: 'st-none', label: 'Nessuna scadenza', rank: 3 };
  const n = daysLeft(lot.expiry);
  if (n < 0) return { cls: 'st-expired', label: n === -1 ? 'Scaduto ieri' : `Scaduto da ${-n} gg`, rank: 0 };
  if (n === 0) return { cls: 'st-soon', label: 'Scade oggi', rank: 1 };
  if (n <= SOON_DAYS) return { cls: 'st-soon', label: `Scade tra ${n} gg`, rank: 1 };
  return { cls: 'st-ok', label: `Tra ${n} gg`, rank: 2 };
}

/* ═════════════ Archivio dati ═════════════ */
function makeSupabaseStore(sb) {
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  return {
    kind: 'supabase',
    async loadAll() {
      const out = {};
      await Promise.all(TABLES.map(async t => {
        out[t] = ok(await sb.from(t).select('*').order('created_at'));
      }));
      return out;
    },
    async insert(t, row) { return ok(await sb.from(t).insert(row).select().single()); },
    async update(t, id, patch) { return ok(await sb.from(t).update(patch).eq('id', id).select().single()); },
    async remove(t, id) { ok(await sb.from(t).delete().eq('id', id)); },
    async removeMany(t, ids) { if (ids.length) ok(await sb.from(t).delete().in('id', ids)); },
    async clear(t) { ok(await sb.from(t).delete().not('id', 'is', null)); },
    async replaceAll(nd) {
      for (const t of ['lots', 'usage_log', 'shopping', 'products']) await this.clear(t);
      for (const t of TABLES) {
        const rows = (nd[t] || []).map(({ user_id, ...r }) => r);
        for (let i = 0; i < rows.length; i += 500) ok(await sb.from(t).insert(rows.slice(i, i + 500)));
      }
    },
  };
}

function makeLocalStore() {
  const KEY = 'smart-pantry-demo-v1';
  const empty = () => ({ products: [], lots: [], usage_log: [], shopping: [] });
  let d;
  try { d = { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { d = empty(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage non disponibile */ } };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  return {
    kind: 'local',
    async loadAll() { return JSON.parse(JSON.stringify(d)); },
    async insert(t, row) {
      const now = new Date().toISOString();
      const r = { id: uid(), created_at: now, ...row };
      if (t === 'usage_log' && !r.used_at) r.used_at = now;
      if (t === 'shopping' && r.done == null) r.done = false;
      d[t].push(r); save(); return r;
    },
    async update(t, id, patch) { const r = d[t].find(x => x.id === id); Object.assign(r, patch); save(); return r; },
    async remove(t, id) {
      d[t] = d[t].filter(x => x.id !== id);
      if (t === 'products') d.lots = d.lots.filter(l => l.product_id !== id);
      save();
    },
    async removeMany(t, ids) { const s = new Set(ids); d[t] = d[t].filter(x => !s.has(x.id)); save(); },
    async clear(t) { d[t] = []; if (t === 'products') d.lots = []; save(); },
    async replaceAll(nd) { d = empty(); for (const t of TABLES) d[t] = nd[t] || []; save(); },
  };
}

/* ═════════════ Stato ═════════════ */
let store = null;
let sb = null;
let data = { products: [], lots: [], usage_log: [], shopping: [] };
const ui = { tab: 'pantry', q: '', cat: '', week: isoDay(weekStart(new Date())) };
let chart = null;

/* ═════════════ Avvio ═════════════ */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  fillSelects();
  bindEvents();
  const cfg = window.APP_CONFIG || {};
  if (cfg.SUPABASE_URL && cfg.SUPABASE_KEY) {
    if (!window.supabase) { showFatal('Impossibile caricare la libreria Supabase. Controlla la connessione.'); return; }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
    store = makeSupabaseStore(sb);
    $('#btn-logout').hidden = false;
    const { data: { session } } = await sb.auth.getSession();
    session ? showApp() : showLogin();
    sb.auth.onAuthStateChange((evt, s) => {
      if (evt === 'SIGNED_OUT') showLogin();
      else if (evt === 'SIGNED_IN' && s && $('#app-view').hidden) showApp();
    });
  } else {
    store = makeLocalStore();
    $('#demo-banner').hidden = false;
    showApp();
  }
}

function showFatal(msg) {
  document.body.innerHTML = `<div class="login-wrap"><div class="card login-card"><h1>Errore</h1><p class="muted">${esc(msg)}</p></div></div>`;
}
function showLogin() {
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  icons();
}
async function showApp() {
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  await refresh();
}

/* ═════════════ Login ═════════════ */
async function doAuth(signup) {
  const email = $('#login-email').value.trim();
  const password = $('#login-pass').value;
  const msg = $('#login-msg');
  if (!email || password.length < 6) { msg.className = 'login-msg err'; msg.textContent = 'Inserisci email e una password di almeno 6 caratteri.'; return; }
  msg.className = 'login-msg'; msg.textContent = signup ? 'Creo l\'account…' : 'Accesso…';
  try {
    if (signup) {
      const { data: r, error } = await sb.auth.signUp({
        email, password, options: { emailRedirectTo: location.origin + location.pathname },
      });
      if (error) throw error;
      if (!r.session) { msg.textContent = 'Account creato! Controlla la mail per confermarlo, poi accedi.'; return; }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (e) {
    msg.className = 'login-msg err';
    msg.textContent = translateErr(e);
  }
}
function translateErr(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/invalid login/i.test(m)) return 'Email o password errati.';
  if (/not confirmed/i.test(m)) return 'Devi prima confermare l\'email (controlla la posta).';
  if (/signups? not allowed|disabled/i.test(m)) return 'La registrazione di nuovi utenti è disattivata.';
  if (/already registered/i.test(m)) return 'Questa email ha già un account: usa "Accedi".';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Errore di rete: controlla connessione e SUPABASE_URL.';
  return m;
}

/* ═════════════ Dati ═════════════ */
async function refresh() {
  try {
    data = await store.loadAll();
  } catch (e) {
    toast('Errore nel caricare i dati: ' + translateErr(e), true);
  }
  render();
}

// Esegue un'operazione, mostra eventuali errori e ricarica tutto
async function act(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
  } catch (e) {
    console.error(e);
    toast('Errore: ' + translateErr(e), true);
  }
  await refresh();
}

/* ═════════════ Render ═════════════ */
function render() {
  renderStats();
  renderInventory();
  renderWeeks();
  renderShopping();
  $('#product-names').innerHTML = data.products.map(p => `<option value="${esc(p.name)}">`).join('');
  icons();
}

function icons() { if (window.lucide) window.lucide.createIcons(); }

function lotsOf(pid) {
  return data.lots.filter(l => l.product_id === pid).sort((a, b) => {
    if (!a.expiry) return 1; if (!b.expiry) return -1;
    return a.expiry.localeCompare(b.expiry);
  });
}

function usageInWeek(weekIso) {
  const start = parseDay(weekIso);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  return data.usage_log.filter(u => { const t = new Date(u.used_at); return t >= start && t < end; });
}

function renderStats() {
  const statuses = data.lots.map(lotStatus);
  const productsWithLots = data.products.filter(p => data.lots.some(l => l.product_id === p.id)).length;
  $('#st-products').textContent = `${productsWithLots} (${data.lots.length})`;
  $('#st-soon').textContent = statuses.filter(s => s.rank === 1).length;
  $('#st-expired').textContent = statuses.filter(s => s.rank === 0).length;
  $('#st-used').textContent = usageInWeek(ui.week).length;
}

function renderInventory() {
  const box = $('#inventory');
  const items = data.products
    .map(p => ({ p, lots: lotsOf(p.id) }))
    .filter(x => x.lots.length)
    .filter(x => !ui.q || norm(x.p.name).includes(norm(ui.q)))
    .filter(x => !ui.cat || x.p.category === ui.cat)
    .sort((a, b) => {
      const ea = a.lots[0].expiry, eb = b.lots[0].expiry;
      if (!ea && !eb) return a.p.name.localeCompare(b.p.name);
      if (!ea) return 1; if (!eb) return -1;
      return ea.localeCompare(eb);
    });

  if (!items.length) {
    const filtered = ui.q || ui.cat;
    box.innerHTML = `<div class="empty"><i data-lucide="${filtered ? 'search-x' : 'package-open'}"></i>
      <div>${filtered ? 'Nessun prodotto corrisponde ai filtri.' : 'La dispensa è vuota. Aggiungi il primo prodotto!'}</div></div>`;
    return;
  }

  box.innerHTML = items.map(({ p, lots }) => {
    const tot = round2(lots.reduce((s, l) => s + Number(l.qty), 0));
    const c = catOf(p.category);
    return `<article class="prod">
      <div class="prod-head">
        <div class="prod-title">
          <span class="prod-emoji">${c.emoji}</span>
          <div>
            <div class="prod-name">${esc(p.name)} <span class="tot">Tot: ${fmtQty(tot)} ${esc(p.unit)}</span></div>
            <div class="prod-cat">${esc(p.category)}</div>
          </div>
        </div>
        <div class="prod-actions">
          <button class="link-btn edit-btn" data-edit="${p.id}"><i data-lucide="pencil"></i>Modifica</button>
          <button class="link-btn del-btn" data-del="${p.id}" title="Elimina prodotto"><i data-lucide="x"></i></button>
        </div>
      </div>
      <div class="lots">${lots.map(l => {
        const s = lotStatus(l);
        return `<div class="lot ${s.cls}">
          <div><b>${fmtQty(l.qty)} ${esc(p.unit)}</b> • ${l.expiry ? `Scad: <b>${fmtDate(l.expiry)}</b>` : 'Senza scadenza'}</div>
          <div class="lot-right">
            <span class="pill ${s.cls}">${s.label}</span>
            <button class="btn use-btn" data-use="${l.id}">✓ Usa</button>
          </div>
        </div>`;
      }).join('')}</div>
    </article>`;
  }).join('');
}

/* ── Settimane / radar ── */
function weekOptions() {
  const set = new Set([isoDay(weekStart(new Date()))]);
  data.usage_log.forEach(u => set.add(isoDay(weekStart(new Date(u.used_at)))));
  return [...set].sort().reverse(); // più recente prima
}
function weekLabel(iso) {
  const s = parseDay(iso);
  const e = new Date(s); e.setDate(e.getDate() + 6);
  const f = d => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  const cur = iso === isoDay(weekStart(new Date()));
  return `🗓️ ${f(s)} - ${f(e)} ${e.getFullYear()}${cur ? ' (Corrente)' : ''}`;
}
function renderWeeks() {
  const weeks = weekOptions();
  if (!weeks.includes(ui.week)) ui.week = weeks[0];
  const sel = $('#week-select');
  sel.innerHTML = weeks.map(w => `<option value="${w}">${weekLabel(w)}</option>`).join('');
  sel.value = ui.week;
  const i = weeks.indexOf(ui.week);
  $('#week-prev').disabled = i >= weeks.length - 1;
  $('#week-next').disabled = i <= 0;
  renderRadar();
}
function renderRadar() {
  const used = usageInWeek(ui.week);
  const counts = FOOD_CATS.map(c => used.filter(u => u.category === c).length);
  if (!window.Chart) return;
  const max = Math.max(1, ...counts);
  if (!chart) {
    chart = new Chart($('#radar'), {
      type: 'radar',
      data: {
        labels: FOOD_CATS,
        datasets: [{
          label: 'Prodotti usati', data: counts,
          backgroundColor: 'rgba(79,70,229,.15)', borderColor: '#4f46e5', borderWidth: 2,
          pointBackgroundColor: '#4f46e5', pointRadius: 3,
        }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            beginAtZero: true, suggestedMax: max,
            ticks: { stepSize: 1, precision: 0, backdropColor: 'transparent', color: '#94a3b8', font: { size: 10 } },
            pointLabels: { color: '#334155', font: { size: 11, weight: '600', family: 'Inter' } },
            grid: { color: '#e2e8f0' }, angleLines: { color: '#e2e8f0' },
          },
        },
      },
    });
  } else {
    chart.data.datasets[0].data = counts;
    chart.options.scales.r.suggestedMax = max;
    chart.update();
  }
}

/* ── Lista spesa ── */
function renderShopping() {
  const open = data.shopping.filter(s => !s.done).length;
  $('#shop-badge').textContent = open;
  const list = [...data.shopping].sort((a, b) => (a.done - b.done) || a.created_at.localeCompare(b.created_at));
  $('#shop-list').innerHTML = list.length ? list.map(s => `
    <li class="shop-item ${s.done ? 'done' : ''}">
      <input type="checkbox" data-shop-toggle="${s.id}" ${s.done ? 'checked' : ''} aria-label="Preso">
      <span class="name">${esc(s.name)} ${s.note ? `<span class="note">· ${esc(s.note)}</span>` : ''}</span>
      <button class="link-btn del-btn" data-shop-del="${s.id}" title="Rimuovi"><i data-lucide="x"></i></button>
    </li>`).join('')
    : `<li class="empty"><i data-lucide="shopping-basket"></i><div>Lista vuota, niente da comprare 🎉</div></li>`;
}

/* ═════════════ Azioni dispensa ═════════════ */
async function onAdd(e) {
  e.preventDefault();
  const name = $('#f-name').value.trim().replace(/\s+/g, ' ');
  const qty = Number($('#f-qty').value);
  const unit = $('#f-unit').value;
  const category = $('#f-cat').value;
  const noExp = $('#f-noexp').checked;
  const expiry = noExp ? null : ($('#f-exp').value || null);
  if (!name || !(qty > 0)) return toast('Inserisci nome e quantità valida.', true);
  if (!noExp && !expiry) return toast('Inserisci la data di scadenza (o spunta "Nessuna scadenza").', true);

  await act(async () => {
    let p = data.products.find(x => norm(x.name) === norm(name));
    let note = '';
    if (!p) {
      p = await store.insert('products', { name, category, unit });
    } else if (p.unit !== unit) {
      note = ` (unità mantenuta: ${p.unit})`;
    }
    const same = data.lots.find(l => l.product_id === p.id && (l.expiry || null) === expiry);
    if (same) await store.update('lots', same.id, { qty: round2(Number(same.qty) + qty) });
    else await store.insert('lots', { product_id: p.id, qty, expiry });
    // Se era in lista della spesa, lo togliamo: l'hai comprato!
    const bought = data.shopping.filter(s => norm(s.name) === norm(name)).map(s => s.id);
    await store.removeMany('shopping', bought);
    return `${p.name} aggiunto${note}${bought.length ? ' e tolto dalla lista spesa' : ''}`;
  }, r => r);

  $('#f-name').value = '';
  $('#f-qty').value = 1;
  $('#f-name').focus();
}

async function onUse(lotId) {
  const lot = data.lots.find(l => l.id === lotId);
  const p = lot && data.products.find(x => x.id === lot.product_id);
  if (!p) return;
  const v = await askNumber(`Quanto "${p.name}" hai usato?`, Number(lot.qty), p.unit, Number(lot.qty));
  if (v == null) return;
  const used = Math.min(v, Number(lot.qty));
  const rest = round2(Number(lot.qty) - used);

  await act(async () => {
    if (rest <= 0) await store.remove('lots', lot.id);
    else await store.update('lots', lot.id, { qty: rest });
    await store.insert('usage_log', {
      product_name: p.name, category: p.category, qty: used, unit: p.unit,
      used_at: new Date().toISOString(),
    });
    const otherLots = data.lots.filter(l => l.product_id === p.id && l.id !== lot.id).length;
    if (rest <= 0 && otherLots === 0) {
      await store.remove('products', p.id);
      if (!data.shopping.some(s => !s.done && norm(s.name) === norm(p.name))) {
        await store.insert('shopping', { name: p.name, done: false });
      }
      return `${p.name} finito: aggiunto alla lista della spesa 🛒`;
    }
    return `Usato ${fmtQty(used)} ${p.unit} di ${p.name}`;
  }, r => r);
}

async function onDelete(pid) {
  const p = data.products.find(x => x.id === pid);
  if (!p) return;
  if (!(await confirmBox(`Eliminare "${p.name}" e tutti i suoi lotti?`, 'Elimina'))) return;
  await act(() => store.remove('products', pid), `${p.name} eliminato`);
}

function onEdit(pid) {
  const p = data.products.find(x => x.id === pid);
  if (!p) return;
  const lots = lotsOf(pid);
  const m = openModal(`
    <h3>Modifica prodotto</h3>
    <form id="edit-form">
      <label>Nome<input name="name" required value="${esc(p.name)}"></label>
      <div class="row2">
        <label>Categoria<select name="category">${catOptions(p.category)}</select></label>
        <label>Unità<select name="unit">${unitOptions(p.unit)}</select></label>
      </div>
      <div class="edit-lots">
        <div class="sub">Lotti (quantità a 0 o 🗑 per eliminarli)</div>
        ${lots.map(l => `
          <div class="edit-lot" data-lot="${l.id}">
            <input type="number" min="0" step="any" name="qty" value="${l.qty}" aria-label="Quantità">
            <input type="date" name="expiry" value="${l.expiry || ''}" aria-label="Scadenza">
            <label class="check" style="margin:0"><input type="checkbox" name="del"> 🗑</label>
          </div>`).join('')}
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-light" data-close>Annulla</button>
        <button type="submit" class="btn btn-dark">Salva modifiche</button>
      </div>
    </form>`);

  m.querySelector('#edit-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target;
    const el = n => f.elements.namedItem(n);
    const name = el('name').value.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const clash = data.products.find(x => x.id !== pid && norm(x.name) === norm(name));
    if (clash) return toast(`Esiste già un prodotto "${clash.name}".`, true);
    closeModal();
    await act(async () => {
      await store.update('products', pid, { name, category: el('category').value, unit: el('unit').value });
      for (const row of f.querySelectorAll('[data-lot]')) {
        const id = row.dataset.lot;
        const qty = Number(row.querySelector('[name=qty]').value);
        const expiry = row.querySelector('[name=expiry]').value || null;
        const del = row.querySelector('[name=del]').checked;
        if (del || !(qty > 0)) await store.remove('lots', id);
        else {
          const old = lots.find(l => l.id === id);
          if (Number(old.qty) !== qty || (old.expiry || null) !== expiry) await store.update('lots', id, { qty, expiry });
        }
      }
      const left = (await store.loadAll()).lots.filter(l => l.product_id === pid).length;
      if (!left) await store.remove('products', pid);
    }, 'Modifiche salvate');
  });
}

/* ═════════════ Lista spesa ═════════════ */
async function onShopAdd(e) {
  e.preventDefault();
  const name = $('#shop-name').value.trim();
  const note = $('#shop-note').value.trim() || null;
  if (!name) return;
  $('#shop-name').value = ''; $('#shop-note').value = '';
  await act(() => store.insert('shopping', { name, note, done: false }));
  $('#shop-name').focus();
}

function shoppingText() {
  const items = data.shopping.filter(s => !s.done);
  if (!items.length) return null;
  return '🛒 Lista della spesa\n' + items.map(s => `- ${s.name}${s.note ? ` (${s.note})` : ''}`).join('\n');
}

async function onShareText() {
  const text = shoppingText();
  if (!text) return toast('La lista della spesa è vuota.');
  if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({ text }); return; } catch { /* annullato: proseguo */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Lista copiata negli appunti 📋');
  } catch {
    const m = openModal(`<h3>Lista della spesa</h3><textarea rows="10" readonly>${esc(text)}</textarea>
      <div class="modal-foot"><button class="btn btn-dark" data-close>Chiudi</button></div>`);
    m.querySelector('textarea').select();
  }
}

/* ═════════════ Ricette ═════════════ */
function onRecipes() {
  const food = data.products
    .filter(p => catOf(p.category).food)
    .map(p => ({ p, lots: lotsOf(p.id) }))
    .filter(x => x.lots.length)
    .sort((a, b) => (a.lots[0].expiry || '9999').localeCompare(b.lots[0].expiry || '9999'));
  if (!food.length) return toast('Nessun alimento in dispensa.');
  const m = openModal(`
    <h3>✨ Idee ricette</h3>
    <p class="sub">Ho selezionato gli alimenti che scadono entro ${SOON_DAYS} giorni. Scegli gli ingredienti e cerca una ricetta.</p>
    <div style="margin-top:12px">${food.map(({ p, lots }) => {
      const s = lotStatus(lots[0]);
      return `<label class="recipe-item"><input type="checkbox" value="${esc(p.name)}" ${s.rank <= 1 ? 'checked' : ''}>
        <span style="flex:1">${catOf(p.category).emoji} ${esc(p.name)}</span><span class="pill ${s.cls}">${s.label}</span></label>`;
    }).join('')}</div>
    <div class="modal-foot">
      <button class="btn btn-light" data-close>Chiudi</button>
      <button class="btn btn-purple" id="go-recipes"><i data-lucide="search"></i>Cerca ricette</button>
    </div>`);
  m.querySelector('#go-recipes').addEventListener('click', () => {
    const picked = [...m.querySelectorAll('input:checked')].map(i => i.value);
    if (!picked.length) return toast('Seleziona almeno un ingrediente.', true);
    const q = 'ricetta con ' + picked.join(' ');
    window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener');
  });
}

/* ═════════════ Backup ═════════════ */
function onBackup() {
  const payload = { app: 'smart-pantry-pro', version: 1, exported_at: new Date().toISOString(), ...data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `smart-pantry-backup-${isoDay(new Date())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup scaricato 💾');
}

async function onRestoreFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let nd;
  try {
    nd = JSON.parse(await file.text());
    if (!TABLES.every(t => Array.isArray(nd[t]))) throw new Error('formato');
  } catch {
    return toast('File di backup non valido.', true);
  }
  const msg = `Ripristinare il backup del ${nd.exported_at ? new Date(nd.exported_at).toLocaleString('it-IT') : '?'}?\n` +
    `Contiene ${nd.products.length} prodotti e ${nd.lots.length} lotti. I dati attuali verranno SOSTITUITI.`;
  if (!(await confirmBox(msg, 'Ripristina'))) return;
  const clean = {};
  for (const t of TABLES) clean[t] = nd[t];
  await act(() => store.replaceAll(clean), 'Backup ripristinato ✅');
}

/* ═════════════ Modali e toast ═════════════ */
function openModal(html) {
  closeModal();
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="card modal" role="dialog" aria-modal="true">${html}</div>`;
  back.addEventListener('click', ev => {
    if (ev.target === back || ev.target.closest('[data-close]')) { ev.preventDefault(); closeModal(); }
  });
  $('#modal-root').appendChild(back);
  icons();
  const first = back.querySelector('input:not([type=checkbox]), textarea');
  if (first) setTimeout(() => first.focus(), 30);
  return back.querySelector('.modal');
}
function closeModal() {
  const root = $('#modal-root');
  const m = root.firstChild;
  if (m && m._onClose) m._onClose();
  root.innerHTML = '';
}

function askNumber(title, value, unit, max) {
  return new Promise(resolve => {
    const m = openModal(`
      <h3>${esc(title)}</h3>
      <form id="ask-form">
        <label>Quantità usata (${esc(unit)}) – disponibili ${fmtQty(max)}
          <input name="v" type="number" min="0.01" step="any" max="${max}" value="${value}" required>
        </label>
        <div class="modal-foot">
          <button type="button" class="btn btn-light" data-close>Annulla</button>
          <button type="button" class="btn btn-light" id="use-all">Usa tutto</button>
          <button type="submit" class="btn btn-dark">Conferma</button>
        </div>
      </form>`);
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); };
    m.parentElement._onClose = () => finish(null);
    m.querySelector('#use-all').addEventListener('click', () => { finish(max); closeModal(); });
    m.querySelector('#ask-form').addEventListener('submit', ev => {
      ev.preventDefault();
      const v = Number(ev.target.v.value);
      if (!(v > 0)) return;
      finish(v); closeModal();
    });
  });
}

function confirmBox(text, okLabel) {
  return new Promise(resolve => {
    const m = openModal(`
      <h3>Conferma</h3>
      <p style="white-space:pre-line;margin:8px 0 0">${esc(text)}</p>
      <div class="modal-foot">
        <button class="btn btn-light" data-close>Annulla</button>
        <button class="btn btn-red" id="ok-btn">${esc(okLabel)}</button>
      </div>`);
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); };
    m.parentElement._onClose = () => finish(false);
    m.querySelector('#ok-btn').addEventListener('click', () => { finish(true); closeModal(); });
  });
}

let toastTimer;
function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, isErr ? 5000 : 2800);
}

/* ═════════════ Setup UI ═════════════ */
function catOptions(sel) {
  return CATS.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.emoji} ${c.id}</option>`).join('');
}
function unitOptions(sel) {
  return UNITS.map(([v, l]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${l}</option>`).join('');
}

function fillSelects() {
  $('#f-cat').innerHTML = catOptions('Carne e Pesce');
  $('#f-unit').innerHTML = unitOptions('pz');
  $('#cat-filter').innerHTML = '<option value="">Tutte le categorie</option>' +
    CATS.map(c => `<option value="${c.id}">${c.emoji} ${c.id}</option>`).join('');
  const d = new Date(); d.setDate(d.getDate() + 7);
  $('#f-exp').value = isoDay(d);
}

function bindEvents() {
  // Login
  $('#login-form').addEventListener('submit', e => { e.preventDefault(); doAuth(false); });
  $('#signup-btn').addEventListener('click', () => doAuth(true));
  $('#btn-logout').addEventListener('click', async () => { if (sb) await sb.auth.signOut(); });

  // Tab
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    ui.tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
    $('#tab-pantry').hidden = ui.tab !== 'pantry';
    $('#tab-shopping').hidden = ui.tab !== 'shopping';
  }));

  // Form aggiunta
  $('#add-form').addEventListener('submit', onAdd);
  $('#f-noexp').addEventListener('change', e => {
    $('#f-exp').disabled = e.target.checked;
    $('#exp-star').hidden = e.target.checked;
  });
  $('#f-cat').addEventListener('change', e => {
    const tool = !catOf(e.target.value).food;
    $('#f-noexp').checked = tool; $('#f-exp').disabled = tool; $('#exp-star').hidden = tool;
  });
  // Se scelgo un prodotto esistente, precompilo categoria e unità
  $('#f-name').addEventListener('change', e => {
    const p = data.products.find(x => norm(x.name) === norm(e.target.value));
    if (p) { $('#f-cat').value = p.category; $('#f-unit').value = p.unit; $('#f-cat').dispatchEvent(new Event('change')); }
  });

  // Inventario (delegation)
  $('#inventory').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.use) onUse(b.dataset.use);
    else if (b.dataset.edit) onEdit(b.dataset.edit);
    else if (b.dataset.del) onDelete(b.dataset.del);
  });
  $('#search').addEventListener('input', e => { ui.q = e.target.value; renderInventory(); icons(); });
  $('#cat-filter').addEventListener('change', e => { ui.cat = e.target.value; renderInventory(); icons(); });

  // Settimane
  const moveWeek = dir => {
    const w = weekOptions(); const i = w.indexOf(ui.week) + dir;
    if (i >= 0 && i < w.length) { ui.week = w[i]; renderWeeks(); renderStats(); }
  };
  $('#week-prev').addEventListener('click', () => moveWeek(1));
  $('#week-next').addEventListener('click', () => moveWeek(-1));
  $('#week-select').addEventListener('change', e => { ui.week = e.target.value; renderWeeks(); renderStats(); });
  $('#btn-reset-history').addEventListener('click', async () => {
    if (!data.usage_log.length) return toast('Lo storico è già vuoto.');
    if (!(await confirmBox('Cancellare TUTTO lo storico dei consumi (tutte le settimane)?', 'Azzera'))) return;
    await act(() => store.clear('usage_log'), 'Storico azzerato');
  });

  // Lista spesa
  $('#shop-form').addEventListener('submit', onShopAdd);
  $('#shop-list').addEventListener('click', e => {
    const del = e.target.closest('[data-shop-del]');
    if (del) act(() => store.remove('shopping', del.dataset.shopDel));
  });
  $('#shop-list').addEventListener('change', e => {
    const id = e.target.dataset.shopToggle;
    if (id) act(() => store.update('shopping', id, { done: e.target.checked }));
  });
  $('#shop-clear-done').addEventListener('click', () => {
    const ids = data.shopping.filter(s => s.done).map(s => s.id);
    if (!ids.length) return toast('Nessun elemento completato.');
    act(() => store.removeMany('shopping', ids), 'Completati rimossi');
  });

  // Header
  $('#btn-backup').addEventListener('click', onBackup);
  $('#btn-restore').addEventListener('click', () => $('#restore-file').click());
  $('#restore-file').addEventListener('change', onRestoreFile);
  $('#btn-text').addEventListener('click', onShareText);
  $('#btn-recipes').addEventListener('click', onRecipes);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}
