import { accountNavModule } from "./navbarModule.js";
import { overlayModule } from "./overlay.js";

export async function initAccount() {
  /*
  const token = localStorage.getItem('token');
  if (!token) {
    await loadTemplate('signup');
    return;
  }
  try {
    const res = await fetch('api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      localStorage.removeItem('token');
      await loadTemplate('login');
      return;
    }
    
    if (!res.ok) throw new Error('Server error');

    await loadAccountPanel('overview');
  } catch (err) {
    console.error('Session check failed: ', err);
    await loadTemplate('login');
  }
  */
  accountNavModule.init();
  const container = document.querySelector('.accountOverview');
  const navPanel = container.querySelector('.navPanel');
  const contentPane = container.querySelector('.contentPane');
  const panelCache = {};

  // ============================================================
  // PANEL ROUTER
  // Maps data-panel values to their render functions.
  // When your Node.js API is ready, only the render functions
  // need to change — this router stays exactly the same.
  // ============================================================
  const panelRenderers = {
    'overview':         renderOverview,
    'payment-methods':  renderPaymentMethods,
    'order-history':    renderOrderHistory,
    'addresses':        renderAddresses,
    'wishlist':         renderWishlist,
    'returns':          renderReturns,
    'rewards':          renderRewards,
    'newsletter':       renderNewsletter,
    'settings':         renderSettings,
    'admin':            renderAdmin,
  };

  // ============================================================
  // PANEL LOADER
  // 1. Marks the clicked nav button active
  // 2. Shows a loading state immediately
  // 3. Fetches the HTML template (cached after first load)
  // 4. Injects the template into .contentPane
  // 5. Calls the render function which fetches + populates data
  //
  // HOW DATA GETS IN:
  // Each render function calls mockFetch() which returns fake data.
  // When your Node.js API exists, replace mockFetch('key') with
  // fetch('/api/account/key').then(res => res.json())
  // The rest of the render function stays the same.
  // ============================================================
  async function loadPanel(panelName) {
     const currentActive = navPanel.querySelector('button.active');
    if (currentActive && currentActive.dataset.panel === panelName) return;
    if (!panelRenderers[panelName]) {
      contentPane.innerHTML = '<p class="panel-error">Panel not found.</p>';
      return;
    }

    // Mark active nav button
    navPanel.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.panel === panelName);
    });

    // Show loading state while template + data fetch
    contentPane.innerHTML = '<div class="panel-loading"><span class="loading-spinner"></span> Loading...</div>';

    // Fetch HTML template, use cache after first load
    if (!panelCache[panelName]) {
      try {
        const res = await fetch(`templates/account/${panelName}.html`);
        if (!res.ok) throw new Error(`Template ${panelName}.html not found`);
        panelCache[panelName] = await res.text();
      } catch (err) {
        console.error(err);
        contentPane.innerHTML = '<p class="panel-error">Failed to load panel.</p>';
        return;
      }
    }

    // Inject template HTML into the content pane
    contentPane.innerHTML = panelCache[panelName];

    // Run the render function for this panel
    // This is where data fetching and DOM population happens
    await panelRenderers[panelName]();
  }

  // ============================================================
  // PANEL RENDERERS
  // Each function:
  //   1. Fetches data (mock now, real API later)
  //   2. Finds the elements that the HTML template defined
  //   3. Populates those elements with the data
  //   4. Attaches any event listeners needed for interactivity
  // ============================================================

  async function renderOverview() {
    // MOCK: replace with fetch('/api/account/overview').then(r => r.json())
    const user = await mockFetch('user');
    const stats = await mockFetch('stats');

    document.getElementById('user-avatar').src = user.avatar;
    document.getElementById('user-fullname').textContent = `${user.firstName} ${user.lastName}`;
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('user-since').textContent = `Member since ${formatDate(user.dateCreated)}`;
    document.getElementById('stat-orders').textContent = stats.orders;
    document.getElementById('stat-wishlist').textContent = stats.wishlist;
    document.getElementById('stat-points').textContent = stats.points;
    document.getElementById('stat-returns').textContent = stats.returns;
  }

  async function renderPaymentMethods() {
    // MOCK: replace with fetch('/api/account/payment-methods').then(r => r.json())
    const methods = await mockFetch('paymentMethods');
    const list = document.getElementById('card-list');

    list.innerHTML = methods.length ? methods.map(card => `
      <li class="card-item" data-id="${card.id}">
        <div class="card-brand">${card.brand}</div>
        <div class="card-details">
          <span>•••• •••• •••• ${card.last4}</span>
          <span>Expires ${card.expiry}</span>
          ${card.isDefault ? '<span class="badge-default">Default</span>' : ''}
        </div>
        <button class="btn-ghost remove-card" data-id="${card.id}">Remove</button>
      </li>
    `).join('') : '<li class="empty-state">No saved payment methods.</li>';

    // Toggle add card form
    document.querySelector('.add-card-btn')
      .addEventListener('click', () => toggleForm('add-card-form'));

    document.getElementById('cancel-card-btn')
      .addEventListener('click', () => toggleForm('add-card-form', false));

    document.getElementById('save-card-btn')
      .addEventListener('click', saveCard);

    // Remove card buttons
    list.querySelectorAll('.remove-card').forEach(btn =>
      btn.addEventListener('click', () => removeCard(btn.dataset.id))
    );
  }

  async function renderOrderHistory() {
    // MOCK: replace with fetch('/api/account/orders').then(r => r.json())
    const orders = await mockFetch('orders');
    const list = document.getElementById('order-list');
    const filter = document.getElementById('order-status-filter');

    function renderOrders(filteredOrders) {
      list.innerHTML = filteredOrders.length ? filteredOrders.map(order => `
        <li class="order-item">
          <div class="order-header">
            <span class="order-number">Order #${order.orderNumber}</span>
            <span class="order-date">${formatDate(order.orderDate)}</span>
            <span class="order-status status-${order.orderStatus}">${capitalize(order.orderStatus)}</span>
          </div>
          <ul class="order-items-list">
            ${order.items.map(item => `
              <li class="order-line-item">
                <img src="${item.image}" alt="${item.name}">
                <span>${item.name}</span>
                <span>x${item.qty}</span>
                <span>$${item.price}</span>
              </li>
            `).join('')}
          </ul>
        </li>
      `).join('') : '<li class="empty-state">No orders found.</li>';
    }

    renderOrders(orders);

    filter.addEventListener('change', () => {
      const val = filter.value;
      renderOrders(val === 'all' ? orders : orders.filter(o => o.orderStatus === val));
    });
  }

  async function renderAddresses() {
    // MOCK: replace with fetch('/api/account/addresses').then(r => r.json())
    const addresses = await mockFetch('addresses');
    const list = document.getElementById('address-list');

    function renderList(addrs) {
      list.innerHTML = addrs.length ? addrs.map(addr => `
        <li class="address-item" data-id="${addr.id}">
          <div class="address-label">${addr.label} ${addr.isDefault ? '<span class="badge-default">Default</span>' : ''}</div>
          <div class="address-text">
            ${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}<br>
            ${addr.city}, ${addr.state} ${addr.zip}, ${addr.country}
          </div>
          <div class="address-actions">
            <button class="btn-ghost edit-address" data-id="${addr.id}">Edit</button>
            <button class="btn-ghost remove-address" data-id="${addr.id}">Remove</button>
          </div>
        </li>
      `).join('') : '<li class="empty-state">No saved addresses.</li>';

      list.querySelectorAll('.remove-address').forEach(btn =>
        btn.addEventListener('click', () => removeAddress(btn.dataset.id, addrs, renderList))
      );
      list.querySelectorAll('.edit-address').forEach(btn =>
        btn.addEventListener('click', () => showEditAddressForm(btn.dataset.id, addrs))
      );
    }

    renderList(addresses);

    document.querySelector('.add-address-btn')
      .addEventListener('click', () => showAddAddressForm());

    document.getElementById('cancel-address-btn')
      .addEventListener('click', () => toggleForm('address-form', false));

    document.getElementById('save-address-btn')
      .addEventListener('click', () => saveAddress(addresses, renderList));
  }

  async function renderWishlist() {
    // MOCK: replace with fetch('/api/account/wishlist').then(r => r.json())
    const items = await mockFetch('wishlist');
    const list = document.getElementById('wishlist-list');
    const count = document.getElementById('wishlist-count');

    count.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

    list.innerHTML = items.length ? items.map(item => `
      <li class="wishlist-item" data-id="${item.id}">
        <img src="${item.image}" alt="${item.name}" class="wishlist-img">
        <div class="wishlist-info">
          <span class="wishlist-name">${item.name}</span>
          <span class="wishlist-price">$${item.price}</span>
          <span class="wishlist-added">Saved ${formatDate(item.dateAdded)}</span>
        </div>
        <div class="wishlist-actions">
          <button class="btn-primary add-to-cart" data-id="${item.id}">Add to Cart</button>
          <button class="btn-ghost remove-wishlist" data-id="${item.id}">Remove</button>
        </div>
      </li>
    `).join('') : '<li class="empty-state">Your wishlist is empty.</li>';

    list.querySelectorAll('.add-to-cart').forEach(btn =>
      btn.addEventListener('click', () => addToCart(btn.dataset.id))
    );
    list.querySelectorAll('.remove-wishlist').forEach(btn =>
      btn.addEventListener('click', () => removeWishlistItem(btn.dataset.id))
    );
  }

  async function renderReturns() {
    // MOCK: replace with fetch('/api/account/returns').then(r => r.json())
    const [returns, orders] = await Promise.all([
      mockFetch('returns'),
      mockFetch('orders')
    ]);
    const list = document.getElementById('returns-list');

    list.innerHTML = returns.length ? returns.map(ret => `
      <li class="return-item">
        <div class="return-header">
          <span class="return-order">Order #${ret.orderNumber}</span>
          <span class="return-status status-${ret.status.toLowerCase().replace(' ', '-')}">${ret.status}</span>
        </div>
        <div class="return-details">
          <span>${ret.item}</span>
          <span>Refund: $${ret.refundAmount}</span>
          <span>Initiated: ${formatDate(ret.dateInitiated)}</span>
        </div>
      </li>
    `).join('') : '<li class="empty-state">No returns or refunds.</li>';

    // Populate return form order select
    const orderSelect = document.getElementById('return-order-select');
    orders.forEach(order => {
      const option = document.createElement('option');
      option.value = order.orderId;
      option.textContent = `Order #${order.orderNumber} — ${formatDate(order.orderDate)}`;
      orderSelect.appendChild(option);
    });

    document.querySelector('.initiate-return-btn')
      .addEventListener('click', () => toggleForm('return-form'));

    document.getElementById('cancel-return-btn')
      .addEventListener('click', () => toggleForm('return-form', false));

    document.getElementById('submit-return-btn')
      .addEventListener('click', submitReturn);
  }

  async function renderRewards() {
    // MOCK: replace with fetch('/api/account/rewards').then(r => r.json())
    const rewards = await mockFetch('rewards');

    document.getElementById('rewards-points').textContent = rewards.points.toLocaleString();
    document.getElementById('rewards-tier').textContent = `${rewards.tier} Tier`;

    const dealsList = document.getElementById('deals-list');
    dealsList.innerHTML = rewards.deals.length ? rewards.deals.map(deal => `
      <li class="deal-item">
        <div class="deal-info">
          <span class="deal-description">${deal.description}</span>
          <span class="deal-expiry">Expires ${formatDate(deal.expiry)}</span>
        </div>
        <span class="deal-code">${deal.discount}</span>
      </li>
    `).join('') : '<li class="empty-state">No deals available right now.</li>';
  }

  async function renderNewsletter() {
    // MOCK: replace with fetch('/api/account/newsletter').then(r => r.json())
    const prefs = await mockFetch('newsletter');
    const subscribedCheckbox = document.getElementById('newsletter-subscribed');
    const topicsSection = document.getElementById('newsletter-topics');
    const topicsList = document.getElementById('topics-list');

    subscribedCheckbox.checked = prefs.subscribed;
    topicsSection.classList.toggle('hidden', !prefs.subscribed);

    topicsList.innerHTML = prefs.topics.map(topic => `
      <li>
        <label class="toggle-label">
          <input type="checkbox" data-topic-id="${topic.topicId}" ${topic.selected ? 'checked' : ''}>
          <span class="toggle-track"></span>
          ${topic.name}
        </label>
      </li>
    `).join('');

    subscribedCheckbox.addEventListener('change', () => {
      topicsSection.classList.toggle('hidden', !subscribedCheckbox.checked);
    });

    document.getElementById('save-newsletter-btn').addEventListener('click', () => {
      const saved = document.getElementById('newsletter-saved');
      // MOCK: replace with fetch('/api/account/newsletter', { method: 'PUT', body: ... })
      console.log('Saving newsletter prefs...');
      saved.classList.remove('hidden');
      setTimeout(() => saved.classList.add('hidden'), 3000);
    });
  }

  async function renderSettings() {
    // MOCK: replace with fetch('/api/account/settings').then(r => r.json())
    const settings = await mockFetch('settings');

    document.getElementById('setting-share-data').checked = settings.shareData;
    document.getElementById('setting-email-updates').checked = settings.emailUpdates;
    document.getElementById('setting-sms').checked = settings.smsNotifications;

    document.getElementById('change-password-btn').addEventListener('click', () => {
      const current = document.getElementById('current-password').value;
      const next = document.getElementById('new-password').value;
      const confirm = document.getElementById('confirm-password').value;

      if (!current || !next || !confirm) return alert('Please fill in all password fields.');
      if (next !== confirm) return alert('New passwords do not match.');

      // MOCK: replace with fetch('/api/account/password', { method: 'PUT', body: ... })
      console.log('Updating password...');
      document.getElementById('password-saved').classList.remove('hidden');
      setTimeout(() => document.getElementById('password-saved').classList.add('hidden'), 3000);
    });

    document.getElementById('delete-account-btn').addEventListener('click', () => {
      if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
        // MOCK: replace with fetch('/api/account', { method: 'DELETE' })
        console.log('Deleting account...');
      }
    });
  }

  async function renderAdmin() {
    // MOCK: replace with fetch('/api/admin/stats').then(r => r.json())
    const adminData = await mockFetch('admin');

    document.getElementById('admin-total-users').textContent = adminData.totalUsers;
    document.getElementById('admin-total-orders').textContent = adminData.totalOrders;
    document.getElementById('admin-total-products').textContent = adminData.totalProducts;
    document.getElementById('admin-pending-returns').textContent = adminData.pendingReturns;

    const ordersList = document.getElementById('admin-orders-list');
    ordersList.innerHTML = adminData.recentOrders.map(order => `
      <li class="admin-order-item">
        <span>#${order.orderNumber}</span>
        <span>${order.customerName}</span>
        <span>$${order.total}</span>
        <span class="order-status status-${order.orderStatus}">${capitalize(order.orderStatus)}</span>
      </li>
    `).join('');
  }

  // ============================================================
  // ACTION HANDLERS
  // These are stubs. Each one logs now and will call your
  // Node.js API via fetch() with the appropriate method + body.
  // ============================================================

  function saveCard() {
    const name = document.getElementById('card-name').value;
    const number = document.getElementById('card-number').value;
    const expiry = document.getElementById('card-expiry').value;
    const cvv = document.getElementById('card-cvv').value;
    if (!name || !number || !expiry || !cvv) return alert('Please fill in all card fields.');
    // REAL: fetch('/api/account/payment-methods', { method: 'POST', body: JSON.stringify({...}) })
    console.log('Saving card:', { name, number, expiry });
    toggleForm('add-card-form', false);
  }

  function removeCard(id) {
    if (!confirm('Remove this payment method?')) return;
    // REAL: fetch(`/api/account/payment-methods/${id}`, { method: 'DELETE' })
    console.log('Removing card:', id);
    document.querySelector(`.card-item[data-id="${id}"]`)?.remove();
  }

  function showAddAddressForm() {
    document.getElementById('address-form-title').textContent = 'Add Address';
    document.getElementById('address-id').value = '';
    ['addr-label','addr-line1','addr-line2','addr-city','addr-state','addr-zip','addr-country']
      .forEach(id => document.getElementById(id).value = id === 'addr-country' ? 'US' : '');
    toggleForm('address-form');
  }

  function showEditAddressForm(id, addresses) {
    const addr = addresses.find(a => a.id === id);
    if (!addr) return;
    document.getElementById('address-form-title').textContent = 'Edit Address';
    document.getElementById('address-id').value = addr.id;
    document.getElementById('addr-label').value = addr.label;
    document.getElementById('addr-line1').value = addr.line1;
    document.getElementById('addr-line2').value = addr.line2 || '';
    document.getElementById('addr-city').value = addr.city;
    document.getElementById('addr-state').value = addr.state;
    document.getElementById('addr-zip').value = addr.zip;
    document.getElementById('addr-country').value = addr.country;
    document.getElementById('addr-default').checked = addr.isDefault;
    toggleForm('address-form');
  }

  function saveAddress(addresses, renderList) {
    const id = document.getElementById('address-id').value;
    const updated = {
      id: id || String(Date.now()),
      label: document.getElementById('addr-label').value,
      line1: document.getElementById('addr-line1').value,
      line2: document.getElementById('addr-line2').value,
      city: document.getElementById('addr-city').value,
      state: document.getElementById('addr-state').value,
      zip: document.getElementById('addr-zip').value,
      country: document.getElementById('addr-country').value,
      isDefault: document.getElementById('addr-default').checked,
    };
    if (!updated.line1 || !updated.city || !updated.state) return alert('Please fill required fields.');

    if (id) {
      // REAL: fetch(`/api/account/addresses/${id}`, { method: 'PUT', body: JSON.stringify(updated) })
      const idx = addresses.findIndex(a => a.id === id);
      if (idx > -1) addresses[idx] = updated;
    } else {
      // REAL: fetch('/api/account/addresses', { method: 'POST', body: JSON.stringify(updated) })
      addresses.push(updated);
    }
    toggleForm('address-form', false);
    renderList(addresses);
  }

  function removeAddress(id, addresses, renderList) {
    if (!confirm('Remove this address?')) return;
    // REAL: fetch(`/api/account/addresses/${id}`, { method: 'DELETE' })
    const idx = addresses.findIndex(a => a.id === id);
    if (idx > -1) addresses.splice(idx, 1);
    renderList(addresses);
  }

  function addToCart(id) {
    // REAL: fetch('/api/cart', { method: 'POST', body: JSON.stringify({ itemId: id }) })
    console.log('Adding to cart:', id);
  }

  function removeWishlistItem(id) {
    if (!confirm('Remove from wishlist?')) return;
    // REAL: fetch(`/api/account/wishlist/${id}`, { method: 'DELETE' })
    document.querySelector(`.wishlist-item[data-id="${id}"]`)?.remove();
  }

  function submitReturn() {
    const orderId = document.getElementById('return-order-select').value;
    const reason = document.getElementById('return-reason').value;
    const notes = document.getElementById('return-notes').value;
    if (!orderId || !reason) return alert('Please select an order and reason.');
    // REAL: fetch('/api/account/returns', { method: 'POST', body: JSON.stringify({...}) })
    console.log('Submitting return:', { orderId, reason, notes });
    toggleForm('return-form', false);
    alert('Return request submitted.');
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  function toggleForm(formId, show) {
    const form = document.getElementById(formId);
    if (!form) return;
    const shouldShow = show !== undefined ? show : form.classList.contains('hidden');
    form.classList.toggle('hidden', !shouldShow);
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ============================================================
  // MOCK DATA + mockFetch
  //
  // This is your stand-in for the Node.js + DynamoDB API.
  // The shape of each object here should match exactly what
  // your API will return — so when you swap mockFetch() for
  // real fetch() calls, the render functions need zero changes.
  //
  // SWAPPING EXAMPLE:
  //   Before: const user = await mockFetch('user')
  //   After:  const user = await fetch('/api/account/overview').then(r => r.json())
  // ============================================================
  const mockData = {
    user: {
      userId: 'u001',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@email.com',
      avatar: 'avatar.png',
      dateCreated: '2023-01-15',
    },
    stats: {
      orders: 4,
      wishlist: 3,
      points: 1240,
      returns: 1,
    },
    paymentMethods: [
      { id: 'pm1', brand: 'Visa', last4: '4242', expiry: '12/26', isDefault: true },
      { id: 'pm2', brand: 'Mastercard', last4: '5555', expiry: '08/25', isDefault: false },
    ],
    orders: [
      {
        orderId: 'o001',
        orderNumber: '10021',
        orderDate: '2024-11-01',
        orderStatus: 'delivered',
        items: [
          { itemId: 'i1', name: 'Oak Dining Table', qty: 1, price: '799.00', image: 'products.png' },
          { itemId: 'i2', name: 'Chair Set', qty: 4, price: '199.00', image: 'products.png' },
        ]
      },
      {
        orderId: 'o002',
        orderNumber: '10034',
        orderDate: '2025-01-20',
        orderStatus: 'processing',
        items: [
          { itemId: 'i3', name: 'Velvet Sofa', qty: 1, price: '1299.00', image: 'products.png' },
        ]
      },
    ],
    addresses: [
      { id: 'a1', label: 'Home', line1: '123 Main St', line2: '', city: 'Brooklyn', state: 'NY', zip: '11201', country: 'US', isDefault: true },
      { id: 'a2', label: 'Work', line1: '456 Office Ave', line2: 'Suite 200', city: 'New York', state: 'NY', zip: '10001', country: 'US', isDefault: false },
    ],
    wishlist: [
      { id: 'w1', name: 'Marble Coffee Table', price: '349.99', image: 'products.png', dateAdded: '2024-09-10' },
      { id: 'w2', name: 'Linen Armchair', price: '549.00', image: 'products.png', dateAdded: '2024-10-22' },
    ],
    returns: [
      { returnId: 'r1', orderNumber: '10021', item: 'Chair Set', reason: 'Defective', status: 'Refund Issued', refundAmount: '199.00', dateInitiated: '2024-11-15' },
    ],
    rewards: {
      points: 1240,
      tier: 'Silver',
      deals: [
        { dealId: 'd1', description: '10% off your next order', discount: 'REWARD10', expiry: '2025-06-01' },
        { dealId: 'd2', description: 'Free standard shipping', discount: 'SHIPFREE', expiry: '2025-04-30' },
      ]
    },
    newsletter: {
      subscribed: true,
      topics: [
        { topicId: 't1', name: 'New Arrivals', selected: true },
        { topicId: 't2', name: 'Sales & Promotions', selected: false },
        { topicId: 't3', name: 'Design Tips & Inspiration', selected: true },
        { topicId: 't4', name: 'Exclusive Member Offers', selected: false },
      ]
    },
    settings: {
      shareData: false,
      emailUpdates: true,
      smsNotifications: false,
    },
    admin: {
      totalUsers: 842,
      totalOrders: 3201,
      totalProducts: 156,
      pendingReturns: 7,
      recentOrders: [
        { orderNumber: '10041', customerName: 'John Smith', total: '499.00', orderStatus: 'processing' },
        { orderNumber: '10040', customerName: 'Emily Chen', total: '1199.00', orderStatus: 'delivered' },
        { orderNumber: '10039', customerName: 'Marcus Lee', total: '249.00', orderStatus: 'cancelled' },
      ]
    },
  };

  function mockFetch(key) {
    // Simulates network delay so you can see loading states work
    return new Promise(resolve => setTimeout(() => resolve(mockData[key]), 200));
  }

  // ============================================================
  // INIT — load the overview panel by default
  // ============================================================
  navPanel.addEventListener('click', e => {
    const btn = e.target.closest('[data-panel]');
    if (btn) loadPanel(btn.dataset.panel);
  });

  loadPanel('overview');
}