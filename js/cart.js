const API_BASE_URL = 'https://zip-backend-myp0.onrender.com/api';

const _inflight = new Map();
async function apiGet(url, opts) {
  const key = url + (opts ? JSON.stringify(opts) : '');
  if (_inflight.has(key)) return _inflight.get(key);
  const p = fetch(url, opts).then(r => { _inflight.delete(key); if (!r.ok) throw new Error('API error'); return r.json(); }).catch(e => { _inflight.delete(key); throw e; });
  _inflight.set(key, p);
  return p;
}

document.addEventListener('click', e => {
  const t = e.target.closest('#navToggle');
  if (t) document.getElementById('navLinks')?.classList.toggle('open');
});

const Cart = {
  _key: 'zipstore_cart',

  get() {
    try {
      return JSON.parse(localStorage.getItem(this._key)) || [];
    } catch {
      return [];
    }
  },

  save(items) {
    localStorage.setItem(this._key, JSON.stringify(items));
    this._updateBadge();
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: items }));
  },

  add(product, quantity = 1) {
    const items = this.get();
    const existing = items.find(i => i.productId === product._id || i.productId === product.id);

    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        productId: product._id || product.id,
        title: product.title,
        price: product.price,
        imageUrl: product.imageUrl || (product.images && product.images[0]) || '',
        quantity,
      });
    }

    this.save(items);
    return items;
  },

  remove(productId) {
    const items = this.get().filter(i => (i.productId !== productId));
    this.save(items);
    return items;
  },

  updateQuantity(productId, delta) {
    const items = this.get();
    const item = items.find(i => i.productId === productId);
    if (!item) return items;

    item.quantity += delta;
    if (item.quantity <= 0) {
      return this.remove(productId);
    }

    this.save(items);
    return items;
  },

  setQuantity(productId, qty) {
    const items = this.get();
    const item = items.find(i => i.productId === productId);
    if (!item) return items;

    item.quantity = Math.max(1, qty);
    this.save(items);
    return items;
  },

  clear() {
    this.save([]);
  },

  getTotal() {
    return this.get().reduce((sum, i) => sum + i.price * i.quantity, 0);
  },

  getCount() {
    return this.get().reduce((sum, i) => sum + i.quantity, 0);
  },

  _updateBadge() {
    const count = this.getCount();
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
    document.querySelectorAll('.cart-icon').forEach(el => {
      el.classList.toggle('has-items', count > 0);
    });
  },

  init() {
    this._updateBadge();
  },
};

document.addEventListener('DOMContentLoaded', () => Cart.init());