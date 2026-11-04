// Meesho Trend Report: loads the daily data files and renders the page.
(() => {
  const CATEGORIES = [
    "Women's ethnic", "Women's western", "Men's clothing", 'Kids & toys', 'Home & kitchen',
    'Beauty & personal care', 'Jewellery', 'Bags & footwear', 'Electronics accessories', 'Health & fitness',
  ];
  const ICONS = {
    "Women's ethnic": 'c-ethnic', "Women's western": 'c-western', "Men's clothing": 'c-mens', 'Kids & toys': 'c-kids',
    'Home & kitchen': 'c-home', 'Beauty & personal care': 'c-beauty', 'Jewellery': 'c-jewel', 'Bags & footwear': 'c-bags',
    'Electronics accessories': 'c-elec', 'Health & fitness': 'c-health',
  };
  const FIT_SCORE = { good: 90, mid: 55, hard: 25 };
  // Colour order for tiles; picked so neighbouring tiles differ across the 4-column grid.
  const TILE_COLOURS = [0, 2, 3, 4, 1, 3, 0, 4, 2, 1];
  const CAT_COLOURS = [1, 0, 4, 3, 2, 3, 2, 1, 0, 4];

  const state = { tab: 'today', category: 'All', search: '', products: [], analysis: [] };

  const fmt = new Intl.NumberFormat('en-IN');
  const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
  const rupee = (v) => '₹' + fmt.format(Math.round(Number(v)));
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
  const SVGNS = 'http://www.w3.org/2000/svg';

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(id) {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('class', 'ic');
    s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(SVGNS, 'use');
    u.setAttribute('href', '#' + id);
    s.append(u);
    return s;
  }
  function photo(src, cls) {
    const box = el('div', cls);
    if (src) {
      const img = el('img');
      img.src = src; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => img.remove());
      box.append(img);
    }
    return box;
  }
  const note = (key) => state.analysis.find((r) => r.key === key);
  const inScope = (p) => state.category === 'All' || p.category === state.category;

  // ---- Data ----
  function prepare() {
    const rows = state.products;
    state.dates = [...new Set(rows.map((p) => p.date))].sort();
    state.day = state.dates[state.dates.length - 1];
    state.prevDay = state.dates[state.dates.length - 2] || null;
    const byDate = {};
    for (const p of rows) (byDate[p.date] ??= []).push(p);
    state.byDate = byDate;
    const prev = new Map((byDate[state.prevDay] || []).map((p) => [p.pid, Number(p.reviews)]));
    state.today = byDate[state.day].map((p) => ({
      ...p, reviews: Number(p.reviews), price: Number(p.price), rating: Number(p.rating),
      new_reviews: prev.has(p.pid) ? Number(p.reviews) - prev.get(p.pid) : null,
    }));
    state.hasHistory = !!state.prevDay;

    const median = {};
    for (const c of CATEGORIES) {
      const v = state.today.filter((p) => p.category === c).map((p) => p.reviews).sort((a, b) => a - b);
      median[c] = v[Math.floor(v.length / 2)];
    }
    state.rising = state.today.filter((p) => Number(p.listing_rank) <= 10 && p.reviews < median[p.category])
      .sort((a, b) => a.listing_rank - b.listing_rank);
    state.cats = CATEGORIES.map((c) => catStats(c, state.today)).filter((c) => c.products);
  }

  function catStats(c, rows) {
    const ps = rows.filter((p) => c === 'All' || p.category === c);
    const prices = ps.map((p) => Number(p.price)).sort((a, b) => a - b);
    const known = ps.filter((p) => p.one_star_reviews != null);
    const growing = ps.filter((p) => p.new_reviews != null);
    return {
      category: c, products: ps.length,
      reviews: ps.reduce((s, p) => s + Number(p.reviews), 0),
      new_reviews: growing.length ? growing.reduce((s, p) => s + p.new_reviews, 0) : null,
      median: prices[Math.floor((prices.length - 1) / 2)],
      rating: ps.length ? ps.reduce((s, p) => s + Number(p.rating), 0) / ps.length : null,
      one_star: known.length ? known.reduce((s, p) => s + Number(p.one_star_reviews), 0) / known.reduce((s, p) => s + Number(p.reviews), 0) : null,
    };
  }

  // ---- Static-once parts ----
  function renderOnce() {
    const d = new Date(state.day + 'T00:00:00Z');
    $('updated').textContent = `Updated ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'UTC' })} · Day ${state.dates.length} of tracking`;
    const sel = $('category');
    sel.replaceChildren(new Option('All categories', 'All'), ...CATEGORIES.map((c) => new Option(c, c)));
    sel.value = state.category;
    sel.addEventListener('change', () => setCategory(sel.value));
    $('short').replaceChildren(...String(note('Shortlist')?.text || '').split('\n').filter(Boolean).map((t) => el('li', '', t)));
    $('avoid').textContent = note('Avoid')?.text || '';
  }

  function setCategory(c) {
    state.category = c;
    $('category').value = c;
    save();
    render();
  }

  // ---- Ranked rows for the current tab, category and search ----
  function rankedRows() {
    const q = state.search.trim().toLowerCase();
    const rows = state.today.filter((p) => inScope(p) && (!q || p.name.toLowerCase().includes(q) || String(p.subcategory).toLowerCase().includes(q)));
    if (state.tab === 'today' && state.hasHistory) return rows.filter((p) => p.new_reviews > 0).sort((a, b) => b.new_reviews - a.new_reviews);
    return rows.sort((a, b) => b.reviews - a.reviews);
  }

  function renderCollage() {
    const box = $('collage');
    box.replaceChildren(...rankedRows().filter((p) => p.image).slice(0, 5).map((p) => photo(p.image, '')));
  }

  function renderStats() {
    const s = catStats(state.category, state.today);
    $('s-new').textContent = s.new_reviews != null ? '+' + fmt.format(s.new_reviews) : '—';
    $('s-reviews').textContent = compact.format(s.reviews);
    $('s-price').textContent = rupee(s.median);
    $('s-rating').textContent = s.rating != null ? s.rating.toFixed(2) + ' ★' : '—';
    $('s-rating-label').textContent = s.one_star != null ? `average rating · ${(s.one_star * 100).toFixed(1)}% are 1-star` : 'average rating';
  }

  // ---- Product mosaic ----
  function renderMosaic() {
    document.querySelectorAll('.toggle button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
    const today = state.tab === 'today' && state.hasHistory;
    const scope = state.category === 'All' ? '' : ` in ${state.category}`;
    $('sellers-title').textContent = today ? 'What Sold Most Today' : 'Best Sellers of All Time';
    $('sellers-sub').textContent = (today
      ? 'Ranked by new reviews since the previous update, the best sign of recent sales'
      : 'Ranked by total reviews, which show what has sold the most over time') + scope + '.';

    const box = $('mosaic');
    box.replaceChildren();
    const rows = rankedRows().slice(0, 10);
    if (!rows.length) {
      box.append(el('li', 'none', state.search ? `No products match "${state.search}".` : 'No products to show yet.'));
      return;
    }
    rows.forEach((p, i) => {
      const li = el('li', `tile bg-${TILE_COLOURS[i % TILE_COLOURS.length]}${i === 0 ? ' big' : ''}`);
      const a = el('a');
      a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', `Number ${i + 1}: ${p.name}, ${rupee(p.price)}, opens on Meesho`);
      const ph = photo(p.image, 'tile-photo');
      ph.append(el('span', 'rank', '#' + (i + 1)));
      const metric = el('div', 'tile-metric', today ? '+' + fmt.format(p.new_reviews) : compact.format(p.reviews));
      metric.append(el('small', '', today ? 'new reviews' : 'reviews'));
      const meta = el('div', 'tile-meta');
      meta.append(el('b', '', rupee(p.price)), el('span', '', p.rating.toFixed(1) + ' ★'));
      a.append(ph, el('div', 'tile-name', p.name), metric, meta);
      li.append(a);
      box.append(li);
    });

    // The written analysis fills whatever is left of the last row on wide screens.
    const n = state.category === 'All' ? note('Overall') : note(state.category);
    if (n) {
      const cells = 4 + (rows.length - 1);
      const say = el('li', 'say');
      say.style.setProperty('--span', String((4 - cells % 4) % 4 || 4));
      say.append(el('h3', '', state.category === 'All' ? "Today's Read" : n.headline.replace(/^[^:]+:\s*/, '').replace(/^./, (c) => c.toUpperCase())));
      if (n.fit_label) say.append(el('span', 'fit ' + n.fit_level, n.fit_label));
      say.append(el('p', '', n.text));
      box.append(say);
    }
  }

  // ---- Categories ----
  function renderCats() {
    const box = $('cats');
    box.replaceChildren();
    const key = state.hasHistory ? 'new_reviews' : 'reviews';
    [...state.cats].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0)).forEach((c, i) => {
      const li = el('li', `bg-${CAT_COLOURS[i % CAT_COLOURS.length]}`);
      const b = el('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.category === c.category));
      const top = el('span');
      top.append(icon(ICONS[c.category]), el('h3', '', c.category));
      const bottom = el('span');
      bottom.append(
        el('span', 'cat-num', c.new_reviews != null ? '+' + fmt.format(c.new_reviews) : compact.format(c.reviews)),
        el('span', 'cat-sub', `${c.new_reviews != null ? 'new reviews' : 'reviews'} · typical ${rupee(c.median)}`),
      );
      b.append(top, bottom);
      b.addEventListener('click', () => setCategory(state.category === c.category ? 'All' : c.category));
      li.append(b);
      box.append(li);
    });
  }

  // ---- Bars ----
  function bars(list, rows) {
    list.replaceChildren();
    const max = Math.max(1, ...rows.map((r) => r.value));
    for (const r of rows) {
      const li = el('li');
      const row = el('div', 'bar-row');
      row.append(el('span', '', r.label), el('span', '', r.text));
      const bar = el('div', 'bar');
      const fill = el('i');
      fill.style.width = (r.scale ? r.value : (r.value / max) * 100) + '%';
      bar.append(fill);
      li.append(row, bar);
      list.append(li);
    }
  }

  function renderTypes() {
    const types = {};
    for (const p of state.today.filter(inScope)) {
      const t = (types[p.subcategory] ??= { label: p.subcategory, value: 0 });
      t.value += p.reviews;
    }
    bars($('types'), Object.values(types).sort((a, b) => b.value - a.value).slice(0, 6).map((t) => ({ ...t, text: compact.format(t.value) })));
  }

  function renderHealth() {
    const all = state.cats;
    const maxRev = Math.max(...all.map((x) => x.reviews));
    const maxNew = Math.max(0, ...all.map((x) => x.new_reviews ?? 0));
    const meds = all.map((x) => x.median);
    const minMed = Math.min(...meds), maxMed = Math.max(...meds);
    const one = (x) => ({
      Demand: (x.reviews / maxRev) * 100,
      Growth: x.new_reviews == null || !maxNew ? null : (x.new_reviews / maxNew) * 100,
      Rating: clamp((x.rating - 3.5) * 100),
      'Few complaints': x.one_star == null ? null : clamp(100 - x.one_star * 600),
      Affordable: maxMed === minMed ? 50 : ((maxMed - x.median) / (maxMed - minMed)) * 100,
      'Beginner fit': FIT_SCORE[note(x.category)?.fit_level] ?? null,
    });
    let scores;
    if (state.category !== 'All') {
      scores = one(all.find((x) => x.category === state.category));
    } else {
      const each = all.map(one);
      scores = {};
      for (const k of Object.keys(each[0])) {
        const vals = each.map((e) => e[k]).filter((v) => v != null);
        scores[k] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      }
    }
    bars($('health'), Object.entries(scores).map(([label, v]) => ({
      label, value: v ?? 0, scale: true, text: v == null ? 'not yet' : String(Math.round(v)),
    })));
    $('health-sub').textContent = `${state.category === 'All' ? 'Average across categories' : state.category}. Scores out of 100 compared with other categories; higher is better for a beginner.`;
  }

  // ---- Trending ----
  function renderTrending() {
    const box = $('strip');
    box.replaceChildren();
    const rows = state.rising.filter(inScope).slice(0, 12);
    if (!rows.length) { box.append(el('li', 'none', 'Nothing new is being pushed in this category today.')); return; }
    rows.forEach((p, i) => {
      const li = el('li', `tile bg-${TILE_COLOURS[i % TILE_COLOURS.length]}`);
      const a = el('a');
      a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', `${p.name}, ${rupee(p.price)}, position ${p.listing_rank} on its page, opens on Meesho`);
      const ph = photo(p.image, 'tile-photo');
      ph.append(el('span', 'rank', '#' + p.listing_rank));
      const meta = el('div', 'tile-meta');
      meta.append(el('b', '', rupee(p.price)), el('span', '', compact.format(p.reviews) + ' reviews'));
      a.append(ph, el('div', 'tile-name', p.name), meta);
      li.append(a);
      box.append(li);
    });
  }

  function render() {
    renderCollage();
    renderStats();
    renderMosaic();
    renderCats();
    renderTypes();
    renderHealth();
    renderTrending();
  }

  // ---- Address bar state ----
  function save() {
    const cat = state.category === 'All' ? '' : '/' + encodeURIComponent(state.category);
    history.replaceState(null, '', '#' + state.tab + cat);
  }
  function load() {
    const [tab, cat] = location.hash.slice(1).split('/');
    if (tab === 'today' || tab === 'alltime') state.tab = tab;
    const c = cat && decodeURIComponent(cat);
    if (tab === 'today' || tab === 'alltime') state.category = c && CATEGORIES.includes(c) ? c : 'All';
  }

  document.querySelectorAll('.toggle button').forEach((b) => {
    b.addEventListener('click', () => { state.tab = b.dataset.tab; save(); renderCollage(); renderMosaic(); });
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      state.tab = state.tab === 'today' ? 'alltime' : 'today';
      save(); renderCollage(); renderMosaic();
      document.querySelector(`.toggle button[data-tab="${state.tab}"]`).focus();
    });
  });
  $('search').addEventListener('input', (e) => { state.search = e.target.value; renderMosaic(); });
  window.addEventListener('hashchange', () => { load(); if (state.today) { $('category').value = state.category; render(); } });

  async function start() {
    load();
    $('mosaic').replaceChildren(el('li', 'skeleton'));
    try {
      const bust = '?v=' + Date.now().toString(36);
      const [products, analysis] = await Promise.all([
        fetch('data/products.json' + bust).then((r) => { if (!r.ok) throw new Error('products ' + r.status); return r.json(); }),
        fetch('data/analysis.json' + bust).then((r) => (r.ok ? r.json() : [])),
      ]);
      state.products = products;
      state.analysis = analysis;
      prepare();
      renderOnce();
      render();
    } catch (err) {
      $('updated').textContent = 'The data could not be loaded. Try refreshing the page.';
      $('mosaic').replaceChildren(el('li', 'none', 'The data could not be loaded.'));
      console.error(err);
    }
  }
  start();
})();
