// Modern approach
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');

// script.js
const navLinks = document.querySelectorAll('.nav-link');
const overlays = document.querySelectorAll('.overlay');
const closeButtons = document.querySelectorAll('.close-overlay');
const overlayLogo = document.getElementById('overlayLogo');
const navbar = document.querySelector('.navbar');
const hero = document.querySelector('.hero');

// Open overlay
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    const target = e.target.getAttribute('href').substring(1); // remove #
    
    if (target === 'home') {
      // Close all overlays, show homepage
      closeAllOverlays();
    } else {
      // Open corresponding overlay
      e.preventDefault();
      const overlay = document.getElementById(`${target}-overlay`);
      if (overlay) {
        overlay.classList.add('active');
        overlayLogo.classList.add('active');
        navbar.classList.add('hidden');
      }
    }
  });
});

// Close overlay
closeButtons.forEach(btn => {
  btn.addEventListener('click', closeAllOverlays);
});

// Close on background click
overlays.forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeAllOverlays();
    }
  });
});

// Close with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllOverlays();
  }
});

function closeAllOverlays() {
  overlays.forEach(overlay => overlay.classList.remove('active'));
  overlayLogo.classList.remove('active');
  navbar.classList.remove('hidden');
}