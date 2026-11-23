const num = v => {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cur = '', q = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      rows.push(row);
      row = [];
    } else cur += c;
  }

  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }

  if (!rows.length) return [];

  const head = rows.shift().map(h => h.trim());

  return rows
    .filter(r => r.some(v => v.trim() !== ''))
    .map(r => Object.fromEntries(
      head.map((h, i) => [h, (r[i] ?? '').trim()])
    ));
}

const normStock = s => {
  const v = (s || '').trim().toLowerCase();
  if (v === 'out of stock') return 'Out of stock';
  if (v === 'call to confirm') return 'Call to confirm';
  return 'In stock';
};

function readCardType(value) {
  const type = String(value ?? '').trim().toLowerCase();
  if (type === 'pipe') return 'pipe';
  if (type === 'standard' || type === 'wide') return 'standard';
  return '';
}

export function buildProducts(rows) {
  const map = new Map();

  rows.forEach((r, idx) => {
    if ((r.show_on_site || 'Yes').toLowerCase() === 'no') return;

    const id = r.product_id;
    if (!id) return;

    let p = map.get(id);

    if (!p) {
      p = {
        id,
        category: r.category,
        type: r.type,
        name: r.product_name,
        image: r.image,
        searchWords: r.search_words || '',
        cardType: '',
        variants: [],
        order: num(r.sort_order) ?? idx
      };

      map.set(id, p);
    }
    p.cardType ||= readCardType(r.card_type);

    const price = num(r.price_ghs);
    const promo = num(r.promo_price_ghs);

    let current = num(r.current_price_ghs);
    if (current == null) current = promo ?? price;

    const onSale = r.on_sale
      ? r.on_sale === 'Yes'
      : current != null && price != null && current < price;

    p.variants.push({
      size: r.size || '',
      unit: r.unit || '',
      price,
      current,
      onSale,
      pct: num(r.discount_percent) ??
        (onSale && price ? Math.round((1 - current / price) * 100) : 0),
      stock: normStock(r.stock_status),
      order: num(r.sort_order) ?? idx
    });
  });

  const list = [...map.values()];

  list.forEach(p => {
    p.variants.sort((a, b) => a.order - b.order);
    p.cardType ||= 'standard';
  });

  return list.sort((a, b) => a.order - b.order);
}

export function buildCategories(rows) {
  const cats = new Map();

  rows.forEach((r, idx) => {
    if (
      (r.show_on_site || 'Yes').toLowerCase() === 'no' ||
      !r.category ||
      !r.type
    ) return;

    if (!cats.has(r.category)) cats.set(r.category, []);

    cats.get(r.category).push({
      name: r.type,
      description: r.description || '',
      order: num(r.sort_order) ?? idx
    });
  });

  return [...cats].map(([name, types]) => ({
    name,
    types: types.sort((a, b) => a.order - b.order)
  }));
}

async function fetchCSV(url) {
  const res = await fetch(url, { cache: 'no-cache' });

  if (!res.ok) {
    throw new Error(`Could not load ${url} (${res.status})`);
  }

  return parseCSV(await res.text());
}

const CACHE_KEY = 'tb_catalogue_v1';

export async function loadCatalogue(urls) {
  try {
    const [p, c, s] = await Promise.all([
      fetchCSV(urls.products),
      urls.categories ? fetchCSV(urls.categories) : Promise.resolve([]),
      urls.settings ? fetchCSV(urls.settings) : Promise.resolve([])
    ]);

    const data = {
      products: buildProducts(p),
      categories: buildCategories(c),
      settings: Object.fromEntries(s.map(r => [r.key, r.value]))
    };

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {}

    return { data, fromCache: false };
  } catch (err) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cached) return { data: cached, fromCache: true };
    } catch (e) {}

    throw err;
  }
}
