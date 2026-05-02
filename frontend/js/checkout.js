import { apiFetch } from './api.js';
import { overlayModule } from './overlay.js';
import {
    mountStripeElements,
    unmountStripeElements,
    submitNewCard,
    submitSavedCard,
} from './stripe.js';

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

    const token = localStorage.getItem('token');
    if (token) {
        // Load in parallel — UI degrades gracefully if either fails
        await Promise.all([loadSavedAddresses(), loadSavedCards()]);
    }

    bindCheckoutEvents();
}

export function teardownCheckout() {
    unmountStripeElements();
    _selectedStripeMethodId = null;

    // Reset rails so stale chips don't show on re-open
    const addressRail = document.getElementById('addressRail');
    const cardRail    = document.getElementById('cardRail');
    if (addressRail) addressRail.innerHTML = '';
    if (cardRail)    cardRail.innerHTML    = '';

    document.getElementById('addressAutofill').style.display = 'none';
    document.getElementById('cardAutofill').style.display    = 'none';
    document.getElementById('newCardSection').style.display  = '';

    hideStatus();
}

// ─── Saved addresses ──────────────────────────────────────────────────────────

async function loadSavedAddresses() {
    let addresses;
    try {
        addresses = await apiFetch('account/address');
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

    document.getElementById('viewCartBtn')?.addEventListener('click', () => {
        const preview = document.getElementById('cartPreview');
        const chevron = document.getElementById('cartChevron');
        const isOpen  = preview.classList.toggle('open');
        preview.setAttribute('aria-expanded', String(isOpen));
        chevron.classList.toggle('flipped', isOpen);
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

    const submitBtn = document.getElementById('submitOrder');
    submitBtn.disabled = true;
    showStatus('loading', 'Processing…', '');

    try {
        const fullName    = document.getElementById('fullName').value.trim();
        const saveAddress = document.getElementById('saveAddressCheck')?.checked ?? false;
        const saveCard    = document.getElementById('saveCardCheck')?.checked ?? false;
        const items       = window.cartModule?.getItems?.() ?? [];

        if (!fullName) throw new Error('Please enter your full name.');

        const addressId = await resolveAddressId(saveAddress);
        let order;

        if (_selectedStripeMethodId) {
            order = await submitSavedCard({
                stripePaymentMethodId: _selectedStripeMethodId,
                fullName,
                addressId,
                items,
            });
        } else {
            order = await submitNewCard({ fullName, addressId, saveCard, items });
        }

        document.getElementById('statusOverlay').dataset.success = 'true';
        showStatus(
        'success',
            'Order placed!',
            `Order #${order.orderId} confirmed. Check your email for details.`,
        );
        console.log('pre-clear cartState:', window.cartModule?.getCartState());
        window.cartModule.clearCartState();
        window.cartModule.updateAllBadges();
        console.log('post-clear cartState:', window.cartModule?.getCartState());
        console.log('cartModule defined:', !!window.cartModule);

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
// order.service.js stores addressId on the order record and resolves the full
// address at read-time. We therefore always need a persisted addressId.
//
// Rules:
//   - Saved chip selected  → use chip's addressId directly, no extra write.
//   - New address + save   → POST to /account/address with isDefault: false,
//                            use returned addressId.
//   - New address + no save → POST a transient record (label: 'Shipping',
//                             isDefault: false). This is the minimum needed for
//                             order.service.js to resolve the address. A future
//                             improvement would be to store address inline on
//                             the order to avoid orphan records.

async function resolveAddressId(saveAddress) {
    const rail       = document.getElementById('addressRail');
    const activeChip = rail?.querySelector('.autofillChip.active');

    if (activeChip && activeChip.dataset.addressId !== 'new') {
        return activeChip.dataset.addressId;
    }

    const line1  = document.getElementById('streetAddress').value.trim();
    const city   = document.getElementById('city').value.trim();
    const state  = document.getElementById('state').value.trim();
    const postal = document.getElementById('postal').value.trim();

    if (!line1 || !city || !state || !postal) {
        throw new Error('Please fill in your full shipping address.');
    }

    const saved = await apiFetch('account/address', {
        method: 'POST',
        body: JSON.stringify({
            line1,
            line2:     document.getElementById('aptUnit').value.trim(),
            city,
            state,
            zip:       postal,
            country:   'US',
            label:     saveAddress ? 'Home' : 'Shipping',
            isDefault: false,
        }),
    });

    return saved.addressId;
}

// ─── Status overlay ───────────────────────────────────────────────────────────

function showStatus(type, title, message) {
    const overlay = document.getElementById('statusOverlay');
    const iconMap = {
        loading: '<div class="statusSpinner"></div>',
        success: '<div class="statusIconGlyph success">✓</div>',
        error:   '<div class="statusIconGlyph error">✕</div>',
    };
    document.getElementById('statusIcon').innerHTML      = iconMap[type] ?? '';
    document.getElementById('statusTitle').textContent   = title;
    document.getElementById('statusMessage').textContent = message;
    overlay.dataset.success = '';
    overlay.className = `statusOverlay visible ${type}`;
}

function hideStatus() {
    const overlay = document.getElementById('statusOverlay');
    overlay.className    = 'statusOverlay';
    overlay.dataset.success = '';
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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

function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escAttr(str) {
    return String(str ?? '').replace(/"/g, '&quot;');
}