// Meesho Trend Report: loads the daily data files and renders the Today / All-time views.
(() => {
  const CATEGORIES = [
    "Women's ethnic", "Women's western", "Men's clothing", 'Kids & toys', 'Home & kitchen',
    'Beauty & personal care', 'Jewellery', 'Bags & footwear', 'Electronics accessories', 'Health & fitness',
  ];
  const SHORT = { 'Beauty & personal care': 'Beauty', 'Electronics accessories': 'Electronics' };

  const state = { tab: 'today', category: 'All', products: [], analysis: [], day: '', prevDay: '' };

  const fmt = new Intl.NumberFormat('en-IN');
  const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
  const rupee = (v) => '₹' + fmt.format(Math.round(Number(v)));
  const pct = (v) => (v * 100).toFixed(1) + '%';
  const $ = (id) => document.getElementById(id);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---- Data ----
  function prepare() {
    const rows = state.products;
    state.day = rows.reduce((m, p) => (p.date > m ? p.date : m), '');
    state.prevDay = rows.reduce((m, p) => (p.date < state.day && p.date > m ? p.date : m), '');
    const prev = new Map(rows.filter((p) => p.date === state.prevDay).map((p) => [p.pid, Number(p.reviews)]));
    state.today = rows.filter((p) => p.date === state.day).map((p) => ({
      ...p,
      reviews: Number(p.reviews),
      new_reviews: prev.has(p.pid) ? Number(p.reviews) - prev.get(p.pid) : null,
    }));
    state.days = new Set(rows.map((p) => p.date)).size;

    const median = {};
    for (const c of CATEGORIES) {
      const v = state.today.filter((p) => p.category === c).map((p) => p.reviews).sort((a, b) => a - b);
      median[c] = v[Math.floor(v.length / 2)];
    }
    state.rising = state.today
      .filter((p) => Number(p.listing_rank) <= 10 && p.reviews < median[p.category])
      .sort((a, b) => a.listing_rank - b.listing_rank);
  }

  const inScope = (p) => state.category === 'All' || p.category === state.category;
  const note = (key) => state.analysis.find((r) => r.key === key);

  // ---- Pieces ----
  function photo(p, cls, extra) {
    const box = el('div', cls);
    if (p.image) {
      const img = el('img');
      img.src = p.image;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => img.remove());
      box.append(img);
    }
    if (extra) box.append(extra);
    return box;
  }

  function productCard(p, rank, metric, max, badge) {
    const li = el('li', 'card');
    const a = el('a');
    a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', `${rank ? '#' + rank + ' ' : ''}${p.name}, ${rupee(p.price)}`);
    const ph = photo(p, 'card-photo');
    if (rank) ph.append(el('span', 'rank', '#' + rank));
    if (badge) ph.append(el('span', 'new-badge', badge));
    const body = el('div', 'card-body');
    body.append(el('div', 'card-name', p.name));
    const meta = el('div', 'card-meta');
    meta.append(el('span', 'price', rupee(p.price)), el('span', 'rating', Number(p.rating).toFixed(1) + ' ★'));
    body.append(meta);
    if (metric) {
      const m = el('div', 'metric');
      const row = el('div', 'metric-row');
      row.append(el('span', '', metric.label), el('b', '', metric.text(p)));
      const bar = el('div', 'bar');
      const fill = el('i');
      fill.style.width = Math.max(3, (metric.value(p) / max) * 100) + '%';
      bar.append(fill);
      m.append(row, bar);
      body.append(m);
    }
    body.append(el('div', 'tag', state.category === 'All' ? p.category : p.subcategory));
    a.append(ph, body);
    li.append(a);
    return li;
  }

  function spotlight(p, label, keyStat) {
    const s = $('spotlight');
    s.replaceChildren();
    if (!p) return;
    s.append(photo(p, 'spot-photo', el('span', 'crown', '#1')));
    const body = el('div', 'spot-body');
    body.append(el('div', 'spot-label', label + (state.category === 'All' ? ' · ' + p.category : ' · ' + p.subcategory)));
    body.append(el('div', 'spot-name', p.name));
    const stats = el('div', 'spot-stats');
    const stat = (v, l, cls) => { const d = el('div', cls); d.append(el('b', '', v), el('span', '', l)); stats.append(d); };
    stat(keyStat.text, keyStat.label, 'key');
    stat(rupee(p.price), 'Price');
    stat(Number(p.rating).toFixed(1) + ' ★', 'Rating');
    if (state.tab === 'today') stat(compact.format(p.reviews), 'Total reviews');
    body.append(stats);
    const btn = el('a', 'btn', 'View on Meesho ↗');
    btn.href = p.url; btn.target = '_blank'; btn.rel = 'noopener';
    body.append(btn);
    s.append(body);
  }

  function board(list, rows, valueOf, textOf, isOn, onClick) {
    list.replaceChildren();
    const max = Math.max(1, ...rows.map(valueOf));
    for (const r of rows) {
      const li = el('li', isOn && isOn(r) ? 'on' : '');
      if (onClick) {
        li.classList.add('clickable');
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        li.addEventListener('click', () => onClick(r));
        li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(r); } });
      }
      const row = el('div', 'board-row');
      const name = el('span', '', r.label);
      if (r.sub) name.append(el('small', '', r.sub));
      row.append(name, el('b', '', textOf(r)));
      const bar = el('div', 'bar');
      const fill = el('i');
      fill.style.width = Math.max(2, (valueOf(r) / max) * 100) + '%';
      bar.append(fill);
      li.append(row, bar);
      list.append(li);
    }
  }

  // ---- Render ----
  function renderHeader() {
    const d = new Date(state.day + 'T00:00:00Z');
    $('updated').textContent = 'Updated ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    $('day-label').textContent = `Day ${state.days} of daily research`;
    const overall = note('Overall');
    if (overall) $('takeaway').textContent = overall.text;
    $('stat-products').textContent = fmt.format(state.today.length);
    $('stat-categories').textContent = new Set(state.today.map((p) => p.category)).size;
    $('stat-days').textContent = state.days;

    $('shortlist').replaceChildren(...String(note('Shortlist')?.text || '').split('\n').filter(Boolean).map((t) => el('li', '', t)));
    $('avoid').textContent = note('Avoid')?.text || '';
  }

  function renderChips() {
    const nav = $('chips');
    nav.replaceChildren();
    for (const c of ['All', ...CATEGORIES]) {
      const b = el('button', 'chip', c === 'All' ? 'All categories' : SHORT[c] || c);
      b.setAttribute('aria-pressed', String(state.category === c));
      b.addEventListener('click', () => { state.category = c; save(); render(); });
      nav.append(b);
      if (state.category === c && c !== 'All') requestAnimationFrame(() => nav.scrollTo({ left: b.offsetLeft - 40 }));
    }
  }

  function renderNote() {
    const n = state.category === 'All' ? null : note(state.category);
    $('note').hidden = !n;
    if (!n) return;
    $('note-title').textContent = n.headline;
    $('note-fit').textContent = n.fit_label;
    $('note-fit').className = 'fit ' + n.fit_level;
    $('note-text').textContent = n.text;
  }

  function categoryStats() {
    return CATEGORIES.map((c) => {
      const ps = state.today.filter((p) => p.category === c);
      const known = ps.filter((p) => p.new_reviews != null);
      return {
        label: c, category: c, products: ps.length,
        reviews: ps.reduce((s, p) => s + p.reviews, 0),
        new_reviews: known.length ? known.reduce((s, p) => s + p.new_reviews, 0) : null,
        median_price: ps.map((p) => Number(p.price)).sort((a, b) => a - b)[Math.floor(ps.length / 2)],
      };
    }).filter((r) => r.products);
  }

  function renderView() {
    const today = state.tab === 'today';
    const hasHistory = state.days >= 2;
    const scoped = state.today.filter(inScope);
    const pick = (c) => { state.category = state.category === c.category ? 'All' : c.category; save(); render(); };
    const isOn = (r) => r.category === state.category;

    $('waiting').hidden = !(today && !hasHistory);
    const showRanked = !today || hasHistory;
    $('grid-block').hidden = !showRanked;
    $('board-block').hidden = !showRanked;
    $('types-block').hidden = today;
    $('trend-block').hidden = !today;

    if (today && hasHistory) {
      const ranked = scoped.filter((p) => p.new_reviews > 0).sort((a, b) => b.new_reviews - a.new_reviews);
      const top = ranked.slice(0, 10);
      spotlight(top[0], 'Top seller today', { text: '+' + fmt.format(top[0]?.new_reviews || 0), label: 'New reviews since yesterday' });
      $('grid-title').textContent = 'Top 10 sellers today';
      $('grid-sub').textContent = 'Ranked by new reviews since the previous morning: the best sign of daily sales.';
      fillGrid(top, { label: 'New reviews', text: (p) => '+' + fmt.format(p.new_reviews), value: (p) => p.new_reviews });
      $('board-title').textContent = 'Categories gaining fastest';
      $('board-sub').textContent = 'New reviews since yesterday on each category\'s top listings. Tap one to filter.';
      const cats = categoryStats().filter((r) => r.new_reviews != null).sort((a, b) => b.new_reviews - a.new_reviews);
      board($('board'), cats, (r) => r.new_reviews, (r) => '+' + fmt.format(r.new_reviews), isOn, pick);
    } else if (today) {
      $('spotlight').replaceChildren();
    } else {
      const top = [...scoped].sort((a, b) => b.reviews - a.reviews).slice(0, 10);
      spotlight(top[0], 'Best seller of all time', { text: compact.format(top[0]?.reviews || 0), label: 'Total reviews' });
      $('grid-title').textContent = 'Top 10 best sellers of all time';
      $('grid-sub').textContent = 'Ranked by total reviews. More reviews means more orders over the product\'s lifetime.';
      fillGrid(top, { label: 'Reviews', text: (p) => compact.format(p.reviews), value: (p) => p.reviews });
      $('board-title').textContent = 'Categories by total reviews';
      $('board-sub').textContent = 'Total reviews on each category\'s top listings. Tap one to filter.';
      const cats = categoryStats().sort((a, b) => b.reviews - a.reviews).map((r) => ({ ...r, sub: 'median ' + rupee(r.median_price) }));
      board($('board'), cats, (r) => r.reviews, (r) => compact.format(r.reviews), isOn, pick);

      const types = {};
      for (const p of scoped) {
        const t = (types[p.subcategory] ??= { label: p.subcategory, n: 0, reviews: 0 });
        t.n += 1; t.reviews += p.reviews;
      }
      const typeRows = Object.values(types).sort((a, b) => b.reviews - a.reviews).slice(0, 7).map((t) => ({ ...t, sub: t.n + (t.n === 1 ? ' product' : ' products') }));
      board($('types'), typeRows, (r) => r.reviews, (r) => compact.format(r.reviews));
    }

    if (today) {
      const list = $('trending');
      list.replaceChildren();
      const rows = state.rising.filter(inScope).slice(0, 12);
      if (!rows.length) list.append(el('li', 'empty', 'Nothing new is being pushed in this category today.'));
      rows.forEach((p) => list.append(productCard(p, null, null, 1, 'Position #' + p.listing_rank)));
    }
  }

  function fillGrid(rows, metric) {
    const grid = $('grid');
    grid.replaceChildren();
    if (!rows.length) { grid.append(el('li', 'empty', 'No products to show for this category yet.')); return; }
    const max = Math.max(1, ...rows.map(metric.value));
    rows.forEach((p, i) => grid.append(productCard(p, i + 1, metric, max)));
  }

  function renderTabs() {
    document.querySelectorAll('[role=tab]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === state.tab)));
    $('view').setAttribute('aria-labelledby', 'tab-' + state.tab);
  }

  function render() {
    renderTabs();
    renderChips();
    renderNote();
    renderView();
  }

  // ---- State in the address bar ----
  function save() {
    const cat = state.category === 'All' ? '' : '/' + encodeURIComponent(state.category);
    history.replaceState(null, '', '#' + state.tab + cat);
  }
  function load() {
    const [tab, cat] = location.hash.slice(1).split('/');
    if (tab === 'today' || tab === 'alltime') state.tab = tab;
    const c = cat && decodeURIComponent(cat);
    if (c && CATEGORIES.includes(c)) state.category = c;
  }

  function setTab(tab) { state.tab = tab; save(); render(); }
  document.querySelectorAll('[role=tab]').forEach((t) => {
    t.addEventListener('click', () => setTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      setTab(state.tab === 'today' ? 'alltime' : 'today');
      document.getElementById('tab-' + state.tab).focus();
    });
  });
  document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.goto)));
  window.addEventListener('hashchange', () => { load(); if (state.today) render(); });

  // ---- Start ----
  async function start() {
    load();
    $('spotlight').replaceChildren(el('div', 'skeleton'));
    try {
      const bust = '?v=' + Date.now().toString(36);
      const [products, analysis] = await Promise.all([
        fetch('data/products.json' + bust).then((r) => { if (!r.ok) throw new Error('products ' + r.status); return r.json(); }),
        fetch('data/analysis.json' + bust).then((r) => (r.ok ? r.json() : [])),
      ]);
      state.products = products;
      state.analysis = analysis;
      prepare();
      renderHeader();
      render();
    } catch (err) {
      $('spotlight').replaceChildren(el('p', 'empty error', 'The data could not be loaded. Try refreshing the page.'));
      $('updated').textContent = 'Not loaded';
      console.error(err);
    }
  }
  start();
})();
