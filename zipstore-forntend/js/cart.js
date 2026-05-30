const API_BASE_URL = 'https://your-backend.com/api';

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
        imageUrl: product.imageUrl || '',
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
  },

  init() {
    this._updateBadge();
  },
};

document.addEventListener('DOMContentLoaded', () => Cart.init());
