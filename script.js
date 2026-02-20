// Declare all necessary variables
const navToggle = document.querySelector('.nav-toggle'); // The hamburger icon toggle button
const navMenu = document.querySelector('.nav-menu'); // The menu itself
const navLinks = document.querySelectorAll('.nav-link'); // Links inside the menu
const overlays = document.querySelectorAll('.overlay'); // The overlays
const overlayLogo = document.getElementById('overlayLogo'); // Logo inside overlay
const overlayBackground = document.querySelector('.overlayBackground')
const navbar = document.querySelector('.navbar'); // The navbar
const hero = document.querySelector('.hero'); // Hero section
const menu = document.querySelectorAll('.nav-menu'); // Multiple menus, if any
const hamburgericon = document.getElementById('hamburger-icon'); // The hamburger icon image
const ctaButtons = document.querySelectorAll('.ctaButton a');

// Open overlay
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    const target = e.target.getAttribute('href').substring(1); // remove #
    closeMenu()
    closeAllOverlays();
    
    const overlay = document.getElementById(`${target}-overlay`);
    if (overlay) {
        overlay.classList.add('active');
        overlayBackground.classList.add('active');
        openOverlay(target);
    }
  });
});

// Close with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllOverlays();
  }
});

ctaButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const target = e.target.getAttribute('href').substring(1); // Get target from href (remove #)
        
        const overlay = document.getElementById(`${target}-overlay`);
        if (overlay) {
            overlay.classList.add('active'); // Show the targeted overlay
            overlayBackground.classList.add('active');
            openOverlay(target);
        }
    });
});

function closeMenu() {
    navMenu.classList.remove('show');
    hamburgericon.src = 'hamburger.png'
}

function closeAllOverlays() {
    document.querySelectorAll('.overlay').forEach(overlay => {
        overlay.classList.remove('active');
    });
    overlayBackground.classList.remove('active');
}

function toggleMenu() {
    const menu = document.querySelector('.nav-menu');
    menu.classList.toggle('show');
    if (menu.classList.contains('show')) {
        hamburgericon.src = 'close.png';
    } else {
        hamburgericon.src = 'hamburger.png';
    }
}

function openOverlay(target) {
// Get the target overlay
    const overlay = document.getElementById(`${target}-overlay`);
    if (!overlay) return; // Exit if overlay doesn't exist

    // Handle content injection
    injectOverlayContent(target, overlay);

    // Show the overlay
    overlay.classList.add('active');
    overlayBackground.classList.add('active');
}

function injectOverlayContent(target, overlay) {
    const contentDiv = overlay.querySelector('.content');
    contentDiv.innerHTML = ''; // Clear existing content

    switch (target) {
        case 'products':
            contentDiv.innerHTML = `<h2>Products</h2><p>Content for products...</p>`;
            break;
        case 'account':
            contentDiv.innerHTML = `<h2>Account</h2><p>Account-related content...</p>`;
            break;
        case 'about':
            contentDiv.innerHTML = `<h2>About</h2><p>About us content...</p>`;
            break;
        case 'contact':
            contentDiv.innerHTML = `<h2>Contact</h2><p>Contact information...</p>`;
            break;
        default:
            contentDiv.innerHTML = `<p>Content not available</p>`;
            break;
    }
}

document.querySelectorAll('.bannerNav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.target.getAttribute('href').substring(1);
            closeAllOverlays();
            openOverlay(target);
            injectOverlayContent(target, document.querySelector(`#${target}-overlay`));
        });
    });