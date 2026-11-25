/* =========================================================
   S&C Watches — couche de données partagée (site + CRM)

   Deux modes, choisis automatiquement :
   - EN LIGNE (Supabase) si assets/js/config.js est rempli :
     les commandes, clients et messages sont enregistrés sur
     le serveur et visibles depuis n'importe quel appareil.
   - LOCAL sinon : tout reste dans ce navigateur (pour tester).

   Lectures : synchrones, depuis un cache chargé par SC.ready().
   Écritures : asynchrones (renvoient une Promise).
   ========================================================= */
(function () {
  const KEY = 'sc_watches_db_v1';
  const cfg = window.SC_CONFIG || {};
  const MODE = cfg.supabaseUrl && cfg.supabaseAnonKey ? 'remote' : 'local';
  const sb = MODE === 'remote' && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  const STATUSES = {
    en_attente:  { label: 'En attente de paiement', tone: 'warn' },
    payee:       { label: 'Payée',                  tone: 'info' },
    preparation: { label: 'En préparation',         tone: 'info' },
    expediee:    { label: 'Expédiée',               tone: 'ok'   },
    livree:      { label: 'Livrée',                 tone: 'ok'   },
    annulee:     { label: 'Annulée',                tone: 'bad'  },
  };
  const STATUS_FLOW = ['en_attente', 'payee', 'preparation', 'expediee', 'livree'];

  const DEFAULT_SETTINGS = {
    shipping: 5,
    contactEmail: 'SCWatchesofficial@gmail.com',
    instagram: 'scwatchesofficial',
    address: 'Annecy-le-Vieux, 74940, France',
    stripeLinks: {},
  };

  function seedProducts() {
    return [
      {
        id: 'finesse', name: 'S&C Finesse', price: 145, stock: 12, active: true, sort: 1,
        badge: 'Disponible', category: 'Classique', image: 'assets/img/finesse.jpg',
        short: 'Boîtier rectangulaire en acier 316L satiné, cadran argent guilloché soleil à chiffres romains.',
        description: "La Finesse revisite l'élégance des montres rectangulaires d'antan. Son boîtier en acier 316L satiné encadre un cadran argent guilloché, ponctué d'un guichet date et d'une petite seconde. Portée sur un bracelet en cuir noir texture croco, elle accompagne aussi bien un costume qu'une chemise ouverte.",
        specs: { 'Boîtier': 'Acier 316L satiné, rectangulaire', 'Cadran': 'Argent guilloché, guichet date', 'Verre': 'Traité anti-reflets', 'Bracelet': 'Cuir noir texture croco' },
      },
      {
        id: 'celeste-date', name: 'S&C Céleste Date', price: 195, stock: 8, active: true, sort: 2,
        badge: 'Disponible', category: 'Classique', image: 'assets/img/celeste-date.jpg',
        short: 'Montre ronde en acier massif à lunette cannelée, cadran argent météorite texturé, jour et date.',
        description: "La Céleste Date affiche un cadran argent à texture météorite, sublimé par une lunette cannelée qui capte chaque reflet. Mouvement automatique, guichets jour et date : une pièce de caractère pensée pour durer.",
        specs: { 'Boîtier': 'Acier massif, rond', 'Lunette': 'Cannelée polie', 'Cadran': 'Argent texture météorite, jour & date', 'Mouvement': 'Automatique', 'Bracelet': 'Acier' },
      },
      {
        id: 'eclipse', name: 'S&C Eclipse', price: 240, stock: 5, active: true, sort: 3,
        badge: 'Édition numérotée', category: 'Sport chic', image: 'assets/img/eclipse.jpg',
        short: 'Icône contemporaine au boîtier octogonal adouci, cadran noir guilloché à rayures horizontales.',
        description: "L'Eclipse est notre pièce signature. Son boîtier octogonal aux angles adoucis et son bracelet intégré dessinent une silhouette sport chic, tandis que le cadran noir guilloché à rayures horizontales joue avec la lumière. Chaque exemplaire est numéroté.",
        specs: { 'Boîtier': 'Acier 316L brossé et poli, octogonal', 'Cadran': 'Noir guilloché à rayures, guichet date', 'Verre': 'Traité anti-reflets', 'Bracelet': 'Acier intégré', 'Série': 'Édition numérotée' },
      },
    ];
  }
  const seed = () => ({ version: 2, products: seedProducts(), orders: [], customers: [], messages: [], settings: { ...DEFAULT_SETTINGS, adminHash: null }, log: [] });

  /* ---------- Outils ---------- */
  let db = null;
  const now = () => new Date().toISOString();
  const norm = (s) => String(s || '').trim().toLowerCase();
  const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function persist() { if (MODE === 'local') { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('Sauvegarde impossible', e); } } }
  function readLocal() { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function logLocal(text) { db.log.unshift({ at: now(), text }); db.log = db.log.slice(0, 200); }

  // Conversion objets JS (camelCase) <-> lignes SQL (snake_case)
  const snake = (k) => k === 'short' ? 'short_text' : k.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
  const camel = (k) => k === 'short_text' ? 'short' : k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const toRow = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [snake(k), v]));
  const fromRow = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [camel(k), v]));
  const numify = (o, keys) => { keys.forEach(k => { if (o[k] != null) o[k] = Number(o[k]); }); return o; };
  const PRODUCT_COLS = ['id', 'name', 'price', 'stock', 'active', 'badge', 'category', 'image', 'short', 'description', 'specs', 'sort'];
  const ORDER_COLS = ['id', 'ref', 'createdAt', 'customerId', 'customer', 'address', 'lines', 'subtotal', 'shipping', 'total', 'status', 'tracking', 'notes', 'history'];
  const CUSTOMER_COLS = ['id', 'email', 'name', 'phone', 'address', 'tags', 'notes', 'source', 'createdAt', 'updatedAt'];
  const MESSAGE_COLS = ['id', 'name', 'email', 'subject', 'message', 'createdAt', 'status', 'notes'];
  const pick = (o, cols) => Object.fromEntries(cols.filter(c => o[c] !== undefined).map(c => [c, o[c]]));
  const fromProduct = (r) => numify(fromRow(r), ['price', 'stock']);
  const fromOrder = (r) => { const o = numify(fromRow(r), ['subtotal', 'shipping', 'total']); o.lines = (o.lines || []).map(l => ({ ...l, price: Number(l.price), qty: Number(l.qty) })); o.tracking = o.tracking || { carrier: '', number: '' }; o.history = o.history || []; return o; };
  const fromCustomer = (r) => { const c = fromRow(r); c.tags = c.tags || []; return c; };

  function check(res) {
    if (res.error) {
      const m = res.error.message || 'Erreur serveur';
      if (/JWT|session|not authorized|permission|row-level/i.test(m)) throw new Error("Accès refusé : reconnectez-vous au CRM.");
      throw new Error(m);
    }
    return res.data;
  }
  function needSb() { if (!sb) throw new Error('Connexion à la base de données impossible (vérifiez votre connexion internet).'); }
  // Écrit sur le serveur en mode en ligne ; ne fait que persister en mode local.
  async function remote(fn) { if (MODE === 'local') { persist(); return; } needSb(); return check(await fn()); }

  function upsertCustomerLocal(data, source) {
    const email = norm(data.email);
    if (!email) return null;
    let c = db.customers.find(x => x.email === email);
    if (!c) { c = { id: uuid(), email, name: '', phone: '', address: null, tags: [], notes: '', source, createdAt: now() }; db.customers.push(c); }
    if (data.name) c.name = data.name;
    if (data.phone) c.phone = data.phone;
    if (data.address) c.address = data.address;
    c.updatedAt = now();
    return c;
  }
  function newRefLocal() { let ref; do { ref = 'SC-' + Math.floor(100000 + Math.random() * 900000); } while (db.orders.some(o => o.ref === ref)); return ref; }
  function adjustStockCache(lines, sign) { lines.forEach(l => { const p = db.products.find(x => x.id === l.productId); if (p) p.stock = Math.max(0, p.stock + sign * l.qty); }); }

  /* ---------- Chargement ---------- */
  async function loadRemote(admin) {
    needSb();
    db = db || { products: [], orders: [], customers: [], messages: [], settings: { ...DEFAULT_SETTINGS }, log: [] };
    const [p, s] = await Promise.all([
      sb.from('products').select('*').order('sort').order('created_at'),
      sb.from('settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    db.products = check(p).map(fromProduct);
    const st = check(s);
    if (st) { const x = fromRow(st); delete x.id; db.settings = { ...DEFAULT_SETTINGS, ...x, stripeLinks: x.stripeLinks || {} }; }
    if (admin) {
      const [o, c, m, l] = await Promise.all([
        sb.from('orders').select('*').order('created_at', { ascending: false }),
        sb.from('customers').select('*').order('created_at', { ascending: false }),
        sb.from('messages').select('*').order('created_at', { ascending: false }),
        sb.from('activity_log').select('at,text').order('at', { ascending: false }).limit(200),
      ]);
      db.orders = check(o).map(fromOrder);
      db.customers = check(c).map(fromCustomer);
      db.messages = check(m).map(fromRow);
      db.log = check(l);
    }
  }

  /* ---------- Données de démonstration ---------- */
  function buildDemo() {
    const first = ['Camille', 'Hugo', 'Léa', 'Thomas', 'Manon', 'Lucas', 'Chloé', 'Nathan', 'Inès', 'Julien', 'Sarah', 'Maxime'];
    const last = ['Martin', 'Bernard', 'Dubois', 'Durand', 'Lefèvre', 'Moreau', 'Girard', 'Roux', 'Fournier', 'Mercier'];
    const cities = [['Annecy', '74000'], ['Lyon', '69002'], ['Paris', '75011'], ['Chambéry', '73000'], ['Grenoble', '38000'], ['Bordeaux', '33000'], ['Annemasse', '74100']];
    const rnd = a => a[Math.floor(Math.random() * a.length)];
    const products = db.products.filter(p => p.active);
    const out = { customers: [], orders: [], messages: [] };
    const tag = Date.now().toString(36).slice(-4);
    for (let i = 0; i < 26; i++) {
      const fn = rnd(first), ln = rnd(last), [city, zip] = rnd(cities);
      const email = `${norm(fn)}.${norm(ln)}.${tag}${i}@exemple.fr`.normalize('NFD').replace(/[̀-ͯ]/g, '');
      const p = rnd(products);
      const qty = Math.random() < 0.85 ? 1 : 2;
      const date = new Date(Date.now() - Math.floor(Math.random() * 45) * 864e5 - Math.floor(Math.random() * 8e7));
      const address = { line1: `${1 + Math.floor(Math.random() * 90)} rue des Horlogers`, line2: '', zip, city };
      const phone = '06 ' + String(Math.floor(10000000 + Math.random() * 89999999)).replace(/(\d\d)(?=\d)/g, '$1 ');
      const c = { id: uuid(), email, name: `${fn} ${ln}`, phone, address, tags: i < 3 ? ['VIP'] : [], notes: '', source: 'demo', createdAt: date.toISOString(), updatedAt: date.toISOString() };
      out.customers.push(c);
      const ageDays = (Date.now() - date) / 864e5;
      const status = ageDays > 12 ? (Math.random() < 0.08 ? 'annulee' : 'livree') : ageDays > 6 ? 'expediee' : ageDays > 2 ? rnd(['payee', 'preparation']) : rnd(['en_attente', 'payee']);
      const history = [{ status: 'en_attente', at: date.toISOString(), note: 'Commande créée sur le site' }];
      const idx = STATUS_FLOW.indexOf(status);
      for (let k = 1; k <= idx; k++) history.push({ status: STATUS_FLOW[k], at: new Date(+date + k * 864e5 * 1.5).toISOString(), note: '' });
      if (status === 'annulee') history.push({ status: 'annulee', at: new Date(+date + 864e5).toISOString(), note: 'Annulée à la demande du client' });
      const subtotal = p.price * qty, shipping = Number(db.settings.shipping) || 0;
      out.orders.push({
        id: uuid(), ref: 'SC-' + Math.floor(100000 + Math.random() * 900000), createdAt: date.toISOString(), customerId: c.id,
        customer: { name: c.name, email, phone }, address,
        lines: [{ productId: p.id, name: p.name, price: p.price, qty, image: p.image }],
        subtotal, shipping, total: subtotal + shipping, status,
        tracking: idx >= 3 ? { carrier: 'Colissimo', number: '6A' + Math.floor(1e10 + Math.random() * 9e10) } : { carrier: '', number: '' },
        notes: '', history,
      });
      if (i % 4 === 0) out.messages.push({
        id: uuid(), name: c.name, email, subject: rnd(['Demande générale', p.name, 'Service après-vente']),
        message: rnd(['Bonjour, est-il possible de graver le fond de boîte ? Merci !', 'Quel est le délai de livraison pour Lyon ?', 'Le bracelet est-il ajustable en boutique ?', "Bonjour, je souhaiterais offrir l'Eclipse pour un anniversaire, proposez-vous un écrin cadeau ?"]),
        createdAt: new Date(+date + 3600e3).toISOString(), status: rnd(['nouveau', 'traite']), notes: '',
      });
    }
    const seen = new Set(db.orders.map(o => o.ref));
    out.orders.forEach(o => { while (seen.has(o.ref)) o.ref = 'SC-' + Math.floor(100000 + Math.random() * 900000); seen.add(o.ref); });
    return out;
  }

  /* ---------- Authentification ---------- */
  async function hash(text) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sc-watches::' + text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381; for (const ch of 'sc-watches::' + text) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return 'x' + (h >>> 0).toString(16);
  }
  const sessGet = () => { try { return sessionStorage.getItem('sc_admin'); } catch (e) { return null; } };
  const sessSet = (v) => { try { v ? sessionStorage.setItem('sc_admin', v) : sessionStorage.removeItem('sc_admin'); } catch (e) { /* */ } };

  const auth = {
    mode: MODE,
    needsSetup() { return MODE === 'local' && !(db && db.settings.adminHash); },
    async isLogged() {
      if (MODE === 'local') return !!(db && db.settings.adminHash) && sessGet() === db.settings.adminHash;
      if (!sb) return false;
      const { data } = await sb.auth.getSession();
      if (!data.session) return false;
      const r = await sb.rpc('is_admin');
      return !r.error && r.data === true;
    },
    async email() { if (MODE === 'local' || !sb) return ''; const { data } = await sb.auth.getSession(); return data.session ? data.session.user.email : ''; },
    async setup(pw) { if (MODE !== 'local') throw new Error('Non disponible'); const h = await hash(pw); db.settings.adminHash = h; persist(); sessSet(h); },
    async signIn(email, pw) {
      if (MODE === 'local') { const h = await hash(pw); if (h !== db.settings.adminHash) throw new Error('Mot de passe incorrect.'); sessSet(h); return; }
      needSb();
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) throw new Error(/invalid/i.test(error.message) ? 'E-mail ou mot de passe incorrect.' : error.message);
      const r = await sb.rpc('is_admin');
      if (r.error || r.data !== true) { await sb.auth.signOut(); throw new Error("Ce compte n'est pas autorisé à accéder au CRM (ajoutez son e-mail dans la table « admins »)."); }
    },
    async signOut() { sessSet(null); if (MODE === 'remote' && sb) await sb.auth.signOut(); },
    async changePassword(current, next) {
      if (MODE === 'local') {
        if (await hash(current) !== db.settings.adminHash) throw new Error('Mot de passe actuel incorrect.');
        const h = await hash(next); db.settings.adminHash = h; persist(); sessSet(h); return;
      }
      needSb();
      const email = await auth.email();
      const chk = await sb.auth.signInWithPassword({ email, password: current });
      if (chk.error) throw new Error('Mot de passe actuel incorrect.');
      const { error } = await sb.auth.updateUser({ password: next });
      if (error) throw new Error(error.message);
    },
  };

  /* ---------- API publique ---------- */
  const api = {
    STATUSES, STATUS_FLOW, mode: MODE, auth,

    /** Charge les données. { admin: true } charge aussi commandes, clients, messages. */
    async ready(opts = {}) {
      if (MODE === 'local') { db = readLocal() || db; if (!db) { db = seed(); persist(); } return; }
      await loadRemote(!!opts.admin);
    },
    refresh(opts) { return api.ready(opts); },

    /* ----- Produits ----- */
    products(all) { return db.products.filter(p => all || p.active); },
    product(id) { return db.products.find(p => p.id === id) || null; },
    async saveProduct(p) {
      const i = db.products.findIndex(x => x.id === p.id);
      if (i >= 0) db.products[i] = { ...db.products[i], ...p };
      else db.products.push({ active: true, stock: 0, specs: {}, sort: db.products.length + 1, ...p });
      const full = db.products.find(x => x.id === p.id);
      if (MODE === 'local') logLocal(`Produit « ${p.name} » enregistré`);
      await remote(() => sb.from('products').upsert(toRow(pick(full, PRODUCT_COLS))));
      return full;
    },
    async deleteProduct(id) { db.products = db.products.filter(p => p.id !== id); await remote(() => sb.from('products').delete().eq('id', id)); },

    /* ----- Commandes ----- */
    async createOrder({ items, customer, address }) {
      if (MODE === 'remote') {
        needSb();
        const r = check(await sb.rpc('create_order', { p_items: items, p_customer: customer, p_address: address }));
        return { id: r.id, ref: r.ref, total: Number(r.total), customer: { email: r.email } };
      }
      const lines = items.map(it => {
        const p = db.products.find(x => x.id === it.productId && x.active);
        if (!p) throw new Error("Ce modèle n'est plus disponible");
        const qty = Math.max(1, Math.min(10, it.qty | 0));
        if (p.stock < qty) throw new Error('Stock insuffisant pour ' + p.name);
        return { productId: p.id, name: p.name, price: p.price, qty, image: p.image };
      });
      const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
      const shipping = Number(db.settings.shipping) || 0;
      const c = upsertCustomerLocal({ ...customer, address }, 'commande');
      const order = {
        id: uuid(), ref: newRefLocal(), createdAt: now(),
        customerId: c && c.id, customer: { name: customer.name, email: norm(customer.email), phone: customer.phone || '' },
        address, lines, subtotal, shipping, total: subtotal + shipping,
        status: 'en_attente', tracking: { carrier: '', number: '' }, notes: '',
        history: [{ status: 'en_attente', at: now(), note: 'Commande créée sur le site' }],
      };
      adjustStockCache(lines, -1);
      db.orders.unshift(order);
      logLocal(`Nouvelle commande ${order.ref} — ${order.total} €`);
      persist();
      return order;
    },
    orders() { return db.orders; },
    order(id) { return db.orders.find(o => o.id === id || o.ref === id) || null; },
    async findOrder(ref, email) {
      if (MODE === 'remote') {
        needSb();
        const r = check(await sb.rpc('track_order', { p_ref: String(ref || ''), p_email: String(email || '') }));
        return r ? fromOrder(r) : null;
      }
      const r2 = String(ref || '').trim().toUpperCase();
      return db.orders.find(o => o.ref === r2 && o.customer.email === norm(email)) || null;
    },
    async updateOrder(id, patch, note) {
      const o = db.orders.find(x => x.id === id);
      if (!o) return null;
      if (patch.status && patch.status !== o.status) {
        if (patch.status === 'annulee') adjustStockCache(o.lines, +1);
        if (o.status === 'annulee') adjustStockCache(o.lines, -1);
        o.history.push({ status: patch.status, at: now(), note: note || '' });
        if (MODE === 'local') logLocal(`Commande ${o.ref} : ${STATUSES[patch.status].label}`);
      }
      Object.assign(o, patch);
      await remote(() => sb.from('orders').update(toRow(pick(o, ['status', 'tracking', 'notes', 'history']))).eq('id', id));
      return o;
    },
    async deleteOrder(id) { db.orders = db.orders.filter(o => o.id !== id); await remote(() => sb.from('orders').delete().eq('id', id)); },

    /* ----- Clients ----- */
    customers() {
      return db.customers.map(c => {
        const orders = db.orders.filter(o => o.customer.email === c.email);
        const valid = orders.filter(o => o.status !== 'annulee' && o.status !== 'en_attente');
        return {
          ...c,
          orderCount: orders.length,
          spent: valid.reduce((s, o) => s + o.total, 0),
          lastOrder: orders.length ? orders.map(o => o.createdAt).sort().pop() : null,
          messageCount: db.messages.filter(m => m.email === c.email).length,
        };
      });
    },
    customer(id) { return api.customers().find(c => c.id === id) || null; },
    async updateCustomer(id, patch) {
      const c = db.customers.find(x => x.id === id); if (!c) return null;
      Object.assign(c, patch, { updatedAt: now() });
      await remote(() => sb.from('customers').update(toRow(pick(c, ['name', 'phone', 'address', 'tags', 'notes', 'updatedAt']))).eq('id', id));
      return c;
    },
    async addCustomer(data) {
      const email = norm(data.email);
      if (db.customers.some(x => x.email === email)) throw new Error('Un client avec cet e-mail existe déjà');
      const c = { id: uuid(), email, name: data.name || '', phone: data.phone || '', address: data.address || null, tags: data.tags || [], notes: data.notes || '', source: 'manuel', createdAt: now(), updatedAt: now() };
      db.customers.unshift(c);
      await remote(() => sb.from('customers').insert(toRow(pick(c, CUSTOMER_COLS))));
      return c;
    },
    async deleteCustomer(id) { db.customers = db.customers.filter(c => c.id !== id); await remote(() => sb.from('customers').delete().eq('id', id)); },

    /* ----- Messages ----- */
    async addMessage({ name, email, subject, message }) {
      if (MODE === 'remote') { needSb(); check(await sb.rpc('add_message', { p_name: name, p_email: email, p_subject: subject || '', p_message: message })); return; }
      upsertCustomerLocal({ name, email }, 'contact');
      db.messages.unshift({ id: uuid(), name, email: norm(email), subject: subject || 'Demande générale', message, createdAt: now(), status: 'nouveau', notes: '' });
      logLocal(`Nouveau message de ${name}`);
      persist();
    },
    messages() { return db.messages; },
    async updateMessage(id, patch) {
      const m = db.messages.find(x => x.id === id); if (!m) return null;
      Object.assign(m, patch);
      await remote(() => sb.from('messages').update(toRow(pick(m, ['status', 'notes']))).eq('id', id));
      return m;
    },
    async deleteMessage(id) { db.messages = db.messages.filter(m => m.id !== id); await remote(() => sb.from('messages').delete().eq('id', id)); },

    /* ----- Paramètres ----- */
    settings() { return db.settings; },
    async saveSettings(patch) {
      Object.assign(db.settings, patch);
      const row = toRow(pick(db.settings, ['shipping', 'contactEmail', 'instagram', 'address', 'stripeLinks']));
      await remote(() => sb.from('settings').upsert({ id: 1, ...row }));
      return db.settings;
    },
    log() { return db.log; },

    /* ----- Sauvegarde ----- */
    exportJSON() { const d = clone(db); delete d.settings.adminHash; return JSON.stringify(d, null, 2); },
    async importJSON(text) {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.products) || !Array.isArray(data.orders)) throw new Error('Fichier non reconnu');
      if (MODE === 'local') { const h = db.settings.adminHash; db = { ...seed(), ...data }; db.settings = { ...DEFAULT_SETTINGS, ...data.settings, adminHash: h }; persist(); return; }
      needSb();
      if (data.products.length) check(await sb.from('products').upsert(data.products.map(p => toRow(pick(p, PRODUCT_COLS)))));
      if ((data.customers || []).length) check(await sb.from('customers').upsert(data.customers.map(c => toRow(pick(c, CUSTOMER_COLS))), { onConflict: 'email' }));
      if (data.orders.length) check(await sb.from('orders').upsert(data.orders.map(o => toRow(pick(o, ORDER_COLS)))));
      if ((data.messages || []).length) check(await sb.from('messages').upsert(data.messages.map(m => toRow(pick(m, MESSAGE_COLS)))));
      if (data.settings) await api.saveSettings(pick(data.settings, ['shipping', 'contactEmail', 'instagram', 'address', 'stripeLinks']));
      await loadRemote(true);
    },
    /** Efface commandes, clients et messages (les produits sont conservés). */
    async reset() {
      db.orders = []; db.customers = []; db.messages = []; db.log = [];
      if (MODE === 'local') { persist(); return; }
      needSb();
      check(await sb.from('orders').delete().not('id', 'is', null));
      check(await sb.from('messages').delete().not('id', 'is', null));
      check(await sb.from('customers').delete().not('id', 'is', null));
      check(await sb.from('activity_log').delete().gt('id', 0));
    },
    async loadDemo() {
      const d = buildDemo();
      if (MODE === 'local') {
        db.customers.push(...d.customers); db.orders.push(...d.orders); db.messages.push(...d.messages);
        db.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        db.messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        logLocal('Données de démonstration chargées'); persist(); return;
      }
      needSb();
      check(await sb.from('customers').insert(d.customers.map(c => toRow(pick(c, CUSTOMER_COLS)))));
      check(await sb.from('orders').insert(d.orders.map(o => toRow(pick(o, ORDER_COLS)))));
      check(await sb.from('messages').insert(d.messages.map(m => toRow(pick(m, MESSAGE_COLS)))));
      await loadRemote(true);
    },
  };

  window.SC = api;
})();
