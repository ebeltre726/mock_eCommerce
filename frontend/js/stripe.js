// stripe.js
import { apiFetch } from './api.js';

const stripe     = Stripe('pk_test_51TDH912E0ytncV4m8z5H93ZqAtjDo6b5LZ446LCdmMXTIPEb8UiZvlEzhZObkrnGDEDNWcP3V8FjzZmaVpnfovk200SQfEH1ca');
const style = {
    base: {
        color: '#32325d',
        fontFamily: 'inherit',
        fontSize: '16px',
        '::placeholder': {
            color: '#aab7c4', // ← light gray, matches typical input placeholders
        },
    },
    invalid: {
        color: '#fa755a',
    },
};
const elements   = stripe.elements();
const cardNumber = elements.create('cardNumber', { style });
const cardExpiry = elements.create('cardExpiry', { style });
const cardCvc    = elements.create('cardCvc',    { style });

export function mountStripeElement() {
    const numberEl = document.getElementById('card-number');
    const expiryEl = document.getElementById('card-expiry');
    const cvcEl    = document.getElementById('card-cvc');

    if (!numberEl || !expiryEl || !cvcEl) {
        console.error('Stripe element containers not found');
        return;
    }

    cardNumber.mount(numberEl);
    cardExpiry.mount(expiryEl);
    cardCvc.mount(cvcEl);

    [cardNumber, cardExpiry, cardCvc].forEach(el => {
        el.on('change', e => {
            const errorDiv = document.getElementById('card-errors');
            if (errorDiv) errorDiv.textContent = e.error ? e.error.message : '';
        });
    });
}

export async function submitStripePayment({ fullName, shippingAddress, cart }) {
    const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumber,
        billing_details: { name: fullName },
    });

    if (error) throw new Error(error.message);

    // First create the address
    const address = await apiFetch('account/address', {
        method: 'POST',
        body: JSON.stringify({
            line1: shippingAddress.street,
            line2: shippingAddress.apt || '',
            city: shippingAddress.city,
            state: shippingAddress.state,
            zip: shippingAddress.postal,
            country: 'US',
            isDefault: false, // Don't make checkout addresses default
        }),
    });

    // Then create the order with addressId
    const order = await apiFetch('orders', {
        method: 'POST',
        body: JSON.stringify({
            paymentMethodId: paymentMethod.id,
            fullName,
            addressId: address.addressId,
            cardLast4: paymentMethod.card.last4,
            items:     cart,
        }),
    });

    return order;
}