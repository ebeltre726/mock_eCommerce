// cartOverlay.js
const BATCH_SIZE = 6;
let cartItems = [];
let cartIndex = 0;
let sentinelObserver;

export function initCartOverlay() {
    document.addEventListener("DOMContentLoaded", () => {
      fetchCart().then(() => setupObserver());
      setupEventDelegation();
    });
  }

async function fetchCart() {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const res = await fetch("/api/cart", {
        headers: { Authorization: `Bearer ${token}` }
      });
      cartItems = await res.json();
    } catch (err) {
      console.error("Failed to fetch cart from API:", err);
      cartItems = [];
    }
  } else {
    cartItems = JSON.parse(localStorage.getItem("cart")) || [];
  }

  loadNextCartBatch(); // Load first batch
}

function loadNextCartBatch() {
  const container = document.querySelector(".cartContents");
  const sentinel = document.getElementById("productMarker");
  if (!container || !sentinel) return;

  const nextItems = cartItems.slice(cartIndex, cartIndex + BATCH_SIZE);
  nextItems.forEach(item => {
    const div = document.createElement("div");
    div.classList.add("cartProduct");
    div.dataset.productId = item.productId;

    div.innerHTML = `
      <label class="itemTitle">${item.name || ""}</label>
      <div class="imgContnr">
        ${item.description ? `<label class="productDesc">${item.description}</label>` : ""}
        <div class="cartQtyBadge">${item.quantity || 0}</div>
        ${item.imageUrl ? `<img class="cartImage" src="http://localhost:3000${item.imageUrl}">` : ""}
      </div>
      <button class="rmvCart">Remove</button>
      ${item.price ? `<label class="cartProdPrice">$${item.price}</label>` : ""}
    `;

    container.insertBefore(div, sentinel);
  });

  cartIndex += BATCH_SIZE;

  if (cartIndex >= cartItems.length && sentinelObserver) {
    sentinelObserver.disconnect();
  }
}

function setupObserver() {
  const sentinel = document.getElementById("productMarker");
  const container = document.querySelector(".cartContents");
  if (!sentinel || !container) return;

  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const nextItems = products.slice(cartIndex, cartIndex + BATCH_SIZE);
        nextItems.forEach(p => {
          const div = document.createElement("div");
          div.classList.add("cartProduct");
          div.dataset.productId = p.productId;

          div.innerHTML = `
            <label class="itemTitle">${p.name}</label>
            <div class="imgContnr">
              <img class="info" src="${p.infoImageUrl || "info.png"}">
              <label class="productDesc">${p.description || ""}</label>
              <img class="closeProd hidden" src="close.png">
              <img class="cartImage" src="http://localhost:3000${p.imageUrl || ""}">
            </div>
            <button class="addToCart">Add to Cart</button>
            <label class="cartProdPrice">$${p.price || 0}</label>
          `;

          container.insertBefore(div, sentinelObserver);

          // Trigger fade/translate animation in next tick
          requestAnimationFrame(() => {
            div.classList.add("active");
          });
        });

        cartIndex += BATCH_SIZE;

        if (cartIndex >= cartItems.length && sentinelObserver) {
          sentinelObserver.disconnect();
        }
      }
    });
  }, {
    root: container,
    threshold: 0.1
  });

  observer.observe(sentinel);
}

function setupEventDelegation() {
  const container = document.querySelector(".cartContents");
  container.addEventListener("click", e => {
    const target = e.target;
    if (target.classList.contains("rmvCart")) {
      const productDiv = target.closest(".cartProduct");
      const productId = productDiv.dataset.productId;

      // call the cartModule remove function
      import('./cart.js').then(({ cartModule }) => {
        cartModule.removeItemFromCart?.(productId);
      });

      // remove from DOM immediately
      productDiv.remove();
    }
  });
}