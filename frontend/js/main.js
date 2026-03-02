// main.js
import { menuModule } from './menu.js';
import { overlayModule } from './overlay.js';
import { cartModule } from './cart.js';
import { productInfoModule } from './productInfo.js';
import { bannerModule } from './banner.js';
import { initProducts } from "./products.js";
import { initCartOverlay } from "./cartOverlay.js";

document.addEventListener('DOMContentLoaded', () => {
    menuModule.init();
    overlayModule.init();

    document.querySelectorAll('.ctaButton').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            overlayModule.open(target);
        });
    });

    initProducts();
    initCartOverlay();
    cartModule.init();   // ✅ This is your cart init
    productInfoModule.init();
    bannerModule.init();
});