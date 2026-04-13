// checkout.js
import { cartModule } from './cart.js';
import { overlayModule } from './overlay.js';
import { mountStripeElement, submitStripePayment } from './stripe.js';
import { apiFetch } from './api.js';

export function initCheckout() {
    mountStripeElement();
    renderCart();
    setupCartToggle();
    setupStatusDismiss();
    setupFormSubmit();
}

async function renderCart() {
    const grid    = document.getElementById('cartGrid');
    const totalEl = document.getElementById('totalAmount');
    if (!grid || !totalEl) return;

    let cart = cartModule.getCartState();
    if (!cart.length) {
        await cartModule.loadCart();
        cart = cartModule.getCartState();
    }

    if (!cart.length) {
        grid.innerHTML = `<div class="emptyCart">No items in cart.</div>`;
        totalEl.textContent = '$0.00';
        return;
    }

    const products = await Promise.all(
        cart.map(item =>
            fetch(`http://localhost:3000/api/products/${item.productId}`)
                .then(r => r.ok ? r.json() : null)
        )
    );

    let total = 0;
    grid.innerHTML = cart.map((item, i) => {
        const p = products[i];
        if (!p) return '';
        const lineTotal = item.quantity * p.price;
        total += lineTotal;
        return `
            <div class="cartItem">
                <span class="itemName">${p.name}
                    <span class="itemQty">×${item.quantity}</span>
                </span>
                <span class="itemPrice">$${lineTotal.toFixed(2)}</span>
            </div>
        `;
    }).join('');

    totalEl.textContent = `$${total.toFixed(2)}`;
}

function setupCartToggle() {
    const viewCartBtn = document.getElementById('viewCartBtn');
    if (!viewCartBtn) return;

    viewCartBtn.addEventListener('click', () => {
        const preview = document.getElementById('cartPreview');
        const label   = document.getElementById('viewCartLabel');
        const chevron = document.getElementById('cartChevron');
        const open    = preview.classList.toggle('open');

        preview.setAttribute('aria-expanded', open);
        label.textContent = open ? 'Hide Cart' : 'View Cart';
        chevron.classList.toggle('flipped', open);

        if (open) {
            setTimeout(() => preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
        }
    });
}

function validateField(input) {
    const ok = input.checkValidity() && input.value.trim() !== '';
    input.classList.toggle('invalid', !ok);
    return ok;
}

function showStatus({ success, processing = false, message = null }) {
    const overlay = document.getElementById('statusOverlay');
    const icon    = document.getElementById('statusIcon');
    const title   = document.getElementById('statusTitle');
    const msg     = document.getElementById('statusMessage');
    const dismiss = document.getElementById('statusDismiss');

    if (processing) {
        icon.innerHTML      = `<div class="spinner"></div>`;
        title.textContent   = 'Processing…';
        msg.textContent     = 'Please do not close this window.';
        dismiss.style.display = 'none';
    } else if (success) {
        icon.textContent    = '✓';
        icon.style.color    = 'var(--success)';
        title.textContent   = 'Order Confirmed!';
        msg.textContent     = message ?? 'Your order has been placed successfully.';
        dismiss.style.display = '';
    } else {
        icon.textContent    = '✕';
        icon.style.color    = 'var(--danger)';
        title.textContent   = 'Payment Failed';
        msg.textContent     = message ?? 'We couldn\'t process your payment. Please check your details and try again.';
        dismiss.style.display = '';
    }

    overlay.classList.add('visible');
}

function setupStatusDismiss() {
    document.getElementById('statusDismiss')?.addEventListener('click', () => {
        document.getElementById('statusOverlay').classList.remove('visible');
        document.getElementById('submitOrder').disabled = false;
    });
}

function setupFormSubmit() {
  document.getElementById('checkoutForm')?.addEventListener('submit', async e => {
      e.preventDefault();

      // Validate all required shipping fields
      const requiredIds = ['fullName', 'streetAddress', 'city', 'state', 'postal'];
      const allValid = requiredIds
          .map(id => {
              const el = document.getElementById(id);
              if (!el) {
                  console.error(`Field not found: ${id}`);
                  return false;
              }
              return validateField(el);
          })
          .every(Boolean);

      if (!allValid) return;

      const btn = document.getElementById('submitOrder');
      btn.disabled = true;
      showStatus({ processing: true });

      try {
          const cart = cartModule.getCartState();
          const order = await submitStripePayment({
              fullName: document.getElementById('fullName').value,
              shippingAddress: {
                  street:  document.getElementById('streetAddress').value,
                  apt:     document.getElementById('aptUnit').value || null,
                  city:    document.getElementById('city').value,
                  state:   document.getElementById('state').value,
                  postal:  document.getElementById('postal').value,
              },
              cart: cart,
          });

          showStatus({
              success: true,
              message: order.paymentMethod === 'stripe_test'
                  ? 'Payment confirmed via Stripe. Order placed successfully.'
                  : 'Payment method added. Your demo order has been placed.',
          });

          await apiFetch('cart/clear', { method: 'DELETE' });
          cartModule.clearCartState();
          cartModule.updateAllBadges();

      } catch (err) {
          console.error('Order submission failed:', err);
          showStatus({ success: false });
      }
  });
}