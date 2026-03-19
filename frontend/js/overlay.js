export const overlayModule = (() => {
  const overlay = document.getElementById('overlay');
  const overlayBackground = document.querySelector('.overlayBackground');
  const closeBtn = overlay.querySelector('.closeOverlays');
  const contentDiv = overlay.querySelector('.content');
  const templateCache = {};

  const moduleMap = {
      products: () => import('./products.js').then(m => m.initProducts()),
      checkout: () => import('./checkout.js').then(m => m.initCheckout()),
      account:  () => import('./account.js').then(m => m.initAccount()),
      login:    () => import('./login.js').then(m => m.initLogin()),
      signup:   () => import('./signup.js').then(m => m.initSignup()),
      cart:     () => import('./cart.js').then(m => {
        const container = document.querySelector('.cartContents');
        if (!container) return;
        m.cartModule.renderCartProducts(container);
      }),
  };

  function close() {
      overlay.classList.remove('active');
      overlayBackground.classList.remove('active');
      contentDiv.innerHTML = '';
  }

  function showOverlay() {
      overlay.classList.add('active');
      overlayBackground.classList.add('active');
  }

  function initTemplate(target) {
      moduleMap[target]?.().catch(err => console.error(`Failed to init ${target}:`, err));
  }

  function loadTemplate(target) {
      if (templateCache[target]) {
          contentDiv.innerHTML = templateCache[target];
          showOverlay();
          initTemplate(target);
          return;
      }

      fetch(`templates/${target}.html`)
          .then(res => {
              if (!res.ok) throw new Error('Template not found');
              return res.text();
          })
          .then(html => {
              templateCache[target] = html;
              contentDiv.innerHTML = html;
              showOverlay();
              initTemplate(target);
          })
          .catch(err => {
              console.error(err);
              contentDiv.innerHTML = '<p>Template not found.</p>';
              showOverlay();
          });
  }

  function open(target) {
      loadTemplate(target);
  }

  function init() {
      if (closeBtn) closeBtn.addEventListener('click', close);
      if (overlayBackground) {
          overlayBackground.addEventListener('click', (e) => {
              if (e.target === overlayBackground) close();
          });
      }
  }

  return { init, open, close };
})();