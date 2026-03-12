export const accountNavModule = (() => {
    let navOpen = false;

    function init() {
        const toggleBtn = document.querySelector('.nav-toggle-btn');
        const navPanel = document.querySelector('.navPanel');
        const toggleIcon = document.getElementById('nav-toggle-icon');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                navPanel.classList.toggle('show');
                toggleBtn.classList.toggle('active');
                navOpen = !navOpen;
                toggleIcon.src = navOpen ? 'close.png' : 'hamburger.png';
            });
        }

        // Close nav when a panel button is clicked (on small screens)

    }

    return { init };
})();