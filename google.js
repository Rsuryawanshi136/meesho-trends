// BuyerMind Google Shopping report: typical prices, discounts and stores from data/google.json.
(() => {
  const state = { category: 'All', sort: 'cheap', data: null, meesho: {} };
  const fmt = new Intl.NumberFormat('en-IN');
  const rupee = (v) => '₹' + fmt.format(Math.round(Number(v)));
  const $ = (id) => document.getElementById(id);
  const quantile = (arr, f) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) * f)] : null; };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const scoped = () => {
    const cats = state.data.categories.filter((c) => state.category === 'All' || c.category === state.category);
    return cats.flatMap((c) => c.products.map((p) => ({ ...p, category: c.category })));
  };
  const discountOf = (p) => (p.was && p.was > p.price ? (p.was - p.price) / p.was : 0);

  function renderPrices() {
    const rows = scoped();
    const prices = rows.map((p) => p.price);
    const typical = quantile(prices, 0.5);
    const lo = quantile(prices, 0.1), hi = quantile(prices, 0.9);
    $('scope').textContent = state.category === 'All' ? 'All categories' : state.category;
    $('k-price').textContent = rupee(typical);
    $('k-delta').textContent = `${rows.length} listings`;
    const pos = hi > lo ? ((typical - lo) / (hi - lo)) * 100 : 50;
    $('range-fill').style.width = clamp(pos, 8, 100) + '%';
    $('range-mark').style.left = `calc(${clamp(pos, 8, 100)}% - 1px)`;
    $('range-lo').textContent = rupee(lo);
    $('range-hi').textContent = rupee(hi);
    $('range-note').textContent = `Half of these listings cost ${rupee(quantile(prices, 0.25))}–${rupee(quantile(prices, 0.75))}.`;

    const disc = rows.filter((p) => discountOf(p) > 0);
    $('t-disc').textContent = Math.round((disc.length / Math.max(1, rows.length)) * 100) + '%';
    $('t-disc-note').textContent = disc.length ? `average ${Math.round((disc.reduce((s, p) => s + discountOf(p), 0) / disc.length) * 100)}% off the shown old price` : 'none shown today';

    const m = state.category === 'All' ? quantile(Object.values(state.meesho), 0.5) : state.meesho[state.category];
    if (m && typical) {
      const ratio = typical / m;
      $('t-meesho').textContent = ratio >= 1.05 ? ratio.toFixed(1) + '× higher' : ratio <= 0.95 ? (1 / ratio).toFixed(1) + '× lower' : 'About the same';
      $('t-meesho-note').textContent = `Meesho's typical price is ${rupee(m)}`;
    } else {
      $('t-meesho').textContent = '—';
      $('t-meesho-note').textContent = 'Meesho data not available';
    }
  }

  function bar(fraction) {
    const b = el('div', 'item-bar');
    const f = el('i');
    f.style.width = Math.max(3, fraction * 100) + '%';
    b.append(f);
    return b;
  }

  function renderStores() {
    const counts = {};
    for (const p of scoped()) if (p.store) counts[p.store] = (counts[p.store] || 0) + 1;
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    const list = $('store-list');
    list.replaceChildren();
    if (!rows.length) { list.append(el('li', 'empty', 'No store names read for this category.')); return; }
    for (const [name, n] of rows) {
      const li = el('li', 'gbar');
      const top = el('div', 'gbar-row');
      top.append(el('span', '', name), el('b', '', `${n} ${n === 1 ? 'listing' : 'listings'}`));
      li.append(top, bar(n / max));
      list.append(li);
    }
  }

  function renderCats() {
    const list = $('cat-list');
    list.replaceChildren();
    const rows = state.data.categories.map((c) => ({ category: c.category, typical: quantile(c.products.map((p) => p.price), 0.5), n: c.products.length }))
      .filter((c) => c.n).sort((a, b) => b.typical - a.typical);
    for (const c of rows) {
      const li = el('li');
      const b = el('button', 'lrow');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.category === c.category));
      const body = el('span', 'lrow-body');
      const m = state.meesho[c.category];
      body.append(el('b', '', c.category), el('span', '', m ? `Meesho ${rupee(m)}` : `${c.n} listings`));
      b.append(body, el('span', 'lrow-val', rupee(c.typical)));
      b.addEventListener('click', () => setCategory(state.category === c.category ? 'All' : c.category));
      li.append(b);
      list.append(li);
    }
  }

  function renderRows() {
    document.querySelectorAll('#seg button').forEach((b) => {
      const on = b.dataset.sort === state.sort;
      b.setAttribute('aria-selected', String(on));
      if (on) $('seg').dataset.active = b.dataset.idx;
    });
    let rows = scoped();
    if (state.sort === 'cheap') {
      rows = rows.sort((a, b) => a.price - b.price);
      $('list-note').textContent = 'Lowest prices listed today. A very low price can also mean a smaller or different product.';
    } else if (state.sort === 'disc') {
      rows = rows.filter((p) => discountOf(p) > 0).sort((a, b) => discountOf(b) - discountOf(a));
      $('list-note').textContent = 'Biggest cuts from the old price shown by the store. Sellers set those old prices, so treat them with care.';
    } else {
      rows = rows.filter((p) => p.rating).sort((a, b) => b.rating - a.rating);
      $('list-note').textContent = 'Highest star ratings. Few listings show ratings here, and a rating from a handful of buyers means little.';
    }
    const list = $('rows');
    list.replaceChildren();
    if (!rows.length) { list.append(el('li', 'empty', 'Nothing to show for this view today.')); return; }
    rows.slice(0, 10).forEach((p, i) => {
      const li = el('li', 'grow-row');
      li.style.setProperty('--i', i);
      const a = el('a', 'lrow');
      a.href = 'https://www.google.com/search?udm=28&gl=in&hl=en&q=' + encodeURIComponent(p.name);
      a.target = '_blank';
      a.rel = 'noopener';
      a.setAttribute('aria-label', `${p.name}, ${rupee(p.price)}, search on Google Shopping`);
      const body = el('span', 'lrow-body');
      const bits = [p.store, state.category === 'All' ? p.category : null].filter(Boolean).join(' · ');
      body.append(el('b', '', p.name), el('span', '', bits));
      const val = el('span', 'lrow-val', rupee(p.price));
      if (state.sort === 'disc') val.append(el('small', '', Math.round(discountOf(p) * 100) + '% off'));
      if (state.sort === 'rated') val.append(el('small', '', p.rating.toFixed(1) + ' ★' + (p.rating_count ? ` (${p.rating_count})` : '')));
      a.append(body, val);
      li.append(a);
      list.append(li);
    });
  }

  function render() {
    renderPrices();
    renderStores();
    renderCats();
    renderRows();
  }

  function setCategory(c) {
    state.category = c;
    $('category').value = c;
    history.replaceState(null, '', c === 'All' ? '#' : '#' + encodeURIComponent(c));
    render();
  }

  document.querySelectorAll('#seg button').forEach((b) => b.addEventListener('click', () => { state.sort = b.dataset.sort; renderRows(); }));

  async function start() {
    try {
      const bust = '?v=' + Date.now().toString(36);
      const [data, products] = await Promise.all([
        fetch('data/google.json' + bust).then((r) => { if (!r.ok) throw new Error('google ' + r.status); return r.json(); }),
        fetch('data/products.json' + bust).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);
      state.data = data;
      const day = products.reduce((m, p) => (p.date > m ? p.date : m), '');
      for (const c of data.categories) {
        const m = quantile(products.filter((p) => p.date === day && p.category === c.category).map((p) => Number(p.price)), 0.5);
        if (m) state.meesho[c.category] = m;
      }
      const d = new Date(data.date + 'T00:00:00Z');
      const total = data.categories.reduce((s, c) => s + c.products.length, 0);
      $('updated').textContent = `Updated ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'UTC' })} · ${total} listings`;
      $('terms').textContent = data.categories.map((c) => `"${c.query}"`).join(', ');
      const sel = $('category');
      sel.replaceChildren(new Option('All categories', 'All'), ...data.categories.map((c) => new Option(c.category, c.category)));
      const wanted = decodeURIComponent(location.hash.slice(1));
      if (data.categories.some((c) => c.category === wanted)) state.category = wanted;
      sel.value = state.category;
      sel.addEventListener('change', () => setCategory(sel.value));
      render();
    } catch (err) {
      $('updated').textContent = 'The data could not be loaded. Try refreshing the page.';
      console.error(err);
    }
  }
  start();
})();
