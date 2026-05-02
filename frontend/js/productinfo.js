// productInfo.js
export const productInfoModule = (() => {
    function handleClick(e) {
        const target = e.target;
        const container = target.closest(".imgContnr");
        if (!container) return;

        const infoIcon = container.querySelector(".info");
        const desc = container.querySelector(".productDesc");
        const closeBtn = container.querySelector(".closeProd");
        const cartImage = container.querySelector(".cartImage");
        const wlIcon = container.querySelector(".wishlist-icon");

        if (target.classList.contains("info")) {
            infoIcon.classList.add("hidden");
            desc.classList.add("active");
            if (closeBtn) closeBtn.classList.remove("hidden");
            if (cartImage) cartImage.classList.add("blur");
            if (wlIcon) wlIcon.classList.add("hidden");
        }

        if (target.classList.contains("closeProd")) {
            if (desc) desc.classList.remove("active");
            if (infoIcon) infoIcon.classList.remove("hidden");
            if (cartImage) cartImage.classList.remove("blur");
            if (wlIcon) wlIcon.classList.remove("hidden");
            target.classList.add("hidden");
        }
    }

    function init() {
        document.addEventListener("click", handleClick);
    }

    return { init };
})();