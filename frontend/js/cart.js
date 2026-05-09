import { isWishlisted, toggleWishlist } from './wishlist.js';
import { apiFetch } from './api.js';
import { products } from './products.js';
import config from './config.js';
import { esc, escAttr, isLoggedIn } from './utils.js';

const MAX_QTY = 5;
let cartState = [];

// ============================================================
// CART STATE
// ============================================================

function getCartState() {
    return cartState;
}

function clearCartState() {
    cartState = [];
}

async function loadCart() {
    if (isLoggedIn()) {
        try {
            cartState = await apiFetch('cart');
        } catch (err) {
            cartState = [];
        }
    } else {
        cartState = JSON.parse(localStorage.getItem('cart')) || [];
    }
}

function getItemQuantityInCart(productId) {
    const item = cartState.find(i => i.productId === productId);
    return item ? item.quantity : 0;
}

async function mergeCartsOnLogin() {
    const localCart = JSON.parse(localStorage.getItem('cart')) || [];
    if (!localCart.length) {
        await loadCart();
        return;
    }

    await Promise.allSettled(localCart.map(item =>
        apiFetch('cart/add', {
            method: 'POST',
            body: JSON.stringify({
                productId: item.productId,
                quantity:  item.quantity,
            }),
        })
    ));

    localStorage.removeItem('cart');
    await loadCart();
    updateAllBadges();
}

// ============================================================
// ADD / REMOVE
// ============================================================

async function addItemToCart(productId, quantity) {
    // Trust in-memory cartState — no loadCart() round trip needed
    const currentQty = getItemQuantityInCart(productId);
    const allowedQty = Math.min(quantity, MAX_QTY - currentQty);

    if (allowedQty <= 0) {
        showCartError(`Maximum of ${MAX_QTY} per item reached.`);
        return;
    }

    const existing = cartState.find(i => i.productId === productId);
    if (existing) {
        existing.quantity = Math.min(existing.quantity + allowedQty, MAX_QTY);
    } else {
        cartState.push({ productId, quantity: allowedQty });
    }

    if (isLoggedIn()) {
        try {
            await apiFetch('cart/add', {
                method: 'POST',
                body: JSON.stringify({ productId, quantity: allowedQty }),
            });
        } catch (err) {
            console.error('Failed to sync cart add:', err);
        }
    } else {
        localStorage.setItem('cart', JSON.stringify(cartState));
    }

    updateProductBadge(productId);
    changeCartIcon();
}

async function removeItemFromCart(productId, quantity) {
    const existing = cartState.find(i => i.productId === productId);
    if (existing) {
        existing.quantity -= quantity;
        if (existing.quantity <= 0) {
            cartState = cartState.filter(i => i.productId !== productId);
        }
    }

    if (isLoggedIn()) {
        try {
            await apiFetch('cart/remove', {
                method: 'POST',
                body: JSON.stringify({ productId, quantity }),
            });
        } catch (err) {
            console.error('Failed to sync cart remove:', err);
        }
    } else {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        const item = cart.find(i => i.productId === productId);
        if (item) {
            item.quantity -= quantity;
            if (item.quantity <= 0) {
                cart = cart.filter(i => i.productId !== productId);
            }
        }
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    updateProductBadge(productId);
}

function getItems() {
    return cartState.map(item => {
        const product = products.find(p => (p.id ?? p.productId) === item.productId);
        return {
            productId: item.productId,
            quantity:  item.quantity,
            price:     product?.price ?? 0,
        };
    });
}

// ============================================================
// BADGE
// ============================================================

function updateProductBadge(productId) {
    const quantity  = getItemQuantityInCart(productId);
    const container = document.querySelector(`.cartProduct[data-product-id="${productId}"]`);
    if (!container) return;
    const badge = container.querySelector('.cartQtyBadge');
    if (!badge) return;
    badge.textContent = `x${quantity}`;
    badge.classList.toggle('hidden', quantity === 0);
}

function updateAllBadges() {
    if (!Array.isArray(cartState)) return;
    cartState.forEach(item => updateProductBadge(item.productId));
}

// ============================================================
// RENDER
// ============================================================

async function fetchProductDetails(productId) {
    try {
        return await apiFetch(`products/${productId}`);
    } catch {
        return null;
    }
}

async function renderCartProducts(container) {
    await loadCart();

    if (!cartState.length) {
        container.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
        return;
    }

    const productDetails = await Promise.all(
        cartState
            .filter(item => item.productId)
            .map(item => fetchProductDetails(item.productId))
    );

    const sentinel = container.querySelector('#productMarker');
    container.innerHTML = '';
    if (sentinel) container.appendChild(sentinel);

    cartState.forEach((item, i) => {
        const p = productDetails[i];
        if (!p) return;

        const div = document.createElement('div');
        div.classList.add('cartProduct');
        div.dataset.productId = item.productId;
        
        const base = import.meta.env?.BASE_URL ?? './';
        div.innerHTML = `
            <label class="itemTitle">${esc(p.name)}</label>
            <div class="imgContnr">
                <img class="info" src="${escAttr(base)}info.png">
                <label class="productDesc">${esc(p.description || '')}</label>
                <img class="closeProd hidden" src="${escAttr(base)}close.png">
                <img class="wishlist-icon" src="${isWishlisted(item.productId) ? `${escAttr(base)}wl-selected.png` : `${escAttr(base)}wl-unselected.png`}" data-product-id="${escAttr(String(item.productId))}">
                <img class="cartImage" src="${escAttr(p.imageUrl || '')}">
            </div>
            <span class="cartQtyBadge ${item.quantity > 0 ? '' : 'hidden'}">x${esc(String(item.quantity))}</span>
            <button class="rmvCart">Remove from Cart</button>
            <label class="cartProdPrice">$${esc(String(p.price || 0))}</label>
        `;

        const wlIcon = div.querySelector('.wishlist-icon');
        wlIcon.addEventListener('click', () => toggleWishlist(item.productId, wlIcon));

        container.insertBefore(div, sentinel || null);
        requestAnimationFrame(() => div.classList.add('active'));
    });
}

// ============================================================
// QTY CONTROLS
// ============================================================

function buildQtyControls(productId, mode, max) {
    const qtyControls = document.createElement('div');
    qtyControls.classList.add('qtyControls');
    qtyControls.dataset.productId = productId;
    qtyControls.dataset.mode      = mode;
    qtyControls.dataset.max       = max;
    qtyControls.innerHTML = `
        <button class="closeQty">x</button>
        <button class="decreaseQty">-</button>
        <span class="qtyValue">1</span>
        <button class="increaseQty">+</button>
        <button class="confirmQty">✔</button>
    `;

    let dismissTimer = setTimeout(() => {
        if (qtyControls.isConnected) restoreButton(qtyControls);
    }, 4000);

    qtyControls.addEventListener('click', () => {
        clearTimeout(dismissTimer);
        dismissTimer = setTimeout(() => {
            if (qtyControls.isConnected) restoreButton(qtyControls);
        }, 4000);
    });

    return qtyControls;
}

function restoreButton(qtyControls) {
    const mode = qtyControls.dataset.mode;
    const btn  = document.createElement('button');
    btn.className   = mode === 'add' ? 'addToCart' : 'rmvCart';
    btn.textContent = mode === 'add' ? 'Add to Cart' : 'Remove from Cart';
    qtyControls.replaceWith(btn);
}

function restoreAddButton(qtyControls) {
    const btn = document.createElement('button');
    btn.classList.add('addToCart');
    btn.textContent = 'Add to Cart';
    qtyControls.replaceWith(btn);
}

function showAddedMessage(controls) {
    const message = document.createElement('div');
    message.classList.add('addedMessage');
    message.textContent = 'Item(s) Added!';
    controls.replaceWith(message);

    setTimeout(() => {
        const btn = document.createElement('button');
        btn.classList.add('addToCart');
        btn.textContent = 'Add to Cart';
        message.replaceWith(btn);
    }, 1500);
}

// ============================================================
// CLICK HANDLER
// ============================================================

async function handleClick(e) {
    const target = e.target;
    const parent = target.closest('.qtyControls');

    // ADD flow
    if (target.classList.contains('addToCart')) {
        const productContainer = target.closest('.cartProduct');
        const productId        = productContainer.dataset.productId;
        const currentQty       = getItemQuantityInCart(productId);
        const maxAddable       = MAX_QTY - currentQty;

        if (maxAddable <= 0) {
            showCartError(`You already have the maximum of ${MAX_QTY} in your cart.`);
            return;
        }

        const qtyControls = buildQtyControls(productId, 'add', maxAddable);
        target.replaceWith(qtyControls);
        return;
    }

    // REMOVE flow
    if (target.classList.contains('rmvCart')) {
        const productContainer = target.closest('.cartProduct');
        const productId        = productContainer.dataset.productId;
        const currentQty       = getItemQuantityInCart(productId);

        if (currentQty <= 0) {
            target.textContent = 'Not in cart';
            target.disabled    = true;
            setTimeout(() => {
                target.textContent = 'Remove from Cart';
                target.disabled    = false;
            }, 2000);
            return;
        }

        const qtyControls = buildQtyControls(productId, 'remove', currentQty);
        target.replaceWith(qtyControls);
        return;
    }

    if (!parent) return;

    const qtySpan = parent.querySelector('.qtyValue');
    const max     = parseInt(parent.dataset.max);

    if (target.classList.contains('increaseQty')) {
        const qty = parseInt(qtySpan.textContent);
        if (qty < max) qtySpan.textContent = qty + 1;
    }

    if (target.classList.contains('decreaseQty')) {
        const qty = parseInt(qtySpan.textContent);
        if (qty > 1) qtySpan.textContent = qty - 1;
    }

    if (target.classList.contains('closeQty')) {
        restoreButton(parent);
    }

    if (target.classList.contains('confirmQty')) {
        const productId = parent.dataset.productId;
        const mode      = parent.dataset.mode;
        const quantity  = parseInt(qtySpan.textContent);

        if (mode === 'add') {
            await addItemToCart(productId, quantity);
            showAddedMessage(parent);
        } else {
            await removeItemFromCart(productId, quantity);
            const remaining = getItemQuantityInCart(productId);
            if (remaining <= 0) {
                parent.closest('.cartProduct')?.remove();
            } else {
                restoreButton(parent);
            }
        }
    }
}

// ============================================================
// UTILITIES
// ============================================================

function changeCartIcon() {
    const cartImg = document.querySelector('.bannerNav li:last-child img');
    if (cartImg) cartImg.src = `${import.meta.env?.BASE_URL ?? './'}cartAdd.png`;
}

function showCartError(message) {
    const existing = document.querySelector('.cart-inline-error');
    if (existing) existing.remove();
    const err       = document.createElement('p');
    err.className   = 'cart-inline-error';
    err.textContent = message;
    // Adjust selector to match your cart container
    document.querySelector('.cartContents')?.appendChild(err);
    setTimeout(() => err.remove(), 3000);
}

// ============================================================
// INIT
// ============================================================

async function init() {
    document.addEventListener('click', handleClick);
    await loadCart();
    updateAllBadges();
}

export const cartModule = {
    init,
    loadCart,
    clearCartState,
    getCartState,
    getItems,
    addItemToCart,
    removeItemFromCart,
    getItemQuantityInCart,
    mergeCartsOnLogin,
    updateAllBadges,
    renderCartProducts,
};