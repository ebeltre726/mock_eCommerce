// productId → itemId (UUID from backend for auth users; productId sentinel for guests)

import { apiFetch, AuthError } from './api.js';
import { isLoggedIn } from './utils.js';

const wishlistMap = new Map();

export function isWishlisted(productId) {
    return wishlistMap.has(productId);
}

export async function loadWishlistState() {
    if (isLoggedIn()) {
        try {
            const { items } = await apiFetch('account/wishlist');
            items.forEach(item => wishlistMap.set(item.productId, item.itemId));
        } catch (err) {
            if (!(err instanceof AuthError)) console.error('Failed to load wishlist state', err);
        }
    } else {
        const local = JSON.parse(localStorage.getItem('wishlist')) || [];
        local.forEach(item => wishlistMap.set(item.productId, item.productId));
    }
}

export async function toggleWishlist(productId, iconEl) {
    const wishlisted = wishlistMap.has(productId);
    const authed = isLoggedIn();
    try {
        if (wishlisted) {
            if (authed) {
                const itemId = wishlistMap.get(productId);
                await apiFetch(`account/wishlist/${itemId}`, { method: 'DELETE' });
            } else {
                const local = JSON.parse(localStorage.getItem('wishlist')) || [];
                localStorage.setItem('wishlist', JSON.stringify(local.filter(i => i.productId !== productId)));
            }
            wishlistMap.delete(productId);
            iconEl.src = `${import.meta.env?.BASE_URL ?? './'}wl-unselected.png`;
        } else {
            if (authed) {
                const data = await apiFetch('account/wishlist', {
                    method: 'POST',
                    body: JSON.stringify({ productId }),
                });
                wishlistMap.set(productId, data.itemId);
            } else {
                const local = JSON.parse(localStorage.getItem('wishlist')) || [];
                local.push({ productId });
                localStorage.setItem('wishlist', JSON.stringify(local));
                wishlistMap.set(productId, productId);
            }
            iconEl.src = `${import.meta.env?.BASE_URL ?? './'}wl-selected.png`;
        }
    } catch (err) {
        console.error('Wishlist toggle failed', err);
    }
}

export function refreshWishlistIcons() {
    const base = import.meta.env?.BASE_URL ?? './';
    document.querySelectorAll('.wishlist-icon[data-product-id]').forEach(icon => {
        icon.src = wishlistMap.has(icon.dataset.productId)
            ? `${base}wl-selected.png`
            : `${base}wl-unselected.png`;
    });
}

// Called by the account panel when removing an item by itemId (not productId).
// Keeps wishlistMap and localStorage in sync without making another API call.
export function syncWishlistRemoval(productId) {
    wishlistMap.delete(productId);
    const local = JSON.parse(localStorage.getItem('wishlist')) || [];
    if (local.length) {
        localStorage.setItem('wishlist', JSON.stringify(local.filter(i => i.productId !== productId)));
    }
}

export async function mergeWishlistOnLogin() {
    const local = JSON.parse(localStorage.getItem('wishlist')) || [];
    if (local.length) {
        await Promise.allSettled(local.map(item =>
            apiFetch('account/wishlist', {
                method: 'POST',
                body: JSON.stringify({ productId: item.productId }),
            })
        ));
        localStorage.removeItem('wishlist');
    }
    wishlistMap.clear();
    try {
        const { items } = await apiFetch('account/wishlist');
        items.forEach(item => wishlistMap.set(item.productId, item.itemId));
    } catch (err) {
        console.error('Failed to reload wishlist after merge', err);
    }
}