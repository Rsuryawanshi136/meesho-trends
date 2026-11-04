// BuyerMind landing page: fills the photo collage and the Meesho card from the latest Meesho data.
(async () => {
  try {
    const rows = await fetch('data/products.json?v=' + Date.now().toString(36)).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    const dates = [...new Set(rows.map((p) => p.date))].sort();
    const day = dates[dates.length - 1];
    const prevDay = dates[dates.length - 2];
    const prev = new Map(rows.filter((p) => p.date === prevDay).map((p) => [p.pid, Number(p.reviews)]));
    const today = rows.filter((p) => p.date === day).map((p) => ({ ...p, gain: prev.has(p.pid) ? Number(p.reviews) - prev.get(p.pid) : null }));
    const ranked = prevDay
      ? today.filter((p) => p.gain > 0).sort((a, b) => b.gain - a.gain)
      : [...today].sort((a, b) => Number(b.reviews) - Number(a.reviews));

    const collage = document.getElementById('collage');
    for (const p of ranked.filter((x) => x.image).slice(0, 5)) {
      const box = document.createElement('div');
      const img = document.createElement('img');
      img.src = p.image; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => box.remove());
      box.append(img);
      collage.append(box);
    }

    const top = ranked[0];
    if (top) {
      const fmt = new Intl.NumberFormat('en-IN');
      const el = document.getElementById('meesho-top');
      const date = new Date(day + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'UTC' });
      el.textContent = `${date}: ${top.name}${top.gain != null ? `, +${fmt.format(top.gain)} new reviews` : ''}`;
      el.hidden = false;
    }
  } catch (err) {
    // The page still works without the live details.
    console.error(err);
  }
})();
