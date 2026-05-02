// main.js
import { menuModule } from './menu.js';
import { overlayModule } from './overlay.js';
import { cartModule } from './cart.js';
import { productInfoModule } from './productInfo.js';
import { initProducts } from "./products.js";
import { loadWishlistState } from './wishlist.js';

document.addEventListener('DOMContentLoaded', async () => {
    menuModule.init();
    overlayModule.init();

    await loadWishlistState();
    await initProducts();
    cartModule.init();
    window.cartModule = cartModule;
    productInfoModule.init();
    
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
});