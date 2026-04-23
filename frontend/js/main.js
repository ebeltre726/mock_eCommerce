// main.js
import { menuModule } from './menu.js';
import { overlayModule } from './overlay.js';
import { cartModule } from './cart.js';
import { productInfoModule } from './productInfo.js';
import { initProducts } from "./products.js";

document.addEventListener('DOMContentLoaded', async () => {
    menuModule.init();
    overlayModule.init();
    
    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-target]');
        if (!btn?.dataset.target) return;
        e.preventDefault();

        const target = btn.dataset.target;

        if (target === 'checkout') {
            // Register teardown callback for checkout specifically
            import('./checkout.js').then(m => {
                overlayModule.open('checkout', m.teardownCheckout);
            });
        } else {
            overlayModule.open(target);
        }
    });

    await initProducts();    // ← wait for products to render first
    cartModule.init();       // ← then init cart so badges find the divs
    window.cartModule = cartModule; // expose for debugging
    productInfoModule.init();
});