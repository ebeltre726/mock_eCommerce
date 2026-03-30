export const cartModule = (() => {
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
        const token = localStorage.getItem('token');
        if (token) {
            const res = await fetch('http://localhost:3000/api/cart', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                // Token expired or invalid — clear it and fall back to localStorage
                if (res.status === 401) localStorage.removeItem('token');
                cartState = [];
                return;
            }
            cartState = await res.json();
        } else {
            cartState = JSON.parse(localStorage.getItem('cart')) || [];
        }
    }

    function getItemQuantityInCart(productId) {
        // synchronous — reads from memory, no API call
        const item = cartState.find(i => i.productId === productId);
        return item ? item.quantity : 0;
    }

    async function mergeCartsOnLogin() {
        const localCart = JSON.parse(localStorage.getItem('cart')) || [];
        if (!localCart.length) {
            await loadCart();
            return;
        }

        const token = localStorage.getItem('token');
        for (const item of localCart) {
            await fetch('http://localhost:3000/api/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ productId: item.productId, quantity: item.quantity })
            });
        }

        localStorage.removeItem('cart');
        await loadCart();
        updateAllBadges();
    }

    // ============================================================
    // ADD / REMOVE
    // ============================================================

    async function addItemToCart(productId, quantity) {
        
        await loadCart();

        const currentQty = getItemQuantityInCart(productId) || 0; // sync, no fetch
        const allowedQty = Math.min(quantity, MAX_QTY - currentQty);
        if (allowedQty <= 0) {
            alert(`Maximum of ${MAX_QTY} reached.`);
            return;
        }
    
        // Update local state immediately
        const existing = cartState.find(i => i.productId === productId);
        if (existing) {
            existing.quantity = Math.min(existing.quantity + allowedQty, MAX_QTY);
        } else {
            cartState.push({ productId, quantity: allowedQty });
        }
    
        // Sync to API in background
        const token = localStorage.getItem('token');
        if (token) {
            await fetch('http://localhost:3000/api/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ productId, quantity: allowedQty })
            });
        } else {
            localStorage.setItem('cart', JSON.stringify(cartState));
        }
    
        updateProductBadge(productId); // sync, reads from cartState
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

        const token = localStorage.getItem('token');

        if (token) {
            await fetch('http://localhost:3000/api/cart/remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ productId, quantity })
            });
        } else {
            let cart = JSON.parse(localStorage.getItem('cart')) || [];
            const existing = cart.find(i => i.productId === productId);
            if (existing) {
                existing.quantity -= quantity;
                if (existing.quantity <= 0) {
                    cart = cart.filter(i => i.productId !== productId);
                }
            }
            localStorage.setItem('cart', JSON.stringify(cart));
        }

        updateProductBadge(productId);
    }

    // ============================================================
    // BADGE
    // ============================================================

    function updateProductBadge(productId) {
        // no await needed — reads cartState directly
        const quantity = getItemQuantityInCart(productId);
        const container = document.querySelector(`.cartProduct[data-product-id="${productId}"]`);
        if (!container) return;
        const badge = container.querySelector('.cartQtyBadge');
        if (!badge) return;
        badge.textContent = `x${quantity}`;
        badge.classList.toggle('hidden', quantity === 0);
    }
    
    function updateAllBadges() {
        if (!Array.isArray(cartState)) return; // guard against bad state
        cartState.forEach(item => updateProductBadge(item.productId));
    }

    async function fetchProductDetails(productId) {
        const res = await fetch(`http://localhost:3000/api/products/${productId}`);
        if (!res.ok) return null;
        return res.json();
    }

    async function renderCartProducts(container) {
        await loadCart(); // populates cartState

        if (!cartState.length) {
            container.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
            return;
        }
    
        const products = await Promise.all(
            cartState
                .filter(item => item.productId) // ← skip items with no productId
                .map(item => fetchProductDetails(item.productId))
        );
    
        const sentinel = container.querySelector('#productMarker');
        container.innerHTML = '';
        if (sentinel) container.appendChild(sentinel);
    
        cartState.forEach((item, i) => {
            const p = products[i];
            if (!p) return;
    
            const div = document.createElement('div');
            div.classList.add('cartProduct');
            div.dataset.productId = item.productId;
    
            div.innerHTML = `
                <label class="itemTitle">${p.name}</label>
                <div class="imgContnr">
                    <img class="info" src="info.png">
                    <label class="productDesc">${p.description || ''}</label>
                    <img class="closeProd hidden" src="close.png">
                    <img class="cartImage" src="http://localhost:3000${p.imageUrl || ''}">
                </div>
                <span class="cartQtyBadge ${item.quantity > 0 ? '' : 'hidden'}">x${item.quantity}</span>
                <button class="rmvCart">Remove from Cart</button>
                <label class="cartProdPrice">$${p.price || 0}</label>
            `;
    
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
        qtyControls.dataset.mode = mode;
        qtyControls.dataset.max = max;
        qtyControls.innerHTML = `
            <button class="closeQty">x</button>
            <button class="decreaseQty">-</button>
            <span class="qtyValue">1</span>
            <button class="increaseQty">+</button>
            <button class="confirmQty">✔</button>
        `;

        // Reset timer on every interaction
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
        const btn = document.createElement('button');
        btn.className = mode === 'add' ? 'addToCart' : 'rmvCart';
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
            const productId = productContainer.dataset.productId;
            const currentQty = await getItemQuantityInCart(productId);
            const maxAddable = MAX_QTY - currentQty;

            if (maxAddable <= 0) {
                alert(`You already have the maximum of ${MAX_QTY} in your cart.`);
                return;
            }

            const qtyControls = buildQtyControls(productId, 'add', maxAddable);
            target.replaceWith(qtyControls);
            return;
        }

        // REMOVE flow
        if (target.classList.contains('rmvCart')) {
            const productContainer = target.closest('.cartProduct');
            const productId = productContainer.dataset.productId;
            const currentQty = await getItemQuantityInCart(productId);

            if (currentQty <= 0) {
                const btn = target;
                btn.textContent = 'Not in cart';
                btn.disabled = true;
                setTimeout(() => {
                    btn.textContent = 'Remove';
                    btn.disabled = false;
                }, 2000);
                return;
            }

            const qtyControls = buildQtyControls(productId, 'remove', currentQty);
            target.replaceWith(qtyControls);
            return;
        }

        if (!parent) return;

        const qtySpan = parent.querySelector('.qtyValue');
        const max = parseInt(parent.dataset.max);

        if (target.classList.contains('increaseQty')) {
            let qty = parseInt(qtySpan.textContent);
            if (qty < max) qtySpan.textContent = qty + 1;
        }

        if (target.classList.contains('decreaseQty')) {
            let qty = parseInt(qtySpan.textContent);
            if (qty > 1) qtySpan.textContent = qty - 1;
        }

        if (target.classList.contains('closeQty')) {
            restoreButton(parent);
        }

        if (target.classList.contains('confirmQty')) {
            const productId = parent.dataset.productId;
            const mode = parent.dataset.mode;
            const quantity = parseInt(qtySpan.textContent);

            if (mode === 'add') {
                await addItemToCart(productId, quantity);
                showAddedMessage(parent);
            } else {
                await removeItemFromCart(productId, quantity);
                
                const remaining = getItemQuantityInCart(productId);
                
                if (remaining <= 0) {
                    // Remove the entire cartProduct div from the cart overlay
                    const productContainer = parent.closest('.cartProduct');
                    if (productContainer) productContainer.remove();
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
        if (cartImg) cartImg.src = 'cartAdd.png';
    }

    // ============================================================
    // INIT
    // ============================================================

    async function init() {
        document.addEventListener('click', handleClick);
        await loadCart();
        updateAllBadges(); // populate badges on page load for logged-in users
    }

    return { init, loadCart, removeItemFromCart, updateAllBadges, renderCartProducts, mergeCartsOnLogin, addItemToCart, getCartState, clearCartState };
})();