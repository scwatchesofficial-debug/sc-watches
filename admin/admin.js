/* S&C Watches — CRM (tableau de bord, commandes, clients, messages, produits, paramètres) */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number(n) % 1 ? 2 : 0 }).format(n || 0);
  const dfmt = (iso, withTime) => iso ? new Date(iso).toLocaleDateString('fr-FR', withTime ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 6e4); if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`; const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`; const d = Math.round(h / 24); return d < 30 ? `il y a ${d} j` : dfmt(iso); };
  const img = (src) => /^(https?:|data:|\/)/.test(src || '') ? src : '../' + (src || '');
  const S = SC.STATUSES;
  const pill = (st) => `<span class="pill ${S[st] ? S[st].tone : 'neutral'}">${esc(S[st] ? S[st].label : st)}</span>`;
  const VALID = (o) => o.status !== 'annulee' && o.status !== 'en_attente';

  const I = {
    dash: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="6" height="8" rx="1"/><rect x="11" y="3" width="6" height="5" rx="1"/><rect x="11" y="10" width="6" height="7" rx="1"/><rect x="3" y="13" width="6" height="4" rx="1"/></svg>',
    box: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6.5L10 3l7 3.5v7L10 17l-7-3.5z"/><path d="M3 6.5L10 10l7-3.5M10 10v7"/></svg>',
    users: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="7" r="3"/><path d="M2.5 16.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"/><path d="M13 4.2a3 3 0 0 1 0 5.6M15 12.3c1.4.6 2.2 2 2.5 4.2"/></svg>',
    mail: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="4" width="15" height="12" rx="2"/><path d="M3 5l7 6 7-6"/></svg>',
    watch: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="4.5"/><path d="M7 5.8L7.8 2h4.4l.8 3.8M7 14.2l.8 3.8h4.4l.8-3.8M10 8v2l1.3 1"/></svg>',
    gear: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/></svg>',
    ext: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 3h6v6M17 3l-8 8M14 12v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/></svg>',
    out: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 17H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M13 14l4-4-4-4M17 10H8"/></svg>',
    search: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 5l10 10M15 5L5 15"/></svg>',
    dl: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 3v10M6 9l4 4 4-4M4 16h12"/></svg>',
    plus: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 4v12M4 10h12"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" stroke-width="1.5"><path d="M3 6h14M3 10h14M3 14h14"/></svg>',
  };

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); }

  /* =================== Actions & erreurs =================== */
  // Exécute une écriture, affiche le message de succès ou l'erreur, puis rafraîchit l'écran.
  async function act(promise, okMsg, after) {
    try { const r = await promise; if (okMsg) toast(okMsg); if (after) after(r); return r; }
    catch (e) { console.error(e); toast('⚠️ ' + (e.message || 'Erreur')); if (SC.mode === 'remote') { try { await SC.refresh({ admin: true }); } catch (_) { /* */ } route(); } return undefined; }
  }

  /* =================== Authentification =================== */
  let logged = false;
  const REMOTE = SC.mode === 'remote';

  function renderLogin(errMsg) {
    const first = SC.auth.needsSetup();
    $('#root').innerHTML = `<div class="login"><form class="login-box" id="loginForm">
      <div class="brand" style="padding:0"><span class="brand-mark">S&amp;C</span><div><b>S&amp;C WATCHES</b><small>CRM</small></div></div>
      <h1>${first ? 'Bienvenue' : 'Connexion'}</h1>
      <p>${first ? 'Première visite : choisissez le mot de passe qui protégera votre espace de gestion.' : 'Accédez à votre espace de gestion.'}</p>
      <div style="display:grid;gap:14px">
        ${REMOTE ? '<label>E-mail<input type="email" id="em" required autocomplete="username" autofocus></label>' : ''}
        <label>Mot de passe<input type="password" id="pw" required minlength="${first ? 6 : 1}" autocomplete="${first ? 'new-password' : 'current-password'}" ${REMOTE ? '' : 'autofocus'}></label>
        ${first ? '<label>Confirmer le mot de passe<input type="password" id="pw2" required minlength="6" autocomplete="new-password"></label>' : ''}
        <p id="loginErr" style="color:var(--bad);margin:0;font-size:13px">${esc(errMsg || '')}</p>
        <button class="btn primary" id="loginBtn" style="justify-content:center;height:42px">${first ? 'Créer et entrer' : 'Se connecter'}</button>
        <a href="../index.html" class="muted" style="font-size:12.5px;text-align:center">← Retour au site</a>
        ${REMOTE ? '' : '<p class="hint" style="margin:0;text-align:center">Mode local : données enregistrées dans ce navigateur uniquement.</p>'}
      </div></form></div>`;
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const pw = $('#pw').value, err = $('#loginErr'), btn = $('#loginBtn');
      err.textContent = ''; btn.disabled = true;
      try {
        if (first) {
          if (pw.length < 6) throw new Error('6 caractères minimum.');
          if (pw !== $('#pw2').value) throw new Error('Les deux mots de passe ne correspondent pas.');
          await SC.auth.setup(pw);
        } else {
          await SC.auth.signIn(REMOTE ? $('#em').value : '', pw);
        }
        await enter();
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    });
  }

  async function enter() {
    $('#root').innerHTML = '<div class="login"><p class="muted">Chargement des données…</p></div>';
    try { await SC.ready({ admin: true }); }
    catch (e) { logged = false; return renderLogin('Impossible de charger les données : ' + e.message); }
    logged = true;
    window.onhashchange = route;
    route();
  }

  /* =================== Coque de l'application =================== */
  const VIEWS = [
    ['dashboard', 'Tableau de bord', I.dash],
    ['commandes', 'Commandes', I.box],
    ['clients', 'Clients', I.users],
    ['messages', 'Messages', I.mail],
    ['produits', 'Produits', I.watch],
    ['parametres', 'Paramètres', I.gear],
  ];
  const state = { orderFilter: 'tous', orderQ: '', clientQ: '', clientTag: 'tous', msgFilter: 'nouveau' };

  function shell() {
    $('#root').innerHTML = `<div class="mobile-bar"><button class="icon-btn" id="menuBtn" aria-label="Menu">${I.menu}</button><b style="font-family:var(--serif);font-size:18px">S&amp;C CRM</b></div>
    <div class="app">
      <nav class="side" id="side">
        <div class="brand"><span class="brand-mark">S&amp;C</span><div><b>S&amp;C WATCHES</b><small>CRM</small></div></div>
        ${VIEWS.map(([k, t, ic]) => `<a class="nav" href="#${k}" data-v="${k}">${ic}<span>${t}</span><span class="count" data-count="${k}" hidden></span></a>`).join('')}
        <div class="bottom">
          <div class="hint" style="padding:6px 12px">${REMOTE ? '<span style="color:var(--ok)">●</span> Base en ligne' : '<span style="color:var(--warn)">●</span> Mode local (test)'}</div>
          <a class="nav" href="#" id="refreshBtn"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 4v4h-4M4 16v-4h4M15.5 8A6 6 0 0 0 5 6.5M4.5 12A6 6 0 0 0 15 13.5"/></svg><span>Actualiser</span></a>
          <a class="nav" href="../index.html" target="_blank">${I.ext}<span>Voir le site</span></a>
          <a class="nav" href="#" id="logout">${I.out}<span>Déconnexion</span></a>
        </div>
      </nav>
      <main class="main" id="view"></main>
    </div>`;
    $('#logout').addEventListener('click', async e => { e.preventDefault(); logged = false; await SC.auth.signOut(); history.replaceState(null, '', location.pathname); renderLogin(); });
    $('#refreshBtn').addEventListener('click', async e => { e.preventDefault(); await refreshData(); toast('Données à jour'); });
    $('#menuBtn').addEventListener('click', () => $('#side').classList.toggle('open'));
    $('#side').addEventListener('click', e => { if (e.target.closest('a.nav')) $('#side').classList.remove('open'); });
  }

  function counts() {
    const pending = SC.orders().filter(o => o.status === 'payee' || o.status === 'preparation').length;
    const unread = SC.messages().filter(m => m.status === 'nouveau').length;
    const setC = (k, n) => { const el = $(`[data-count="${k}"]`); if (el) { el.hidden = !n; el.textContent = n; } };
    setC('commandes', pending); setC('messages', unread);
  }

  async function refreshData() {
    if (!logged) return;
    try { await SC.refresh({ admin: true }); } catch (e) { toast('⚠️ ' + e.message); return; }
    if (!$('#drawer').classList.contains('open')) route(); else counts();
  }

  function route() {
    if (!logged) return renderLogin();
    if (!$('#side')) shell();
    const v = (location.hash.slice(1) || 'dashboard').split('/')[0];
    const view = VIEWS.find(x => x[0] === v) ? v : 'dashboard';
    $$('.side a.nav[data-v]').forEach(a => a.classList.toggle('active', a.dataset.v === view));
    closeDrawer();
    views[view]();
    counts();
    window.scrollTo(0, 0);
  }

  const top = (title, sub, actions = '') => `<div class="top"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div></div>`;

  /* =================== Panneau latéral =================== */
  function openDrawer(html) { const d = $('#drawer'); d.innerHTML = html; d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); $('#drawerBg').classList.add('open'); $$('[data-close]', d).forEach(b => b.addEventListener('click', closeDrawer)); }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#drawerBg').classList.remove('open'); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  /* =================== Export CSV =================== */
  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type }); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function csv(rows) { return '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\n'); }

  /* =================== Vues =================== */
  const views = {
    /* ---------- Tableau de bord ---------- */
    dashboard() {
      const orders = SC.orders(), valid = orders.filter(VALID), DAY = 864e5, now = Date.now();
      const inRange = (o, a, b) => { const t = +new Date(o.createdAt); return t >= now - a * DAY && t < now - b * DAY; };
      const rev30 = valid.filter(o => inRange(o, 30, 0)).reduce((s, o) => s + o.total, 0);
      const revPrev = valid.filter(o => inRange(o, 60, 30)).reduce((s, o) => s + o.total, 0);
      const n30 = valid.filter(o => inRange(o, 30, 0)).length;
      const delta = revPrev ? Math.round((rev30 - revPrev) / revPrev * 100) : null;
      const aov = valid.length ? valid.reduce((s, o) => s + o.total, 0) / valid.length : 0;
      const toShip = orders.filter(o => o.status === 'payee' || o.status === 'preparation');
      const waiting = orders.filter(o => o.status === 'en_attente');
      const unread = SC.messages().filter(m => m.status === 'nouveau');
      const customers = SC.customers();

      // chiffre d'affaires par jour (30 j)
      const days = [...Array(30)].map((_, i) => { const d = new Date(now - (29 - i) * DAY); d.setHours(0, 0, 0, 0); return { d, v: 0 }; });
      valid.forEach(o => { const t = new Date(o.createdAt); t.setHours(0, 0, 0, 0); const day = days.find(x => +x.d === +t); if (day) day.v += o.total; });
      const max = Math.max(100, ...days.map(x => x.v)), W = 600, H = 200, bw = W / 30;
      const chart = `<svg class="chart" viewBox="0 0 ${W} ${H + 22}" preserveAspectRatio="none" role="img" aria-label="Chiffre d'affaires des 30 derniers jours">
        ${[0, .5, 1].map(f => `<line class="grid" x1="0" x2="${W}" y1="${H - f * H + .5}" y2="${H - f * H + .5}"/>`).join('')}
        ${days.map((x, i) => { const h = x.v / max * (H - 10); return `<rect class="bar" x="${i * bw + 3}" y="${H - h}" width="${bw - 6}" height="${Math.max(h, x.v ? 2 : 0)}" rx="2"><title>${x.d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : ${eur(x.v)}</title></rect>`; }).join('')}
        ${days.map((x, i) => i % 5 === 2 ? `<text x="${i * bw + bw / 2}" y="${H + 16}" text-anchor="middle">${x.d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</text>` : '').join('')}
      </svg>`;

      // ventes par modèle
      const byProduct = {};
      valid.forEach(o => o.lines.forEach(l => { byProduct[l.name] = byProduct[l.name] || { qty: 0, rev: 0 }; byProduct[l.name].qty += l.qty; byProduct[l.name].rev += l.qty * l.price; }));
      const prodRows = Object.entries(byProduct).sort((a, b) => b[1].rev - a[1].rev);
      const maxRev = Math.max(1, ...prodRows.map(r => r[1].rev));
      const lowStock = SC.products(true).filter(p => p.active && p.stock <= 3);

      const empty = !orders.length && !SC.messages().length;
      $('#view').innerHTML = top('Tableau de bord', new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), `<a class="btn" href="../index.html" target="_blank">${I.ext} Voir le site</a>`) +
        (empty ? `<div class="banner"><span>Votre CRM est vide pour l'instant : les commandes et messages du site apparaîtront ici automatiquement.</span><button class="btn" id="demoBtn">Charger des données de démonstration</button></div>` : '') +
        `<div class="kpis">
          <div class="card kpi"><div class="label">Chiffre d'affaires · 30 j</div><div class="value num">${eur(rev30)}</div><div class="delta ${delta == null ? '' : delta >= 0 ? 'up' : 'down'}">${delta == null ? '<span class="muted">—</span>' : (delta >= 0 ? '▲ ' : '▼ ') + Math.abs(delta) + ' % vs 30 j précédents'}</div></div>
          <div class="card kpi"><div class="label">Commandes payées · 30 j</div><div class="value num">${n30}</div><div class="delta muted">${waiting.length} en attente de paiement</div></div>
          <div class="card kpi"><div class="label">Panier moyen</div><div class="value num">${eur(Math.round(aov))}</div><div class="delta muted">sur ${valid.length} commande${valid.length > 1 ? 's' : ''}</div></div>
          <div class="card kpi"><div class="label">Clients</div><div class="value num">${customers.length}</div><div class="delta muted">${customers.filter(c => c.orderCount > 1).length} clients fidèles (2+ commandes)</div></div>
        </div>
        <div class="grid-dash">
          <div class="card"><div class="card-h"><h2>Ventes des 30 derniers jours</h2><span class="muted num">${eur(rev30)}</span></div><div class="card-b">${chart}</div></div>
          <div class="card"><div class="card-h"><h2>Ventes par modèle</h2></div><div class="card-b bars-h">
            ${prodRows.length ? prodRows.map(([n, r]) => `<div class="r"><span>${esc(n)} <span class="muted">· ${r.qty} vendue${r.qty > 1 ? 's' : ''}</span></span><b class="num">${eur(r.rev)}</b><div class="track"><div class="fill" style="width:${r.rev / maxRev * 100}%"></div></div></div>`).join('') : '<p class="muted">Aucune vente pour le moment.</p>'}
            ${lowStock.length ? `<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)"><b style="font-size:12px;color:var(--warn)">Stock faible</b>${lowStock.map(p => `<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px"><span>${esc(p.name)}</span><span class="${p.stock ? '' : 'muted'}" style="color:${p.stock ? 'var(--warn)' : 'var(--bad)'}">${p.stock ? p.stock + ' restant' + (p.stock > 1 ? 's' : '') : 'Épuisé'}</span></div>`).join('')}</div>` : ''}
          </div></div>
        </div>
        <div class="grid-dash">
          <div class="card"><div class="card-h"><h2>À expédier</h2><a class="btn sm" href="#commandes" data-goto="payee">Tout voir</a></div>
            ${toShip.length ? `<div class="table-wrap"><table><tbody>${toShip.slice(0, 6).map(o => `<tr data-order="${o.id}"><td><b>${esc(o.ref)}</b><div class="muted" style="font-size:12px">${ago(o.createdAt)}</div></td><td class="who"><b>${esc(o.customer.name)}</b><span>${esc(o.address.city)}</span></td><td>${pill(o.status)}</td><td class="r num">${eur(o.total)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Rien à expédier. 🎉</div>'}
          </div>
          <div class="card"><div class="card-h"><h2>Messages non lus</h2><a class="btn sm" href="#messages">Boîte de réception</a></div>
            <div class="card-b" style="padding-top:6px">${unread.length ? `<ul class="feed">${unread.slice(0, 5).map(m => `<li data-msg="${m.id}" style="cursor:pointer"><span><b>${esc(m.name)}</b><br><span class="muted">${esc(m.message.slice(0, 70))}${m.message.length > 70 ? '…' : ''}</span></span><small>${ago(m.createdAt)}</small></li>`).join('')}</ul>` : '<p class="muted" style="margin:14px 0 0">Aucun message en attente.</p>'}</div>
          </div>
        </div>
        <div class="card"><div class="card-h"><h2>Activité récente</h2></div><div class="card-b" style="padding-top:6px"><ul class="feed">${SC.log().slice(0, 8).map(l => `<li><span>${esc(l.text)}</span><small>${ago(l.at)}</small></li>`).join('') || '<li class="muted">Aucune activité.</li>'}</ul></div></div>`;

      const demo = $('#demoBtn'); if (demo) demo.addEventListener('click', () => { demo.disabled = true; act(SC.loadDemo(), 'Données de démonstration chargées', route); });
      $$('[data-order]').forEach(r => r.addEventListener('click', () => orderDrawer(r.dataset.order)));
      $$('[data-msg]').forEach(r => r.addEventListener('click', () => messageDrawer(r.dataset.msg)));
      $$('[data-goto]').forEach(a => a.addEventListener('click', () => { state.orderFilter = 'a_traiter'; }));
    },

    /* ---------- Commandes ---------- */
    commandes() {
      const all = SC.orders();
      const filters = [['tous', 'Toutes', () => true], ['a_traiter', 'À traiter', o => o.status === 'payee' || o.status === 'preparation'], ...Object.entries(S).map(([k, v]) => [k, v.label, o => o.status === k])];
      $('#view').innerHTML = top('Commandes', `${all.length} commande${all.length > 1 ? 's' : ''} au total`, `<button class="btn" id="csvOrders">${I.dl} Exporter (CSV)</button>`) +
        `<div class="toolbar"><div class="search">${I.search}<input id="q" placeholder="N°, client, e-mail, ville…" value="${esc(state.orderQ)}"></div></div>
        <div class="toolbar"><div class="tabs" id="ftabs">${filters.map(([k, t, fn]) => `<button class="tab ${state.orderFilter === k ? 'active' : ''}" data-f="${k}">${t}<span class="n">${all.filter(fn).length}</span></button>`).join('')}</div></div>
        <div class="card"><div class="table-wrap"><table><thead><tr><th>Commande</th><th>Date</th><th>Client</th><th>Articles</th><th>Statut</th><th class="r">Total</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
      const draw = () => {
        const fn = filters.find(f => f[0] === state.orderFilter)[2], q = state.orderQ.toLowerCase();
        const list = all.filter(fn).filter(o => !q || [o.ref, o.customer.name, o.customer.email, o.address.city, o.address.zip, o.tracking.number].join(' ').toLowerCase().includes(q));
        $('#rows').innerHTML = list.length ? list.map(o => `<tr data-id="${o.id}"><td><b>${esc(o.ref)}</b></td><td class="muted">${dfmt(o.createdAt)}</td><td class="who"><b>${esc(o.customer.name)}</b><span>${esc(o.customer.email)}</span></td><td>${o.lines.map(l => `${esc(l.name.replace('S&C ', ''))} × ${l.qty}`).join(', ')}</td><td>${pill(o.status)}</td><td class="r num"><b>${eur(o.total)}</b></td></tr>`).join('') : `<tr><td colspan="6" class="empty">Aucune commande${q || state.orderFilter !== 'tous' ? ' ne correspond à ces critères' : ' pour le moment'}.</td></tr>`;
        $$('#rows tr[data-id]').forEach(r => r.addEventListener('click', () => orderDrawer(r.dataset.id)));
      };
      $('#q').addEventListener('input', e => { state.orderQ = e.target.value; draw(); });
      $('#ftabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; state.orderFilter = b.dataset.f; $$('#ftabs .tab').forEach(x => x.classList.toggle('active', x === b)); draw(); });
      $('#csvOrders').addEventListener('click', () => {
        downloadFile(`commandes-${new Date().toISOString().slice(0, 10)}.csv`, csv([['N°', 'Date', 'Client', 'E-mail', 'Téléphone', 'Adresse', 'Code postal', 'Ville', 'Articles', 'Sous-total', 'Livraison', 'Total', 'Statut', 'Transporteur', 'N° suivi'],
          ...all.map(o => [o.ref, dfmt(o.createdAt), o.customer.name, o.customer.email, o.customer.phone, [o.address.line1, o.address.line2].filter(Boolean).join(', '), o.address.zip, o.address.city, o.lines.map(l => `${l.name} x${l.qty}`).join(' + '), o.subtotal, o.shipping, o.total, S[o.status].label, o.tracking.carrier, o.tracking.number])]), 'text/csv;charset=utf-8');
      });
      draw();
    },

    /* ---------- Clients ---------- */
    clients() {
      const all = SC.customers().sort((a, b) => b.spent - a.spent || (b.lastOrder || '').localeCompare(a.lastOrder || ''));
      const tags = [...new Set(all.flatMap(c => c.tags))];
      $('#view').innerHTML = top('Clients', `${all.length} contact${all.length > 1 ? 's' : ''} · ${eur(all.reduce((s, c) => s + c.spent, 0))} de chiffre d'affaires cumulé`, `<button class="btn" id="csvClients">${I.dl} Exporter (CSV)</button><button class="btn primary" id="addClient">${I.plus} Ajouter un client</button>`) +
        `<div class="toolbar"><div class="search">${I.search}<input id="q" placeholder="Nom, e-mail, ville…" value="${esc(state.clientQ)}"></div>
          <div class="tabs" id="ttabs">${['tous', 'acheteurs', 'prospects', ...tags].map(t => `<button class="tab ${state.clientTag === t ? 'active' : ''}" data-t="${esc(t)}">${t === 'tous' ? 'Tous' : t === 'acheteurs' ? 'Acheteurs' : t === 'prospects' ? 'Prospects' : esc(t)}</button>`).join('')}</div></div>
        <div class="card"><div class="table-wrap"><table><thead><tr><th>Client</th><th>Ville</th><th>Commandes</th><th>Dernière commande</th><th>Étiquettes</th><th class="r">Total dépensé</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
      const draw = () => {
        const q = state.clientQ.toLowerCase(), t = state.clientTag;
        const list = all.filter(c => t === 'tous' || (t === 'acheteurs' ? c.spent > 0 : t === 'prospects' ? c.spent === 0 : c.tags.includes(t)))
          .filter(c => !q || [c.name, c.email, c.phone, c.address && c.address.city].join(' ').toLowerCase().includes(q));
        $('#rows').innerHTML = list.length ? list.map(c => `<tr data-id="${c.id}"><td class="who"><b>${esc(c.name || '—')}</b><span>${esc(c.email)}</span></td><td>${esc(c.address ? c.address.city : '—')}</td><td class="num">${c.orderCount}</td><td class="muted">${c.lastOrder ? dfmt(c.lastOrder) : '—'}</td><td>${c.tags.map(x => `<span class="tag">${esc(x)}</span>`).join('') || '<span class="muted">—</span>'}</td><td class="r num"><b>${eur(c.spent)}</b></td></tr>`).join('') : '<tr><td colspan="6" class="empty">Aucun client trouvé.</td></tr>';
        $$('#rows tr[data-id]').forEach(r => r.addEventListener('click', () => clientDrawer(r.dataset.id)));
      };
      $('#q').addEventListener('input', e => { state.clientQ = e.target.value; draw(); });
      $('#ttabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; state.clientTag = b.dataset.t; $$('#ttabs .tab').forEach(x => x.classList.toggle('active', x === b)); draw(); });
      $('#csvClients').addEventListener('click', () => downloadFile(`clients-${new Date().toISOString().slice(0, 10)}.csv`, csv([['Nom', 'E-mail', 'Téléphone', 'Adresse', 'Code postal', 'Ville', 'Commandes', 'Total dépensé', 'Étiquettes', 'Notes', 'Client depuis'],
        ...all.map(c => [c.name, c.email, c.phone, c.address ? c.address.line1 : '', c.address ? c.address.zip : '', c.address ? c.address.city : '', c.orderCount, c.spent, c.tags.join(', '), c.notes, dfmt(c.createdAt)])]), 'text/csv;charset=utf-8'));
      $('#addClient').addEventListener('click', () => clientDrawer(null));
      draw();
    },

    /* ---------- Messages ---------- */
    messages() {
      const all = SC.messages();
      const filters = [['nouveau', 'À traiter', m => m.status !== 'traite'], ['traite', 'Traités', m => m.status === 'traite'], ['tous', 'Tous', () => true]];
      const mpill = { nouveau: '<span class="pill warn">Non lu</span>', lu: '<span class="pill info">Lu</span>', traite: '<span class="pill ok">Traité</span>' };
      $('#view').innerHTML = top('Messages', 'Demandes reçues via le formulaire de contact du site') +
        `<div class="toolbar"><div class="tabs" id="mtabs">${filters.map(([k, t, fn]) => `<button class="tab ${state.msgFilter === k ? 'active' : ''}" data-f="${k}">${t}<span class="n">${all.filter(fn).length}</span></button>`).join('')}</div></div>
        <div class="card"><div class="table-wrap"><table><thead><tr><th>De</th><th>Sujet</th><th>Message</th><th>Reçu</th><th>Statut</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
      const draw = () => {
        const list = all.filter(filters.find(f => f[0] === state.msgFilter)[2]);
        $('#rows').innerHTML = list.length ? list.map(m => `<tr data-id="${m.id}"><td class="who"><b>${esc(m.name)}</b><span>${esc(m.email)}</span></td><td>${esc(m.subject)}</td><td class="muted" style="max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.message)}</td><td class="muted" style="white-space:nowrap">${ago(m.createdAt)}</td><td>${mpill[m.status] || ''}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">Aucun message ici.</td></tr>';
        $$('#rows tr[data-id]').forEach(r => r.addEventListener('click', () => messageDrawer(r.dataset.id)));
      };
      $('#mtabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; state.msgFilter = b.dataset.f; $$('#mtabs .tab').forEach(x => x.classList.toggle('active', x === b)); draw(); });
      draw();
    },

    /* ---------- Produits ---------- */
    produits() {
      const all = SC.products(true);
      const sold = {}; SC.orders().filter(VALID).forEach(o => o.lines.forEach(l => { sold[l.productId] = (sold[l.productId] || 0) + l.qty; }));
      $('#view').innerHTML = top('Produits', 'Les modifications sont visibles immédiatement sur le site', `<button class="btn primary" id="addProd">${I.plus} Nouveau modèle</button>`) +
        `<div class="card"><div class="table-wrap"><table><thead><tr><th></th><th>Modèle</th><th>Catégorie</th><th>Prix</th><th>Stock</th><th>Vendus</th><th>En ligne</th></tr></thead><tbody>
        ${all.map(p => `<tr data-id="${esc(p.id)}"><td style="width:54px"><img class="thumb" src="${esc(img(p.image))}" alt=""></td><td class="who"><b>${esc(p.name)}</b><span>${esc(p.badge || '')}</span></td><td>${esc(p.category || '—')}</td><td class="num">${eur(p.price)}</td><td class="num" style="color:${p.stock <= 0 ? 'var(--bad)' : p.stock <= 3 ? 'var(--warn)' : 'inherit'}">${p.stock}</td><td class="num">${sold[p.id] || 0}</td><td>${p.active ? '<span class="pill ok">En ligne</span>' : '<span class="pill neutral">Masqué</span>'}</td></tr>`).join('')}
        </tbody></table></div></div>`;
      $$('tbody tr[data-id]').forEach(r => r.addEventListener('click', () => productDrawer(r.dataset.id)));
      $('#addProd').addEventListener('click', () => productDrawer(null));
    },

    /* ---------- Paramètres ---------- */
    parametres() {
      const s = SC.settings(), prods = SC.products(true);
      $('#view').innerHTML = top('Paramètres') + `
      <div style="display:grid;gap:18px;max-width:820px">
        <form class="card" id="shopForm"><div class="card-h"><h2>Boutique</h2></div><div class="card-b fgrid">
          <label>Frais de livraison (€)<input type="number" min="0" step="0.5" name="shipping" value="${esc(s.shipping)}"></label>
          <label>E-mail de contact<input type="email" name="contactEmail" value="${esc(s.contactEmail)}"></label>
          <label>Compte Instagram (sans @)<input name="instagram" value="${esc(s.instagram)}"></label>
          <label>Adresse de l'atelier<input name="address" value="${esc(s.address)}"></label>
          <div class="full"><button class="btn primary">Enregistrer</button></div>
        </div></form>

        <form class="card" id="payForm"><div class="card-h"><h2>Paiement par carte (Stripe)</h2></div><div class="card-b" style="display:grid;gap:14px">
          <p class="hint" style="margin:0">Collez ici le <b>lien de paiement Stripe</b> de chaque modèle (Stripe → Liens de paiement). Après avoir validé le formulaire de commande, le client est redirigé vers ce lien ; le n° de commande est transmis à Stripe (champ « client_reference_id ») pour faire le rapprochement. Sans lien, la commande est simplement enregistrée « En attente de paiement ».</p>
          ${prods.map(p => `<label>${esc(p.name)}<input type="url" name="${esc(p.id)}" placeholder="https://buy.stripe.com/…" value="${esc((s.stripeLinks || {})[p.id] || '')}"></label>`).join('')}
          <div><button class="btn primary">Enregistrer</button></div>
        </div></form>

        <form class="card" id="pwForm"><div class="card-h"><h2>Mot de passe administrateur</h2></div><div class="card-b fgrid">
          <label>Mot de passe actuel<input type="password" name="cur" required autocomplete="current-password"></label>
          <label>Nouveau mot de passe<input type="password" name="next" required minlength="6" autocomplete="new-password"></label>
          <div class="full"><button class="btn primary">Changer le mot de passe</button> <span id="pwMsg" class="hint" style="margin-left:10px"></span></div>
        </div></form>

        <div class="card"><div class="card-h"><h2>Sauvegarde des données</h2></div><div class="card-b" style="display:grid;gap:14px">
          <p class="hint" style="margin:0">${REMOTE ? 'Vos données sont enregistrées en ligne (Supabase). Vous pouvez en plus télécharger une copie de sécurité à tout moment.' : 'Mode local : les données sont stockées dans ce navigateur. Téléchargez régulièrement une sauvegarde ; elle pourra être importée dans la base en ligne une fois celle-ci configurée.'}</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn" id="backup">${I.dl} Télécharger une sauvegarde</button>
            <label class="btn" style="display:inline-flex;font-size:13px;color:var(--text)">Restaurer une sauvegarde<input type="file" id="restore" accept="application/json,.json" hidden></label>
            <button class="btn" id="demo">Ajouter des données de démo</button>
            <button class="btn danger" id="reset">Tout effacer</button>
          </div>
        </div></div>
      </div>`;
      $('#shopForm').addEventListener('submit', e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); d.shipping = Math.max(0, +d.shipping || 0); d.instagram = d.instagram.replace(/^@/, ''); act(SC.saveSettings(d), 'Paramètres enregistrés'); });
      $('#payForm').addEventListener('submit', e => {
        e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
        for (const [k, v] of Object.entries(d)) if (v && !/^https:\/\//.test(v)) return toast('Les liens doivent commencer par https://');
        act(SC.saveSettings({ stripeLinks: d }), 'Liens de paiement enregistrés');
      });
      $('#pwForm').addEventListener('submit', async e => {
        e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
        try { await SC.auth.changePassword(d.cur, d.next); e.target.reset(); $('#pwMsg').textContent = ''; toast('Mot de passe modifié'); }
        catch (err) { $('#pwMsg').textContent = err.message; }
      });
      $('#backup').addEventListener('click', () => downloadFile(`sauvegarde-sc-watches-${new Date().toISOString().slice(0, 10)}.json`, SC.exportJSON(), 'application/json'));
      $('#restore').addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        if (!confirm('Remplacer toutes les données actuelles par celles de cette sauvegarde ?')) return;
        const r = new FileReader(); r.onload = () => act(Promise.resolve().then(() => SC.importJSON(r.result)), 'Sauvegarde restaurée', route); r.readAsText(f);
      });
      $('#demo').addEventListener('click', e => { e.currentTarget.disabled = true; act(SC.loadDemo(), 'Données de démonstration ajoutées', route); });
      $('#reset').addEventListener('click', () => { if (confirm('Effacer définitivement toutes les commandes, clients et messages ? Les produits sont conservés. Pensez à télécharger une sauvegarde avant.')) act(SC.reset(), 'Données effacées', route); });
    },
  };

  /* =================== Fiches détaillées =================== */
  function orderDrawer(id) {
    const o = SC.order(id); if (!o) return;
    const a = o.address;
    const nextStatus = SC.STATUS_FLOW[SC.STATUS_FLOW.indexOf(o.status) + 1];
    openDrawer(`<div class="drawer-h"><div><span class="muted" style="font-size:12px">${dfmt(o.createdAt, true)}</span><h2>${esc(o.ref)}</h2><div style="margin-top:8px">${pill(o.status)}</div></div><button class="icon-btn" data-close aria-label="Fermer">${I.x}</button></div>
      <div class="drawer-b">
        <div class="sec"><h3>Articles</h3><div class="lines-mini">${o.lines.map(l => `<div><img class="thumb" src="${esc(img(l.image))}" alt=""><div style="flex:1"><b>${esc(l.name)}</b><div class="muted" style="font-size:12.5px">${eur(l.price)} × ${l.qty}</div></div><b class="num">${eur(l.price * l.qty)}</b></div>`).join('')}
          <div class="tot" style="margin-top:8px"><span>Sous-total</span><span class="num">${eur(o.subtotal)}</span></div><div class="tot"><span>Livraison</span><span class="num">${eur(o.shipping)}</span></div><div class="tot" style="color:var(--text);font-weight:700"><span>Total</span><span class="num">${eur(o.total)}</span></div></div></div>
        <div class="sec"><h3>Client</h3><dl class="kv"><dt>Nom</dt><dd><a href="#" id="toClient">${esc(o.customer.name)}</a></dd><dt>E-mail</dt><dd><a href="mailto:${esc(o.customer.email)}?subject=${encodeURIComponent('Votre commande S&C Watches ' + o.ref)}">${esc(o.customer.email)}</a></dd><dt>Téléphone</dt><dd><a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone || '—')}</a></dd><dt>Livraison</dt><dd>${esc(a.line1)}${a.line2 ? '<br>' + esc(a.line2) : ''}<br>${esc(a.zip)} ${esc(a.city)}</dd></dl></div>
        <form class="sec" id="oForm" style="display:grid;gap:14px"><h3 style="margin:0">Traitement</h3>
          <div class="fgrid">
            <label>Statut<select name="status">${Object.entries(S).map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
            <label>Transporteur<input name="carrier" list="carriers" value="${esc(o.tracking.carrier)}" placeholder="Colissimo, Chronopost…"></label>
            <label class="full">N° de suivi colis<input name="number" value="${esc(o.tracking.number)}"></label>
            <label class="full">Notes internes<textarea name="notes" placeholder="Gravure demandée, emballage cadeau…">${esc(o.notes)}</textarea></label>
          </div>
          <datalist id="carriers"><option>Colissimo</option><option>Chronopost</option><option>Mondial Relay</option><option>DHL</option><option>UPS</option><option>Remise en main propre</option></datalist>
        </form>
        <div class="sec"><h3>Historique</h3><ul class="timeline-mini">${o.history.slice().reverse().map(h => `<li>${esc(S[h.status] ? S[h.status].label : h.status)}${h.note ? ` — <span class="muted">${esc(h.note)}</span>` : ''}<small>${dfmt(h.at, true)}</small></li>`).join('')}</ul></div>
      </div>
      <div class="drawer-f">
        <button class="btn danger ghost" id="oDel" style="margin-right:auto">Supprimer</button>
        ${nextStatus ? `<button class="btn" id="oNext">Passer à « ${S[nextStatus].label} »</button>` : ''}
        <button class="btn primary" id="oSave">Enregistrer</button>
      </div>`);
    const save = (forceStatus) => {
      const d = Object.fromEntries(new FormData($('#oForm')));
      const status = forceStatus || d.status;
      if (status === 'expediee' && !d.number && !confirm("Aucun numéro de suivi n'est renseigné. Marquer quand même comme expédiée ?")) return;
      act(SC.updateOrder(o.id, { status, tracking: { carrier: d.carrier.trim(), number: d.number.trim() }, notes: d.notes }), 'Commande mise à jour', () => { route(); orderDrawer(o.id); });
    };
    $('#oSave').addEventListener('click', () => save());
    const nb = $('#oNext'); if (nb) nb.addEventListener('click', () => save(nextStatus));
    $('#oDel').addEventListener('click', () => { if (confirm(`Supprimer définitivement la commande ${o.ref} ?`)) { closeDrawer(); act(SC.deleteOrder(o.id), 'Commande supprimée', route); } });
    $('#toClient').addEventListener('click', e => { e.preventDefault(); const c = SC.customers().find(x => x.email === o.customer.email); if (c) clientDrawer(c.id); });
  }

  function clientDrawer(id) {
    const c = id ? SC.customer(id) : { id: null, name: '', email: '', phone: '', address: null, tags: [], notes: '', orderCount: 0, spent: 0 };
    if (!c) return;
    const orders = id ? SC.orders().filter(o => o.customer.email === c.email) : [];
    const msgs = id ? SC.messages().filter(m => m.email === c.email) : [];
    const a = c.address || { line1: '', line2: '', zip: '', city: '' };
    openDrawer(`<div class="drawer-h"><div><span class="muted" style="font-size:12px">${id ? 'Client depuis le ' + dfmt(c.createdAt) : 'Nouveau contact'}</span><h2>${esc(c.name || 'Nouveau client')}</h2>${id ? `<div style="margin-top:8px;display:flex;gap:16px;font-size:13px"><span><b class="num">${eur(c.spent)}</b> <span class="muted">dépensés</span></span><span><b>${c.orderCount}</b> <span class="muted">commande${c.orderCount > 1 ? 's' : ''}</span></span></div>` : ''}</div><button class="icon-btn" data-close aria-label="Fermer">${I.x}</button></div>
      <div class="drawer-b">
        <form id="cForm" class="fgrid">
          <label>Nom complet<input name="name" value="${esc(c.name)}" required></label>
          <label>E-mail<input type="email" name="email" value="${esc(c.email)}" required ${id ? 'readonly title="L\'e-mail identifie le client"' : ''}></label>
          <label>Téléphone<input name="phone" value="${esc(c.phone)}"></label>
          <label>Étiquettes <span class="hint">séparées par des virgules</span><input name="tags" value="${esc(c.tags.join(', '))}" placeholder="VIP, Revendeur, Presse…"></label>
          <label class="full">Adresse<input name="line1" value="${esc(a.line1)}"></label>
          <label>Code postal<input name="zip" value="${esc(a.zip)}"></label>
          <label>Ville<input name="city" value="${esc(a.city)}"></label>
          <label class="full">Notes<textarea name="notes" placeholder="Préférences, taille de poignet, anniversaire…">${esc(c.notes)}</textarea></label>
        </form>
        ${id ? `<div class="sec"><h3>Commandes</h3>${orders.length ? `<div class="lines-mini">${orders.map(o => `<div style="cursor:pointer" data-o="${o.id}"><div style="flex:1"><b>${esc(o.ref)}</b> <span class="muted" style="font-size:12.5px">· ${dfmt(o.createdAt)}</span><div class="muted" style="font-size:12.5px">${o.lines.map(l => esc(l.name) + ' × ' + l.qty).join(', ')}</div></div>${pill(o.status)}<b class="num">${eur(o.total)}</b></div>`).join('')}</div>` : '<p class="muted" style="margin:0">Aucune commande.</p>'}</div>
        <div class="sec"><h3>Messages</h3>${msgs.length ? `<ul class="feed">${msgs.map(m => `<li data-m="${m.id}" style="cursor:pointer"><span><b>${esc(m.subject)}</b><br><span class="muted">${esc(m.message.slice(0, 80))}</span></span><small>${ago(m.createdAt)}</small></li>`).join('')}</ul>` : '<p class="muted" style="margin:0">Aucun message.</p>'}</div>` : ''}
      </div>
      <div class="drawer-f">
        ${id ? `<button class="btn danger ghost" id="cDel" style="margin-right:auto">Supprimer</button><a class="btn" href="mailto:${esc(c.email)}">${I.mail} Écrire</a>` : ''}
        <button class="btn primary" id="cSave">Enregistrer</button>
      </div>`);
    $('#cSave').addEventListener('click', () => {
      const f = $('#cForm'); if (!f.reportValidity()) return;
      const d = Object.fromEntries(new FormData(f));
      const patch = { name: d.name.trim(), phone: d.phone.trim(), notes: d.notes, tags: d.tags.split(',').map(t => t.trim()).filter(Boolean), address: (d.line1 || d.city) ? { line1: d.line1.trim(), line2: '', zip: d.zip.trim(), city: d.city.trim() } : null };
      const job = id ? SC.updateCustomer(id, patch) : SC.addCustomer({ email: d.email, ...patch });
      act(job, 'Client enregistré', (c2) => { route(); if (c2) clientDrawer(c2.id); });
    });
    if (id) {
      $('#cDel').addEventListener('click', () => { if (confirm(`Supprimer la fiche de ${c.name || c.email} ? Ses commandes restent conservées.`)) { closeDrawer(); act(SC.deleteCustomer(id), 'Client supprimé', route); } });
      $$('[data-o]').forEach(r => r.addEventListener('click', () => orderDrawer(r.dataset.o)));
      $$('[data-m]').forEach(r => r.addEventListener('click', () => messageDrawer(r.dataset.m)));
    }
  }

  function messageDrawer(id) {
    let m = SC.messages().find(x => x.id === id); if (!m) return;
    if (m.status === 'nouveau') { act(SC.updateMessage(id, { status: 'lu' })); counts(); }
    const reply = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent('Re : ' + m.subject + ' — S&C Watches')}&body=${encodeURIComponent(`Bonjour ${m.name.split(' ')[0]},\n\nMerci pour votre message.\n\n\n\nBien à vous,\nS&C Watches\n\n— Votre message du ${dfmt(m.createdAt)} —\n${m.message}`)}`;
    openDrawer(`<div class="drawer-h"><div><span class="muted" style="font-size:12px">${dfmt(m.createdAt, true)}</span><h2>${esc(m.subject)}</h2><div style="margin-top:6px;font-size:13px"><b>${esc(m.name)}</b> <span class="muted">· ${esc(m.email)}</span></div></div><button class="icon-btn" data-close aria-label="Fermer">${I.x}</button></div>
      <div class="drawer-b">
        <div class="msg-body">${esc(m.message)}</div>
        <label>Notes internes<textarea id="mNotes" placeholder="Suite donnée, relance prévue…">${esc(m.notes)}</textarea></label>
        <label class="check"><input type="checkbox" id="mDone" ${m.status === 'traite' ? 'checked' : ''}> Marquer comme traité</label>
      </div>
      <div class="drawer-f">
        <button class="btn danger ghost" id="mDel" style="margin-right:auto">Supprimer</button>
        <button class="btn" id="mClient">Fiche client</button>
        <a class="btn" href="${reply}">${I.mail} Répondre</a>
        <button class="btn primary" id="mSave">Enregistrer</button>
      </div>`);
    $('#mSave').addEventListener('click', () => { closeDrawer(); act(SC.updateMessage(id, { notes: $('#mNotes').value, status: $('#mDone').checked ? 'traite' : 'lu' }), 'Message mis à jour', route); });
    $('#mDel').addEventListener('click', () => { if (confirm('Supprimer définitivement ce message ?')) { closeDrawer(); act(SC.deleteMessage(id), 'Message supprimé', route); } });
    $('#mClient').addEventListener('click', () => { const c = SC.customers().find(x => x.email === m.email); if (c) clientDrawer(c.id); });
  }

  function productDrawer(id) {
    const p = id ? SC.product(id) : { id: '', name: 'S&C ', price: 0, stock: 0, active: false, badge: 'Disponible', category: 'Classique', image: 'assets/img/', short: '', description: '', specs: {} };
    if (!p) return;
    const specsTxt = Object.entries(p.specs || {}).map(([k, v]) => `${k} : ${v}`).join('\n');
    openDrawer(`<div class="drawer-h"><div><span class="muted" style="font-size:12px">${id ? 'Modifier le modèle' : 'Nouveau modèle'}</span><h2>${esc(id ? p.name : 'Nouveau modèle')}</h2></div><button class="icon-btn" data-close aria-label="Fermer">${I.x}</button></div>
      <div class="drawer-b">
        <form id="pForm" class="fgrid">
          <div class="full" style="display:flex;gap:16px;align-items:center"><img id="pPrev" class="thumb" style="width:80px;height:96px" src="${esc(img(p.image))}" alt=""><label style="flex:1">Image (chemin ou URL)<input name="image" value="${esc(p.image)}" required><span class="hint">Ex. assets/img/eclipse.jpg — déposez la photo dans le dossier assets/img du site.</span></label></div>
          <label>Nom<input name="name" value="${esc(p.name)}" required></label>
          <label>Prix (€)<input type="number" name="price" min="0" step="1" value="${esc(p.price)}" required></label>
          <label>Stock<input type="number" name="stock" min="0" step="1" value="${esc(p.stock)}" required></label>
          <label>Catégorie<input name="category" value="${esc(p.category || '')}"></label>
          <label class="full">Badge affiché<input name="badge" value="${esc(p.badge || '')}" placeholder="Disponible, Édition numérotée, Nouveau…"></label>
          <label class="full">Accroche (cartes)<textarea name="short" style="min-height:64px" required>${esc(p.short)}</textarea></label>
          <label class="full">Description (fiche produit)<textarea name="description">${esc(p.description)}</textarea></label>
          <label class="full">Caractéristiques <span class="hint">une par ligne, au format « Nom : valeur »</span><textarea name="specs">${esc(specsTxt)}</textarea></label>
          <label class="check full"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Afficher ce modèle sur le site</label>
        </form>
      </div>
      <div class="drawer-f">
        ${id ? `<button class="btn danger ghost" id="pDel" style="margin-right:auto">Supprimer</button><a class="btn" href="../montre.html?id=${encodeURIComponent(id)}" target="_blank">${I.ext} Voir</a>` : ''}
        <button class="btn primary" id="pSave">Enregistrer</button>
      </div>`);
    $('#pForm [name=image]').addEventListener('input', e => { $('#pPrev').src = img(e.target.value); });
    $('#pSave').addEventListener('click', () => {
      const f = $('#pForm'); if (!f.reportValidity()) return;
      const d = Object.fromEntries(new FormData(f));
      const specs = {}; d.specs.split('\n').forEach(line => { const i = line.indexOf(':'); if (i > 0) specs[line.slice(0, i).trim()] = line.slice(i + 1).trim(); });
      let pid = id;
      if (!pid) {
        pid = d.name.toLowerCase().replace(/^s&c\s*/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'modele';
        while (SC.product(pid)) pid += '-2';
      }
      closeDrawer();
      act(SC.saveProduct({ id: pid, name: d.name.trim(), price: +d.price, stock: Math.max(0, +d.stock | 0), category: d.category.trim(), badge: d.badge.trim(), image: d.image.trim(), short: d.short.trim(), description: d.description.trim(), specs, active: !!d.active }), 'Modèle enregistré', route);
    });
    if (id) $('#pDel').addEventListener('click', () => { if (confirm(`Supprimer « ${p.name} » du catalogue ? Les commandes existantes sont conservées. (Pour le retirer temporairement, décochez plutôt « Afficher sur le site ».)`)) { closeDrawer(); act(SC.deleteProduct(id), 'Modèle supprimé', route); } });
  }

  $('#drawerBg').addEventListener('click', closeDrawer);

  /* =================== Démarrage =================== */
  // Nouvelles commandes / messages : rechargement automatique au retour sur l'onglet et toutes les 2 minutes.
  if (REMOTE) {
    window.addEventListener('focus', () => refreshData());
    setInterval(() => { if (document.visibilityState === 'visible') refreshData(); }, 120000);
  } else {
    window.addEventListener('storage', e => { if (e.key === 'sc_watches_db_v1') refreshData(); });
  }

  (async function boot() {
    try { await SC.ready(); } catch (e) { return renderLogin('Connexion à la base impossible : ' + e.message); }
    if (await SC.auth.isLogged()) enter(); else renderLogin();
  })();
})();
