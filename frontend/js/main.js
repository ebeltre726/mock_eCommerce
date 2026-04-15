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
        console.log('data-target click:', btn?.dataset.target);
        if (btn?.dataset.target) {
            e.preventDefault();
            overlayModule.open(btn.dataset.target);
        }
    });

    await initProducts();    // ← wait for products to render first
    cartModule.init();       // ← then init cart so badges find the divs
    productInfoModule.init();
});