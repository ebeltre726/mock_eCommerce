// Modern approach
/*
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');

// script.js
const navLinks = document.querySelectorAll('.nav-link');
const overlays = document.querySelectorAll('.overlay');
const closeButtons = document.querySelectorAll('.close-overlay');
const overlayLogo = document.getElementById('overlayLogo');
const navbar = document.querySelector('.navbar');
const hero = document.querySelector('.hero');
const menu = document.querySelectorAll('.nav-menu')
const hamburgericon = document.getElementById('hamburger-icon')
*/

// Declare all necessary variables
const navToggle = document.querySelector('.nav-toggle'); // The hamburger icon toggle button
const navMenu = document.querySelector('.nav-menu'); // The menu itself
const navLinks = document.querySelectorAll('.nav-link'); // Links inside the menu
const overlays = document.querySelectorAll('.overlay'); // The overlays
const closeButtons = document.querySelectorAll('.close-overlay'); // Buttons to close overlays
const overlayLogo = document.getElementById('overlayLogo'); // Logo inside overlay
const navbar = document.querySelector('.navbar'); // The navbar
const hero = document.querySelector('.hero'); // Hero section
const menu = document.querySelectorAll('.nav-menu'); // Multiple menus, if any
const hamburgericon = document.getElementById('hamburger-icon'); // The hamburger icon image


// Open overlay
menu.forEach(link => {
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

function toggleMenu() {
    navMenu.classList.toggle('show');
    if (menu.classList.contains('show')) {
        hamburgericon.src = 'close.png';
    } else {
        hamburgericon.src = 'hamburger.png';
    }
}