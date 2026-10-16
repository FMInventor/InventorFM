/* Smart Pantry Pro v2 — GitHub Pages + Supabase
   HTML + JavaScript puro, nessun build. */
'use strict';

/* ═════════════ Costanti ═════════════ */
// L'ordine segue il percorso tipico al supermercato (usato anche nella sezione Mother)
const CATS = [
  { id: 'Frutta e Verdura', icon: 'apple',           color: '#15803d', bg: '#dcfce7', food: true },
  { id: 'Pane e Cereali',   icon: 'wheat',           color: '#b45309', bg: '#fef3c7', food: true },
  { id: 'Carne e Pesce',    icon: 'beef',            color: '#b91c1c', bg: '#fee2e2', food: true },
  { id: 'Pollo',            icon: 'drumstick',       color: '#b45309', bg: '#fef9c3', food: true },
  { id: 'Latticini e Uova', icon: 'milk',            color: '#0369a1', bg: '#e0f2fe', food: true },
  { id: 'Surgelati',        icon: 'snowflake',       color: '#0e7490', bg: '#cffafe', food: true },
  { id: 'Conserve',         icon: 'cylinder',        color: '#9a3412', bg: '#ffedd5', food: true },
  { id: 'Bevande',          icon: 'cup-soda',        color: '#6d28d9', bg: '#ede9fe', food: true },
  { id: 'Snack e Dolci',    icon: 'cookie',          color: '#be185d', bg: '#fce7f3', food: true },
  { id: 'Altro',            icon: 'shopping-basket', color: '#475569', bg: '#f1f5f9', food: true },
  { id: 'Igiene e Pulizia', icon: 'spray-can',       color: '#0f766e', bg: '#ccfbf1', food: false },
  { id: 'Strumenti',        icon: 'wrench',          color: '#334155', bg: '#e2e8f0', food: false },
];
const FROZEN = 'Surgelati';
const FROZEN_DAYS = 90; // scadenza suggerita: 3 mesi dal congelamento
const FOOD_CATS = CATS.filter(c => c.food).map(c => c.id);
const UNITS = [
  ['pz', 'Pezzi (pz)'], ['g', 'Grammi (g)'], ['kg', 'Chili (kg)'],
  ['ml', 'Millilitri (ml)'], ['L', 'Litri (L)'], ['conf', 'Confezioni (conf)'],
];
const RED_DAYS = 2;     // entro 2 giorni → rosso
const ORANGE_DAYS = 5;  // entro 5 giorni → arancione
const TABLES = ['products', 'lots', 'usage_log', 'shopping'];
const GROUPS = [
  { key: 'expired', title: 'Scaduti' },
  { key: 'red',     title: `Entro ${RED_DAYS} giorni` },
  { key: 'orange',  title: `Entro ${ORANGE_DAYS} giorni` },
  { key: 'ok',      title: 'Più avanti' },
  { key: 'none',    title: 'Senza scadenza' },
];

const catOf = id => CATS.find(c => c.id === id) || CATS.find(c => c.id === 'Altro');
// Un prodotto può avere più categorie (es. Surgelati + Carne e Pesce); la prima è la principale
const catsOf = p => (p && Array.isArray(p.categories) && p.categories.length) ? p.categories : [p?.category || 'Altro'];
const isFoodCats = list => list.some(c => catOf(c).food);
const catIcon = id => { const c = catOf(id); return `<span class="cat-ic" style="--c:${c.color};--b:${c.bg}" title="${esc(c.id)}"><i data-lucide="${c.icon}"></i></span>`; };
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmtQty = n => Number(n).toLocaleString('it-IT', { maximumFractionDigits: 2 });
const round2 = n => Math.round(n * 100) / 100;
const qtyText = (q, u) => (q != null && q !== '' && Number(q) > 0) ? `${fmtQty(q)} ${u || 'pz'}` : '';
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage non disponibile */ } };

/* ═════════════ Date ═════════════ */
const pad = n => String(n).padStart(2, '0');
const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysLeft = s => Math.round((parseDay(s) - today()) / 86400000);
const fmtDate = s => parseDay(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const plusDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d); };
const addDaysTo = (iso, n) => { const d = parseDay(iso); d.setDate(d.getDate() + n); return isoDay(d); };
const weekStart = date => {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunedì
  return d;
};

function lotStatus(lot) {
  if (!lot.expiry) return { key: 'none', cls: 'st-none', label: 'Nessuna scadenza', rank: 4 };
  const n = daysLeft(lot.expiry);
  if (n < 0) return { key: 'expired', cls: 'st-expired', n, label: n === -1 ? 'Scaduto ieri' : `Scaduto da ${-n} gg`, rank: 0 };
  if (n <= RED_DAYS) return { key: 'red', cls: 'st-red', n, label: n === 0 ? 'Scade oggi' : n === 1 ? 'Scade domani' : `Scade tra ${n} gg`, rank: 1 };
  if (n <= ORANGE_DAYS) return { key: 'orange', cls: 'st-orange', n, label: `Scade tra ${n} gg`, rank: 2 };
  return { key: 'ok', cls: 'st-ok', n, label: `Tra ${n} gg`, rank: 3 };
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
    async updateMany(t, ids, patch) { if (ids.length) ok(await sb.from(t).update(patch).in('id', ids)); },
    async clear(t) { ok(await sb.from(t).delete().not('id', 'is', null)); },
    async replaceAll(nd) {
      for (const t of ['lots', 'usage_log', 'shopping', 'products']) await this.clear(t);
      for (const t of TABLES) {
        const rows = (nd[t] || []).map(({ user_id, ...r }) => r);
        for (let i = 0; i < rows.length; i += 500) ok(await sb.from(t).insert(rows.slice(i, i + 500)));
      }
    },
    async getShareToken() {
      const r = ok(await sb.from('share_links').select('token').maybeSingle());
      if (r) return r.token;
      return ok(await sb.from('share_links').insert({}).select('token').single()).token;
    },
    async resetShareToken() {
      await this.getShareToken();
      const { data: { user } } = await sb.auth.getUser();
      const token = crypto.randomUUID();
      ok(await sb.from('share_links').update({ token }).eq('user_id', user.id));
      return token;
    },
  };
}

function makeLocalStore() {
  const KEY = 'smart-pantry-demo-v1';
  const empty = () => ({ products: [], lots: [], usage_log: [], shopping: [] });
  let d = { ...empty(), ...lsGet(KEY, {}) };
  const save = () => lsSet(KEY, d);
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
    async update(t, id, patch) { const r = d[t].find(x => x.id === id); if (r) Object.assign(r, patch); save(); return r; },
    async remove(t, id) {
      d[t] = d[t].filter(x => x.id !== id);
      if (t === 'products') d.lots = d.lots.filter(l => l.product_id !== id);
      save();
    },
    async removeMany(t, ids) { const s = new Set(ids); d[t] = d[t].filter(x => !s.has(x.id)); save(); },
    async updateMany(t, ids, patch) { const s = new Set(ids); d[t].forEach(x => { if (s.has(x.id)) Object.assign(x, patch); }); save(); },
    async clear(t) { d[t] = []; if (t === 'products') d.lots = []; save(); },
    async replaceAll(nd) { d = empty(); for (const t of TABLES) d[t] = nd[t] || []; save(); },
  };
}

/* ═════════════ Stato ═════════════ */
let store = null;
let sb = null;
let data = { products: [], lots: [], usage_log: [], shopping: [] };
const ui = { tab: lsGet('sp-tab', 'pantry'), q: '', cat: '', week: isoDay(weekStart(new Date())) };
let chart = null;
let appShown = false;
let realtime = null;
let pollTimer = null;
let refreshTimer = null;

/* ═════════════ Avvio ═════════════ */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  const cfg = window.APP_CONFIG || {};
  const hasSupabase = !!(cfg.SUPABASE_URL && cfg.SUPABASE_KEY);
  const motherToken = new URLSearchParams(location.search).get('m');

  if ((hasSupabase || motherToken) && !window.supabase) {
    return showFatal('Impossibile caricare la libreria Supabase. Controlla la connessione e ricarica la pagina.');
  }

  // Pagina Mother aperta dal link condiviso (niente login)
  if (motherToken) {
    if (!hasSupabase) return showFatal('Il sito non è ancora collegato a Supabase.');
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, { auth: { persistSession: false } });
    return startMotherPage(motherToken);
  }

  fillSelects();
  bindEvents();
  registerSW();
  updateBell();

  if (hasSupabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
    store = makeSupabaseStore(sb);
    $('#btn-logout').hidden = false;
    const { data: { session } } = await sb.auth.getSession();
    session ? showApp() : showLogin();
    sb.auth.onAuthStateChange((evt, s) => {
      if (evt === 'SIGNED_OUT') showLogin();
      else if (s && !appShown) showApp();
    });
  } else {
    store = makeLocalStore();
    $('#demo-banner').hidden = false;
    showApp();
  }
}

function showFatal(msg) {
  document.body.innerHTML = `<div class="login-wrap"><div class="card login-card"><h1>Ops!</h1><p class="muted">${esc(msg)}</p></div></div>`;
}
function showLogin() {
  appShown = false;
  stopLive();
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  icons();
}
async function showApp() {
  if (appShown) return;
  appShown = true;
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  setTab(ui.tab);
  await refresh();
  startLive();
}

/* Aggiornamento automatico: Realtime di Supabase + controllo periodico */
function startLive() {
  stopLive();
  if (sb && store.kind === 'supabase') {
    realtime = sb.channel('pantry-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => scheduleRefresh())
      .subscribe();
  }
  pollTimer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
}
function stopLive() {
  if (realtime && sb) sb.removeChannel(realtime);
  realtime = null;
  clearInterval(pollTimer);
}
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 400);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && appShown) refresh(); });

/* ═════════════ Login ═════════════ */
async function doAuth() {
  const email = $('#login-email').value.trim();
  const password = $('#login-pass').value;
  const msg = $('#login-msg');
  if (!email || password.length < 6) { msg.className = 'login-msg err'; msg.textContent = 'Inserisci email e una password di almeno 6 caratteri.'; return; }
  msg.className = 'login-msg'; msg.textContent = 'Accesso…';
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    msg.textContent = '';
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
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Errore di rete: controlla la connessione.';
  if (/column .* does not exist|share_links|mother_list|schema cache/i.test(m)) return 'Database da aggiornare: riesegui supabase.sql nel SQL Editor di Supabase.';
  return m;
}

/* ═════════════ Dati ═════════════ */
async function refresh() {
  try {
    data = await store.loadAll();
  } catch (e) {
    console.error(e);
    if (/JWT|token/i.test(e.message || '') && sb) { await sb.auth.signOut(); return; }
    toast('Errore nel caricare i dati: ' + translateErr(e), true);
  }
  render();
  checkExpiryNotifications();
}

// Esegue un'operazione, mostra eventuali errori e ricarica tutto
let busy = false;
async function act(fn, okMsg) {
  if (busy) return;
  busy = true;
  document.body.style.cursor = 'progress';
  try {
    const r = await fn();
    if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
  } catch (e) {
    console.error(e);
    toast('Errore: ' + translateErr(e), true);
  } finally {
    busy = false;
    document.body.style.cursor = '';
  }
  await refresh();
}

/* Salvataggio rapido per tocchi ripetuti (caselle): non blocca, poi riallinea */
function quickSave(t, id, patch) {
  store.update(t, id, patch)
    .catch(e => toast('Modifica non salvata: ' + translateErr(e), true))
    .finally(() => scheduleRefresh());
}

const productByName = name => data.products.find(x => norm(x.name) === norm(name));

/* Aggiunge al magazzino (crea il prodotto o un nuovo lotto) */
async function addToInventory({ name, qty, unit, categories, expiry, frozen_at }) {
  let p = productByName(name);
  let note = '';
  categories = categories && categories.length ? categories : ['Altro'];
  if (!p) p = await store.insert('products', { name, category: categories[0], categories, unit });
  else {
    if (p.unit !== unit) note = ` (unità mantenuta: ${p.unit})`;
    if (catsOf(p).join('|') !== categories.join('|')) {
      p = await store.update('products', p.id, { category: categories[0], categories });
    }
  }
  if (!categories.includes(FROZEN)) frozen_at = null;
  const same = data.lots.find(l => l.product_id === p.id && (l.expiry || null) === (expiry || null)
    && (l.frozen_at || null) === (frozen_at || null));
  if (same) await store.update('lots', same.id, { qty: round2(Number(same.qty) + qty) });
  else await store.insert('lots', { product_id: p.id, qty, expiry: expiry || null, frozen_at: frozen_at || null });
  return { p, note };
}

/* Aggiunge alla lista della spesa sommando le quantità se c'è già */
async function addToShopping({ name, qty, unit, category }) {
  const ex = data.shopping.find(s => !s.done && norm(s.name) === norm(name) && (s.unit || unit) === unit);
  if (ex) {
    const q = (Number(ex.qty) > 0 && qty > 0) ? round2(Number(ex.qty) + qty) : (qty || ex.qty || null);
    return store.update('shopping', ex.id, { qty: q, unit: unit || ex.unit, category: ex.category || category });
  }
  return store.insert('shopping', { name, qty: qty || null, unit: unit || null, category: category || null, done: false });
}

/* Dopo un acquisto: scala la quantità comprata dalla lista della spesa */
async function consumeShopping(name, qty, unit) {
  let left = qty;
  const items = data.shopping.filter(s => norm(s.name) === norm(name))
    .sort((a, b) => (b.done - a.done) || a.created_at.localeCompare(b.created_at));
  let removed = 0, reduced = false;
  for (const s of items) {
    const sq = Number(s.qty);
    if (!(sq > 0) || (s.unit && s.unit !== unit) || left >= sq) {
      await store.remove('shopping', s.id); removed++;
      if (sq > 0 && (!s.unit || s.unit === unit)) left = round2(left - sq);
    } else if (left > 0) {
      await store.update('shopping', s.id, { qty: round2(sq - left), done: false }); left = 0; reduced = true;
    }
  }
  return { removed, reduced };
}

/* ═════════════ Render ═════════════ */
function render() {
  renderStats();
  renderInventory();
  renderWeeks();
  renderShopping();
  renderMother($('#mother-app-list'), data.shopping.filter(x => x.in_mother), {
    updatedAt: new Date(),
    emptyText: 'Nessuna lista ancora. Vai su <b>Lista della Spesa</b>, seleziona i prodotti con la casella e premi <b>Genera lista Mother</b>.',
  });
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
  const st = data.lots.map(lotStatus);
  const productsWithLots = data.products.filter(p => data.lots.some(l => l.product_id === p.id)).length;
  $('#st-products').textContent = `${productsWithLots} (${data.lots.length})`;
  $('#st-expired').textContent = st.filter(s => s.key === 'expired').length;
  $('#st-red').textContent = st.filter(s => s.key === 'red').length;
  $('#st-orange').textContent = st.filter(s => s.key === 'orange').length;
  $('#st-used').textContent = usageInWeek(ui.week).length;
}

function renderInventory() {
  const box = $('#inventory');
  const items = data.products
    .map(p => ({ p, lots: lotsOf(p.id) }))
    .filter(x => x.lots.length)
    .filter(x => !ui.q || norm(x.p.name).includes(norm(ui.q)))
    .filter(x => !ui.cat || catsOf(x.p).includes(ui.cat))
    .map(x => ({ ...x, st: lotStatus(x.lots[0]) }))
    .sort((a, b) => {
      const ea = a.lots[0].expiry, eb = b.lots[0].expiry;
      if (!ea && !eb) return a.p.name.localeCompare(b.p.name);
      if (!ea) return 1; if (!eb) return -1;
      return ea.localeCompare(eb) || a.p.name.localeCompare(b.p.name);
    });

  if (!items.length) {
    const filtered = ui.q || ui.cat;
    box.innerHTML = `<div class="empty"><i data-lucide="${filtered ? 'search-x' : 'package-open'}"></i>
      <div>${filtered ? 'Nessun prodotto corrisponde ai filtri.' : 'La dispensa è vuota. Aggiungi il primo prodotto!'}</div></div>`;
    return;
  }

  box.innerHTML = GROUPS.map(g => {
    const list = items.filter(x => x.st.key === g.key);
    if (!list.length) return '';
    return `<div class="grp-head grp-${g.key}" id="grp-${g.key}">${g.title} <span class="count">${list.length}</span></div>`
      + list.map(productCard).join('');
  }).join('');
}

function frozenInfo(l) {
  if (!l.frozen_at) return '';
  const n = -daysLeft(l.frozen_at);
  const ago = n <= 0 ? 'oggi' : n === 1 ? 'da 1 giorno' : `da ${n} giorni`;
  return `<div class="frozen-info"><i data-lucide="snowflake"></i>Congelato il ${fmtDate(l.frozen_at)} (${ago})</div>`;
}

function productCard({ p, lots, st }) {
  const tot = round2(lots.reduce((s, l) => s + Number(l.qty), 0));
  const cats = catsOf(p);
  return `<article class="prod g-${st.key}">
    <div class="prod-head">
      <div class="prod-title">
        ${catIcon(cats[0])}
        <div>
          <div class="prod-name">${esc(p.name)} <span class="tot">Tot: ${fmtQty(tot)} ${esc(p.unit)}</span></div>
          <div class="prod-cat">${cats.map(esc).join(' · ')}</div>
        </div>
      </div>
      <div class="prod-actions">
        <button class="link-btn edit-btn" data-edit="${p.id}" aria-label="Modifica"><i data-lucide="pencil"></i><span>Modifica</span></button>
        <button class="link-btn del-btn" data-del="${p.id}" title="Elimina prodotto" aria-label="Elimina"><i data-lucide="x"></i></button>
      </div>
    </div>
    <div class="lots">${lots.map(l => {
      const s = lotStatus(l);
      return `<div class="lot ${s.cls}">
        <div><b>${fmtQty(l.qty)} ${esc(p.unit)}</b> • ${l.expiry ? `Scad: <b>${fmtDate(l.expiry)}</b>` : 'Senza scadenza'}${frozenInfo(l)}</div>
        <div class="lot-right">
          <span class="pill ${s.cls}">${s.label}</span>
          <button class="btn use-btn" data-use="${l.id}"><i data-lucide="check"></i>Usa</button>
        </div>
      </div>`;
    }).join('')}</div>
  </article>`;
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
  return `${f(s)} – ${f(e)} ${e.getFullYear()}${cur ? ' (Corrente)' : ''}`;
}
function renderWeeks() {
  const weeks = weekOptions();
  if (!weeks.includes(ui.week)) ui.week = weeks[0];
  const sel = $('#week-select');
  sel.innerHTML = weeks.map(w => `<option value="${w}">🗓️ ${weekLabel(w)}</option>`).join('');
  sel.value = ui.week;
  const i = weeks.indexOf(ui.week);
  $('#week-prev').disabled = i >= weeks.length - 1;
  $('#week-next').disabled = i <= 0;
  renderRadar();
}
function renderRadar() {
  if (!window.Chart) return;
  const used = usageInWeek(ui.week);
  const counts = FOOD_CATS.map(c => used.filter(u => (u.categories && u.categories.length ? u.categories : [u.category]).includes(c)).length);
  const max = Math.max(1, ...counts);
  if (!chart) {
    chart = new Chart($('#radar'), {
      type: 'radar',
      data: {
        labels: FOOD_CATS,
        datasets: [{
          label: 'Prodotti usati', data: counts,
          backgroundColor: 'rgba(79,70,229,.14)', borderColor: '#4f46e5', borderWidth: 2,
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
            grid: { color: '#e4e8f0' }, angleLines: { color: '#e4e8f0' },
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
function shopCategory(s) {
  return s.category || catsOf(productByName(s.name))[0] || 'Altro';
}
function renderShopping() {
  const open = data.shopping.filter(s => !s.done).length;
  $$('.shop-badge').forEach(b => { b.textContent = open; b.classList.toggle('zero', open === 0); });
  const list = [...data.shopping].sort((a, b) => (a.done - b.done) || a.created_at.localeCompare(b.created_at));
  const nSel = data.shopping.filter(x => x.selected).length;
  $('#gen-count').textContent = nSel;
  $('#shop-select-all').checked = list.length > 0 && nSel === list.length;
  $('#shop-select-all').indeterminate = nSel > 0 && nSel < list.length;
  $('#shop-tools').hidden = !list.length;
  $('#shop-list').innerHTML = list.length ? list.map(s => {
    const c = catOf(shopCategory(s));
    const q = qtyText(s.qty, s.unit);
    return `<li class="shop-item ${s.selected ? 'sel' : ''} ${s.done ? 'done' : ''}">
      <input type="checkbox" class="sel-box" data-shop-select="${s.id}" ${s.selected ? 'checked' : ''} aria-label="Seleziona per la lista Mother">
      ${catIcon(c.id)}
      <div class="info">
        <div class="name">${esc(s.name)}</div>
        <div class="meta">${esc(c.id)}${s.note ? ` · ${esc(s.note)}` : ''}
          ${s.in_mother && !s.done ? '<span class="tag tag-m">In lista Mother</span>' : ''}
          ${s.done ? '<span class="tag tag-ok">✓ Preso da Mother</span>' : ''}</div>
      </div>
      ${q ? `<span class="qty-chip">${esc(q)}</span>` : ''}
      <button class="btn restock-btn" data-restock="${s.id}" title="Aggiorna nell'inventario"><i data-lucide="package-plus"></i><span>In dispensa</span></button>
      <button class="link-btn del-btn" data-shop-del="${s.id}" title="Rimuovi" aria-label="Rimuovi"><i data-lucide="x"></i></button>
    </li>`;
  }).join('')
    : `<li class="empty"><i data-lucide="shopping-basket"></i><div>Lista vuota, niente da comprare 🎉</div></li>`;
}

/* ── Mother (usata sia nella scheda dell'app sia nella pagina condivisa) ── */
const CHECK_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

function renderMother(target, items, { updatedAt, error, emptyText } = {}) {
  if (!target) return;
  const todo = items.filter(s => !s.done);
  const done = items.filter(s => s.done);
  const total = items.length;
  const time = updatedAt ? updatedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';

  const itemHtml = s => {
    const q = qtyText(s.qty, s.unit);
    return `<li><button class="m-item ${s.done ? 'done' : ''}" data-m-toggle="${s.id}" aria-pressed="${s.done}">
      <span class="m-box">${s.done ? CHECK_SVG : ''}</span>
      <span class="m-name">${esc(s.name)}${s.note ? `<span class="m-note">${esc(s.note)}</span>` : ''}</span>
      ${q ? `<span class="m-qty">${esc(q)}</span>` : ''}
    </button></li>`;
  };

  let body;
  if (!total) {
    body = emptyText
      ? `<div class="m-empty"><div class="big">📝</div><p>La lista è vuota</p><span>${emptyText}</span></div>`
      : `<div class="m-empty"><div class="big">🎉</div><p>Niente da comprare!</p><span>La lista è vuota.</span></div>`;
  } else {
    const groups = CATS.map(c => ({ c, list: todo.filter(s => shopCategory(s) === c.id) })).filter(g => g.list.length);
    body = `
      <div class="m-progress"><div style="width:${Math.round(done.length / total * 100)}%"></div></div>
      <div class="m-count">${todo.length ? `Ancora da prendere: <b>${todo.length}</b> · Presi: ${done.length}` : 'Hai preso tutto! Grazie ❤️'}</div>
      ${groups.map(g => `<div class="m-cat">${catIcon(g.c.id)}${esc(g.c.id)}</div>
        <ul class="m-list">${g.list.map(itemHtml).join('')}</ul>`).join('')}
      ${done.length ? `<div class="m-cat" style="color:#15803d"><span class="cat-ic" style="--c:#15803d;--b:#dcfce7"><i data-lucide="circle-check"></i></span>Già nel carrello</div>
        <ul class="m-list">${done.map(itemHtml).join('')}</ul>` : ''}`;
  }

  target.innerHTML = `<div class="m-card">
    <h1 class="m-hello">Ciao! 👋</h1>
    <p class="m-sub">${total ? 'Ecco cosa serve comprare. Tocca un prodotto quando lo metti nel carrello.' : 'Per ora non serve niente.'}</p>
    ${body}
    ${error ? `<div class="m-error">${esc(error)}</div>` : ''}
    <div class="m-foot">Aggiornata alle ${time} · si aggiorna da sola</div>
  </div>`;
}

/* Pagina Mother aperta dal link (senza login) */
async function startMotherPage(token) {
  document.title = 'Lista della spesa';
  document.body.classList.add('mother-mode');
  $('#mother-page').hidden = false;
  const box = $('#mother-page-list');
  let items = [];
  let error = '';
  let last = null;
  let pending = 0;
  const draw = () => { renderMother(box, items, { updatedAt: last, error }); icons(); };

  const load = async () => {
    if (pending) return; // non sovrascrivere un tocco appena fatto
    const { data: rows, error: e } = await sb.rpc('mother_list', { p_token: token });
    if (e) { error = 'Non riesco ad aggiornare la lista. Controlla la connessione.'; console.error(e); }
    else { items = rows || []; error = ''; last = new Date(); }
    draw();
  };

  box.addEventListener('click', async e => {
    const b = e.target.closest('[data-m-toggle]');
    if (!b) return;
    const it = items.find(s => s.id === b.dataset.mToggle);
    if (!it) return;
    it.done = !it.done;
    draw();
    pending++;
    const { error: er } = await sb.rpc('mother_toggle', { p_token: token, p_id: it.id, p_done: it.done });
    pending--;
    if (er) { it.done = !it.done; error = 'Modifica non salvata, riprova.'; draw(); }
  });

  renderMother(box, [], { updatedAt: null });
  box.querySelector('.m-sub').textContent = 'Carico la lista…';
  await load();
  if (!last && !error) error = 'Link non valido.';
  setInterval(() => { if (!document.hidden) load(); }, 8000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
}

async function onMotherShare() {
  if (store.kind !== 'supabase') return toast('Il link per Mother funziona dopo aver collegato Supabase (config.js).', true);
  try {
    const token = await store.getShareToken();
    showShareModal(motherLink(token));
  } catch (e) { toast('Errore: ' + translateErr(e), true); }
}
async function onMotherReset() {
  if (store.kind !== 'supabase') return toast('Disponibile dopo aver collegato Supabase.', true);
  if (!(await confirmBox('Creare un nuovo link? Quello vecchio smetterà di funzionare.', 'Nuovo link'))) return;
  try {
    const token = await store.resetShareToken();
    showShareModal(motherLink(token));
  } catch (e) { toast('Errore: ' + translateErr(e), true); }
}
const motherLink = token => `${location.origin}${location.pathname}?m=${token}`;

function showShareModal(link) {
  const msg = `Ciao! Ecco la lista della spesa 🛒 (si aggiorna da sola): ${link}`;
  const m = openModal(`
    <h3>💌 Link per Mother</h3>
    <p class="sub">Si apre dal telefono senza password e mostra solo la lista della spesa, sempre aggiornata. Consiglio: aprilo e aggiungilo alla schermata Home.</p>
    <input id="share-link" readonly value="${esc(link)}" style="font-size:13px">
    <div class="modal-foot">
      <a class="btn btn-light" href="${esc(link)}" target="_blank" rel="noopener"><i data-lucide="external-link"></i>Apri</a>
      <button class="btn btn-light" id="copy-link"><i data-lucide="copy"></i>Copia</button>
      <a class="btn btn-green" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener"><i data-lucide="message-circle"></i>WhatsApp</a>
    </div>`);
  m.querySelector('#copy-link').addEventListener('click', () => copyText(link, 'Link copiato 📋'));
  m.querySelector('#share-link').addEventListener('focus', e => e.target.select());
}

/* ═════════════ Azioni dispensa ═════════════ */
async function onAdd(e) {
  e.preventDefault();
  const name = clean($('#f-name').value);
  const qty = Number($('#f-qty').value);
  const unit = $('#f-unit').value;
  const categories = pickerValue($('#f-cats'));
  const noExp = $('#f-noexp').checked;
  const expiry = noExp ? null : ($('#f-exp').value || null);
  const frozen_at = categories.includes(FROZEN) ? ($('#f-frozen').value || isoDay(new Date())) : null;
  if (!categories.length) return toast('Scegli almeno una categoria.', true);
  if (!name || !(qty > 0)) return toast('Inserisci nome e quantità valida.', true);
  if (!noExp && !expiry) return toast('Inserisci la data di scadenza (o spunta "Nessuna scadenza").', true);

  await act(async () => {
    const { p, note } = await addToInventory({ name, qty, unit, categories, expiry, frozen_at });
    const sh = await consumeShopping(name, qty, p.unit);
    return `${p.name} aggiunto${note}${sh.removed || sh.reduced ? ' · aggiornata la lista spesa' : ''}`;
  }, r => r);

  $('#f-name').value = '';
  $('#f-qty').value = 1;
  expTouched = false;
  $('#f-name').focus();
}

async function onUse(lotId) {
  const lot = data.lots.find(l => l.id === lotId);
  const p = lot && data.products.find(x => x.id === lot.product_id);
  if (!p) return;
  const v = await askUse(p, Number(lot.qty));
  if (v == null) return;
  const used = round2(Math.min(v, Number(lot.qty)));
  const rest = round2(Number(lot.qty) - used);

  await act(async () => {
    if (rest <= 0) await store.remove('lots', lot.id);
    else await store.update('lots', lot.id, { qty: rest });
    await store.insert('usage_log', {
      product_name: p.name, category: catsOf(p)[0], categories: catsOf(p), qty: used, unit: p.unit,
      used_at: new Date().toISOString(),
    });
    // La quantità usata va nella lista della spesa
    await addToShopping({ name: p.name, qty: used, unit: p.unit, category: catsOf(p)[0] });
    const otherLots = data.lots.filter(l => l.product_id === p.id && l.id !== lot.id).length;
    if (rest <= 0 && otherLots === 0) await store.remove('products', p.id);
    return `Usato ${fmtQty(used)} ${p.unit} di ${p.name} · aggiunto alla spesa 🛒`;
  }, r => r);
}

async function onDelete(pid) {
  const p = data.products.find(x => x.id === pid);
  if (!p) return;
  if (!(await confirmBox(`Eliminare "${p.name}" e tutti i suoi lotti?\n(Non verrà aggiunto alla lista della spesa.)`, 'Elimina'))) return;
  await act(() => store.remove('products', pid), `${p.name} eliminato`);
}

function onEdit(pid) {
  const p = data.products.find(x => x.id === pid);
  if (!p) return;
  const lots = lotsOf(pid);
  const m = openModal(`
    <h3>Modifica prodotto</h3>
    <form id="edit-form">
      <div class="row2">
        <label>Nome<input name="pname" required value="${esc(p.name)}"></label>
        <label>Unità<select name="unit">${unitOptions(p.unit)}</select></label>
      </div>
      <label>Categorie <span class="hint">(anche più di una)</span></label>
      <div class="chips" id="edit-cats"></div>
      <div class="edit-lots">
        <div class="sub">Lotti: quantità, scadenza<span class="fz-col"> e data di congelamento</span> (spunta 🗑 per eliminarne uno)</div>
        ${lots.map(l => `
          <div class="edit-lot" data-lot="${l.id}">
            <label class="mini">Quantità<input type="number" min="0" step="any" name="qty" value="${l.qty}"></label>
            <label class="mini">Scadenza<input type="date" name="expiry" value="${l.expiry || ''}"></label>
            <label class="mini fz-col">Congelato il<input type="date" name="frozen" value="${l.frozen_at || ''}"></label>
            <label class="check del-lot"><input type="checkbox" name="del"> 🗑</label>
          </div>`).join('')}
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-light" data-close>Annulla</button>
        <button type="submit" class="btn btn-dark">Salva modifiche</button>
      </div>
    </form>`);
  const picker = m.querySelector('#edit-cats');
  const showFz = list => m.querySelectorAll('.fz-col').forEach(x => { x.hidden = !list.includes(FROZEN); });
  initPicker(picker, catsOf(p), showFz);
  showFz(catsOf(p));

  m.querySelector('#edit-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target;
    const el = n => f.elements.namedItem(n);
    const name = clean(el('pname').value);
    if (!name) return;
    const clash = data.products.find(x => x.id !== pid && norm(x.name) === norm(name));
    if (clash) return toast(`Esiste già un prodotto "${clash.name}".`, true);
    const rows = [...f.querySelectorAll('[data-lot]')].map(row => ({
      id: row.dataset.lot,
      qty: Number(row.querySelector('[name=qty]').value),
      expiry: row.querySelector('[name=expiry]').value || null,
      frozen_at: row.querySelector('[name=frozen]').value || null,
      del: row.querySelector('[name=del]').checked,
    }));
    const categories = pickerValue(picker), unit = el('unit').value;
    if (!categories.length) return toast('Scegli almeno una categoria.', true);
    const fz = categories.includes(FROZEN);
    rows.forEach(r => { if (!fz) r.frozen_at = null; });
    closeModal();
    await act(async () => {
      await store.update('products', pid, { name, category: categories[0], categories, unit });
      let left = 0;
      for (const r of rows) {
        if (r.del || !(r.qty > 0)) { await store.remove('lots', r.id); continue; }
        left++;
        const old = lots.find(l => l.id === r.id);
        if (Number(old.qty) !== r.qty || (old.expiry || null) !== r.expiry || (old.frozen_at || null) !== r.frozen_at) {
          await store.update('lots', r.id, { qty: r.qty, expiry: r.expiry, frozen_at: r.frozen_at });
        }
      }
      if (!left) await store.remove('products', pid);
    }, 'Modifiche salvate');
  });
}

/* ═════════════ Lista spesa ═════════════ */
async function onShopAdd(e) {
  e.preventDefault();
  const name = clean($('#shop-name').value);
  const qty = Number($('#shop-qty').value) || null;
  const p = productByName(name);
  const unit = qty ? $('#shop-unit').value : (p?.unit || null);
  if (!name) return;
  $('#shop-name').value = ''; $('#shop-qty').value = '';
  await act(() => addToShopping({ name: p?.name || name, qty, unit, category: p ? catsOf(p)[0] : null }), `${name} aggiunto alla lista`);
  $('#shop-name').focus();
}

/* Finestra: conferma quantità comprata e scadenza → aggiorna l'inventario */
function restockModal(item) {
  return new Promise(resolve => {
    const p = productByName(item.name);
    const unit = item.unit || p?.unit || 'pz';
    const startCats = p ? catsOf(p) : [item.category || 'Altro'];
    const tool = !isFoodCats(startCats);
    const m = openModal(`
      <h3>📦 Metti in dispensa: ${esc(item.name)}</h3>
      <p class="sub">Conferma la quantità che hai comprato e la data di scadenza.</p>
      <form id="restock-form">
        <div class="row2">
          <label>Quantità comprata *<input name="qty" type="number" min="0.01" step="any" required inputmode="decimal" value="${Number(item.qty) > 0 ? item.qty : 1}"></label>
          <label>Unità<select name="unit">${unitOptions(unit)}</select></label>
        </div>
        <label>Categorie <span class="hint">(anche più di una)</span></label>
        <div class="chips" id="restock-cats"></div>
        <div class="row2">
          <label class="fz-col">Data di congelamento<input name="frozen" type="date" value="${isoDay(new Date())}"></label>
          <label>Data di scadenza<input name="expiry" type="date" value="${tool ? '' : plusDays(7)}" ${tool ? 'disabled' : ''}></label>
        </div>
        <label class="check"><input type="checkbox" name="noexp" ${tool ? 'checked' : ''}> Nessuna scadenza</label>
        <div class="modal-foot">
          <button type="button" class="btn btn-light" data-close>Annulla</button>
          <button type="submit" class="btn btn-green"><i data-lucide="check"></i>Conferma e aggiorna</button>
        </div>
      </form>`);
    const f = m.querySelector('#restock-form');
    const el = n => f.elements.namedItem(n);
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); };
    m.parentElement._onClose = () => finish(null);
    el('noexp').addEventListener('change', () => { el('expiry').disabled = el('noexp').checked; if (!el('noexp').checked && !el('expiry').value) el('expiry').value = plusDays(7); });
    const picker = m.querySelector('#restock-cats');
    let touched = false;
    el('expiry').addEventListener('input', () => { touched = true; });
    const onCats = list => {
      const fz = list.includes(FROZEN);
      m.querySelectorAll('.fz-col').forEach(x => { x.hidden = !fz; });
      const t = !isFoodCats(list.length ? list : ['Altro']);
      if (el('noexp').checked !== t) { el('noexp').checked = t; el('noexp').dispatchEvent(new Event('change')); }
      if (fz && !touched && !el('noexp').checked) el('expiry').value = addDaysTo(el('frozen').value || isoDay(new Date()), FROZEN_DAYS);
    };
    el('frozen').addEventListener('change', () => { if (!touched && el('frozen').value) el('expiry').value = addDaysTo(el('frozen').value, FROZEN_DAYS); });
    initPicker(picker, startCats, onCats);
    m.querySelectorAll('.fz-col').forEach(x => { x.hidden = !startCats.includes(FROZEN); });
    if (startCats.includes(FROZEN) && !tool) el('expiry').value = addDaysTo(isoDay(new Date()), FROZEN_DAYS);
    f.addEventListener('submit', ev => {
      ev.preventDefault();
      const qty = Number(el('qty').value);
      const noexp = el('noexp').checked;
      const expiry = noexp ? null : el('expiry').value;
      if (!(qty > 0)) return toast('Quantità non valida.', true);
      if (!noexp && !expiry) return toast('Inserisci la scadenza o spunta "Nessuna scadenza".', true);
      const categories = pickerValue(picker);
      if (!categories.length) return toast('Scegli almeno una categoria.', true);
      const frozen_at = categories.includes(FROZEN) ? (el('frozen').value || isoDay(new Date())) : null;
      finish({ qty, unit: el('unit').value, categories, expiry, frozen_at });
      closeModal();
    });
  });
}

async function restockItem(item) {
  const v = await restockModal(item);
  if (!v) return false;
  await act(async () => {
    const { p, note } = await addToInventory({ name: item.name, ...v });
    await consumeShopping(item.name, v.qty, p.unit);
    return `${p.name}: ${fmtQty(v.qty)} ${p.unit} in dispensa ✅${note}`;
  }, r => r);
  return true;
}

/* Genera la lista Mother con i prodotti selezionati.
   I prodotti che Mother aveva già segnato come presi NON vengono persi. */
async function onGenerateMother() {
  const sel = data.shopping.filter(s => s.selected);
  const kept = data.shopping.filter(s => s.in_mother && s.done && !s.selected);
  if (!sel.length && !kept.length) return toast('Seleziona almeno un prodotto con la casella ☑️', true);
  await act(async () => {
    const toIn = [], toInKeepDone = [], toOut = [];
    for (const s of data.shopping) {
      const wasDone = !!(s.in_mother && s.done);
      const inM = !!s.selected || wasDone;
      if (!inM) { if (s.in_mother || s.done) toOut.push(s.id); }
      else if (wasDone) { if (!s.in_mother || !s.done) toInKeepDone.push(s.id); }
      else if (!s.in_mother || s.done) toIn.push(s.id);
    }
    await store.updateMany('shopping', toIn, { in_mother: true, done: false });
    await store.updateMany('shopping', toInKeepDone, { in_mother: true, done: true });
    await store.updateMany('shopping', toOut, { in_mother: false, done: false });
    const n = sel.length + kept.length;
    return `Lista Mother creata: ${n} prodott${n === 1 ? 'o' : 'i'}` + (kept.length ? ` (${kept.length} già presi conservati)` : '') + ' ❤️';
  }, r => r);
}

async function onSelectAll(on) {
  const ids = data.shopping.filter(s => !!s.selected !== on).map(s => s.id);
  await act(() => store.updateMany('shopping', ids, { selected: on }));
}

async function onRestockAllDone() {
  const items = data.shopping.filter(s => s.done);
  if (!items.length) return toast('Nessun prodotto segnato come preso da Mother.');
  for (const it of items) {
    const fresh = data.shopping.find(s => s.id === it.id);
    if (fresh && !(await restockItem(fresh))) break; // Annulla = interrompe
  }
}

function shoppingText() {
  const items = data.shopping.filter(s => !s.done);
  if (!items.length) return null;
  return '🛒 Lista della spesa\n' + items.map(s => {
    const q = qtyText(s.qty, s.unit);
    return `- ${s.name}${q ? ` (${q})` : ''}${s.note ? ` – ${s.note}` : ''}`;
  }).join('\n');
}

async function onShareText() {
  const text = shoppingText();
  if (!text) return toast('La lista della spesa è vuota.');
  if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({ text }); return; } catch { /* annullato: proseguo */ }
  }
  showTextModal('🛒 Lista della spesa', text);
}

/* ═════════════ Ricette → prompt per Gemini ═════════════ */
function onRecipes() {
  const food = data.products
    .filter(p => isFoodCats(catsOf(p)))
    .map(p => ({ p, lots: lotsOf(p.id) }))
    .filter(x => x.lots.length)
    .sort((a, b) => (a.lots[0].expiry || '9999').localeCompare(b.lots[0].expiry || '9999'));
  if (!food.length) return toast('Nessun alimento in dispensa.');
  const m = openModal(`
    <h3>✨ Idee ricette con Gemini</h3>
    <p class="sub">Ho già selezionato gli alimenti che scadono entro ${ORANGE_DAYS} giorni. Scegli gli ingredienti: creo un testo da copiare e incollare in Gemini.</p>
    <div style="margin-top:12px">${food.map(({ p, lots }, i) => {
      const s = lotStatus(lots[0]);
      const tot = round2(lots.reduce((a, l) => a + Number(l.qty), 0));
      return `<label class="recipe-item"><input type="checkbox" value="${i}" ${s.rank <= 2 ? 'checked' : ''}>
        ${catIcon(catsOf(p)[0])}<span style="flex:1">${esc(p.name)} <span class="muted">· ${fmtQty(tot)} ${esc(p.unit)}</span></span><span class="pill ${s.cls}">${s.label}</span></label>`;
    }).join('')}</div>
    <form id="rec-opts">
      <div class="row2">
        <label>Persone<input name="people" type="number" min="1" max="12" value="2"></label>
        <label>Tempo massimo<select name="time"><option value="15">15 minuti</option><option value="30" selected>30 minuti</option><option value="45">45 minuti</option></select></label>
      </div>
    </form>
    <div class="modal-foot">
      <button class="btn btn-light" data-close>Chiudi</button>
      <button class="btn btn-purple" id="make-prompt"><i data-lucide="wand-sparkles"></i>Crea il testo</button>
    </div>`);
  m.querySelector('#make-prompt').addEventListener('click', () => {
    const picked = [...m.querySelectorAll('.recipe-item input:checked')].map(i => food[Number(i.value)]);
    if (!picked.length) return toast('Seleziona almeno un ingrediente.', true);
    const f = m.querySelector('#rec-opts');
    const people = Number(f.elements.namedItem('people').value) || 2;
    const time = f.elements.namedItem('time').value;
    showPromptModal(buildRecipePrompt(picked, people, time));
  });
}

function buildRecipePrompt(picked, people, time) {
  const lines = picked.map(({ p, lots }) => {
    const tot = round2(lots.reduce((a, l) => a + Number(l.qty), 0));
    const s = lotStatus(lots[0]);
    const when = s.key === 'none' ? '' : s.key === 'expired' ? ' – scaduto, da controllare' : ` – ${s.label.toLowerCase()}`;
    return `- ${p.name}: ${fmtQty(tot)} ${p.unit}${when}`;
  }).join('\n');
  return `Sei un cuoco di casa italiano, pratico e bravo. Ho questi ingredienti in frigo/dispensa (alcuni stanno per scadere):

${lines}

Proponimi 3 ricette SEMPLICI, VELOCI (massimo ${time} minuti in totale) e BUONE per ${people} ${people === 1 ? 'persona' : 'persone'}, che usino soprattutto gli ingredienti che scadono prima.
Posso aggiungere solo ingredienti base che si hanno sempre in casa (olio, sale, pepe, aglio, cipolla, pasta, riso, farina, spezie comuni).

Per ogni ricetta scrivi:
1. Nome della ricetta e tempo totale
2. Ingredienti con le dosi per ${people} ${people === 1 ? 'persona' : 'persone'}
3. Procedimento in passaggi brevi e numerati
4. Un consiglio per renderla ancora più buona

Rispondi in italiano, in modo chiaro e senza giri di parole.`;
}

function showPromptModal(prompt) {
  const m = openModal(`
    <h3>📋 Testo per Gemini</h3>
    <p class="sub">Copialo e incollalo in Gemini per ricevere le ricette.</p>
    <textarea id="prompt-text" rows="14">${esc(prompt)}</textarea>
    <div class="modal-foot">
      <button class="btn btn-light" data-close>Chiudi</button>
      <a class="btn btn-light" href="https://gemini.google.com/app" target="_blank" rel="noopener"><i data-lucide="external-link"></i>Apri Gemini</a>
      <button class="btn btn-purple" id="copy-prompt"><i data-lucide="copy"></i>Copia testo</button>
    </div>`);
  m.querySelector('#copy-prompt').addEventListener('click', () => copyText(m.querySelector('#prompt-text').value, 'Testo copiato! Ora incollalo in Gemini ✨'));
}

function showTextModal(title, text) {
  const m = openModal(`<h3>${esc(title)}</h3><textarea rows="10">${esc(text)}</textarea>
    <div class="modal-foot"><button class="btn btn-light" data-close>Chiudi</button>
    <button class="btn btn-green" id="copy-txt"><i data-lucide="copy"></i>Copia</button></div>`);
  m.querySelector('#copy-txt').addEventListener('click', () => copyText(m.querySelector('textarea').value, 'Lista copiata negli appunti 📋'));
}

async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
  }
  toast(okMsg);
}

/* ═════════════ Notifiche scadenze ═════════════ */
const NKEY = 'smart-pantry-notify-v1';
let notify = lsGet(NKEY, { enabled: false, sent: {} });
let swReg = null;

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(r => { swReg = r; }).catch(() => { /* non disponibile */ });
}
const notifyOn = () => notify.enabled && 'Notification' in window && Notification.permission === 'granted';

function updateBell() {
  const b = $('#btn-notify');
  if (!b) return;
  const on = notifyOn();
  b.classList.toggle('on', on);
  b.title = on ? 'Notifiche scadenze attive (clicca per disattivare)' : 'Attiva le notifiche delle scadenze';
  b.innerHTML = `<i data-lucide="${on ? 'bell-ring' : 'bell-off'}"></i>`;
  icons();
}

async function onToggleNotify() {
  if (!('Notification' in window)) {
    return toast('Questo browser non supporta le notifiche. Su iPhone: Condividi → "Aggiungi a Home", poi apri l\'app dalla Home.', true);
  }
  if (notifyOn()) {
    notify.enabled = false; lsSet(NKEY, notify); updateBell();
    return toast('Notifiche disattivate');
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return toast('Permesso negato: abilita le notifiche per questo sito nelle impostazioni del browser.', true);
  notify = { enabled: true, sent: {} };
  lsSet(NKEY, notify); updateBell();
  const n = await checkExpiryNotifications();
  toast(n ? `Notifiche attive ✅ (${n} scadenze segnalate)` : 'Notifiche attive ✅ Nessun prodotto in scadenza ora');
}

/* Una notifica per ogni lotto in scadenza. Ogni lotto viene segnalato
   una volta per fascia: entro 5 gg, entro 2 gg, oggi, scaduto. */
async function checkExpiryNotifications() {
  if (!notifyOn() || !appShown) return 0;
  const alive = new Set();
  let count = 0;
  for (const lot of data.lots) {
    if (!lot.expiry) continue;
    const s = lotStatus(lot);
    if (s.rank > 2) continue;
    const p = data.products.find(x => x.id === lot.product_id);
    if (!p) continue;
    const stage = s.key === 'expired' ? 'x' : s.n === 0 ? '0' : s.key === 'red' ? '2' : '5';
    const key = `${lot.id}|${stage}`;
    alive.add(key);
    if (notify.sent[key]) continue;
    const icon = s.key === 'orange' ? '🟠' : s.key === 'red' ? '🔴' : '⛔';
    const title = `${icon} ${p.name}: ${s.label.toLowerCase()}`;
    const body = `${fmtQty(lot.qty)} ${p.unit} · scadenza ${fmtDate(lot.expiry)}`;
    await showNotification(title, body, `lot-${lot.id}`);
    notify.sent[key] = isoDay(new Date());
    count++;
  }
  for (const k of Object.keys(notify.sent)) if (!alive.has(k)) delete notify.sent[k];
  lsSet(NKEY, notify);
  return count;
}

async function showNotification(title, body, tag) {
  const opts = { body, tag, icon: 'icon-192.png', badge: 'icon-192.png' };
  try {
    if (swReg && swReg.showNotification) return await swReg.showNotification(title, opts);
    new Notification(title, opts);
  } catch (e) { console.warn('Notifica non mostrata', e); }
}
setInterval(() => { checkExpiryNotifications(); }, 30 * 60 * 1000);

/* ═════════════ Menu (telefono) ═════════════ */
function onMenu() {
  const on = notifyOn();
  const item = (id, icon, label, sub) => `<button class="menu-item" data-go="${id}"><span class="menu-ic"><i data-lucide="${icon}"></i></span>
    <span><b>${label}</b><small>${sub}</small></span></button>`;
  const m = openModal(`
    <h3>Menu</h3>
    <div class="menu-list">
      ${item('btn-recipes', 'sparkles', 'Ricette', 'Testo per Gemini con gli ingredienti')}
      ${item('btn-text', 'clipboard-list', 'Spesa come testo', 'Copia o condividi la lista')}
      ${item('btn-notify', on ? 'bell-ring' : 'bell-off', on ? 'Notifiche attive' : 'Attiva notifiche', on ? 'Tocca per disattivarle' : 'Avvisi per ogni scadenza')}
      ${item('btn-backup', 'download', 'Salva backup', 'Scarica un file con tutti i dati')}
      ${item('btn-restore', 'upload', 'Ripristina backup', 'Ricarica i dati da un file')}
      ${store && store.kind === 'supabase' ? item('btn-logout', 'log-out', 'Esci', 'Disconnetti questo dispositivo') : ''}
    </div>`);
  m.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    closeModal();
    $('#' + b.dataset.go).click();
  });
}

/* ═════════════ Backup ═════════════ */
function onBackup() {
  const payload = { app: 'smart-pantry-pro', version: 2, exported_at: new Date().toISOString(), ...data };
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
    `Contiene ${nd.products.length} prodotti e ${nd.lots.length} lotti.\nI dati attuali verranno SOSTITUITI.`;
  if (!(await confirmBox(msg, 'Ripristina'))) return;
  const cleanData = {};
  for (const t of TABLES) cleanData[t] = nd[t];
  await act(() => store.replaceAll(cleanData), 'Backup ripristinato ✅');
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
  const first = back.querySelector('input:not([type=checkbox]):not([readonly])');
  if (first && matchMedia('(pointer: fine)').matches) setTimeout(() => first.focus(), 30);
  return back.querySelector('.modal');
}
function closeModal() {
  const root = $('#modal-root');
  const m = root.firstChild;
  root.innerHTML = '';
  if (m && m._onClose) m._onClose();
}

function askUse(p, max) {
  return new Promise(resolve => {
    const half = round2(max / 2);
    const m = openModal(`
      <h3>Quanto "${esc(p.name)}" hai usato?</h3>
      <p class="sub">La quantità usata verrà aggiunta alla lista della spesa.</p>
      <form id="ask-form">
        <label>Quantità usata (${esc(p.unit)}) – disponibili ${fmtQty(max)}
          <input name="v" type="number" min="0.01" step="any" max="${max}" value="${max}" required inputmode="decimal">
        </label>
        <div class="quick">
          ${max > 1 && p.unit === 'pz' ? '<button type="button" class="btn btn-light" data-q="1">1 pz</button>' : ''}
          ${max > 0.02 ? `<button type="button" class="btn btn-light" data-q="${half}">Metà (${fmtQty(half)})</button>` : ''}
          <button type="button" class="btn btn-light" data-q="${max}">Tutto (${fmtQty(max)})</button>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-light" data-close>Annulla</button>
          <button type="submit" class="btn btn-green"><i data-lucide="check"></i>Conferma</button>
        </div>
      </form>`);
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); };
    m.parentElement._onClose = () => finish(null);
    const input = m.querySelector('input[name=v]');
    m.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.q; }));
    m.querySelector('#ask-form').addEventListener('submit', ev => {
      ev.preventDefault();
      const v = Number(input.value);
      if (!(v > 0)) return;
      finish(v); closeModal();
    });
  });
}

function confirmBox(text, okLabel) {
  return new Promise(resolve => {
    const m = openModal(`
      <h3>Conferma</h3>
      <p style="white-space:pre-line;margin:8px 0 0;line-height:1.5">${esc(text)}</p>
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
  toastTimer = setTimeout(() => { t.hidden = true; }, isErr ? 5500 : 3000);
}

/* ═════════════ Setup UI ═════════════ */
/* Selettore categorie a "chip": se ne possono scegliere più di una, la prima toccata è la principale */
function catChips() {
  return CATS.map(c => `<button type="button" class="chip" data-cat="${c.id}" style="--c:${c.color};--b:${c.bg}"><i data-lucide="${c.icon}"></i>${c.id}</button>`).join('');
}
function initPicker(el, selected, onChange) {
  el.innerHTML = catChips();
  el._sel = [...selected];
  const paint = () => el.querySelectorAll('.chip').forEach(ch => {
    const i = el._sel.indexOf(ch.dataset.cat);
    ch.classList.toggle('on', i >= 0);
    ch.classList.toggle('main', i === 0 && el._sel.length > 1);
  });
  el._set = list => { el._sel = [...list]; paint(); };
  if (!el._bound) {
    el._bound = true;
    el.addEventListener('click', e => {
      const ch = e.target.closest('.chip');
      if (!ch) return;
      const id = ch.dataset.cat;
      el._sel = el._sel.includes(id) ? el._sel.filter(x => x !== id) : [...el._sel, id];
      paint();
      if (el._onChange) el._onChange(el._sel);
    });
  }
  el._onChange = onChange;
  paint();
  icons();
}
const pickerValue = el => [...(el._sel || [])];
function unitOptions(sel) {
  return UNITS.map(([v, l]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${l}</option>`).join('');
}

function fillSelects() {
  initPicker($('#f-cats'), ['Carne e Pesce'], onFormCatsChange);
  $('#f-frozen').value = isoDay(new Date());
  $('#f-unit').innerHTML = unitOptions('pz');
  $('#shop-unit').innerHTML = unitOptions('pz');
  $('#cat-filter').innerHTML = '<option value="">Tutte le categorie</option>' +
    CATS.map(c => `<option value="${c.id}">${c.id}</option>`).join('');
  $('#f-exp').value = plusDays(7);
}

let expTouched = false;
function onFormCatsChange(list) {
  setNoExp(!isFoodCats(list.length ? list : ['Altro']));
  const fz = list.includes(FROZEN);
  $('#f-frozen-wrap').hidden = !fz;
  if (fz && !expTouched && !$('#f-noexp').checked) {
    $('#f-exp').value = addDaysTo($('#f-frozen').value || isoDay(new Date()), FROZEN_DAYS);
  }
}

function setNoExp(on) {
  $('#f-noexp').checked = on;
  $('#f-exp').disabled = on;
  $('.exp-star').hidden = on;
}

function setTab(tab) {
  if (!['pantry', 'shopping', 'mother'].includes(tab)) tab = 'pantry';
  ui.tab = tab;
  lsSet('sp-tab', tab);
  $$('[data-tab]').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
  $('#tab-pantry').hidden = tab !== 'pantry';
  $('#tab-shopping').hidden = tab !== 'shopping';
  $('#tab-mother').hidden = tab !== 'mother';
  $('#stats').hidden = tab !== 'pantry';
  if (tab === 'pantry' && chart) chart.resize();
}

function bindEvents() {
  // Login
  $('#login-form').addEventListener('submit', e => { e.preventDefault(); doAuth(); });
  $('#btn-logout').addEventListener('click', async () => {
    if (!(await confirmBox('Vuoi uscire?', 'Esci'))) return;
    if (sb) await sb.auth.signOut();
  });

  // Tab (in alto e barra in basso)
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => { setTab(b.dataset.tab); window.scrollTo({ top: 0 }); }));

  // Statistiche cliccabili → vai al gruppo
  $$('[data-jump]').forEach(b => b.addEventListener('click', () => {
    const g = document.getElementById(b.dataset.jump);
    if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else toast('Nessun prodotto in questa fascia 👍');
  }));

  // Form aggiunta
  $('#add-form').addEventListener('submit', onAdd);
  $('#f-noexp').addEventListener('change', e => {
    setNoExp(e.target.checked);
    if (!e.target.checked && !$('#f-exp').value) $('#f-exp').value = plusDays(7);
  });
  $('#f-exp').addEventListener('input', () => { expTouched = true; });
  $('#f-frozen').addEventListener('change', () => {
    if (!expTouched && $('#f-frozen').value) $('#f-exp').value = addDaysTo($('#f-frozen').value, FROZEN_DAYS);
  });
  // Se scrivo/scelgo un prodotto esistente, precompilo categoria e unità
  $('#f-name').addEventListener('input', e => {
    const p = productByName(e.target.value);
    if (p) { $('#f-cats')._set(catsOf(p)); $('#f-unit').value = p.unit; onFormCatsChange(catsOf(p)); }
  });
  $('#jump-add').addEventListener('click', () => {
    $('#add-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => $('#f-name').focus(), 400);
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
  $('#shop-name').addEventListener('input', e => {
    const p = productByName(e.target.value);
    if (p) $('#shop-unit').value = p.unit;
  });
  $('#shop-list').addEventListener('click', e => {
    const del = e.target.closest('[data-shop-del]');
    if (del) return act(() => store.remove('shopping', del.dataset.shopDel));
    const rs = e.target.closest('[data-restock]');
    if (rs) { const it = data.shopping.find(s => s.id === rs.dataset.restock); if (it) restockItem(it); }
  });
  $('#shop-list').addEventListener('change', e => {
    const id = e.target.dataset.shopSelect;
    if (!id) return;
    const it = data.shopping.find(s => s.id === id);
    if (it) it.selected = e.target.checked; // risposta immediata, poi salvo
    renderShopping();
    quickSave('shopping', id, { selected: e.target.checked });
  });
  $('#shop-select-all').addEventListener('change', e => onSelectAll(e.target.checked));
  $('#gen-mother').addEventListener('click', onGenerateMother);
  $('#shop-clear-done').addEventListener('click', async () => {
    const ids = data.shopping.filter(s => s.done).map(s => s.id);
    if (!ids.length) return toast('Nessun prodotto segnato come preso da Mother.');
    if (!(await confirmBox(`Togliere ${ids.length} prodotti presi dalla lista senza aggiornare la dispensa?`, 'Rimuovi'))) return;
    act(() => store.removeMany('shopping', ids), 'Presi rimossi');
  });
  $('#shop-all-in').addEventListener('click', onRestockAllDone);

  // Mother (scheda nell'app)
  $('#mother-app-list').addEventListener('click', e => {
    const b = e.target.closest('[data-m-toggle]');
    if (!b) return;
    const it = data.shopping.find(s => s.id === b.dataset.mToggle);
    if (!it) return;
    it.done = !it.done; // risposta immediata
    render();
    quickSave('shopping', it.id, { done: it.done });
  });
  $('#mother-share').addEventListener('click', onMotherShare);
  $('#mother-reset').addEventListener('click', onMotherReset);

  // Header
  $('#btn-backup').addEventListener('click', onBackup);
  $('#btn-restore').addEventListener('click', () => $('#restore-file').click());
  $('#restore-file').addEventListener('change', onRestoreFile);
  $('#btn-text').addEventListener('click', onShareText);
  $('#btn-recipes').addEventListener('click', onRecipes);
  $('#btn-notify').addEventListener('click', onToggleNotify);
  $('#btn-menu').addEventListener('click', onMenu);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}
