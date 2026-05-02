// productId → itemId (UUID from backend for auth users; productId sentinel for guests)

import { apiFetch, AuthError } from './api.js';

const wishlistMap = new Map();

export function isWishlisted(productId) {
    return wishlistMap.has(productId);
}

export async function loadWishlistState() {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const items = await apiFetch('account/wishlist');
            items.forEach(item => wishlistMap.set(item.productId, item.itemId));
        } catch (err) {
            if (err instanceof AuthError) localStorage.removeItem('token');
            console.error('Failed to load wishlist state', err);
        }
    } else {
        const local = JSON.parse(localStorage.getItem('wishlist')) || [];
        local.forEach(item => wishlistMap.set(item.productId, item.productId));
    }
}

export async function toggleWishlist(productId, iconEl) {
    const wishlisted = wishlistMap.has(productId);
    const token = localStorage.getItem('token');
    try {
        if (wishlisted) {
            if (token) {
                const itemId = wishlistMap.get(productId);
                await apiFetch(`account/wishlist/${itemId}`, { method: 'DELETE' });
            } else {
                const local = JSON.parse(localStorage.getItem('wishlist')) || [];
                localStorage.setItem('wishlist', JSON.stringify(local.filter(i => i.productId !== productId)));
            }
            wishlistMap.delete(productId);
            iconEl.src = `${import.meta.env?.BASE_URL ?? './'}wl-unselected.png`;
        } else {
            if (token) {
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
        const items = await apiFetch('account/wishlist');
        items.forEach(item => wishlistMap.set(item.productId, item.itemId));
    } catch (err) {
        console.error('Failed to reload wishlist after merge', err);
    }
}