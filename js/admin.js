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

/* ===== Sidebar Toggle ===== */
const sidebar = document.getElementById('adminSidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const SIDEBAR_STORAGE_KEY = 'zipstore_sidebar_collapsed';

function setSidebarState(collapsed) {
  sidebar.classList.toggle('collapsed', collapsed);
  localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
}

sidebarToggle.addEventListener('click', () => {
  setSidebarState(!sidebar.classList.contains('collapsed'));
});

if (localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1') {
  sidebar.classList.add('collapsed');
}

/* ===== Navigation ===== */
const navLinks = document.querySelectorAll('.admin-sidebar-nav a');
const sections = {
  dashboard: document.getElementById('section-dashboard'),
  products: document.getElementById('section-products'),
  categories: document.getElementById('section-categories'),
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
    if (link.dataset.section === 'categories') loadCategories();
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

/* ===== Multi-Image Input ===== */
const imageList = document.getElementById('image-list');
const addImageBtn = document.getElementById('add-image-btn');

function getImageRows() {
  return imageList.querySelectorAll('.image-input-row');
}

function getImageUrls() {
  const urls = [];
  getImageRows().forEach(row => {
    const val = row.querySelector('.p-image').value.trim();
    if (val) urls.push(val);
  });
  return urls;
}

function addImageRow(url) {
  const row = document.createElement('div');
  row.className = 'image-input-row';
  row.innerHTML = `
    <input type="url" class="p-image" placeholder="https://example.com/image.jpg" value="${url || ''}">
    <button type="button" class="btn btn-danger btn-sm btn-remove-image">&times;</button>
  `;
  row.querySelector('.btn-remove-image').addEventListener('click', () => {
    row.remove();
    toggleRemoveButtons();
  });
  imageList.appendChild(row);
  toggleRemoveButtons();
}

function toggleRemoveButtons() {
  const rows = getImageRows();
  rows.forEach((row, i) => {
    row.querySelector('.btn-remove-image').style.display = rows.length > 1 ? '' : 'none';
  });
}

addImageBtn.addEventListener('click', () => addImageRow(''));

toggleRemoveButtons();

/* ===== Products Form ===== */
const productForm = document.getElementById('product-form');
const formTitle = document.getElementById('form-title');
const formSubmitBtn = document.getElementById('form-submit-btn');
const formCancelBtn = document.getElementById('form-cancel-btn');
const pCategory = document.getElementById('p-category');
let editingProductId = null;

function resetForm() {
  productForm.reset();
  editingProductId = null;
  formTitle.textContent = 'Add New Product';
  formSubmitBtn.textContent = 'Create Product';
  formCancelBtn.style.display = 'none';
  imageList.innerHTML = '';
  addImageRow('');
  toggleRemoveButtons();
}

formCancelBtn.addEventListener('click', resetForm);

async function loadCategoryOptions(selectedId) {
  try {
    const data = await api('/categories');
    const cats = data.categories || [];
    pCategory.innerHTML = '<option value="">Select category...</option>';
    function addOptions(list, depth) {
      list.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat._id;
        opt.textContent = '  '.repeat(depth) + cat.name;
        if (selectedId && cat._id === selectedId) opt.selected = true;
        pCategory.appendChild(opt);
      });
    }
    const topLevel = cats.filter(c => !c.parent);
    topLevel.sort((a, b) => a.name.localeCompare(b.name));
    topLevel.forEach(parent => {
      addOptions([parent], 0);
      const children = cats.filter(c => c.parent && c.parent._id === parent._id);
      children.sort((a, b) => a.name.localeCompare(b.name));
      addOptions(children, 1);
    });
  } catch (err) {
    showToast('Failed to load categories: ' + err.message, 'error');
  }
}

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const images = getImageUrls();
  const category = pCategory.value;

  if (!category) {
    showToast('Please select a category', 'error');
    return;
  }

  const body = {
    title: document.getElementById('p-title').value,
    description: document.getElementById('p-desc').value,
    price: parseFloat(document.getElementById('p-price').value),
    category,
    stock: parseInt(document.getElementById('p-stock').value, 10),
    images,
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

/* ===== Categories Management ===== */
const catForm = document.getElementById('category-form');
const catFormTitle = document.getElementById('cat-form-title');
const catSubmitBtn = document.getElementById('cat-submit-btn');
const catCancelBtn = document.getElementById('cat-cancel-btn');
const cParent = document.getElementById('c-parent');
let editingCategoryId = null;

function resetCatForm() {
  catForm.reset();
  editingCategoryId = null;
  catFormTitle.textContent = 'Add New Category';
  catSubmitBtn.textContent = 'Create Category';
  catCancelBtn.style.display = 'none';
  cParent.value = '';
}

catCancelBtn.addEventListener('click', resetCatForm);

async function loadCategoryParentOptions(selectedId, excludeId) {
  try {
    const data = await api('/categories');
    const cats = data.categories || [];
    cParent.innerHTML = '<option value="">None (top-level)</option>';
    cats
      .filter(c => !c.parent && (!excludeId || c._id !== excludeId))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(parent => {
        const opt = document.createElement('option');
        opt.value = parent._id;
        opt.textContent = parent.name;
        if (selectedId && parent._id === selectedId) opt.selected = true;
        cParent.appendChild(opt);
      });
  } catch (err) {
    showToast('Failed to load parent categories: ' + err.message, 'error');
  }
}

catForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const body = {
    name: document.getElementById('c-name').value,
    slug: document.getElementById('c-slug').value,
    parent: document.getElementById('c-parent').value || null,
    image: document.getElementById('c-image').value || '',
  };

  try {
    if (editingCategoryId) {
      await api(`/categories/${editingCategoryId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      showToast('Category updated successfully', 'success');
    } else {
      await api('/categories', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      showToast('Category created successfully', 'success');
    }

    resetCatForm();
    loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

function renderCategoryTree(categories) {
  const container = document.getElementById('category-list');
  const empty = document.getElementById('category-empty');

  const topLevel = categories.filter(c => !c.parent);
  if (topLevel.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  container.innerHTML = '<div class="cat-tree"></div>';
  const tree = container.querySelector('.cat-tree');

  topLevel.sort((a, b) => a.name.localeCompare(b.name)).forEach(parent => {
    const children = categories.filter(c => c.parent && (c.parent._id === parent._id || c.parent === parent._id));
    children.sort((a, b) => a.name.localeCompare(b.name));

    const card = document.createElement('div');
    card.className = 'cat-card';
    card.innerHTML = `
      <div class="cat-card-header">
        ${parent.image ? `<img src="${parent.image}" class="cat-card-img">` : '<div class="cat-card-img-placeholder"></div>'}
        <div class="cat-card-info">
          <strong>${parent.name}</strong>
          <span class="cat-card-slug">/${parent.slug}</span>
        </div>
        <div class="cat-card-actions">
          <button class="btn btn-secondary btn-sm cat-edit" data-id="${parent._id}">Edit</button>
          <button class="btn btn-danger btn-sm cat-delete" data-id="${parent._id}">Delete</button>
        </div>
      </div>
      ${children.length ? `
        <div class="cat-sub-list">
          ${children.map(child => `
            <div class="cat-sub-item">
              ${child.image ? `<img src="${child.image}" class="cat-sub-img">` : '<div class="cat-sub-img-placeholder"></div>'}
              <span>${child.name} <span class="cat-card-slug">/${child.slug}</span></span>
              <div class="cat-card-actions">
                <button class="btn btn-secondary btn-sm cat-edit" data-id="${child._id}">Edit</button>
                <button class="btn btn-danger btn-sm cat-delete" data-id="${child._id}">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
    tree.appendChild(card);
  });

  container.querySelectorAll('.cat-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = categories.find(c => c._id === btn.dataset.id);
      if (cat) populateCatForm(cat, categories);
    });
  });

  container.querySelectorAll('.cat-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this category permanently?')) return;
      try {
        await api(`/categories/${btn.dataset.id}`, { method: 'DELETE' });
        showToast('Category deleted', 'success');
        loadCategories();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function populateCatForm(cat, allCats) {
  editingCategoryId = cat._id;
  catFormTitle.textContent = 'Edit Category';
  catSubmitBtn.textContent = 'Update Category';
  catCancelBtn.style.display = 'inline-flex';

  document.getElementById('c-name').value = cat.name || '';
  document.getElementById('c-slug').value = cat.slug || '';
  document.getElementById('c-image').value = cat.image || '';

  const parentId = cat.parent && (cat.parent._id || cat.parent);
  loadCategoryParentOptions(parentId, cat._id);
}

async function loadCategories() {
  try {
    const data = await api('/categories');
    const cats = data.categories || [];
    renderCategoryTree(cats);
    loadCategoryParentOptions();
    loadCategoryOptions();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

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

    tbody.innerHTML = products.map(p => {
      const safe = JSON.stringify(p).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      return `
      <tr>
        <td><strong>${p.title}</strong></td>
        <td>$${Number(p.price).toFixed(2)}</td>
        <td>${p.category?.name || p.category || '—'}</td>
        <td>${p.stock}</td>
        <td>
          <div class="actions">
            <button class="btn btn-secondary btn-sm" data-edit='${safe}'>Edit</button>
            <button class="btn btn-danger btn-sm" data-delete="${p._id}">Delete</button>
          </div>
        </td>
      </tr>
    `}).join('');

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
  document.getElementById('p-stock').value = product.stock ?? 10;
  document.getElementById('p-video').value = product.videoUrl || '';

  imageList.innerHTML = '';
  const imgs = product.images && product.images.length ? product.images : [product.imageUrl || ''];
  imgs.forEach(url => addImageRow(url));
  toggleRemoveButtons();

  loadCategoryOptions(product.category?._id || product.category || '');
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
