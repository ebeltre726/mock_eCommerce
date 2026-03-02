// menu.js
import { overlayModule } from './overlay.js';

export const menuModule = (() => {
    let menuOpen = false;

    function init() {
        const hamburgerBtn = document.querySelector('.hamburger-btn');
        const navMenu = document.querySelector('.nav-menu');
        const hamburgerIcon = document.getElementById('hamburger-icon');

        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', () => {
                navMenu.classList.toggle('show');
                menuOpen = !menuOpen;
                hamburgerIcon.src = menuOpen ? 'close.png' : 'hamburger.png';
            });
        }

        // Nav menu links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                overlayModule.open(link.dataset.target);

                if (menuOpen) {
                    navMenu.classList.remove('show');
                    hamburgerIcon.src = 'hamburger.png';
                    menuOpen = false;
                }
            });
        });
    }

    return { init };
})();