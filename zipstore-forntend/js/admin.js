const API_BASE_URL = 'https://zip-backend-myp0.onrender.com/api';

(function routingGuard() {
  const token = localStorage.getItem('zipstore_token');
  if (!token) {
    window.location.href = 'login.html';
  }
})();

function getToken() {
  return localStorage.getItem('zipstore_token');
}

function showToast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast ' + (type || '');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('zipstore_token');
    localStorage.removeItem('zipstore_user');
    window.location.href = 'login.html';
    throw new Error('Session expired');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ===== Sidebar ===== */
const sidebar = document.getElementById('adminSidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const SIDEBAR_STORAGE_KEY = 'zipstore_sidebar_collapsed';

sidebarToggle.addEventListener('click', () => {
  const collapsed = !sidebar.classList.contains('collapsed');
  sidebar.classList.toggle('collapsed', collapsed);
  localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
});

if (localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1') {
  sidebar.classList.add('collapsed');
}

/* ===== Navigation ===== */
const sections = {
  dashboard: document.getElementById('section-dashboard'),
  products: document.getElementById('section-products'),
  inventory: document.getElementById('section-inventory'),
  orders: document.getElementById('section-orders'),
  categories: document.getElementById('section-categories'),
  plugins: document.getElementById('section-plugins'),
};

document.querySelectorAll('.admin-sidebar-nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const name = link.dataset.section;
    showSection(name);
    if (name === 'dashboard') loadDashboard();
    if (name === 'inventory') loadInventory();
    if (name === 'products') loadCatSuggestions();
    if (name === 'orders') loadOrders();
    if (name === 'categories') loadCategories();
  });
});

function showSection(name) {
  Object.entries(sections).forEach(([key, el]) => { el.style.display = key === name ? 'block' : 'none'; });
  document.querySelectorAll('.admin-sidebar-nav a').forEach(l => l.classList.toggle('active', l.dataset.section === name));
}

/* ===== Dashboard ===== */
async function loadDashboard() {
  try {
    const [pData, oData] = await Promise.all([
      api('/products'),
      api('/admin/orders').catch(() => ({ orders: [] })),
    ]);
    const products = pData.products || pData;
    const orders = oData.orders || oData;
    document.getElementById('stat-revenue').textContent = `$${orders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + (o.totalAmount || 0), 0).toFixed(2)}`;
    document.getElementById('stat-orders').textContent = orders.length;
    document.getElementById('stat-products').textContent = products.length;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ===== Drag & Drop Images ===== */
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previews = document.getElementById('image-previews');
let uploadedImages = [];

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
  fileInput.value = '';
});

function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImages.push(e.target.result);
      renderPreviews();
    };
    reader.readAsDataURL(file);
  }
}

function renderPreviews() {
  if (!uploadedImages.length) {
    previews.innerHTML = '';
    return;
  }
  previews.innerHTML = uploadedImages.map((src, i) => `
    <div class="preview-item">
      <img src="${src}">
      <button type="button" class="preview-remove" data-index="${i}">&times;</button>
    </div>
  `).join('');
  previews.querySelectorAll('.preview-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      uploadedImages.splice(parseInt(btn.dataset.index), 1);
      renderPreviews();
    });
  });
}

function setPreviews(images) {
  uploadedImages = images.filter(s => s);
  renderPreviews();
}

function getImageData() {
  return [...uploadedImages];
}

/* ===== Category Cache ===== */
let categoryCache = [];

async function loadCatSuggestions() {
  try {
    const data = await api('/categories');
    const categories = data.categories || data;
    categoryCache = categories.map(c => ({ _id: c._id, name: c.name }));
    const dl = document.getElementById('cat-suggestions');
    dl.innerHTML = categoryCache.map(c => `<option value="${c.name}">`).join('');
  } catch (_) {}
}

async function resolveCategory(input) {
  if (!input) return null;
  const existing = categoryCache.find(c => c.name.toLowerCase() === input.toLowerCase());
  if (existing) return existing._id;
  const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
  try {
    const result = await api('/categories', {
      method: 'POST',
      body: JSON.stringify({ name: input, slug }),
    });
    const cat = result.category;
    categoryCache.push({ _id: cat._id, name: cat.name });
    const dl = document.getElementById('cat-suggestions');
    dl.innerHTML = categoryCache.map(c => `<option value="${c.name}">`).join('');
    return cat._id;
  } catch (err) {
    showToast('Failed to create category: ' + err.message, 'error');
    return null;
  }
}

/* ===== Product Form ===== */
const productForm = document.getElementById('product-form');
const formTitle = document.getElementById('form-title');
const formSubmitBtn = document.getElementById('form-submit-btn');
const formCancelBtn = document.getElementById('form-cancel-btn');
let editingProductId = null;

function resetForm() {
  productForm.reset();
  editingProductId = null;
  formTitle.textContent = 'New Product';
  formSubmitBtn.textContent = 'Save Product';
  formCancelBtn.style.display = 'none';
  setPreviews([]);
}

formCancelBtn.addEventListener('click', resetForm);

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formSubmitBtn.disabled = true;
  formSubmitBtn.textContent = 'Saving...';

  try {
    const catInput = document.getElementById('p-category').value.trim();
    const categoryId = await resolveCategory(catInput);
    if (!categoryId) { throw new Error('Please enter a category'); }

    const images = getImageData();

    const body = {
      title: document.getElementById('p-title').value,
      description: document.getElementById('p-desc').value,
      price: parseFloat(document.getElementById('p-price').value),
      category: categoryId,
      stock: parseInt(document.getElementById('p-stock').value, 10) || 0,
      images: images,
      videoUrl: document.getElementById('p-video').value || '',
    };

    if (editingProductId) {
      await api(`/products/${editingProductId}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Product updated!', 'success');
    } else {
      await api('/products', { method: 'POST', body: JSON.stringify(body) });
      showToast('Product created!', 'success');
    }

    resetForm();
    loadInventory();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    formSubmitBtn.disabled = false;
    formSubmitBtn.textContent = editingProductId ? 'Update Product' : 'Save Product';
  }
});

/* ===== Inventory ===== */
const tbody = document.getElementById('inventory-tbody');
const emptyRow = document.getElementById('inventory-empty');

function parseImages(product) {
  if (product.images && product.images.length) return product.images;
  if (product.imageUrl) {
    try {
      const parsed = JSON.parse(product.imageUrl);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [product.imageUrl];
  }
  return [];
}

async function loadInventory() {
  try {
    const data = await api('/products');
    const products = data.products || data;

    if (!products.length) {
      tbody.innerHTML = '';
      emptyRow.style.display = 'block';
      return;
    }

    emptyRow.style.display = 'none';
    tbody.innerHTML = products.map(p => {
      const safe = JSON.stringify(p).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      const imgs = parseImages(p);
      const thumb = imgs[0] || '';
      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            ${thumb ? `<img src="${thumb}" style="width:40px;height:40px;border-radius:var(--radius-sm);object-fit:cover;flex-shrink:0">` : ''}
            <strong>${p.title}</strong>
          </div>
        </td>
        <td>$${Number(p.price).toFixed(2)}</td>
        <td>${p.category?.name || '—'}</td>
        <td>${p.stock}</td>
        <td>
          <div class="actions">
            <button class="btn btn-secondary btn-sm" data-edit='${safe}'>Edit</button>
            <button class="btn btn-danger btn-sm" data-delete="${p._id}">Delete</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = JSON.parse(btn.dataset.edit);
        editingProductId = p._id;
        formTitle.textContent = 'Edit Product';
        formSubmitBtn.textContent = 'Update Product';
        formCancelBtn.style.display = 'inline-flex';
        document.getElementById('p-title').value = p.title || '';
        document.getElementById('p-desc').value = p.description || '';
        document.getElementById('p-price').value = p.price || '';
        document.getElementById('p-category').value = p.category?.name || '';
        document.getElementById('p-stock').value = p.stock ?? 10;
        document.getElementById('p-video').value = p.videoUrl || '';
        setPreviews(parseImages(p));
        showSection('products');
        document.getElementById('p-title').focus();
      });
    });

    tbody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this product?')) return;
        try {
          await api(`/products/${btn.dataset.delete}`, { method: 'DELETE' });
          showToast('Deleted', 'success');
          loadInventory();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ===== Order Management ===== */
const ordersTbody = document.getElementById('orders-tbody');
const ordersEmpty = document.getElementById('orders-empty');
const orderModal = document.getElementById('orderModal');
const modalBody = document.getElementById('modalBody');

const ORDER_STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

function openOrderModal(order) {
  const itemsHtml = order.items.map(i => {
    const name = i.productId?.title || 'Unknown Product';
    return `<tr><td>${name}</td><td>${i.quantity}</td><td>$${Number(i.price).toFixed(2)}</td><td>$${(i.price * i.quantity).toFixed(2)}</td></tr>`;
  }).join('');

  modalBody.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-4)">
      <div><strong>Order ID</strong><br><code style="font-size:var(--font-size-sm)">${order._id}</code></div>
      <div><strong>Order Date</strong><br>${new Date(order.createdAt).toLocaleString()}</div>
      <div><strong>Customer</strong><br>${order.userId?.name || '—'}</div>
      <div><strong>Email</strong><br>${order.userId?.email || '—'}</div>
      <div><strong>Payment</strong><br><span class="status-badge status-${order.paymentStatus}">${order.paymentStatus}</span> / ${order.paymentMethod || 'mock'}</div>
      <div><strong>Transaction ID</strong><br>${order.transactionId || '—'}</div>
      <div><strong>Order Status</strong><br><span class="status-badge status-${order.orderStatus}">${order.orderStatus}</span></div>
      <div><strong>Total Amount</strong><br><strong>$${Number(order.totalAmount).toFixed(2)}</strong></div>
    </div>
    <div style="margin-bottom:var(--space-4)">
      <strong>Shipping Address</strong><br>
      ${order.shippingAddress?.street || ''}, ${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} ${order.shippingAddress?.zip || ''}, ${order.shippingAddress?.country || ''}
    </div>
    <div>
      <strong>Ordered Products</strong>
      <div class="admin-table-wrapper" style="margin-top:var(--space-2)">
        <table class="admin-table">
          <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>
    </div>
  `;
  orderModal.style.display = 'flex';
}

function closeOrderModal() {
  orderModal.style.display = 'none';
}

document.getElementById('modalClose').addEventListener('click', closeOrderModal);
orderModal.addEventListener('click', (e) => {
  if (e.target === orderModal) closeOrderModal();
});

async function deleteOrder(orderId) {
  if (!confirm('Delete this order permanently?')) return;
  try {
    await api(`/admin/orders/${orderId}`, { method: 'DELETE' });
    showToast('Order deleted', 'success');
    loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadOrders() {
  try {
    const data = await api('/admin/orders');
    const orders = data.orders || data;

    if (!orders.length) {
      ordersTbody.innerHTML = '';
      ordersEmpty.style.display = 'block';
      return;
    }

    ordersEmpty.style.display = 'none';
    ordersTbody.innerHTML = orders.map(o => {
      const date = new Date(o.createdAt).toLocaleDateString();
      const statusOptions = ORDER_STATUSES.map(s =>
        `<option value="${s}"${s === o.orderStatus ? ' selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
      ).join('');
      const itemsList = o.items.map(i =>
        `${i.productId?.title || 'Unknown'} x${i.quantity}`
      ).join('<br>');
      const addr = `${o.shippingAddress?.street || ''}, ${o.shippingAddress?.city || ''}`;
      return `<tr>
        <td><code>${o._id.slice(-8)}</code></td>
        <td>
          <strong>${o.userId?.name || '—'}</strong><br>
          <span style="font-size:var(--font-size-xs);color:var(--color-text-secondary)">${o.userId?.email || ''}</span>
        </td>
        <td style="font-size:var(--font-size-xs)">${itemsList}</td>
        <td style="font-size:var(--font-size-xs)">${addr}</td>
        <td><strong>$${Number(o.totalAmount).toFixed(2)}</strong></td>
        <td>
          <span class="status-badge status-${o.paymentStatus}">${o.paymentStatus}</span>
          <span style="font-size:var(--font-size-xs);color:var(--color-text-secondary);display:block">${o.paymentMethod || 'mock'}</span>
        </td>
        <td>
          <span class="status-badge status-${o.orderStatus}">${o.orderStatus}</span>
        </td>
        <td style="font-size:var(--font-size-xs);color:var(--color-text-secondary)">${date}</td>
        <td>
          <div class="actions" style="flex-wrap:nowrap">
            <select class="order-status-select" data-order-id="${o._id}" style="font-size:var(--font-size-xs);padding:var(--space-1) var(--space-2);border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-white);max-width:90px">
              ${statusOptions}
            </select>
            <button class="btn btn-secondary btn-sm" data-view-order='${o._id}'>View</button>
            <button class="btn btn-danger btn-sm" data-delete-order="${o._id}">Delete</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    document.querySelectorAll('[data-view-order]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.viewOrder;
        const order = orders.find(o => o._id === id);
        if (order) openOrderModal(order);
      });
    });

    document.querySelectorAll('[data-delete-order]').forEach(btn => {
      btn.addEventListener('click', () => deleteOrder(btn.dataset.deleteOrder));
    });

    document.querySelectorAll('.order-status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        try {
          await api(`/admin/orders/${sel.dataset.orderId}`, {
            method: 'PATCH',
            body: JSON.stringify({ orderStatus: sel.value }),
          });
          showToast('Order status updated', 'success');
          loadOrders();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ===== Category Management ===== */
const catForm = document.getElementById('category-form');
const catName = document.getElementById('cat-name');
const catSlug = document.getElementById('cat-slug');
const catImage = document.getElementById('cat-image');
const catSubmitBtn = document.getElementById('cat-submit-btn');
const catCancelBtn = document.getElementById('cat-cancel-btn');
const catFormTitle = document.getElementById('cat-form-title');
const categoriesTbody = document.getElementById('categories-tbody');
const categoriesEmpty = document.getElementById('categories-empty');
let editingCategoryId = null;

catName.addEventListener('input', () => {
  if (!editingCategoryId) {
    catSlug.value = catName.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || '';
  }
});

function resetCatForm() {
  catForm.reset();
  editingCategoryId = null;
  catFormTitle.textContent = 'Add Category';
  catSubmitBtn.textContent = 'Add Category';
  catCancelBtn.style.display = 'none';
}

catCancelBtn.addEventListener('click', resetCatForm);

catForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  catSubmitBtn.disabled = true;
  catSubmitBtn.textContent = 'Saving...';

  try {
    const slug = catSlug.value.trim() || catName.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';

    const body = {
      name: catName.value.trim(),
      slug,
      image: catImage.value.trim() || '',
    };

    if (editingCategoryId) {
      await api(`/categories/${editingCategoryId}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Category updated!', 'success');
    } else {
      await api('/categories', { method: 'POST', body: JSON.stringify(body) });
      showToast('Category created!', 'success');
    }

    resetCatForm();
    loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    catSubmitBtn.disabled = false;
    catSubmitBtn.textContent = editingCategoryId ? 'Update Category' : 'Add Category';
  }
});

async function loadCategories() {
  try {
    const data = await api('/categories');
    const categories = data.categories || data;

    if (!categories.length) {
      categoriesTbody.innerHTML = '';
      categoriesEmpty.style.display = 'block';
      return;
    }

    categoriesEmpty.style.display = 'none';

    const productData = await api('/products');
    const products = productData.products || productData;
    const productCountMap = {};
    products.forEach(p => {
      const cid = p.category?._id || p.category;
      if (cid) productCountMap[cid] = (productCountMap[cid] || 0) + 1;
    });

    categoriesTbody.innerHTML = categories.map(c =>
      `<tr>
        <td><strong>${c.name}</strong></td>
        <td><code>${c.slug}</code></td>
        <td>${productCountMap[c._id] || 0}</td>
        <td>
          <div class="actions">
            <button class="btn btn-secondary btn-sm" data-edit-cat='${JSON.stringify(c).replace(/'/g, '&#39;').replace(/"/g, '&quot;')}'>Edit</button>
            <button class="btn btn-danger btn-sm" data-delete-cat="${c._id}">Delete</button>
          </div>
        </td>
      </tr>`
    ).join('');

    categoriesTbody.querySelectorAll('[data-edit-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = JSON.parse(btn.dataset.editCat);
        editingCategoryId = c._id;
        catFormTitle.textContent = 'Edit Category';
        catSubmitBtn.textContent = 'Update Category';
        catCancelBtn.style.display = 'inline-flex';
        catName.value = c.name || '';
        catSlug.value = c.slug || '';
        catImage.value = c.image || '';
      });
    });

    categoriesTbody.querySelectorAll('[data-delete-cat]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this category?')) return;
        try {
          await api(`/categories/${btn.dataset.deleteCat}`, { method: 'DELETE' });
          showToast('Category deleted', 'success');
          loadCategories();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ===== Plugins ===== */
const PLUGINS = [
  { id: 'discount', name: 'Discount Engine', desc: '10% off on orders over $100.' },
  { id: 'analytics', name: 'Analytics Tracker', desc: 'Tracks page views and events.' },
  { id: 'reviews', name: 'Reviews & Ratings', desc: 'Enables product reviews.' },
  { id: 'newsletter', name: 'Newsletter Signup', desc: 'Email capture popup.' },
];

function renderPlugins() {
  const state = JSON.parse(localStorage.getItem('zipstore_plugins') || '{}');
  const list = document.getElementById('plugin-list');
  list.innerHTML = PLUGINS.map(p => {
    const on = state[p.id] || false;
    return `<div class="admin-plugin-card">
      <div class="admin-plugin-info"><h4>${p.name}</h4><p>${p.desc}</p></div>
      <div class="toggle ${on ? 'active' : ''}" data-plugin="${p.id}"></div>
    </div>`;
  }).join('');
  list.querySelectorAll('.toggle').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.plugin;
      const state = JSON.parse(localStorage.getItem('zipstore_plugins') || '{}');
      state[id] = !state[id];
      localStorage.setItem('zipstore_plugins', JSON.stringify(state));
      renderPlugins();
    });
  });
}

/* ===== Init ===== */
loadDashboard();
renderPlugins();
loadCatSuggestions();
