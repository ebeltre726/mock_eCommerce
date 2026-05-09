// ============================================================
// account.js
//
// Initialises the account overlay panel.
// Architecture:
//   1. Verify the session via /api/auth/me
//   2. Set up the nav + content pane (setupAccountUI)
//   3. Each nav button calls loadPanel(panelName)
//   4. loadPanel fetches data from the API and calls the
//      matching renderer from panelRenderers
//   5. Each renderer populates the DOM and binds events,
//      scoped to contentPane to avoid ID collisions
// ============================================================

import { accountNavModule } from './navbarModule.js';
import { overlayModule } from './overlay.js';
import { apiFetch, apiFetchForm, AuthError } from './api.js';
import { mountStripeElements, unmountStripeElements, tokeniseCard } from './stripe.js';
import { syncWishlistRemoval } from './wishlist.js';
import { esc, escAttr, isLoggedIn } from './utils.js';

const panelTemplateCache = {};

// ============================================================
// INIT
// ============================================================

export async function initAccount() {
    let user;
    try {
        user = await apiFetch('auth/me');
    } catch (err) {
        // 401 (AuthError)  → not authenticated          → redirect to login/signup
        // 404              → valid JWT but no profile   → redirect to login/signup
        // 5xx / TypeError  → transient infra fault      → inline error, don't redirect
        //                    (user IS logged in; showing login would be confusing)
        if (err instanceof AuthError || err.status === 404) {
            overlayModule.open(isLoggedIn() ? 'login' : 'signup');
        } else {
            const pane = document.querySelector('.content');
            if (pane) pane.innerHTML = '<p class="panel-error">Could not load your account. Please try again.</p>';
            console.error('[account] init error:', err);
        }
        return;
    }

    const navPanel = document.querySelector('.navPanel');
    const contentPane = document.querySelector('.contentPane');

    if (!navPanel || !contentPane) {
        console.error('Account UI elements not found in DOM');
        return;
    }

    accountNavModule.init();
    setupAccountUI(navPanel, contentPane, user); // pass user in directly
}

// ============================================================
// UI SETUP
// ============================================================

function setupAccountUI(navPanel, contentPane, user) {
    const panelRenderers = {
        'overview':   renderOverview,
        'payment':    renderPaymentMethods,
        'orders':     renderOrderHistory,
        'address':    renderAddresses,
        'wishlist':   renderWishlist,
        'returns':    renderReturns,
        'rewards':    renderRewards,
        'newsletter': renderNewsletter,
        'settings':   renderSettings,
    };

    const initialisedPanels = new Set();

    async function loadPanel(panelName, prefetchedData = null) {
        if (!panelName) {
            console.error('loadPanel called with invalid panelName:', panelName);
            return;
        }
        const currentActive = navPanel.querySelector('button.active');
        if (currentActive?.dataset.panel === panelName) return;

        if (!panelRenderers[panelName]) {
            contentPane.innerHTML = '<p class="panel-error">Panel not found.</p>';
            return;
        }

        navPanel.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.panel === panelName);
        });

        contentPane.innerHTML = '<div class="panel-loading"><span class="loading-spinner"></span> Loading...</div>';

        try {
            const [html, data] = await Promise.all([
                fetchTemplate(panelName),
                prefetchedData ?? apiFetch(`account/${panelName}`),
            ]);

            contentPane.innerHTML = html;
            initialisedPanels.delete(panelName);
            await panelRenderers[panelName](contentPane, data);
            initialisedPanels.add(panelName);
        } catch (err) {
            if (err instanceof AuthError) {
                overlayModule.open('login');
                return;
            }
            console.error(`Failed to load panel "${panelName}":`, err);
            contentPane.innerHTML = '<p class="panel-error">Failed to load panel. Please try again.</p>';
        }
    }

    // Single nav listener — never re-bound
    navPanel.addEventListener('click', e => {
        const btn = e.target.closest('[data-panel]');
        if (btn) loadPanel(btn.dataset.panel);
    });

    // Load overview on init, using prefetched auth/me data
    loadPanel('overview', user);

} // ← setupAccountUI closes here

// fetchTemplate lives outside — it only needs panelTemplateCache
async function fetchTemplate(panelName) {
    if (!panelName) {
        console.error('fetchTemplate called with null/undefined:', panelName);
        return '';
    }
    if (panelTemplateCache[panelName]) return panelTemplateCache[panelName];
    const res = await fetch(`/templates/account/${panelName}.html`);
    if (!res.ok) throw new Error(`Template ${panelName}.html not found`);
    const html = await res.text();
    panelTemplateCache[panelName] = html;
    return html;
}

// All renderers, action handlers, and utilities follow outside setupAccountUI

// ============================================================
// PANEL RENDERERS
//
// Signature: (contentPane, data) => void | Promise<void>
//
// Each renderer:
//   1. Builds and injects HTML into contentPane
//   2. Queries elements scoped to contentPane (not document)
//   3. Attaches event listeners via delegation where possible
//
// All DOM queries use contentPane.querySelector / getElementById
// scoped via contentPane to avoid conflicts with other overlays.
// ============================================================

async function renderOverview(contentPane, user) {
    const avatarImg = contentPane.querySelector('#user-avatar');

    if (user.avatar) {
        avatarImg.src = user.avatar;
    }

    contentPane.querySelector('#user-fullname').textContent =
        `${user.firstName} ${user.lastName}`;

    contentPane.querySelector('#user-email').textContent = user.email;

    contentPane.querySelector('#user-since').textContent =
        `Member since ${formatDate(user.dateCreated)}`;

    contentPane.querySelector('#stat-orders').textContent = user.stats.orders;
    contentPane.querySelector('#stat-wishlist').textContent = user.stats.wishlist;
    contentPane.querySelector('#stat-points').textContent = user.stats.points;
    contentPane.querySelector('#stat-returns').textContent = user.stats.returns;

    // ----------------------------
    // Avatar upload logic
    // ----------------------------
    const editBtn = contentPane.querySelector('#avatar-edit-btn');
    const fileInput = contentPane.querySelector('#avatar-file-input');

    if (!editBtn || !fileInput) return;

    const setLoading = (isLoading) => {
        editBtn.disabled = isLoading;
        editBtn.textContent = isLoading
            ? 'Uploading...'
            : 'Change Image ✎';
    };

    // Open file picker
    editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
    });

    // Handle file selection + upload
    fileInput.addEventListener('change', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file); // MUST match multer

    try {
        setLoading(true);

        const result = await apiFetchForm('account/avatar', formData);

        // Update UI instantly
        avatarImg.src = result.avatar;

    } catch (err) {
        console.error('Avatar upload error:', err);
        alert(err.message || 'Failed to upload avatar. Please try again.');

    } finally {
        setLoading(false);
        fileInput.value = ''; // reset input
    }
});
}

async function renderPaymentMethods(contentPane, methods) {
    unmountStripeElements(); // ensure no Stripe elements are mounted before rendering the list
    const list = contentPane.querySelector('#card-list');
 
    // methods shape from payment.service.js: toPublicMethod()
    // { paymentId, stripePaymentMethodId, brand, last4, expiry, isDefault }
    list.innerHTML = methods.length
        ? methods.map(card => `
            <li class="card-item" data-id="${escAttr(card.paymentId)}">
                <div class="card-brand">${esc(card.brand)}</div>
                <div class="card-details">
                    <span>•••• •••• •••• ${esc(card.last4)}</span>
                    <span>Expires ${esc(card.expiry)}</span>
                    ${card.isDefault ? '<span class="badge-default">Default</span>' : ''}
                </div>
                <button class="btn-ghost remove-card" data-id="${escAttr(card.paymentId)}">Remove</button>
            </li>
        `).join('')
        : '<li class="empty-state">No saved payment methods.</li>';
 
    // Delegated remove listener
    list.addEventListener('click', e => {
        const btn = e.target.closest('.remove-card');
        if (btn) removeCard(btn.dataset.id, contentPane);
    });
 
    // Add card — mount Stripe elements into the panel's form on open,
    // unmount on close so they can remount cleanly on the next open.
    const addBtn    = contentPane.querySelector('.add-card-btn');
    const cancelBtn = contentPane.querySelector('#cancel-card-btn');
    const saveBtn   = contentPane.querySelector('#save-card-btn');
    
    addBtn?.addEventListener('click', () => {
    const opened = toggleForm(contentPane, 'add-card-form');
    if (opened) {
        setTimeout(() => {
            const numberEl = contentPane.querySelector('#account-card-number');
            const expiryEl = contentPane.querySelector('#account-card-expiry');
            const cvcEl    = contentPane.querySelector('#account-card-cvc');
            const errorsEl = contentPane.querySelector('#account-card-errors');
            mountStripeElements(numberEl, expiryEl, cvcEl, errorsEl);
        }, 50);
    } else {
        unmountStripeElements();
    }
});
 
    cancelBtn?.addEventListener('click', () => {
        unmountStripeElements();
        toggleForm(contentPane, 'add-card-form', false);
    });
 
    saveBtn?.addEventListener('click', () => saveCard(contentPane));
}
 
async function saveCard(contentPane) {
    const btn = contentPane.querySelector('#save-card-btn');
    btn.disabled    = true;
    btn.textContent = 'Saving…';
 
    try {
        const cardholderName = contentPane.querySelector('#card-name')?.value.trim() ?? '';
 
        // tokeniseCard uses the mounted elements from stripe.js —
        // no Stripe instance or key lives in account.js
        const tokenData = await tokeniseCard(cardholderName);
 
        // POST to backend which writes the PAYMENT# record in DynamoDB
        await apiFetch('account/payment', {
            method: 'POST',
            body: JSON.stringify(tokenData),
        });
 
        unmountStripeElements();
        toggleForm(contentPane, 'add-card-form', false);
 
        // Reload the list from the API so it reflects the new card
        const updated = await apiFetch('account/payment');
        await renderPaymentMethods(contentPane, updated);
 
    } catch (err) {
        showInlineError(contentPane, 'save-card-btn', err.message ?? 'Failed to save card.');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Save Card';
    }
}

async function renderOrderHistory(contentPane, data) {
    const list   = contentPane.querySelector('#order-list');
    const filter = contentPane.querySelector('#order-status-filter');

    let allOrders    = data.orders;
    let nextCursor   = data.nextCursor;

    function renderOrders(filteredOrders) {
        list.innerHTML = filteredOrders.length ? filteredOrders.map(order => `
            <li class="order-item">
                <div class="order-header">
                    <span class="order-number">Order #${esc(order.orderId)}</span>
                    <span class="order-date">${formatDate(order.createdAt)}</span>
                    <span class="order-status status-${escAttr(order.status)}">${esc(capitalize(order.status))}</span>
                </div>
                <ul class="order-items-list">
                    ${order.items.map(item => `
                        <li class="order-line-item">
                            <img src="${escAttr(item.image)}" alt="${escAttr(item.name)}">
                            <span>${esc(item.name)}</span>
                            <span>x${esc(String(item.quantity))}</span>
                            <span>$${esc(String(item.price))}</span>
                        </li>
                    `).join('')}
                </ul>
            </li>
        `).join('') : '<li class="empty-state">No orders found.</li>';

        if (nextCursor) {
            const li = document.createElement('li');
            li.className = 'load-more-item';
            li.innerHTML = '<button class="btn-ghost load-more-orders">Load more</button>';
            list.appendChild(li);
        }
    }

    renderOrders(allOrders);

    filter.addEventListener('change', () => {
        const val = filter.value;
        renderOrders(val === 'all' ? allOrders : allOrders.filter(o => o.status === val));
    });

    list.addEventListener('click', async e => {
        const btn = e.target.closest('.load-more-orders');
        if (!btn || !nextCursor) return;
        btn.disabled    = true;
        btn.textContent = 'Loading…';
        try {
            const more = await apiFetch(`account/orders?cursor=${encodeURIComponent(nextCursor)}`);
            allOrders  = [...allOrders, ...more.orders];
            nextCursor = more.nextCursor;
            const val  = filter.value;
            renderOrders(val === 'all' ? allOrders : allOrders.filter(o => o.status === val));
        } catch (err) {
            console.error('Failed to load more orders:', err);
            btn.disabled    = false;
            btn.textContent = 'Load more';
        }
    });
}

async function renderAddresses(contentPane, { addresses, nextCursor }) {
    const localAddresses = [...addresses];
    let currentCursor = nextCursor;

    function renderList(addrs) {
        const list = contentPane.querySelector('#address-list');
        list.innerHTML = addrs.length ? addrs.map(addr => `
            <li class="address-item" data-id="${escAttr(addr.addressId)}">
                <div class="address-label">${esc(addr.label)} ${addr.isDefault ? '<span class="badge-default">Default</span>' : ''}</div>
                <div class="address-text">
                    ${esc(addr.line1)}${addr.line2 ? ', ' + esc(addr.line2) : ''}<br>
                    ${esc(addr.city)}, ${esc(addr.state)} ${esc(addr.zip)}, ${esc(addr.country)}
                </div>
                <div class="address-actions">
                    <button class="btn-ghost edit-address" data-id="${escAttr(addr.addressId)}">Edit</button>
                    <button class="btn-ghost remove-address" data-id="${escAttr(addr.addressId)}">Remove</button>
                </div>
            </li>
        `).join('') : '<li class="empty-state">No saved addresses.</li>';
    }

    function renderLoadMore() {
        const existing = contentPane.querySelector('.load-more-addresses');
        if (existing) existing.remove();
        if (!currentCursor) return;
        const btn = document.createElement('button');
        btn.className = 'btn-ghost load-more-addresses';
        btn.textContent = 'Load more';
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Loading…';
            try {
                const page = await apiFetch(`account/address?cursor=${encodeURIComponent(currentCursor)}`);
                localAddresses.push(...page.addresses);
                currentCursor = page.nextCursor;
                renderList(localAddresses);
                renderLoadMore();
            } catch {
                btn.disabled = false;
                btn.textContent = 'Load more';
            }
        });
        contentPane.querySelector('#address-list').insertAdjacentElement('afterend', btn);
    }

    renderList(localAddresses);
    renderLoadMore();

    contentPane.querySelector('#address-list').addEventListener('click', e => {
        const removeBtn = e.target.closest('.remove-address');
        const editBtn = e.target.closest('.edit-address');
        if (removeBtn) removeAddress(removeBtn.dataset.id, localAddresses, renderList, contentPane);
        if (editBtn) showEditAddressForm(editBtn.dataset.id, localAddresses, contentPane);
    });

    contentPane.querySelector('.add-address-btn')
        ?.addEventListener('click', () => {
            const opened = toggleForm(contentPane, 'addressContainer');
            if (opened) {
                contentPane.querySelector('#address-form-title').textContent = 'Add Address';
                contentPane.querySelector('#address-id').value = '';
                ['addr-label','addr-line1','addr-line2','addr-city','addr-state','addr-zip']
                    .forEach(id => { contentPane.querySelector(`#${id}`).value = ''; });
                contentPane.querySelector('#addr-country').value = 'US';
                contentPane.querySelector('#addr-default').checked = false;
            }
        });

    contentPane.querySelector('#cancel-address-btn')
        .addEventListener('click', () => toggleForm(contentPane, 'addressContainer', false));

    contentPane.querySelector('#save-address-btn')
        .addEventListener('click', () => saveAddress(localAddresses, renderList, contentPane));
}

async function renderReturns(contentPane, { returns, orders }) {
    const list        = contentPane.querySelector('#returns-list');
    const orderSelect = contentPane.querySelector('#return-order-select');

    list.innerHTML = returns.length ? returns.map(ret => `
        <li class="return-item">
            <div class="return-header">
                <span class="return-order">Order #${esc(ret.orderNumber)}</span>
                <span class="return-status status-${escAttr(ret.status.toLowerCase().replace(' ', '-'))}">${esc(ret.status)}</span>
            </div>
            <div class="return-details">
                <span>${esc(ret.item)}</span>
                <span>Refund: $${esc(String(ret.refundAmount))}</span>
                <span>Initiated: ${formatDate(ret.dateInitiated)}</span>
            </div>
        </li>
    `).join('') : '<li class="empty-state">No returns or refunds.</li>';

    // Populate order dropdown
    orders.forEach(order => {
        const option = document.createElement('option');
        option.value = order.orderId;
        option.textContent = `Order #${order.orderId} — ${formatDate(order.createdAt)}`;
        orderSelect.appendChild(option);
    });

    // ← When order is selected, populate item dropdown
    orderSelect.addEventListener('change', e => {
        const selectedOrderId = e.target.value;
        const order = orders.find(o => o.orderId === selectedOrderId);
        const itemSelect = contentPane.querySelector('#return-item-select');

        itemSelect.innerHTML = '<option value="">-- Select item --</option>';

        if (order) {
            order.items.forEach(item => {
                const option = document.createElement('option');
                option.value          = item.name;
                option.dataset.itemId = item.itemId || item.productId;
                option.textContent    = item.name;
                itemSelect.appendChild(option);
            });
        }
    });

    contentPane.querySelector('.initiate-return-btn')
        .addEventListener('click', () => toggleForm(contentPane, 'return-form'));

    contentPane.querySelector('#cancel-return-btn')
        .addEventListener('click', () => toggleForm(contentPane, 'return-form', false));

    contentPane.querySelector('#submit-return-btn')
        .addEventListener('click', () => submitReturn(contentPane, orders));
}

async function renderRewards(contentPane, rewards) {
    contentPane.querySelector('#rewards-points').textContent = rewards.points.toLocaleString();
    contentPane.querySelector('#rewards-tier').textContent = `${rewards.tier} Tier`;

    const dealsList = contentPane.querySelector('#deals-list');
    dealsList.innerHTML = rewards.deals.length ? rewards.deals.map(deal => `
        <li class="deal-item">
            <div class="deal-info">
                <span class="deal-description">${esc(deal.description)}</span>
                <span class="deal-expiry">Expires ${formatDate(deal.expiry)}</span>
            </div>
            <span class="deal-code">${esc(deal.discount)}</span>
        </li>
    `).join('') : '<li class="empty-state">No deals available right now.</li>';
}

async function renderNewsletter(contentPane, prefs) {
    const subscribedCheckbox = contentPane.querySelector('#newsletter-subscribed');
    const topicsSection = contentPane.querySelector('#newsletter-topics');
    const topicsList = contentPane.querySelector('#topics-list');

    subscribedCheckbox.checked = prefs.subscribed;
    topicsSection.classList.toggle('hidden', !prefs.subscribed);

    topicsList.innerHTML = prefs.topics.map(topic => `
        <li>
            <label class="toggle-label">
                <input type="checkbox" data-topic-id="${escAttr(topic.topicId)}" ${topic.selected ? 'checked' : ''}>
                <span class="toggle-track"></span>
                ${esc(topic.name)}
            </label>
        </li>
    `).join('');

    subscribedCheckbox.addEventListener('change', () => {
        topicsSection.classList.toggle('hidden', !subscribedCheckbox.checked);
    });

    contentPane.querySelector('#save-newsletter-btn').addEventListener('click', async () => {
        try {
            const result = await apiFetch('account/newsletter', {
                method: 'PATCH',
                body: JSON.stringify({
                    subscribed: subscribedCheckbox.checked,
                    topics: [...contentPane.querySelectorAll('[data-topic-id]')].map(el => ({
                        topicId: el.dataset.topicId,
                        selected: el.checked,
                    })),
                }),
            });

            const confirmationId = result.action === 'subscribed'   ? 'newsletter-saved-subscribed'
                                 : result.action === 'unsubscribed' ? 'newsletter-saved-unsubscribed'
                                 :                                    'newsletter-saved-updated';

            const msg = contentPane.querySelector(`#${confirmationId}`);
            msg.classList.remove('hidden');
            setTimeout(() => msg.classList.add('hidden'), 4000);
        } catch (err) {
            console.error('Failed to save newsletter prefs:', err);
        }
    });
}

async function renderSettings(contentPane, settings) {
    contentPane.querySelector('#setting-share-data').checked = settings.shareData;
    contentPane.querySelector('#setting-email-updates').checked = settings.emailUpdates;
    contentPane.querySelector('#setting-sms').checked = settings.smsNotifications;

    contentPane.querySelector('#save-settings-btn').addEventListener('click', async () => {
        const btn = contentPane.querySelector('#save-settings-btn');
        const saved = contentPane.querySelector('#settings-saved');
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
            await apiFetch('account/settings', {
                method: 'PATCH',
                body: JSON.stringify({
                    shareData:        contentPane.querySelector('#setting-share-data').checked,
                    emailUpdates:     contentPane.querySelector('#setting-email-updates').checked,
                    smsNotifications: contentPane.querySelector('#setting-sms').checked,
                }),
            });
            saved.classList.remove('hidden');
            setTimeout(() => saved.classList.add('hidden'), 3000);
        } catch (err) {
            showInlineError(contentPane, 'save-settings-btn', 'Failed to save settings.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Settings';
        }
    });

    contentPane.querySelector('#logout-btn').addEventListener('click', async () => {
        try {
            await apiFetch('auth/logout', { method: 'POST' });
        } catch (err) {
            // GlobalSignOut failed — cookies are cleared by the server regardless
            console.warn('[logout] server-side signout failed:', err.message);
        }
        overlayModule.close();
    });

    contentPane.querySelector('#change-password-btn').addEventListener('click', async () => {
        const current = contentPane.querySelector('#current-password').value;
        const next = contentPane.querySelector('#new-password').value;
        const confirm = contentPane.querySelector('#confirm-password').value;

        if (!current || !next || !confirm) {
            showInlineError(contentPane, 'change-password-btn', 'Please fill in all password fields.');
            return;
        }
        if (next !== confirm) {
            showInlineError(contentPane, 'change-password-btn', 'New passwords do not match.');
            return;
        }

        try {
            await apiFetch('account/password', {
                method: 'PATCH',
                body: JSON.stringify({ current, password: next }),
            });
            contentPane.querySelector('#password-saved').classList.remove('hidden');
            setTimeout(() => contentPane.querySelector('#password-saved').classList.add('hidden'), 3000);
        } catch (err) {
            if (err.message.includes('Invalid current password')) {
                showInlineError(contentPane, 'change-password-btn', 'Current password is incorrect.');
            } else {
                showInlineError(contentPane, 'change-password-btn', 'Failed to update password.');
            }
        }
    });

    contentPane.querySelector('#delete-account-btn').addEventListener('click', async () => {
        confirmAction('Are you sure you want to delete your account? This cannot be undone.', async () => {
            try {
                await apiFetch('account', { method: 'DELETE' });
                overlayModule.close();
            } catch (err) {
                console.error('Failed to delete account:', err);
                showInlineError(contentPane, 'delete-account-btn', 'Failed to delete account. Please try again.');
            }
        });
    });
}

async function renderWishlist(contentPane, items) {
    const list = contentPane.querySelector('#wishlist-list');
    const count = contentPane.querySelector('#wishlist-count');

    // Fetch all product details in one BatchGetItem call instead of N individual requests.
    const productIds = [...new Set(items.map(i => i.productId).filter(Boolean))];
    let productMap = {};
    if (productIds.length > 0) {
        productMap = await apiFetch(`products/batch?ids=${productIds.join(',')}`).catch(() => ({}));
    }

    const enriched = items.map(item => {
        const product = productMap[item.productId] ?? null;
        return {
            itemId:    item.itemId,
            productId: item.productId,
            name:      product?.name     ?? 'Unknown product',
            image:     product?.imageUrl ?? '',
            price:     product?.price    ?? 0,
            dateAdded: item.createdAt,
        };
    });

    count.textContent = `${enriched.length} item${enriched.length !== 1 ? 's' : ''}`;

    list.innerHTML = enriched.length ? enriched.map(item => `
        <li class="wishlist-item" data-id="${escAttr(item.itemId)}" data-product-id="${escAttr(item.productId)}">
            <img src="${escAttr(item.image)}" alt="${escAttr(item.name)}" class="wishlist-img">
            <div class="wishlist-info">
                <span class="wishlist-name">${esc(item.name)}</span>
                <span class="wishlist-price">$${esc(String(item.price))}</span>
                <span class="wishlist-added">Saved ${formatDate(item.dateAdded)}</span>
            </div>
            <div class="wishlist-actions">
                <button class="btn-primary add-to-cart" data-id="${escAttr(item.productId)}">Add to Cart</button>
                <button class="btn-ghost remove-wishlist" data-id="${escAttr(item.itemId)}">Remove</button>
            </div>
        </li>
    `).join('') : '<li class="empty-state">Your wishlist is empty.</li>';

    list.addEventListener('click', e => {
        const cartBtn   = e.target.closest('.add-to-cart');
        const removeBtn = e.target.closest('.remove-wishlist');
        if (cartBtn)   addToCart(cartBtn.dataset.id, cartBtn);
        if (removeBtn) removeWishlistItem(removeBtn.dataset.id, contentPane);
    });
}

// ============================================================
// ACTION HANDLERS
// ============================================================

function removeCard(id, contentPane) {
    confirmAction('Remove this payment method?', () => {
        apiFetch(`account/payment/${id}`, { method: 'DELETE' })
            .then(() => contentPane.querySelector(`.card-item[data-id="${id}"]`)?.remove())
            .catch(err => console.error('Failed to remove card:', err));
    });
}


function showEditAddressForm(id, addresses, contentPane) {
    const addr = addresses.find(a => a.addressId === id);
    if (!addr) return;

    contentPane.querySelector('#address-form-title').textContent = 'Edit Address';
    contentPane.querySelector('#address-id').value   = addr.addressId; // ← addressId
    contentPane.querySelector('#addr-label').value   = addr.label;
    contentPane.querySelector('#addr-line1').value   = addr.line1;
    contentPane.querySelector('#addr-line2').value   = addr.line2 || '';
    contentPane.querySelector('#addr-city').value    = addr.city;
    contentPane.querySelector('#addr-state').value   = addr.state;
    contentPane.querySelector('#addr-zip').value     = addr.zip;
    contentPane.querySelector('#addr-country').value = addr.country;
    contentPane.querySelector('#addr-default').checked = addr.isDefault;
    toggleForm(contentPane, 'addressContainer', true);
}

function saveAddress(addresses, renderList, contentPane) {
    const id = contentPane.querySelector('#address-id').value;
    const updated = {
        addressId: id || String(Date.now()),
        label:     contentPane.querySelector('#addr-label').value.trim(),
        line1:     contentPane.querySelector('#addr-line1').value.trim(),
        line2:     contentPane.querySelector('#addr-line2').value.trim(),
        city:      contentPane.querySelector('#addr-city').value.trim(),
        state:     contentPane.querySelector('#addr-state').value.trim(),
        zip:       contentPane.querySelector('#addr-zip').value.trim(),
        country:   contentPane.querySelector('#addr-country').value.trim(),
        isDefault: contentPane.querySelector('#addr-default').checked,
    };

    if (!updated.line1 || !updated.city || !updated.state) {
        showInlineError(contentPane, 'save-address-btn', 'Please fill in all required fields.');
        return;
    }

    const method = id ? 'PATCH' : 'POST';
    const endpoint = id ? `account/address/${id}` : 'account/address';

    apiFetch(endpoint, { method, body: JSON.stringify(updated) })
        .then((result) => {
            if (id) {
                const idx = addresses.findIndex(a => a.addressId === id);
                if (idx > -1) addresses[idx] = updated;
            } else {
                // Use the server-assigned addressId so edit/delete work immediately
                addresses.push({ ...updated, addressId: result.addressId });
            }
            toggleForm(contentPane, 'addressContainer', false);
            renderList(addresses);
        })
        .catch(err => console.error('Failed to save address:', err));
}

function removeAddress(id, addresses, renderList, contentPane) {
    confirmAction('Remove this address?', () => {
    apiFetch(`account/address/${id}`, { method: 'DELETE' })
        .then(() => {
            const idx = addresses.findIndex(a => a.addressId === id);
            if (idx > -1) addresses.splice(idx, 1);
            renderList(addresses);
        })
        .catch(err => console.error('Failed to remove address:', err));
});
}

function addToCart(id, btn) {
    const original = btn?.textContent;
    if (btn) btn.disabled = true;

    apiFetch('cart/add', {
        method: 'POST',
        body: JSON.stringify({ productId: id, quantity: 1 }),
    })
        .then(() => {
            if (btn) {
                btn.textContent = 'Added!';
                setTimeout(() => {
                    btn.textContent = original;
                    btn.disabled = false;
                }, 1500);
            }
        })
        .catch(err => {
            console.error('Failed to add to cart:', err);
            if (btn) {
                btn.disabled = false;
                btn.textContent = original;
            }
        });
}

function removeWishlistItem(id, contentPane) {
    confirmAction('Remove from wishlist?', () => {
        const item      = contentPane.querySelector(`.wishlist-item[data-id="${id}"]`);
        const removeBtn = item?.querySelector('.remove-wishlist');
        const productId = item?.dataset.productId;
        if (removeBtn) removeBtn.disabled = true;

        apiFetch(`account/wishlist/${id}`, { method: 'DELETE' })
            .then(() => {
                if (productId) syncWishlistRemoval(productId);
                item?.remove();
                const list      = contentPane.querySelector('#wishlist-list');
                const countEl   = contentPane.querySelector('#wishlist-count');
                const remaining = list?.querySelectorAll('.wishlist-item').length ?? 0;
                if (countEl) countEl.textContent = `${remaining} item${remaining !== 1 ? 's' : ''}`;
                if (remaining === 0 && list) {
                    list.innerHTML = '<li class="empty-state">Your wishlist is empty.</li>';
                }
            })
            .catch(err => {
                console.error('Failed to remove wishlist item:', err);
                if (removeBtn) removeBtn.disabled = false;
            });
    });
}

function submitReturn(contentPane, orders) {
    const orderId    = contentPane.querySelector('#return-order-select').value;
    const itemSelect = contentPane.querySelector('#return-item-select');
    const item       = itemSelect?.value;
    const itemId     = itemSelect?.selectedOptions[0]?.dataset.itemId;
    const reason     = contentPane.querySelector('#return-reason').value;
    const notes      = contentPane.querySelector('#return-notes').value.trim();

    if (!orderId || !item || !reason) {
        showInlineError(contentPane, 'submit-return-btn', 'Please select an order, item, and reason.');
        return;
    }

    const order = orders.find(o => o.orderId === orderId);

    apiFetch('account/returns', {
        method: 'POST',
        body: JSON.stringify({
            orderId,
            orderNumber: order?.orderNumber,
            itemId,
            item,
            reason,
            notes,
        }),
    })
        .then(() => {
            toggleForm(contentPane, 'return-form', false);
            window.alert('Return request submitted.');
        })
        .catch(err => console.error('Failed to submit return:', err));
}

// ============================================================
// UTILITIES
// ============================================================

/**
 * Show/hide a form element within contentPane.
 * @param {Element} contentPane
 * @param {string} formId
 * @param {boolean} [show] - Explicit state; omit to toggle
 */
function toggleForm(contentPane, formId, show) {
    const form = contentPane.querySelector(`#${formId}`);
    if (!form) return false;
    const shouldShow = show !== undefined ? show : form.classList.contains('hidden');
    form.classList.toggle('hidden', !shouldShow);
    return shouldShow; // ← add this
}

/**
 * Insert a temporary inline error message after a button.
 * Removes itself after 4 seconds.
 */
function showInlineError(contentPane, nearId, message) {
    const anchor = contentPane.querySelector(`#${nearId}`);
    if (!anchor) return;

    // Avoid stacking duplicates
    anchor.parentNode.querySelector('.inline-error')?.remove();

    const err = document.createElement('p');
    err.className = 'inline-error';
    err.textContent = message;
    anchor.insertAdjacentElement('afterend', err);
    setTimeout(() => err.remove(), 4000);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function confirmAction(message, onConfirm) {
    if (window.confirm(message)) onConfirm();
}