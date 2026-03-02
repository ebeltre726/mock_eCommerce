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

function itsworking() {
    console.log("Dude, it's working.");
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
    
    document.addEventListener("click", function (e) {

        // ---------------------------
        // OPEN QUANTITY CONTROLS
        // ---------------------------
        if (e.target.classList.contains("addToCart")) {
      
          const button = e.target;
          const productContainer = button.closest(".cartProduct"); // make sure your product wrapper has this class
          const productId = productContainer.dataset.productId;
      
          const qtyControls = document.createElement("div");
          qtyControls.classList.add("qtyControls");
          qtyControls.innerHTML = `
            <button class="closeQty">x</button>
            <button class="decreaseQty">-</button>
            <span class="qtyValue">1</span>
            <button class="increaseQty">+</button>
            <button class="confirmQty">✔</button>
          `;
      
          button.replaceWith(qtyControls);
      
          qtyControls.dataset.productId = productId;
          qtyControls.dataset.timerId = autoCloseTimer;
        }
      
        // ---------------------------
        // INCREASE QUANTITY
        // ---------------------------
        if (e.target.classList.contains("increaseQty")) {
          const qtySpan = e.target.parentElement.querySelector(".qtyValue");
          let qty = parseInt(qtySpan.textContent);
      
          if (qty < 5) {
            qtySpan.textContent = qty + 1;
          }
        }

        document.addEventListener("click", function (e) {

            // 1️⃣ Click the info icon
            if (e.target.classList.contains("info")) {
              const container = e.target.closest(".imgContnr");
              const desc = container.querySelector(".productDesc");
              const closeBtn = container.querySelector(".closeProd"); // your close button
              const cartImage = container.querySelector(".cartImage");
          
              // show description and close button
              e.target.classList.add("hidden");       // hide info icon
              desc.classList.add("active");           // show description
              if (closeBtn) closeBtn.classList.remove("hidden"); // show close button
              if (cartImage) cartImage.classList.add("blur");
            }
          
            // 3️⃣ Click the close button
            if (e.target.classList.contains("closeProd")) {
              const container = e.target.closest(".imgContnr");
              const infoIcon = container.querySelector(".info");
              const desc = container.querySelector(".productDesc");
              const cartImage = container.querySelector(".cartImage");
          
              // hide description and close button, show info icon
              if (desc) desc.classList.remove("active");
              if (infoIcon) infoIcon.classList.remove("hidden");
              if (cartImage) cartImage.classList.remove("blur");
              e.target.classList.add("hidden");  // hide the close button itself
            }
          
          });
      
        // ---------------------------
        // DECREASE QUANTITY
        // ---------------------------
        if (e.target.classList.contains("decreaseQty")) {
          const qtySpan = e.target.parentElement.querySelector(".qtyValue");
          let qty = parseInt(qtySpan.textContent);
      
          if (qty > 1) {
            qtySpan.textContent = qty - 1;
          }
        }
      
        // ---------------------------
        // CLOSE BUTTON
        // ---------------------------
        if (e.target.classList.contains("closeQty")) {
          const controls = e.target.closest(".qtyControls");
          clearTimeout(controls.dataset.timerId);
          restoreAddButton(controls);
        }
      
        // ---------------------------
        // CONFIRM BUTTON
        // ---------------------------
        if (e.target.classList.contains("confirmQty")) {
      
          const controls = e.target.closest(".qtyControls");
          clearTimeout(controls.dataset.timerId);
      
          const productId = controls.dataset.productId;
          const quantity = parseInt(
            controls.querySelector(".qtyValue").textContent
          );
      
          addItemToCart(productId, quantity);
      
          changeCartIcon();
      
          showAddedMessage(controls);
        }
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

function restoreAddButton(qtyControls) {
    const newButton = document.createElement("button");
    newButton.classList.add("addToCart");
    newButton.textContent = "Add to Cart";
  
    qtyControls.replaceWith(newButton);
}

function showAddedMessage(controls) {
    const message = document.createElement("div");
    message.classList.add("addedMessage");
    message.textContent = "Item(s) Added!";
  
    controls.innerHTML = "";           // clear existing buttons
    controls.appendChild(message);     // show confirmation
  
    setTimeout(() => {
      restoreAddButton(controls);      // restore original button after delay
    }, 1500); // 1.5 seconds
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

function addItemToCart(productId, quantity) {

    const token = localStorage.getItem("token");
  
    if (token) {
      // Logged in → call API
      fetch("http://localhost:3000/api/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ productId, quantity })
      })
      .then(res => res.json())
      .then(data => console.log("Cart updated:", data))
      .catch(err => console.error(err));
  
    } else {
      // Not logged in → use localStorage
      let cart = JSON.parse(localStorage.getItem("cart")) || [];
  
      const existing = cart.find(item => item.productId === productId);
  
      if (existing) {
        existing.quantity = Math.min(existing.quantity + quantity, 5);
      } else {
        cart.push({
          productId,
          quantity: Math.min(quantity, 5)
        });
      }
  
      localStorage.setItem("cart", JSON.stringify(cart));
    }
}

function changeCartIcon() {

    const cartImg = document.querySelector(
      '.bannerNav li:last-child img'
    );
  
    if (cartImg) {
      cartImg.src = "cartAdd.png";
    }
  }

// Initialize all event listeners when the page is ready
document.addEventListener('DOMContentLoaded', initializeEventListeners);
