// products.js

import { isWishlisted, toggleWishlist } from './wishlist.js';
import { apiFetch } from './api.js';

const BATCH_SIZE = 6;
export let products = [];
let index = 0;
let observer;

export async function initProducts() {
    index = 0;
    setupObserver();      // ✅ observer first
    await fetchProducts(); // ✅ fetch after
    //loadNextBatch();       // ✅ manually load first batch
    setupEventDelegation();
}

async function fetchProducts() {
    try {
        products = await apiFetch('products');
    } catch (err) {
        console.error('Failed to fetch products:', err);
        products = [];
    }
    loadNextBatch();
}

function renderProduct(p) {
    const container = document.querySelector(".productsContainer");
    const sentinel = document.getElementById("productMarker");
    if (!container || !sentinel) return;
  
    const div = document.createElement("div");
    div.classList.add("cartProduct");
    div.dataset.productId = p.id;
  
    const base = import.meta.env?.BASE_URL ?? './';
    div.innerHTML = `
      <label class="itemTitle">${p.name}</label>
      <div class="imgContnr">
        <img class="info" src="${base}info.png">
        <label class="productDesc">${p.description || ""}</label>
        <img class="closeProd hidden" src="${base}close.png">
        <img class="wishlist-icon" src="${isWishlisted(p.id) ? `${base}wl-selected.png` : `${base}wl-unselected.png`}" data-product-id="${p.id}">
        <img class="cartImage" src="${p.imageUrl || ""}">
      </div>
      <button class="addToCart">Add to Cart</button>
      <label class="cartProdPrice">$${p.price || 0}</label>
    `;

    const wlIcon = div.querySelector('.wishlist-icon');
    wlIcon.addEventListener('click', () => toggleWishlist(p.id, wlIcon));
  
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