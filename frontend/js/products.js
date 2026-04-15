// products.js
const BATCH_SIZE = 6;
let products = [];
let index = 0;
let observer;

export async function initProducts() {
    index = 0;
    setupObserver();      // ✅ observer first
    await fetchProducts(); // ✅ fetch after
    loadNextBatch();       // ✅ manually load first batch
    setupEventDelegation();
}

async function fetchProducts() {
  try {
    const res = await fetch("http://localhost:3000/api/products");
    if (!res.ok) {
      console.error("Failed to fetch products:", await res.text());
      products = [];
      return;
    }
    products = await res.json();
  } catch (err) {
    console.error("Error fetching products:", err);
    products = [];
  }

  loadNextBatch(); // Load first batch
}

function renderProduct(p) {
    const container = document.querySelector(".productsContainer");
    const sentinel = document.getElementById("productMarker");
    if (!container || !sentinel) return;
  
    const div = document.createElement("div");
    div.classList.add("cartProduct");
    div.dataset.productId = p.id;
  
    div.innerHTML = `
      <label class="itemTitle">${p.name}</label>
      <div class="imgContnr">
        <img class="info" src="info.png">
        <label class="productDesc">${p.description || ""}</label>
        <img class="closeProd hidden" src="close.png">
        <img class="cartImage" src="${p.imageUrl || ""}">
      </div>
      <button class="addToCart">Add to Cart</button>
      <label class="cartProdPrice">$${p.price || 0}</label>
    `;
  
    container.append(div);
  
    // fade in animation
    requestAnimationFrame(() => div.classList.add("active"));
}

export function resetProducts() {
    products = [];
    index = 0;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
}

function loadNextBatch() {
    const nextItems = products.slice(index, index + BATCH_SIZE);
    nextItems.forEach(renderProduct);
    index += nextItems.length;
  
    if (index >= products.length && observer) {
      observer.disconnect();
    }
  }

function setupObserver() {
    const sentinel = document.getElementById("productMarker");
    const container = document.querySelector(".productsContainer");
    if (!sentinel || !container) return;
  
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadNextBatch(); // ✅ use existing logic
        }
      });
    }, {
      root: null,
      threshold: 0.1
    });
  
    observer.observe(sentinel);
}

function setupEventDelegation() {
    const container = document.querySelector('.productsContainer');
    if (!container) return;

    container.addEventListener('click', e => {
        const target = e.target;

        // Info button handling only — cart clicks handled by cart.js handleClick
        if (target.classList.contains('info')) {
            const productDiv = target.closest('.cartProduct');
            const desc = productDiv?.querySelector('.productDesc');
            const closeBtn = productDiv?.querySelector('.closeProd');
            if (desc) desc.classList.toggle('hidden');
            if (closeBtn) closeBtn.classList.toggle('hidden');
        }

        if (target.classList.contains('closeProd')) {
            const productDiv = target.closest('.cartProduct');
            const desc = productDiv?.querySelector('.productDesc');
            target.classList.add('hidden');
            if (desc) desc.classList.add('hidden');
        }
    });
}