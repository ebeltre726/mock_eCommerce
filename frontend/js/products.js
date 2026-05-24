// products.js

import { isWishlisted, toggleWishlist } from './wishlist.js';
import { apiFetch } from './api.js';
import { esc, escAttr } from './utils.js';

const BATCH_SIZE = 6;
const PAGE_SIZE = 24;
export let products = [];
let index = 0;
let observer;
let nextCursor = null;
let isFetching = false;

export async function initProducts() {
    index = 0;
    products = [];
    nextCursor = null;
    isFetching = false;

    // Show a spinner immediately so the empty grid doesn't confuse users
    // while the first API page is in flight.
    const container = document.querySelector('.productsContainer');
    if (container) {
        container.innerHTML = '<div class="products-loading"><div class="overlay-spinner"></div></div>';
    }

    await fetchProducts();
    setupObserver();
    setupEventDelegation();
}

async function fetchProducts() {
    if (isFetching) return;
    isFetching = true;
    try {
        const url = nextCursor
            ? `products?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(nextCursor)}`
            : `products?limit=${PAGE_SIZE}`;
        const data = await apiFetch(url);
        products = products.concat(data.items ?? []);
        nextCursor = data.nextCursor ?? null;
    } catch (err) {
        console.error('Failed to fetch products:', err);
    } finally {
        isFetching = false;
    }
    loadNextBatch();
}

function renderProduct(p) {
    const container = document.querySelector(".productsContainer");
    const sentinel = document.getElementById("productMarker");
    if (!container || !sentinel) return;

    // Remove the loading spinner the moment the first card is about to render
    container.querySelector('.products-loading')?.remove();

    const div = document.createElement("div");
    div.classList.add("cartProduct");
    div.dataset.productId = p.id;
  
    const base = import.meta.env?.BASE_URL ?? './';
    div.innerHTML = `
      <label class="itemTitle">${esc(p.name)}</label>
      <div class="imgContnr">
        <img class="info" src="${escAttr(base)}info.png">
        <label class="productDesc">${esc(p.description || "")}</label>
        <img class="closeProd hidden" src="${escAttr(base)}close.png">
        <img class="wishlist-icon" src="${isWishlisted(p.id) ? `${escAttr(base)}wl-selected.png` : `${escAttr(base)}wl-unselected.png`}" data-product-id="${escAttr(String(p.id))}">
        <img class="cartImage" src="${escAttr(p.imageUrl || "")}">
      </div>
      <button class="addToCart">Add to Cart</button>
      <label class="cartProdPrice">$${esc(String(p.price || 0))}</label>
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
    nextCursor = null;
    isFetching = false;
    if (observer) {
        observer.disconnect();
        observer = null;
    }
}

function loadNextBatch() {
    const nextItems = products.slice(index, index + BATCH_SIZE);
    nextItems.forEach(renderProduct);
    index += nextItems.length;

    if (index >= products.length) {
        if (nextCursor) {
            fetchProducts();
        } else if (observer) {
            observer.disconnect();
        }
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

    // Info/close button clicks are handled globally by productinfo.js
    // (document-level delegation, active/hidden class via .productDesc.active).
    // No local handler needed here — a second handler would conflict.
}