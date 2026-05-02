import { apiFetch } from './api.js';

// ─── Lazy initialisation ──────────────────────────────────────────────────────
// Nothing is created until mountStripeElements() is called.
// This prevents Stripe.js from running before the overlay DOM exists.

let _stripe   = null;
let _elements = null;
let _cardNumber = null;
let _cardExpiry = null;
let _cardCvc    = null;
let _mounted    = false;

const STYLE = {
    base: {
        color: '#1a1a1a',
        fontFamily: 'Poppins, sans-serif',
        fontSize: '14px',
        fontSmoothing: 'antialiased',
        '::placeholder': { color: '#9a9a9a' },
    },
    invalid: { color: '#e05c5c', iconColor: '#e05c5c' },
};

function getStripe() {
    if (!_stripe) _stripe = Stripe('pk_test_51TDH912E0ytncV4m8z5H93ZqAtjDo6b5LZ446LCdmMXTIPEb8UiZvlEzhZObkrnGDEDNWcP3V8FjzZmaVpnfovk200SQfEH1ca');
    return _stripe;
}

// ─── Mount / unmount ──────────────────────────────────────────────────────────

export function mountStripeElements(numberEl, expiryEl, cvcEl, errorsEl) {
    if (_mounted) return;

    if (!numberEl || !expiryEl || !cvcEl) {
        console.error('[stripe] Mount called with missing container elements.');
        return;
    }

    const stripe = getStripe();
    _elements    = stripe.elements();
    _cardNumber  = _elements.create('cardNumber', { style: STYLE });
    _cardExpiry  = _elements.create('cardExpiry', { style: STYLE });
    _cardCvc     = _elements.create('cardCvc',    { style: STYLE });

    _cardNumber.mount(numberEl);
    _cardExpiry.mount(expiryEl);
    _cardCvc.mount(cvcEl);

    _cardNumber.on('change', e => {
        if (errorsEl) errorsEl.textContent = e.error?.message ?? '';
    });

    _mounted = true;
}

export function unmountStripeElements() {
    if (!_mounted) return;
    _cardNumber?.unmount();
    _cardExpiry?.unmount();
    _cardCvc?.unmount();
    // Destroy element references so they can be recreated cleanly on next mount
    _cardNumber = null;
    _cardExpiry = null;
    _cardCvc    = null;
    _elements   = null;
    _mounted    = false;
}

// ─── Tokenise a new card and submit order ─────────────────────────────────────

export async function submitNewCard({ fullName, addressId, saveCard, items }) {
    if (!_cardNumber) throw new Error('Card elements are not mounted.');

    const stripe = getStripe();
    const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: _cardNumber,
        billing_details: { name: fullName },
    });

    if (error) throw new Error(error.message);

    const body = {
        paymentMethodId: paymentMethod.id,
        fullName,
        addressId,
        items,
        saveCard,
    };

    // Only send card metadata if the user wants to save — backend needs it
    // to write the PAYMENT# record in payment.service.js
    if (saveCard) {
        body.cardBrand  = paymentMethod.card.brand;
        body.cardLast4  = paymentMethod.card.last4;
        body.cardExpiry = `${paymentMethod.card.exp_month}/${String(paymentMethod.card.exp_year).slice(-2)}`;
    }

    return apiFetch('orders', { method: 'POST', body: JSON.stringify(body) });
}

// ─── Submit order with a saved Stripe payment method ─────────────────────────

export async function submitSavedCard({ stripePaymentMethodId, fullName, addressId, items }) {
    return apiFetch('orders', {
        method: 'POST',
        body: JSON.stringify({
            paymentMethodId: stripePaymentMethodId,
            fullName,
            addressId,
            items,
            saveCard: false,
        }),
    });
}

// ─── Account panel — tokenise only (no order) ────────────────────────────────
// Used by account.js to add a card from the Payment Methods panel.

export async function tokeniseCard(cardholderName) {
    if (!_cardNumber) throw new Error('Card elements are not mounted.');
    const stripe = getStripe();
    const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: _cardNumber,
        billing_details: { name: cardholderName },
    });
    if (error) throw new Error(error.message);
    return {
        stripePaymentMethodId: paymentMethod.id,
        brand:  paymentMethod.card.brand,
        last4:  paymentMethod.card.last4,
        expiry: `${paymentMethod.card.exp_month}/${String(paymentMethod.card.exp_year).slice(-2)}`,
    };
}