// banner.js
import { overlayModule } from './overlay.js';

export const bannerModule = (() => {
    function init() {
        // CTA buttons
        document.querySelectorAll('.ctaButton').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                overlayModule.open(btn.querySelector('a').dataset.target);
            });
        });

        // BannerNav items (icon + text)
        document.querySelectorAll('.bannerItems').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.querySelector('a').dataset.target;
                overlayModule.open(target);
            });
        });
    }

    return { init };
})();