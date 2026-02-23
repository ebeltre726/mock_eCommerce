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
const bannerItems = document.querySelectorAll('.bannerNav li')

// Cache templates to avoid redundant network requests
let templateCache = {};
let isMenuOpen = false;

function toggleMenu() {
    navMenu.classList.toggle('show');
    if (navMenu.classList.contains('show')) {
        hamburgericon.src = 'close.png';
        isMenuOpen = !isMenuOpen
    } else {
        hamburgericon.src = 'hamburger.png';
    }
}

function closeMenu() {
    navMenu.classList.remove('show');
    hamburgericon.src = 'hamburger.png'
    isMenuOpen = !isMenuOpen
}

// Function to initialize all event listeners
function initializeEventListeners() {
    // Event listeners for CTA Buttons
    ctaButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-target');
            loadTemplateAndOpenOverlay(target, e);
        });
    });

    // Event listeners for Nav Links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-target');
            loadTemplateAndOpenOverlay(target, e);
        });
    });

    // Event listeners for Banner Nav (both img and text)
    bannerItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Check if clicked on image or link
            let targetLink = null;
            if (e.target.tagName === 'A') {
                targetLink = e.target;  // If it's an <a> tag
            } else if (e.target.tagName === 'IMG') {
                targetLink = e.target.closest('li').querySelector('a');  // If it's an <img> tag, find the closest <a>
            }

            // Handle template loading
            if (targetLink) {
                const target = targetLink.getAttribute('data-target');
                loadTemplateAndOpenOverlay(target, e);
            }
        });
    });
}

// Function to load template and open the overlay
function loadTemplateAndOpenOverlay(target, event) {
    event.preventDefault(); // Prevent default anchor behavior (e.g., page refresh)
    
    closeAllOverlays();

    // Find the target overlay
    const overlay = document.getElementById(`${target}-overlay`);
    if (!overlay) return;

    // Load and inject the external template
    loadTemplate(target, overlay);

    // Open the overlay (show it)
    overlay.classList.add('active');
    overlayBackground.classList.add('active');
}

// Function to load an external template and inject it
function loadTemplate(target, overlay) {
    if (isMenuOpen) {
        closeMenu();
    }
    fetch(`templates/${target}.html`) // Assuming templates are named based on the target (e.g., "products.html")
        .then(response => response.text())
        .then(html => {
            const contentDiv = overlay.querySelector('.content');
            contentDiv.innerHTML = html; // Inject template into the content div
        })
        .catch(error => {
            console.error('Error loading template:', error);
            overlay.querySelector('.content').innerHTML = '<p>Template not found.</p>'; // Fallback message
        });
}

// Function to close all overlays
function closeAllOverlays() {
    overlays.forEach(overlay => {
        overlay.classList.remove('active');
    });
    overlayBackground.classList.remove('active');
}

// Initialize all event listeners when the page is ready
document.addEventListener('DOMContentLoaded', initializeEventListeners);
