// BuyerMind report: loads one platform's daily data files and renders the bento dashboard.
// Pages can set window.BM_PLATFORM to choose the platform; the defaults below are Meesho.
(() => {
  const CFG = Object.assign({ name: 'Meesho', products: 'data/products.json', analysis: 'data/analysis.json', rankIsSales: false, ownBrands: false }, window.BM_PLATFORM || {});
  const CATEGORIES = CFG.categories || [
    "Women's ethnic", "Women's western", "Men's clothing", 'Kids & toys', 'Home & kitchen',
    'Beauty & personal care', 'Jewellery', 'Bags & footwear', 'Electronics accessories', 'Health & fitness',
  ];
  const CAT_STYLE = CFG.styles || {
    "Women's ethnic": ['c-ethnic', '#f6dbe4', '#8f3a58'],
    "Women's western": ['c-western', '#d8e8ec', '#2c6474'],
    "Men's clothing": ['c-mens', '#cfe6d9', '#11624f'],
    'Kids & toys': ['c-kids', '#f8e0c8', '#94551c'],
    'Home & kitchen': ['c-home', '#cfe6d9', '#11624f'],
    'Beauty & personal care': ['c-beauty', '#f6dbe4', '#8f3a58'],
    'Jewellery': ['c-jewel', '#f8e0c8', '#94551c'],
    'Bags & footwear': ['c-bags', '#f3d3b8', '#8a4a18'],
    'Electronics accessories': ['c-elec', '#d8e8ec', '#2c6474'],
    'Health & fitness': ['c-health', '#cfe6d9', '#11624f'],
  };
  const FIT_SCORE = { good: 90, mid: 55, hard: 25 };

  const state = { tab: 'today', category: 'All', search: '', products: [], analysis: [] };
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  function icon(id, cls = 'ic') {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('class', cls);
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
    const prevRank = new Map((byDate[state.prevDay] || []).map((p) => [p.pid, Number(p.listing_rank)]));
    state.today = byDate[state.day].map((p) => ({
      ...p, reviews: Number(p.reviews), price: Number(p.price), rating: Number(p.rating),
      new_reviews: prev.has(p.pid) ? Number(p.reviews) - prev.get(p.pid) : null,
      prev_rank: prevRank.get(p.pid) || null,
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
    const q = (f) => prices[Math.floor((prices.length - 1) * f)];
    return {
      category: c, products: ps.length,
      reviews: ps.reduce((s, p) => s + Number(p.reviews), 0),
      new_reviews: growing.length ? growing.reduce((s, p) => s + p.new_reviews, 0) : null,
      p10: q(0.1), p25: q(0.25), median: q(0.5), p75: q(0.75), p90: q(0.9),
      rating: ps.length ? ps.reduce((s, p) => s + Number(p.rating), 0) / ps.length : null,
      own_share: ps.length ? ps.filter((p) => p.amazon_brand).length / ps.length : null,
      one_star: known.length ? known.reduce((s, p) => s + Number(p.one_star_reviews), 0) / known.reduce((s, p) => s + Number(p.reviews), 0) : null,
    };
  }

  // ---- Header & filters ----
  function renderHeader() {
    const d = new Date(state.day + 'T00:00:00Z');
    $('updated').textContent = `Updated ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'UTC' })} · Day ${state.dates.length} of tracking · ${state.today.length} products`;
    const sel = $('category');
    sel.replaceChildren(new Option('All categories', 'All'), ...CATEGORIES.map((c) => new Option(c, c)));
    sel.value = state.category;
    sel.addEventListener('change', () => setCategory(sel.value));
    $('takeaway').textContent = note('Overall')?.text || `What is selling on ${CFG.name}, every day.`;
    $('shortlist').replaceChildren(...String(note('Shortlist')?.text || '').split('\n').filter(Boolean).map((t) => el('li', '', t)));
    $('avoid').textContent = note('Avoid')?.text || '';
  }

  function setCategory(c) {
    state.category = c;
    $('category').value = c;
    save();
    render();
  }

  // Eases a number from its current value to the new one.
  function countTo(node, value) {
    const from = Number(node.dataset.value || 0);
    node.dataset.value = value;
    if (calm || from === value) { node.textContent = fmt.format(value); return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 650);
      const eased = 1 - Math.pow(1 - t, 3);
      node.textContent = fmt.format(Math.round(from + (value - from) * eased));
      if (t < 1 && Number(node.dataset.value) === value) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---- Card 1: demand, price range, activity dots ----
  function renderDemand() {
    const s = catStats(state.category, state.today);
    countTo($('k-reviews'), s.reviews);
    $('k-reviews-sub').textContent = state.category === 'All' ? 'reviews on top listings' : `reviews on top ${state.category} listings`;
    const delta = $('k-delta');
    delta.replaceChildren();
    if (s.new_reviews != null) {
      delta.append(el('b', '', '+' + fmt.format(s.new_reviews)), document.createTextNode(' new since yesterday'));
    } else {
      delta.textContent = 'Growth shows from tomorrow';
    }

    // Bar spans the 10th–90th percentile so a single expensive listing doesn't squash it.
    const span = Math.max(1, s.p90 - s.p10);
    const pos = ((s.median - s.p10) / span) * 100;
    $('range-fill').style.width = clamp(pos, 8, 100) + '%';
    $('range-mark').style.left = `calc(${clamp(pos, 8, 100)}% - 1px)`;
    $('range-lo').textContent = rupee(s.p10);
    $('range-hi').textContent = rupee(s.p90);
    $('range-note').textContent = `Typical price ${rupee(s.median)} · half of these products cost ${rupee(s.p25)}–${rupee(s.p75)}`;

    renderDots();
  }

  function renderDots() {
    const COLS = $('dots').parentElement.clientWidth < 300 ? 16 : 22;
    const end = new Date(state.day + 'T00:00:00Z');
    const days = [];
    for (let i = COLS - 1; i >= 0; i--) days.push(new Date(end.getTime() - i * 864e5).toISOString().slice(0, 10));

    // per category per day: reviews gained vs the previous collected day
    const gains = {};
    let prevMap = null;
    for (const d of state.dates) {
      const map = new Map((state.byDate[d] || []).map((p) => [p.pid, p]));
      for (const c of CATEGORIES) {
        let g = null;
        if (prevMap) {
          g = 0;
          for (const p of map.values()) if (p.category === c && prevMap.has(p.pid)) g += Number(p.reviews) - Number(prevMap.get(p.pid).reviews);
        }
        (gains[c] ??= {})[d] = g;
      }
      prevMap = map;
    }

    const grid = $('dots');
    grid.replaceChildren();
    grid.style.gridTemplateRows = `repeat(${CATEGORIES.length}, 7px)`;
    for (const d of days) {
      for (const c of CATEGORIES) {
        const dot = el('i', 'dot');
        const has = state.byDate[d]?.some((p) => p.category === c);
        const g = gains[c]?.[d];
        const max = Math.max(1, ...Object.values(gains[c] || {}).filter((x) => x != null));
        let level = 'd0';
        if (has) level = g == null || g <= 0 ? 'd1' : g >= max * 0.5 ? 'd3' : 'd2';
        dot.className = 'dot ' + level;
        if (state.category !== 'All' && c !== state.category) dot.style.opacity = '.25';
        dot.title = `${c} · ${d}${g != null ? ' · +' + fmt.format(g) + ' reviews' : has ? ' · first day collected' : ' · no run'}`;
        grid.append(dot);
      }
    }
    const months = $('dot-months');
    months.replaceChildren();
    let last = '';
    days.forEach((d, i) => {
      const m = new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' });
      if (m !== last && i < COLS - 4) {
        const s = el('span', '', m);
        s.style.left = `calc(${(i / COLS) * 100}% )`;
        months.append(s);
        last = m;
      }
    });
  }

  // ---- Card 2: categories + tiles ----
  function renderCategories() {
    const list = $('cat-list');
    list.replaceChildren();
    const sortKey = state.hasHistory ? 'new_reviews' : 'reviews';
    const cats = [...state.cats].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
    $('cat-count').textContent = `${cats.length} categories · ${state.hasHistory ? 'by growth today' : 'by total reviews'}`;
    for (const c of cats) {
      const [ic, bg, fg] = CAT_STYLE[c.category];
      const li = el('li');
      const b = el('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.category === c.category));
      const tile = el('span', 'cat-icon');
      tile.style.background = bg; tile.style.color = fg;
      tile.append(icon(ic));
      const name = el('span', 'cat-name');
      name.append(el('b', '', c.category), el('span', '', c.new_reviews != null ? `+${fmt.format(c.new_reviews)} today` : `typical price ${rupee(c.median)}`));
      b.append(tile, name, el('span', 'cat-val', compact.format(c.reviews)));
      b.addEventListener('click', () => setCategory(state.category === c.category ? 'All' : c.category));
      li.append(b);
      list.append(li);
    }

    const now = catStats(state.category, state.today);
    const prevRows = state.prevDay ? state.byDate[state.prevDay] : null;
    const before = prevRows ? catStats(state.category, prevRows) : null;
    tile('t-rating', 't-rating-note', now.rating, before?.rating, (v) => v.toFixed(2) + ' ★', true, (d) => Math.abs(d).toFixed(2) + ' from yesterday', `across ${now.products} products`);
    if (CFG.ownBrands) {
      $('t-onestar').textContent = Math.round((now.own_share || 0) * 100) + '%';
      $('t-onestar-note').textContent = 'of these top sellers are named as Amazon brands';
    } else tile('t-onestar', 't-onestar-note', now.one_star, before?.one_star, (v) => (v * 100).toFixed(1) + '%', false, (d) => (Math.abs(d) * 100).toFixed(2) + ' pts from yesterday', 'lower means fewer returns');
  }

  function tile(valId, noteId, now, before, show, higherIsGood, diffText, fallback) {
    const v = $(valId);
    const n = $(noteId);
    v.replaceChildren();
    if (now == null) { v.textContent = '—'; n.textContent = ''; return; }
    const diff = before != null ? now - before : null;
    const dir = diff == null || Math.abs(diff) < 1e-4 ? 'flat' : diff > 0 ? 'up' : 'down';
    const good = dir === 'flat' ? null : (dir === 'up') === higherIsGood;
    const a = el('span', 'arrow ' + (dir === 'flat' ? 'flat' : good ? 'up' : 'down'));
    a.append(icon(dir === 'down' ? 'i-down' : 'i-up'));
    if (dir !== 'flat') v.append(a);
    v.append(document.createTextNode(show(now)));
    n.className = 'tile-note' + (good == null ? '' : good ? ' good' : ' bad');
    n.textContent = diff == null ? fallback : dir === 'flat' ? 'no change from yesterday' : diffText(diff);
  }

  // ---- Card 3: products ----
  function renderProducts() {
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
    $('seg').dataset.active = state.tab;
    const list = $('plist');
    list.replaceChildren();
    const q = state.search.trim().toLowerCase();
    let rows = state.today.filter((p) => inScope(p) && (!q || p.name.toLowerCase().includes(q) || String(p.subcategory).toLowerCase().includes(q)));

    if (state.tab === 'today' && CFG.rankIsSales) {
      rows = rows.sort((a, b) => a.listing_rank - b.listing_rank || b.reviews - a.reviews);
      $('list-note').textContent = `${CFG.name}'s own best-seller rank, which it bases on recent sales. Arrows show the change since the last update.`;
    } else if (state.tab === 'today') {
      if (!state.hasHistory) {
        $('list-note').textContent = 'Ranked by new reviews since yesterday: the best sign of daily sales.';
        const e = el('li', 'empty');
        e.append(el('b', '', "Daily ranking starts after the next update"));
        e.append(document.createTextNode("Today's counts are saved. The next update counts each product's new reviews. Meanwhile, check All-time or Trending now."));
        list.append(e);
        return;
      }
      rows = rows.filter((p) => p.new_reviews > 0).sort((a, b) => b.new_reviews - a.new_reviews);
      $('list-note').textContent = 'Ranked by new reviews since yesterday: the best sign of daily sales.';
    } else {
      rows = rows.sort((a, b) => b.reviews - a.reviews);
      $('list-note').textContent = 'Ranked by total reviews: what has sold the most over time.';
    }
    rows = rows.slice(0, 8);
    if (!rows.length) {
      list.append(el('li', 'empty', q ? `No products match "${state.search}".` : 'No products to show yet.'));
      return;
    }
    rows.forEach((p, i) => {
      const li = el('li', 'prow' + (i === 0 && !q ? ' lift' : ''));
      li.style.setProperty('--i', i);
      const a = el('a');
      a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', `#${i + 1} ${p.name}, ${rupee(p.price)}, show details`);
      opensSheet(a, p);
      const name = el('span', 'pname');
      name.append(el('b', '', p.name), el('span', '', `${CFG.rankIsSales ? '' : `#${i + 1} · `}${rupee(p.price)} · ${state.category === 'All' ? p.category : p.subcategory}`));
      const type = el('span', 'chip type');
      type.append(icon('i-bars'), document.createTextNode(p.subcategory));
      const metric = el('span', state.tab === 'today' && !CFG.rankIsSales ? 'chip good' : 'chip');
      metric.append(icon(state.tab === 'today' ? 'i-trend' : 'i-users'), document.createTextNode(state.tab !== 'today' ? compact.format(p.reviews) : CFG.rankIsSales ? rankText(p) : '+' + fmt.format(p.new_reviews)));
      a.append(photo(p.image, 'thumb'), name, type, metric, ring(p.rating));
      li.append(a);
      list.append(li);
    });
  }

  function rankText(p) {
    const move = p.prev_rank ? p.prev_rank - p.listing_rank : 0;
    return '#' + p.listing_rank + (move > 0 ? ' ▲' + move : move < 0 ? ' ▼' + -move : '');
  }

  function ring(rating) {
    const wrap = el('span', 'ring');
    wrap.title = `Rating ${rating.toFixed(1)} out of 5`;
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 22 22');
    s.setAttribute('aria-hidden', 'true');
    const r = 8.5, c = 2 * Math.PI * r;
    for (const [cls, dash] of [['track', c], ['val', c * clamp(rating / 5, 0, 1)]]) {
      const ci = document.createElementNS(SVGNS, 'circle');
      ci.setAttribute('cx', 11); ci.setAttribute('cy', 11); ci.setAttribute('r', r);
      ci.setAttribute('class', cls);
      ci.setAttribute('stroke-dasharray', `${dash} ${c}`);
      s.append(ci);
    }
    wrap.append(s, document.createTextNode(rating.toFixed(1)));
    return wrap;
  }

  // ---- Product sheet ----
  function opensSheet(link, p) {
    link.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return; // leave "open in new tab" alone
      e.preventDefault();
      showSheet(p);
    });
  }

  function showSheet(p) {
    const body = $('sheet-body');
    body.replaceChildren();
    body.append(photo(p.image, 'sheet-photo'));
    const title = el('h2', '', p.name);
    title.id = 'sheet-name';
    body.append(el('p', 'sheet-cat', p.subcategory === p.category ? p.category : p.category + ' · ' + p.subcategory), title);

    const stats = el('div', 'sheet-stats');
    const stat = (value, label) => { const d = el('div'); d.append(el('b', '', value), el('span', '', label)); stats.append(d); };
    if (p.new_reviews != null) stat((p.new_reviews >= 0 ? '+' : '') + fmt.format(p.new_reviews), 'new reviews');
    stat(fmt.format(p.reviews), 'total reviews');
    stat(rupee(p.price), 'price');
    stat(p.rating.toFixed(1) + ' ★', 'rating');
    if (p.one_star_reviews != null && p.reviews) stat((p.one_star_reviews / p.reviews * 100).toFixed(1) + '%', '1-star reviews');
    stat('#' + p.listing_rank, CFG.rankIsSales ? 'best-seller rank' : 'on its page');
    body.append(stats);

    const history = state.dates.map((d) => (state.byDate[d] || []).find((x) => x.pid === p.pid)).filter(Boolean).map((x) => Number(x.reviews));
    if (history.length >= 2) body.append(el('p', 'sheet-note', `Tracked on ${history.length} days, from ${fmt.format(history[0])} to ${fmt.format(history[history.length - 1])} reviews.`));

    const link = el('a', 'pill-dark sheet-link', `View on ${CFG.name}`);
    link.href = p.url; link.target = '_blank'; link.rel = 'noopener';
    link.append(icon('i-ext'));
    body.append(link);
    $('sheet').showModal();
  }

  function closeSheet() {
    const s = $('sheet');
    if (!s.open) return;
    if (calm) { s.close(); return; }
    s.classList.add('closing');
    setTimeout(() => { s.classList.remove('closing'); s.close(); }, 200);
  }

  // ---- Card 4: health flower ----
  function healthScores(c) {
    const all = state.cats;
    const maxRev = Math.max(...all.map((x) => x.reviews));
    const maxNew = Math.max(0, ...all.map((x) => x.new_reviews ?? 0));
    const meds = all.map((x) => x.median);
    const minMed = Math.min(...meds), maxMed = Math.max(...meds);
    const one = (x) => {
      const fit = note(x.category)?.fit_level;
      return {
        Demand: (x.reviews / maxRev) * 100,
        Growth: x.new_reviews == null || !maxNew ? null : (x.new_reviews / maxNew) * 100,
        Rating: clamp(((x.rating - 3.5) / 1) * 100),
        [CFG.ownBrands ? 'Room for sellers' : 'Few complaints']: CFG.ownBrands ? clamp(100 - (x.own_share || 0) * 300) : x.one_star == null ? null : clamp(100 - x.one_star * 600),
        Affordable: maxMed === minMed ? 50 : ((maxMed - x.median) / (maxMed - minMed)) * 100,
        'Beginner fit': FIT_SCORE[fit] ?? null,
      };
    };
    if (c !== 'All') return one(all.find((x) => x.category === c));
    const each = all.map(one);
    const out = {};
    for (const k of Object.keys(each[0])) {
      const vals = each.map((e) => e[k]).filter((v) => v != null);
      out[k] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }
    return out;
  }

  function heat(v) {
    if (v == null) return 'var(--inset-2)';
    return v >= 66 ? 'var(--heat-hi)' : v >= 40 ? 'var(--heat-mid)' : 'var(--heat-lo)';
  }

  function renderHealth() {
    $('health-cat').textContent = state.category === 'All' ? 'All categories' : state.category;
    const scores = healthScores(state.category);
    const keys = Object.keys(scores);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '-200 -185 400 370');
    const defs = document.createElementNS(SVGNS, 'defs');
    defs.innerHTML = '<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>';
    svg.append(defs);

    const glow = document.createElementNS(SVGNS, 'g');
    glow.setAttribute('filter', 'url(#blur)');
    glow.setAttribute('opacity', '.95');
    const petals = document.createElementNS(SVGNS, 'g');
    const labels = document.createElementNS(SVGNS, 'g');
    keys.forEach((k, i) => {
      const ang = (-90 + i * 60) * Math.PI / 180;
      const v = scores[k];
      const r = 98;
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      const g = document.createElementNS(SVGNS, 'circle');
      g.setAttribute('cx', x * 0.78); g.setAttribute('cy', y * 0.78);
      g.setAttribute('r', v == null ? 26 : 30 + (v / 100) * 26);
      g.setAttribute('fill', heat(v));
      glow.append(g);

      const p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', hexPath(x, y, 56, 16));
      p.setAttribute('fill', 'var(--card)');
      p.setAttribute('fill-opacity', '.38');
      p.setAttribute('stroke', 'var(--card)');
      p.setAttribute('stroke-width', '2.5');
      petals.append(p);

      const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('class', 'petal-label');
      t.setAttribute('x', x); t.setAttribute('y', y - 2);
      const tv = document.createElementNS(SVGNS, 'tspan');
      tv.setAttribute('class', 'v');
      tv.setAttribute('x', x);
      tv.textContent = v == null ? '—' : Math.round(v) + '%';
      const tn = document.createElementNS(SVGNS, 'tspan');
      tn.setAttribute('class', 'n');
      tn.setAttribute('x', x); tn.setAttribute('dy', 16);
      tn.textContent = k;
      t.append(tv, tn);
      labels.append(t);
    });
    // spokes
    const spokes = document.createElementNS(SVGNS, 'g');
    keys.forEach((k, i) => {
      const ang = (-60 + i * 60) * Math.PI / 180;
      const l = document.createElementNS(SVGNS, 'line');
      l.setAttribute('x1', 0); l.setAttribute('y1', 0);
      l.setAttribute('x2', Math.cos(ang) * 150); l.setAttribute('y2', Math.sin(ang) * 150);
      l.setAttribute('stroke', 'var(--card)'); l.setAttribute('stroke-width', '2'); l.setAttribute('stroke-opacity', '.8');
      spokes.append(l);
    });
    const center = document.createElementNS(SVGNS, 'g');
    center.innerHTML = '<circle r="19" fill="var(--card-solid)"/><use href="#i-heart" x="-9" y="-9" width="18" height="18" fill="var(--ink)" stroke="var(--ink)"/>';
    svg.append(glow, petals, spokes, labels, center);
    $('flower').replaceChildren(svg);
    $('flower').setAttribute('aria-label', 'Category health: ' + keys.map((k) => `${k} ${scores[k] == null ? 'not yet available' : Math.round(scores[k]) + ' out of 100'}`).join(', '));

    const n = state.category === 'All' ? null : note(state.category);
    $('insight-text').textContent = n ? n.headline.replace(/^[^:]+:\s*/, '') + '.' : 'Pick a category to see its health and what it means for a beginner.';
    const fit = $('insight-fit');
    fit.textContent = n ? n.fit_label : '';
    fit.className = 'fit ' + (n ? n.fit_level : '');
    fit.hidden = !n;
  }

  // Rounded hexagon centred at (cx, cy)
  function hexPath(cx, cy, size, round) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (60 * i) * Math.PI / 180;
      pts.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
    }
    let d = '';
    for (let i = 0; i < 6; i++) {
      const p0 = pts[(i + 5) % 6], p1 = pts[i], p2 = pts[(i + 1) % 6];
      const t = round / size;
      const a = [p1[0] + (p0[0] - p1[0]) * t, p1[1] + (p0[1] - p1[1]) * t];
      const b = [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t];
      d += (i ? 'L' : 'M') + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'Q' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
    }
    return d + 'Z';
  }

  // ---- Card 5: trending ----
  function renderTrending() {
    const strip = $('strip');
    strip.replaceChildren();
    const rows = state.rising.filter(inScope).slice(0, 12);
    if (!rows.length) { strip.append(el('li', 'empty', 'Nothing new is being pushed in this category today.')); return; }
    for (const p of rows) {
      const li = el('li', 'tcard');
      const a = el('a');
      a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', `${p.name}, ${rupee(p.price)}, position ${p.listing_rank}, show details`);
      opensSheet(a, p);
      const ph = photo(p.image, 'tphoto');
      ph.append(el('span', 'pos', '#' + p.listing_rank + (CFG.rankIsSales ? ' best seller' : ' on page')));
      const body = el('div', 'tbody');
      const meta = el('div', 'tmeta');
      meta.append(el('b', '', rupee(p.price)), el('span', '', compact.format(p.reviews) + ' reviews'));
      body.append(el('div', 'tname', p.name), meta);
      a.append(ph, body);
      li.append(a);
      strip.append(li);
    }
  }

  function render() {
    renderDemand();
    renderCategories();
    renderProducts();
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
    state.category = c && CATEGORIES.includes(c) ? c : 'All';
  }

  document.querySelectorAll('.seg button').forEach((b) => {
    b.addEventListener('click', () => { state.tab = b.dataset.tab; save(); renderProducts(); });
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      state.tab = state.tab === 'today' ? 'alltime' : 'today';
      save(); renderProducts();
      document.querySelector(`.seg button[data-tab="${state.tab}"]`).focus();
    });
  });
  $('search').addEventListener('input', (e) => { state.search = e.target.value; renderProducts(); });
  $('sheet-close').addEventListener('click', closeSheet);
  $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeSheet(); });

  // Phone dock: highlight the section in view.
  if ('IntersectionObserver' in window) {
    const dockLinks = [...document.querySelectorAll('[data-dock]')];
    const seen = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) dockLinks.forEach((a) => (a.dataset.dock === en.target.id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      }
    }, { rootMargin: '-40% 0px -55% 0px' });
    dockLinks.forEach((a) => { const t = document.getElementById(a.dataset.dock); if (t) seen.observe(t); });
  }
  window.addEventListener('hashchange', () => { load(); if (state.today) { $('category').value = state.category; render(); } });

  async function start() {
    load();
    $('plist').replaceChildren(...[0, 1, 2].map(() => el('li', 'skeleton')));
    try {
      const bust = '?v=' + Date.now().toString(36);
      const [products, analysis] = await Promise.all([
        fetch(CFG.products + bust).then((r) => { if (!r.ok) throw new Error('products ' + r.status); return r.json(); }),
        fetch(CFG.analysis + bust).then((r) => (r.ok ? r.json() : [])),
      ]);
      state.products = products;
      state.analysis = analysis;
      prepare();
      renderHeader();
      render();
    } catch (err) {
      $('updated').textContent = 'The data could not be loaded. Try refreshing the page.';
      $('plist').replaceChildren(el('li', 'empty', 'The data could not be loaded.'));
      console.error(err);
    }
  }
  start();
})();
