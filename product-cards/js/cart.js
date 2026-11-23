const KEY = 'tb_cart_v1';
let memoryCart = [];
let storageUnavailable = false;

const itemKey = item => `${item.id ?? ''}|${item.size ?? ''}`;
const quantity = value => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(1, Math.min(999, Math.floor(number)))
    : 1;
};

export const Cart = {
  get() {
    let items = memoryCart;

    if (!storageUnavailable) {
      try {
        const saved = JSON.parse(localStorage.getItem(KEY));
        if (Array.isArray(saved)) items = saved;
      } catch (error) {
        storageUnavailable = true;
      }
    }

    return items
      .filter(item => item && typeof item === 'object')
      .map(item => ({ ...item, key: itemKey(item), qty: quantity(item.qty) }));
  },

  save(items) {
    memoryCart = items;

    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (error) {
      storageUnavailable = true;
    }

    document.dispatchEvent(
      new CustomEvent('cart:change', { detail: this.get() })
    );
  },

  add(item) {
    const items = this.get();
    const key = itemKey(item);
    const found = items.find(cartItem => cartItem.key === key);

    if (found) {
      found.qty = Math.min(999, found.qty + quantity(item.qty));
    } else {
      items.push({ ...item, key, qty: quantity(item.qty) });
    }

    this.save(items);
  },

  count() {
    return this.get().reduce((total, item) => total + item.qty, 0);
  },

  update(key, value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;

    if (number <= 0) {
      this.remove(key);
      return;
    }

    const items = this.get();
    const item = items.find(cartItem => cartItem.key === key);
    if (!item) return;

    item.qty = quantity(number);
    this.save(items);
  },

  remove(key) {
    this.save(this.get().filter(item => item.key !== key));
  },

  clear() {
    this.save([]);
  }
};
