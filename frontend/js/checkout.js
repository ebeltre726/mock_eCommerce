// ── Mock cart data (replace with your real cart source) ──────────────────
  const cart = [
    { name: "Wireless Headphones", qty: 1, price: 89.99 },
    { name: "USB-C Cable (3-pack)", qty: 2, price: 12.49 },
    { name: "Laptop Stand",        qty: 1, price: 34.95 },
  ];

  // ── Render cart ───────────────────────────────────────────────────────────
  function renderCart() {
    const grid = document.getElementById("cartGrid");
    const totalEl = document.getElementById("totalAmount");

    if (!cart.length) {
      grid.innerHTML = `<div class="emptyCart">No items in cart.</div>`;
      totalEl.textContent = "$0.00";
      return;
    }

    let total = 0;
    grid.innerHTML = cart.map(item => {
      const lineTotal = item.qty * item.price;
      total += lineTotal;
      return `
        <div class="cartItem">
          <span class="itemName">${item.name}<span class="itemQty">×${item.qty}</span></span>
          <span class="itemPrice">$${lineTotal.toFixed(2)}</span>
        </div>`;
    }).join("");

    totalEl.textContent = `$${total.toFixed(2)}`;
  }

  // ── Toggle cart ───────────────────────────────────────────────────────────
  document.getElementById("viewCartBtn").addEventListener("click", () => {
    const preview = document.getElementById("cartPreview");
    const label   = document.getElementById("viewCartLabel");
    const chevron = document.getElementById("cartChevron");
    const open    = preview.classList.toggle("open");

    preview.setAttribute("aria-expanded", open);
    label.textContent = open ? "Hide Cart" : "View Cart";
    chevron.classList.toggle("flipped", open);

    if (open) {
      setTimeout(() => preview.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  });

  // ── Input formatting ──────────────────────────────────────────────────────
  document.getElementById("cardNumber").addEventListener("input", e => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 16);
    e.target.value = v.match(/.{1,4}/g)?.join(" ") ?? v;
  });

  document.getElementById("cardExpiry").addEventListener("input", e => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (v.length >= 3) v = v.slice(0,2) + "/" + v.slice(2);
    e.target.value = v;
  });

  document.getElementById("cardCvv").addEventListener("input", e => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  });

  // ── Validation ────────────────────────────────────────────────────────────
  function validateField(input) {
    const ok = input.checkValidity() && input.value.trim() !== "";
    input.classList.toggle("invalid", !ok);
    return ok;
  }

  document.querySelectorAll(".checkoutContent input").forEach(input => {
    input.addEventListener("blur", () => validateField(input));
  });

  // ── Status overlay ────────────────────────────────────────────────────────
  function showStatus({ success, processing = false }) {
    const overlay  = document.getElementById("statusOverlay");
    const icon     = document.getElementById("statusIcon");
    const title    = document.getElementById("statusTitle");
    const message  = document.getElementById("statusMessage");
    const dismiss  = document.getElementById("statusDismiss");

    if (processing) {
      icon.innerHTML = `<div class="spinner"></div>`;
      title.textContent = "Processing…";
      message.textContent = "Please do not close this window.";
      dismiss.style.display = "none";
    } else if (success) {
      icon.textContent = "✓";
      icon.style.color = "var(--success)";
      title.textContent = "Order Confirmed!";
      message.textContent = "Your order has been placed successfully. You'll receive a confirmation email shortly.";
      dismiss.style.display = "";
    } else {
      icon.textContent = "✕";
      icon.style.color = "var(--danger)";
      title.textContent = "Payment Failed";
      message.textContent = "We couldn't process your payment. Please check your details and try again.";
      dismiss.style.display = "";
    }

    overlay.classList.add("visible");
  }

  document.getElementById("statusDismiss").addEventListener("click", () => {
    document.getElementById("statusOverlay").classList.remove("visible");
    document.getElementById("submitOrder").disabled = false;
  });

  // ── Form submit ───────────────────────────────────────────────────────────
  document.getElementById("checkoutForm").addEventListener("submit", async e => {
    e.preventDefault();

    const inputs = [...e.target.querySelectorAll("input[required]")];
    const allValid = inputs.map(validateField).every(Boolean);
    if (!allValid) return;

    const btn = document.getElementById("submitOrder");
    btn.disabled = true;
    showStatus({ processing: true });

    // Replace with your real order submission logic
    await new Promise(r => setTimeout(r, 2000));
    const success = Math.random() > 0.25; // mock 75% success rate
    showStatus({ success });
  });