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

function api(path, options = {}) {
  const token = getToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(async (res) => {
    if (res.status === 401) {
      localStorage.removeItem('zipstore_token');
      localStorage.removeItem('zipstore_user');
      window.location.href = 'login.html';
      throw new Error('Session expired');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  });
}

/* ===== Navigation ===== */
const navLinks = document.querySelectorAll('.admin-sidebar-nav a');
const sections = {
  dashboard: document.getElementById('section-dashboard'),
  products: document.getElementById('section-products'),
  inventory: document.getElementById('section-inventory'),
  plugins: document.getElementById('section-plugins'),
};

function showSection(name) {
  Object.entries(sections).forEach(([key, el]) => {
    el.style.display = key === name ? 'block' : 'none';
  });
  navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.section === name);
  });
}

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(link.dataset.section);
    if (link.dataset.section === 'dashboard') loadDashboard();
    if (link.dataset.section === 'inventory') loadInventory();
  });
});

/* ===== Dashboard ===== */
async function loadDashboard() {
  try {
    const [productsData, ordersData] = await Promise.all([
      api('/products'),
      api('/admin/orders'),
    ]);

    const products = productsData.products || productsData;
    const orders = ordersData.orders || ordersData;

    const totalRevenue = orders
      .filter(o => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    document.getElementById('stat-revenue').textContent = `$${totalRevenue.toFixed(2)}`;
    document.getElementById('stat-orders').textContent = orders.length;
    document.getElementById('stat-products').textContent = products.length;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ===== Products Form (Create / Update) ===== */
const productForm = document.getElementById('product-form');
const formTitle = document.getElementById('form-title');
const formSubmitBtn = document.getElementById('form-submit-btn');
const formCancelBtn = document.getElementById('form-cancel-btn');
let editingProductId = null;

function resetForm() {
  productForm.reset();
  editingProductId = null;
  formTitle.textContent = 'Add New Product';
  formSubmitBtn.textContent = 'Create Product';
  formCancelBtn.style.display = 'none';
}

formCancelBtn.addEventListener('click', resetForm);

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const body = {
    title: document.getElementById('p-title').value,
    description: document.getElementById('p-desc').value,
    price: parseFloat(document.getElementById('p-price').value),
    category: document.getElementById('p-category').value,
    stock: parseInt(document.getElementById('p-stock').value, 10),
    imageUrl: document.getElementById('p-image').value || '',
    videoUrl: document.getElementById('p-video').value || '',
  };

  try {
    if (editingProductId) {
      await api(`/products/${editingProductId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      showToast('Product updated successfully', 'success');
    } else {
      await api('/products', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      showToast('Product created successfully', 'success');
    }

    resetForm();
    loadInventory();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

/* ===== Inventory Table ===== */
const tbody = document.getElementById('inventory-tbody');
const emptyRow = document.getElementById('inventory-empty');

async function loadInventory() {
  try {
    const data = await api('/products');
    const products = data.products || data;

    if (products.length === 0) {
      tbody.innerHTML = '';
      emptyRow.style.display = 'block';
      return;
    }

    emptyRow.style.display = 'none';

    tbody.innerHTML = products.map(p => `
      <tr>
        <td><strong>${p.title}</strong></td>
        <td>$${Number(p.price).toFixed(2)}</td>
        <td>${p.category?.name || p.category || '—'}</td>
        <td>${p.stock}</td>
        <td>
          <div class="actions">
            <button class="btn btn-secondary btn-sm" data-edit='${JSON.stringify(p).replace(/'/g, '&#39;')}'>Edit</button>
            <button class="btn btn-danger btn-sm" data-delete="${p._id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const product = JSON.parse(btn.dataset.edit);
        populateForm(product);
      });
    });

    tbody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this product permanently?')) return;
        try {
          await api(`/products/${btn.dataset.delete}`, { method: 'DELETE' });
          showToast('Product deleted', 'success');
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

function populateForm(product) {
  editingProductId = product._id;
  formTitle.textContent = 'Edit Product';
  formSubmitBtn.textContent = 'Update Product';
  formCancelBtn.style.display = 'inline-flex';

  document.getElementById('p-title').value = product.title || '';
  document.getElementById('p-desc').value = product.description || '';
  document.getElementById('p-price').value = product.price || '';
  document.getElementById('p-category').value = product.category?._id || product.category || '';
  document.getElementById('p-stock').value = product.stock ?? 10;
  document.getElementById('p-image').value = product.imageUrl || '';
  document.getElementById('p-video').value = product.videoUrl || '';

  showSection('products');
  document.getElementById('p-title').focus();
}

/* ===== Plugin Configuration ===== */
const PLUGIN_STORAGE_KEY = 'zipstore_plugins';

const AVAILABLE_PLUGINS = [
  { id: 'discount', name: 'Discount Engine', desc: 'Applies 10% off on orders over $100.' },
  { id: 'analytics', name: 'Analytics Tracker', desc: 'Tracks page views and user events.' },
  { id: 'reviews', name: 'Reviews & Ratings', desc: 'Enables product review submissions.' },
  { id: 'newsletter', name: 'Newsletter Signup', desc: 'Shows email capture popup on the storefront.' },
];

function getPluginState() {
  try {
    return JSON.parse(localStorage.getItem(PLUGIN_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function savePluginState(state) {
  localStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify(state));
}

function renderPlugins() {
  const state = getPluginState();
  const list = document.getElementById('plugin-list');

  list.innerHTML = AVAILABLE_PLUGINS.map(p => {
    const enabled = state[p.id] || false;
    return `
      <div class="admin-plugin-card">
        <div class="admin-plugin-info">
          <h4>${p.name}</h4>
          <p>${p.desc}</p>
        </div>
        <div class="toggle ${enabled ? 'active' : ''}" data-plugin="${p.id}"></div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.toggle').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.plugin;
      const state = getPluginState();
      state[id] = !state[id];
      savePluginState(state);
      renderPlugins();
      showToast(`${AVAILABLE_PLUGINS.find(p => p.id === id).name} ${state[id] ? 'enabled' : 'disabled'}`, 'success');
    });
  });
}

/* ===== Init ===== */
loadDashboard();
renderPlugins();
