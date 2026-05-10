import { apiFetch } from './api.js';
import { overlayModule } from './overlay.js';
import {
    mountStripeElements,
    unmountStripeElements,
    submitNewCard,
    submitSavedCard,
} from './stripe.js';
import { esc, escAttr, isLoggedIn } from './utils.js';

// ─── Module state ─────────────────────────────────────────────────────────────
// stripePaymentMethodId of the selected saved card, null = new card entry
let _selectedStripeMethodId = null;

// ─── Init / teardown ─────────────────────────────────────────────────────────

export async function initCheckout() {
    const numberEl = document.getElementById('card-number');
    const expiryEl = document.getElementById('card-expiry');
    const cvcEl    = document.getElementById('card-cvc');
    const errorsEl = document.getElementById('card-errors');
    mountStripeElements(numberEl, expiryEl, cvcEl, errorsEl);
    _selectedStripeMethodId = null;

    if (isLoggedIn()) {
        // Load in parallel — UI degrades gracefully if either fails
        await Promise.all([loadSavedAddresses(), loadSavedCards()]);
    } else {
        // Guests have no account — hide save options so they're never offered
        document.getElementById('saveAddressRow').style.display = 'none';
        document.getElementById('saveCardRow').style.display    = 'none';
    }

    bindCheckoutEvents();
    updateTotal();
}

export function teardownCheckout() {
    unmountStripeElements();
    _selectedStripeMethodId = null;

    // Reset rails so stale chips don't show on re-open
    const addressRail = document.getElementById('addressRail');
    const cardRail    = document.getElementById('cardRail');
    if (addressRail) addressRail.innerHTML = '';
    if (cardRail)    cardRail.innerHTML    = '';

    const setDisplay = (id, val) => { const el = document.getElementById(id); if (el) el.style.display = val; };
    setDisplay('addressAutofill', 'none');
    setDisplay('cardAutofill',    'none');
    setDisplay('newCardSection',  '');
    setDisplay('saveAddressRow',  '');
    setDisplay('saveCardRow',     '');

    hideStatus();
}

// ─── Saved addresses ──────────────────────────────────────────────────────────

async function loadSavedAddresses() {
    let addresses;
    try {
        ({ addresses } = await apiFetch('account/address'));
    } catch {
        return; // Not logged in or network error — blank form is fine
    }
    if (!addresses?.length) return;

    const section = document.getElementById('addressAutofill');
    const rail    = document.getElementById('addressRail');

    rail.innerHTML = addresses.map((addr, i) => `
        <div class="autofillChip ${addr.isDefault || i === 0 ? 'active' : ''}"
             role="option"
             aria-selected="${addr.isDefault || i === 0}"
             data-address-id="${escAttr(addr.addressId)}"
             data-line1="${escAttr(addr.line1)}"
             data-line2="${escAttr(addr.line2 ?? '')}"
             data-city="${escAttr(addr.city)}"
             data-state="${escAttr(addr.state)}"
             data-postal="${escAttr(addr.zip)}"
             data-label="${escAttr(addr.label)}">
            <span class="chipLabel">${esc(addr.label)}</span>
            <span class="chipSub">${esc(addr.line1)}, ${esc(addr.city)}</span>
        </div>
    `).join('') + `
        <div class="autofillChip newChip"
             role="option"
             aria-selected="false"
             data-address-id="new">
            <span class="chipLabel">+ New</span>
        </div>
    `;

    section.style.display = '';

    // Pre-fill with default or first address
    const preselect = rail.querySelector('.autofillChip.active');
    if (preselect) applyAddressChip(preselect);
}

function applyAddressChip(chip) {
    if (!chip || chip.dataset.addressId === 'new') {
        clearAddressFields();
        document.getElementById('streetAddress')?.focus();
        return;
    }
    setValue('streetAddress', chip.dataset.line1);
    setValue('aptUnit',       chip.dataset.line2);
    setValue('city',          chip.dataset.city);
    setValue('state',         chip.dataset.state);
    setValue('postal',        chip.dataset.postal);
}

function clearAddressFields() {
    ['streetAddress', 'aptUnit', 'city', 'state', 'postal']
        .forEach(id => setValue(id, ''));
}

// ─── Saved cards ──────────────────────────────────────────────────────────────

async function loadSavedCards() {
    let methods;
    try {
        methods = await apiFetch('account/payment');
    } catch {
        return;
    }
    if (!methods?.length) return;

    const section        = document.getElementById('cardAutofill');
    const rail           = document.getElementById('cardRail');
    const newCardSection = document.getElementById('newCardSection');

    // Prefer the default card, otherwise first in list
    const defaultMethod = methods.find(m => m.isDefault) ?? methods[0];

    rail.innerHTML = methods.map(m => `
        <div class="autofillChip cardChip ${m.paymentId === defaultMethod.paymentId ? 'active' : ''}"
             role="option"
             aria-selected="${m.paymentId === defaultMethod.paymentId}"
             data-method-id="${escAttr(m.stripePaymentMethodId)}"
             data-payment-id="${escAttr(m.paymentId)}">
            <span class="chipBrand">${esc(m.brand)}</span>
            <span class="chipLabel">•••• ${esc(m.last4)}</span>
            <span class="chipSub">Exp ${esc(m.expiry)}</span>
        </div>
    `).join('') + `
        <div class="autofillChip newChip"
             role="option"
             aria-selected="false"
             data-method-id="new">
            <span class="chipLabel">+ New card</span>
        </div>
    `;

    section.style.display = '';
    _selectedStripeMethodId = defaultMethod.stripePaymentMethodId;
    newCardSection.style.display = 'none';
}

// ─── Event delegation ─────────────────────────────────────────────────────────

function bindCheckoutEvents() {
    document.getElementById('addressRail')?.addEventListener('click', e => {
        const chip = e.target.closest('[data-address-id]');
        if (!chip) return;
        setActiveChip(document.getElementById('addressRail'), chip);
        applyAddressChip(chip);
    });

    document.getElementById('cardRail')?.addEventListener('click', e => {
        const chip = e.target.closest('[data-method-id]');
        if (!chip) return;
        setActiveChip(document.getElementById('cardRail'), chip);

        const newCardSection = document.getElementById('newCardSection');
        if (chip.dataset.methodId === 'new') {
            _selectedStripeMethodId = null;
            newCardSection.style.display = '';
        } else {
            _selectedStripeMethodId = chip.dataset.methodId;
            newCardSection.style.display = 'none';
        }
    });

    document.getElementById('viewCartBtn')?.addEventListener('click', async () => {
        const preview = document.getElementById('cartPreview');
        const btn     = document.getElementById('viewCartBtn');
        const chevron = document.getElementById('cartChevron');
        const isOpen  = preview.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(isOpen));
        chevron.classList.toggle('flipped', isOpen);

        if (isOpen) {
            const cartGrid = document.getElementById('cartGrid');
            if (cartGrid && window.cartModule) {
                await renderCartPreview(cartGrid);
            }
        }
    });

    document.getElementById('statusDismiss')?.addEventListener('click', () => {
    const wasSuccess = document.getElementById('statusOverlay').dataset.success === 'true';
    hideStatus();
    if (wasSuccess) {
        overlayModule.close(); // close() now fires teardownCheckout via callback
    }
});

    document.getElementById('checkoutForm')
        ?.addEventListener('submit', handleSubmit);
}

// ─── Submit ───────────────────────────────────────────────────────────────────

async function handleSubmit(e) {
    e.preventDefault();

    // Validate before disabling the button or touching Stripe/APIs
    const items = window.cartModule?.getItems?.() ?? [];
    if (!items.length) {
        showStatus('error', 'Your cart is empty', 'Add items to your cart before checking out.');
        return;
    }

    const submitBtn = document.getElementById('submitOrder');
    submitBtn.disabled = true;
    showStatus('loading', 'Processing…', '');

    try {
        const fullName    = document.getElementById('fullName').value.trim();
        const saveAddress = document.getElementById('saveAddressCheck')?.checked ?? false;
        const saveCard    = document.getElementById('saveCardCheck')?.checked ?? false;

        if (!fullName) throw new Error('Please enter your full name.');

        const addressPayload = await resolveAddress(saveAddress);
        let order;

        if (_selectedStripeMethodId) {
            order = await submitSavedCard({
                stripePaymentMethodId: _selectedStripeMethodId,
                fullName,
                ...addressPayload,
                items,  // validated non-empty above
            });
        } else {
            order = await submitNewCard({ fullName, ...addressPayload, saveCard, items });
        }

        document.getElementById('statusOverlay').dataset.success = 'true';
        showStatus(
        'success',
            'Order placed!',
            `Order #${order.orderId} confirmed. Check your email for details.`,
        );
        window.cartModule.clearCartState();
        window.cartModule.updateAllBadges();

    } catch (err) {
        const isDeclined = err.status === 402 ||
            err.message?.toLowerCase().includes('declined') ||
            err.message?.toLowerCase().includes('card');

        showStatus(
            'error',
            isDeclined ? 'Card declined' : 'Payment failed',
            err.message ?? 'Something went wrong. Please try again.',
        );
        submitBtn.disabled = false;
    }
}

// ─── Address resolution ───────────────────────────────────────────────────────
//
// Rules:
//   - Saved chip selected   → return { addressId } directly, no extra write.
//   - New address + save    → POST to /account/address, return { addressId }.
//   - New address + no save → return { shippingAddress } inline so the order
//                             stores it directly without creating an orphan record.

async function resolveAddress(saveAddress) {
    const rail       = document.getElementById('addressRail');
    const activeChip = rail?.querySelector('.autofillChip.active');

    if (activeChip && activeChip.dataset.addressId !== 'new') {
        return { addressId: activeChip.dataset.addressId };
    }

    const line1  = document.getElementById('streetAddress').value.trim();
    const city   = document.getElementById('city').value.trim();
    const state  = document.getElementById('state').value.trim();
    const postal = document.getElementById('postal').value.trim();

    if (!line1 || !city || !state || !postal) {
        throw new Error('Please fill in your full shipping address.');
    }

    const addressData = {
        line1,
        line2:   document.getElementById('aptUnit').value.trim(),
        city,
        state,
        zip:     postal,
        country: 'US',
    };

    const isAuthenticated = isLoggedIn();
    if (saveAddress && isAuthenticated) {
        const saved = await apiFetch('account/address', {
            method: 'POST',
            body: JSON.stringify({ ...addressData, label: 'Home', isDefault: false }),
        });
        return { addressId: saved.addressId };
    }

    return { shippingAddress: addressData };
}

// ─── Status overlay ───────────────────────────────────────────────────────────

function showStatus(type, title, message) {
    const overlay  = document.getElementById('statusOverlay');
    const iconEl   = document.getElementById('statusIcon');

    iconEl.textContent = '';
    const glyph = document.createElement('div');
    if (type === 'loading') {
        glyph.className = 'statusSpinner';
    } else {
        glyph.className = `statusIconGlyph ${type}`;
        glyph.textContent = type === 'success' ? '✓' : '✕';
    }
    iconEl.appendChild(glyph);

    document.getElementById('statusTitle').textContent   = title;
    document.getElementById('statusMessage').textContent = message;
    overlay.dataset.success = '';
    overlay.className = `statusOverlay visible ${type}`;
}

function hideStatus() {
    const overlay = document.getElementById('statusOverlay');
    if (!overlay) return;
    overlay.className       = 'statusOverlay';
    overlay.dataset.success = '';
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function renderCartPreview(cartGrid) {
    const cartState = window.cartModule.getCartState();

    if (!cartState.length) {
        cartGrid.innerHTML = '<p class="emptyCart">No items in cart.</p>';
        updateTotal();
        return;
    }

    cartGrid.innerHTML = '<p class="emptyCart">Loading…</p>';

    const details = await Promise.all(
        cartState.map(item =>
            apiFetch(`products/${item.productId}`).catch(() => null)
        )
    );

    let total = 0;
    const rows = cartState.map((item, i) => {
        const p = details[i];
        if (!p) return '';
        const lineTotal = (p.price ?? 0) * item.quantity;
        total += lineTotal;
        return `
            <div class="cartLineItem">
                <span>${esc(p.name)}<span class="itemQty">×${item.quantity}</span></span>
                <span class="itemPrice">$${lineTotal.toFixed(2)}</span>
            </div>`;
    }).join('');

    cartGrid.innerHTML = rows || '<p class="emptyCart">No items in cart.</p>';

    const totalEl = document.getElementById('totalAmount');
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
}

function updateTotal() {
    const items = window.cartModule?.getItems?.() ?? [];
    const total = items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
    const totalEl = document.getElementById('totalAmount');
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
}

function setActiveChip(rail, active) {
    rail.querySelectorAll('.autofillChip').forEach(c => {
        c.classList.toggle('active', c === active);
        c.setAttribute('aria-selected', String(c === active));
    });
}

function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
}

// esc() and escAttr() are imported from ./utils.js