// cart.js
import { menuModule } from './menu.js';


export const cartModule = (() => {
    const MAX_QTY = 5;

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
        controls.innerHTML = "";
        controls.appendChild(message);

        setTimeout(() => restoreAddButton(controls), 1500);
    }

    async function addItemToCart(productId, quantity) {
        const token = localStorage.getItem("token");
      
        if (token) {
          await fetch("/api/cart/add", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ productId, quantity })
          });
      
          // After adding, fetch updated cart
          const res = await fetch("/api/cart", {
            headers: { "Authorization": `Bearer ${token}` }
          });
      
          const cartItems = await res.json();
          console.log(cartItems);
        }
    }

    async function removeItemFromCart(productId) {
      const token = localStorage.getItem("token");
      if (token) {
        await fetch(`/api/cart/remove`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ productId })
        });
      } else {
        let cart = JSON.parse(localStorage.getItem("cart")) || [];
        cart = cart.filter(i => i.productId !== productId);
        localStorage.setItem("cart", JSON.stringify(cart));
      }
    }

    function changeCartIcon() {
        const cartImg = document.querySelector('.bannerNav li:last-child img');
        if (cartImg) cartImg.src = "cartAdd.png";
    }

    function updateProductBadge(productId) {
        let quantity = 0;
    
        const token = localStorage.getItem("token");
    
        if (!token) {
            const cart = JSON.parse(localStorage.getItem("cart")) || [];
            const item = cart.find(i => i.productId === productId);
            if (item) quantity = item.quantity;
        } else {
            // For now (mock project), assume backend already synced
            // In real app you'd fetch cart state
            return;
        }
    
        const productContainer = document.querySelector(
            `.cartProduct[data-product-id="${productId}"]`
        );
    
        if (!productContainer) return;
    
        const badge = productContainer.querySelector(".cartQtyBadge");
    
        if (quantity > 0) {
            badge.textContent = quantity;
            badge.classList.remove("hidden");
        } else {
            badge.classList.add("hidden");
        }
    }

    function handleClick(e) {
        const target = e.target;
        const parent = target.closest(".qtyControls");

        if (target.classList.contains("addToCart")) {
            const productContainer = target.closest(".cartProduct");
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
            qtyControls.dataset.productId = productId;
            target.replaceWith(qtyControls);
        }

        if (!parent) return;

        if (target.classList.contains("increaseQty")) {
            const qtySpan = parent.querySelector(".qtyValue");
            let qty = parseInt(qtySpan.textContent);
            if (qty < MAX_QTY) qtySpan.textContent = qty + 1;
        }

        if (target.classList.contains("decreaseQty")) {
            const qtySpan = parent.querySelector(".qtyValue");
            let qty = parseInt(qtySpan.textContent);
            if (qty > 1) qtySpan.textContent = qty - 1;
        }

        if (target.classList.contains("closeQty")) {
            restoreAddButton(parent);
        }

        if (target.classList.contains("confirmQty")) {
            const productId = parent.dataset.productId;
            const quantity = parseInt(parent.querySelector(".qtyValue").textContent);
            addItemToCart(productId, quantity);
            showAddedMessage(parent);
        }
    }

    function init() {
        document.addEventListener("click", handleClick);
    }

    return { init, removeItemFromCart };
})();