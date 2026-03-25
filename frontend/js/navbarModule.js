export const accountNavModule = (() => {
    let currentToggleBtn = null; // track which element we're attached to

    function init() {
        const toggleBtn  = document.querySelector('.nav-toggle-btn');
        const navPanel   = document.querySelector('.navPanel');
        const toggleIcon = document.getElementById('nav-toggle-icon');

        if (!toggleBtn || !navPanel || !toggleIcon) {
            console.error('navbarModule: required elements not found');
            return;
        }

        // If already initialised on this exact element, skip
        if (toggleBtn === currentToggleBtn) return;
        currentToggleBtn = toggleBtn;

        function updateIcon() {
            const isOpen = navPanel.classList.contains('show');
            toggleIcon.src = isOpen ? 'close.png' : 'hamburger.png';
        }

        toggleBtn.addEventListener('click', () => {
            navPanel.classList.toggle('show');
            toggleBtn.classList.toggle('active');
            updateIcon();
        });

        document.querySelectorAll('.navPanel button').forEach(btn => {
            btn.addEventListener('click', () => {
                const isAbsolute = getComputedStyle(navPanel).position === 'absolute';
                if (isAbsolute) {
                    navPanel.classList.remove('show');
                    toggleBtn.classList.remove('active');
                    toggleIcon.src = 'hamburger.png';
                }
            });
        });
    }

    return { init };
})();