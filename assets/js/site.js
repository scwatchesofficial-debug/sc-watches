/* S&C Watches — logique du site public */
(async function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const page = document.body.dataset.page;
  let loadError = null;
  try { await SC.ready(); } catch (e) { loadError = e; console.error(e); }
  const settings = loadError ? { contactEmail: 'SCWatchesofficial@gmail.com', instagram: 'scwatchesofficial', shipping: 5, stripeLinks: {} } : SC.settings();

  const ICON = {
    arrow: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 8h12M9 3l5 5-5 5"/></svg>',
    pin: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M8 15s5-4.6 5-8.5A5 5 0 0 0 3 6.5C3 10.4 8 15 8 15z"/><circle cx="8" cy="6.5" r="1.8"/></svg>',
    mail: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="3" width="13" height="10" rx="1.5"/><path d="M2 4l6 5 6-5"/></svg>',
    insta: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="1.5" width="13" height="13" rx="3.5"/><circle cx="8" cy="8" r="3"/><circle cx="12" cy="4" r=".6" fill="currentColor"/></svg>',
    check: '<svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3 8.5l3.2 3L13 4.5"/></svg>',
  };

  /* ---------- En-tête & pied de page communs ---------- */
  const links = [['index.html', 'Accueil', 'home'], ['histoire.html', 'Notre histoire', 'histoire'], ['commander.html', 'Commander', 'commander'], ['suivi.html', 'Suivi', 'suivi'], ['contact.html', 'Contact', 'contact']];
  const logo = `<a class="logo" href="index.html" aria-label="S&C Watches — accueil"><span class="logo-mark">S&amp;C</span><span class="logo-text"><b>S&amp;C WATCHES</b><small>ANNECY</small></span></a>`;
  document.body.insertAdjacentHTML('afterbegin', `
    <header class="nav"><div class="nav-inner">
      ${logo}
      <nav class="nav-links" id="navLinks">${links.map(([h, t, k]) => `<a href="${h}" class="${k === page ? 'active' : ''}">${t}</a>`).join('')}</nav>
      <a class="btn nav-cta" href="collection.html">Découvrir la collection</a>
      <button class="burger" aria-label="Menu" aria-expanded="false" id="burger"><svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" stroke-width="1.4"><path d="M3 6h14M3 10h14M3 14h14"/></svg></button>
    </div></header>`);
  $('#burger').addEventListener('click', e => { const o = $('#navLinks').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', o); });

  document.body.insertAdjacentHTML('beforeend', `
    <footer><div class="wrap">
      <div class="foot">
        <div>${logo}<p>Horlogerie d'expression française. Garde-temps façonnés avec exigence à Annecy-le-Vieux, au juste prix du luxe.</p><div class="place">Annecy-le-Vieux — France</div></div>
        <div><h4>Navigation</h4><ul><li><a href="index.html">Accueil</a></li><li><a href="collection.html">La Collection</a></li><li><a href="histoire.html">Notre histoire</a></li><li><a href="suivi.html">Suivre ma commande</a></li><li><a href="contact.html">Contact</a></li></ul></div>
        <div><h4>Suivez-nous</h4><ul><li><a href="https://instagram.com/${esc(settings.instagram)}" target="_blank" rel="noopener" style="display:flex;gap:10px;align-items:center">${ICON.insta.replace('<svg', '<svg width="15" height="15"')} Instagram <span class="muted">@${esc(settings.instagram)}</span></a></li><li><a href="mailto:${esc(settings.contactEmail)}">${esc(settings.contactEmail)}</a></li></ul></div>
      </div>
      <div class="giant" aria-hidden="true">S&amp;C WATCHES</div>
      <div class="legal"><span>© ${new Date().getFullYear()} S&amp;C Watches. Tous droits réservés.</span><span class="legal-links"><a href="mentions-legales.html">Mentions légales &amp; confidentialité</a><a href="cgv.html">CGV</a><a href="cgv.html#retractation">Rétractation</a></span><span>Fabriqué en France</span></div>
    </div></footer>
    <div class="toast" id="toast" role="status"></div>`);

  window.toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2800); };

  /* ---------- Apparition au défilement ---------- */
  function initReveal() {
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 }) : null;
    $$('.reveal:not(.in)').forEach(el => io ? io.observe(el) : el.classList.add('in'));
  }

  /* ---------- Réassurance (uniquement des faits vérifiables) ---------- */
  const ship = Number(settings.shipping) || 0;
  const REASSURE = [
    ['truck', ship ? `Livraison en France : ${eur(ship)}` : 'Livraison offerte en France'],
    ['lock', 'Paiement sécurisé par carte (Stripe)'],
    ['back', "14 jours pour changer d'avis"],
    ['chat', 'Une question ? Réponse personnelle'],
  ];
  const RICON = {
    truck: '<path d="M1.5 4h8v7h-8zM9.5 6.5h3l2 2.5V11h-5"/><circle cx="4.5" cy="12" r="1.3"/><circle cx="11.5" cy="12" r="1.3"/>',
    lock: '<rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/>',
    back: '<path d="M3 6h7a3.5 3.5 0 0 1 0 7H6"/><path d="M5.5 3.5L3 6l2.5 2.5"/>',
    chat: '<path d="M2 3.5h12v8H6l-3 2.5v-2.5H2z"/>',
  };
  const reassureHTML = () => REASSURE.map(([i, t]) => `<li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">${RICON[i]}</svg>${esc(t)}</li>`).join('');
  $$('[data-reassure]').forEach(el => { el.innerHTML = reassureHTML(); });
  $$('[data-shipping]').forEach(el => { el.textContent = ship ? eur(ship) : 'offerts'; });

  const FAQ = [
    ['Combien coûte la livraison ?', `${ship ? 'La livraison coûte ' + eur(ship) : 'La livraison est offerte'} en France. Nous livrons pour l'instant en France uniquement.`],
    ['Le paiement est-il sécurisé ?', 'Oui. Vous réglez par carte bancaire sur la page de paiement de Stripe. Nous ne voyons ni ne conservons jamais vos coordonnées bancaires.'],
    ['Et si la montre ne me plaît pas ?', "Vous disposez de 14 jours après réception pour changer d'avis. Écrivez-nous et nous vous expliquons comment nous la renvoyer. Tous les détails sont dans nos conditions générales de vente (lien en bas de page)."],
    ['Comment suivre ma commande ?', 'Après votre commande, vous recevez un numéro (SC-000000). Avec ce numéro et votre e-mail, la page Suivi vous indique à tout moment où en est votre montre.'],
    ['Pourquoi ces prix ?', "Nous vendons directement depuis notre atelier d'Annecy-le-Vieux, sans boutique ni revendeur entre vous et nous : pas de marge d'intermédiaire à payer."],
  ];
  const faq = $('#faq');
  if (faq) faq.innerHTML = FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');

  /* ---------- Carte produit ---------- */
  function card(p) {
    const out = p.stock <= 0;
    return `<a class="card reveal" href="montre.html?id=${encodeURIComponent(p.id)}">
      <div class="card-media"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"><span class="badge ${out ? 'out' : ''}">${out ? 'Épuisée' : esc(p.badge || 'Disponible')}</span></div>
      <div class="card-title"><h3>${esc(p.name)}</h3><span class="price">${eur(p.price)}</span></div>
      <p>${esc(p.short)}</p>
      <span class="link">Voir la montre ${ICON.arrow.replace('<svg', '<svg width="13" height="13"')}</span>
    </a>`;
  }

  /* ---------- Pages ---------- */
  const pages = {
    home() {
      $('#homeGrid').innerHTML = SC.products().slice(0, 3).map(card).join('');
      $('#ctaNames').textContent = SC.products().map(p => p.name.replace('S&C ', '')).join(' — ');
    },

    collection() {
      const all = SC.products();
      const cats = ['Toutes', ...new Set(all.map(p => p.category).filter(Boolean))];
      const f = $('#filters');
      f.innerHTML = cats.map((c, i) => `<button class="chip ${i ? '' : 'active'}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
      const render = (cat) => { $('#collectionGrid').innerHTML = all.filter(p => cat === 'Toutes' || p.category === cat).map(card).join(''); initReveal(); };
      f.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; $$('.chip', f).forEach(x => x.classList.toggle('active', x === b)); render(b.dataset.cat); });
      render('Toutes');
    },

    produit() {
      const id = new URLSearchParams(location.search).get('id');
      const p = SC.product(id);
      const root = $('#product');
      if (!p || !p.active) { root.innerHTML = `<div class="success"><h1>Montre introuvable</h1><p class="lead" style="margin:16px auto 30px">Ce modèle n'est plus disponible.</p><a class="btn btn-silver" href="collection.html">Voir la collection</a></div>`; return; }
      document.title = `${p.name} — S&C Watches`;
      const stock = p.stock <= 0 ? '<span class="stock out">Épuisée — contactez-nous pour être prévenu</span>' : p.stock <= 5 ? `<span class="stock low">Plus que ${p.stock} exemplaire${p.stock > 1 ? 's' : ''} disponible${p.stock > 1 ? 's' : ''}</span>` : '<span class="stock">En stock</span>';
      root.innerHTML = `<div class="product">
        <div class="product-media"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>
        <div>
          <a class="link" href="collection.html">← La collection</a>
          <div style="margin-top:28px"><span class="eyebrow">${esc(p.badge || p.category || 'Garde-temps')}</span></div>
          <h1>${esc(p.name)}</h1>
          <div class="price">${eur(p.price)}</div>
          ${stock}
          <p class="desc">${esc(p.description || p.short)}</p>
          <dl class="specs">${Object.entries(p.specs || {}).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            ${p.stock > 0 ? `<a class="btn btn-silver" href="commander.html?modele=${encodeURIComponent(p.id)}">Commander · ${eur(p.price)} ${ICON.arrow}</a>` : ''}
            <a class="btn" href="contact.html?modele=${encodeURIComponent(p.id)}">Poser une question</a>
          </div>
          <ul class="reassure">${reassureHTML()}</ul>`
          + (p.stock > 0 ? `<div class="buy-bar"><div><b>${esc(p.name)}</b><span>${eur(p.price)}</span></div><a class="btn btn-silver" href="commander.html?modele=${encodeURIComponent(p.id)}">Commander</a></div>` : '') + `
        </div></div>`;
    },

    commander() {
      const products = SC.products();
      const sel = $('#model');
      sel.innerHTML = products.map(p => `<option value="${esc(p.id)}" ${p.stock <= 0 ? 'disabled' : ''}>${esc(p.name)} — ${eur(p.price)}${p.stock <= 0 ? ' (épuisée)' : ''}</option>`).join('');
      const wanted = new URLSearchParams(location.search).get('modele');
      const firstOk = products.find(p => p.stock > 0);
      if (wanted && products.some(p => p.id === wanted && p.stock > 0)) sel.value = wanted; else if (firstOk) sel.value = firstOk.id;

      const update = () => {
        const p = SC.product(sel.value); if (!p) return;
        const qtyEl = $('#qty');
        qtyEl.max = Math.max(1, p.stock);
        if (+qtyEl.value > p.stock) qtyEl.value = p.stock;
        const q = Math.max(1, +qtyEl.value || 1), ship = +settings.shipping || 0;
        $('#summary').innerHTML = `<span class="eyebrow plain">Votre commande</span>
          <div class="item"><img src="${esc(p.image)}" alt=""><div><b>${esc(p.name)}</b><span class="muted" style="font-size:13px">${eur(p.price)} × ${q}</span></div></div>
          <div class="lines" style="padding-top:14px"><div><span>Sous-total</span><span>${eur(p.price * q)}</span></div><div><span>Livraison (France)</span><span>${ship ? eur(ship) : 'Offerte'}</span></div><div class="total"><span>Total</span><span>${eur(p.price * q + ship)}</span></div></div>
          <small>Livraison en France uniquement. Les frais peuvent varier selon votre lieu de résidence ; dans ce cas, nous vous contactons avant l'expédition.</small>`;
      };
      sel.addEventListener('change', update); $('#qty').addEventListener('input', update); update();

      $('#orderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.currentTarget, d = Object.fromEntries(new FormData(f));
        const errEl = $('#orderErr'); errEl.textContent = '';
        if (!/^\d{5}$/.test(d.zip.trim())) { errEl.textContent = 'Le code postal doit comporter 5 chiffres (livraison en France).'; return; }
        const btn = $('#payBtn'); btn.disabled = true; btn.textContent = 'Enregistrement…';
        try {
          const order = await SC.createOrder({
            items: [{ productId: d.model, qty: +d.qty }],
            customer: { name: d.name.trim(), email: d.email.trim(), phone: d.phone.trim() },
            address: { line1: d.line1.trim(), line2: d.line2.trim(), zip: d.zip.trim(), city: d.city.trim() },
          });
          const payLink = (SC.settings().stripeLinks || {})[d.model];
          if (payLink) {
            btn.textContent = 'Redirection vers le paiement…';
            const url = new URL(payLink);
            url.searchParams.set('client_reference_id', order.ref);
            url.searchParams.set('prefilled_email', order.customer.email);
            setTimeout(() => { location.href = url.toString(); }, 600);
          } else {
            location.href = `commander.html?ok=${encodeURIComponent(order.ref)}`;
          }
        } catch (err) { errEl.textContent = err.message || "La commande n'a pas pu être enregistrée. Réessayez."; btn.disabled = false; btn.innerHTML = 'Payer par carte'; }
      });

      const ok = new URLSearchParams(location.search).get('ok');
      if (ok) {
        $('#checkoutView').hidden = true;
        $('#successView').hidden = false;
        $('#successRef').textContent = ok;
        $('#successTrack').href = `suivi.html?ref=${encodeURIComponent(ok)}`;
      }
    },

    suivi() {
      const params = new URLSearchParams(location.search);
      if (params.get('ref')) $('#ref').value = params.get('ref');
      $('#trackForm').addEventListener('submit', async e => {
        e.preventDefault();
        const out = $('#trackResult');
        let o;
        try { o = await SC.findOrder($('#ref').value, $('#temail').value); }
        catch (err) { out.innerHTML = `<div class="panel" style="margin-top:30px"><p class="err">Recherche impossible pour le moment. Réessayez dans un instant.</p></div>`; return; }
        if (!o) { out.innerHTML = `<div class="panel" style="margin-top:30px"><p class="err">Aucune commande ne correspond à ce numéro et cet e-mail. Vérifiez le numéro reçu (format SC-000000).</p></div>`; return; }
        const S = SC.STATUSES, idx = SC.STATUS_FLOW.indexOf(o.status);
        out.innerHTML = `<div class="panel" style="margin-top:30px">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px"><div><span class="eyebrow plain">Commande</span><h3 style="margin-top:6px">${esc(o.ref)}</h3></div><div style="text-align:right"><span class="eyebrow plain">Statut</span><h3 style="margin-top:6px">${esc(S[o.status].label)}</h3></div></div>
          ${o.status === 'annulee' ? '<p class="err" style="margin-top:20px">Cette commande a été annulée. Contactez-nous pour toute question.</p>' : `<div class="steps">${['Reçue', 'Payée', 'En préparation', 'Expédiée', 'Livrée'].map((t, i) => `<div class="${i <= idx ? 'done' : ''}">${t}</div>`).join('')}</div>`}
          ${o.tracking && o.tracking.number ? `<p style="margin-top:20px">Transporteur : <b>${esc(o.tracking.carrier || '—')}</b> · N° de suivi : <b>${esc(o.tracking.number)}</b></p>` : ''}
          <div class="lines" style="margin-top:22px;border-top:1px solid var(--line);padding-top:16px;font-size:14px;color:var(--soft)">${o.lines.map(l => `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>${esc(l.name)} × ${l.qty}</span><span>${eur(l.price * l.qty)}</span></div>`).join('')}<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Livraison</span><span>${eur(o.shipping)}</span></div><div style="display:flex;justify-content:space-between;padding:10px 0 0;color:var(--text);font-weight:600"><span>Total</span><span>${eur(o.total)}</span></div></div>
          <p class="muted" style="font-size:12.5px;margin-top:16px">Passée le ${new Date(o.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>`;
      });
    },

    contact() {
      const sel = $('#subject');
      sel.innerHTML = ['Demande générale', ...SC.products(true).map(p => p.name), 'Service après-vente', 'Partenariat / presse'].map(s => `<option>${esc(s)}</option>`).join('');
      const m = SC.product(new URLSearchParams(location.search).get('modele'));
      if (m) sel.value = m.name;
      $('#cEmail').textContent = settings.contactEmail; $('#cEmail').href = 'mailto:' + settings.contactEmail;
      $('#contactForm').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.currentTarget, btn = form.querySelector('button[type=submit]');
        const d = Object.fromEntries(new FormData(form));
        btn.disabled = true;
        try {
          await SC.addMessage({ name: d.name.trim(), email: d.email.trim(), subject: d.subject, message: d.message.trim() });
          form.reset();
          $('#contactOk').hidden = false;
          toast('Message envoyé — merci !');
        } catch (err) {
          toast("Envoi impossible : " + (err.message || 'réessayez'));
        } finally { btn.disabled = false; }
      });
    },
  };

  if (loadError) {
    const target = $('main');
    if (target) target.insertAdjacentHTML('afterbegin', `<div class="wrap"><div class="panel" style="margin-bottom:30px"><p class="err">La boutique est momentanément indisponible. Merci de réessayer dans quelques instants ou de nous écrire à <a href="mailto:${esc(settings.contactEmail)}">${esc(settings.contactEmail)}</a>.</p></div></div>`);
  } else if (pages[page]) {
    try { await pages[page](); } catch (e) { console.error(e); }
  }
  initReveal();
})();
