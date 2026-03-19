export const accountNavModule = (() => {
    let navOpen = false;

    function init() {
        const toggleBtn = document.querySelector('.nav-toggle-btn');
        const navPanel = document.querySelector('.navPanel');
        const toggleIcon = document.getElementById('nav-toggle-icon');

        function updateIcon() {
            const isOpen = navPanel.classList.contains('show');
            toggleIcon.src = isOpen ? 'close.png' : 'hamburger.png';
        }

        toggleBtn.addEventListener('click', () => {
            navPanel.classList.toggle('show');
            toggleBtn.classList.toggle('active');
            updateIcon();
        });

        // Close nav when a panel button is clicked
        document.querySelectorAll('.navPanel button').forEach(btn => {
            btn.addEventListener('click', () => {
                const isAbsolute = getComputedStyle(navPanel).position === 'absolute';
                if (isAbsolute) {
                    navPanel.classList.remove('show');
                    toggleBtn.classList.remove('active');
                    navOpen = false;
                    toggleIcon.src = 'hamburger.png';
                }
            });
        });
    }

    return { init };
})();