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
      api('/admin/orders'),
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
    const data = await api('/products');
    const products = data.products || data;
    const map = {};
    products.forEach(p => {
      if (p.category && p.category._id) map[p.category._id] = p.category.name;
    });
    categoryCache = Object.entries(map).map(([id, name]) => ({ _id: id, name }));
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
      imageUrl: images.length ? JSON.stringify(images) : '',
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
