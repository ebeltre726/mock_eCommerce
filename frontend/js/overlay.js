export const overlayModule = (() => {
  const overlay = document.getElementById('overlay');
  const overlayBackground = document.querySelector('.overlayBackground');
  const closeBtn = overlay.querySelector('.closeOverlays');
  const contentDiv = overlay.querySelector('.content');
  let _abortController = new AbortController();
  const templateCache = {};
  let _closeCallbacks = [];
  let _currentTarget = null;
  let _isLoading = false;

  const moduleMap = {
      products: () => import('./products.js').then(m => m.initProducts()),
      checkout: () => import('./checkout.js').then(m => m.initCheckout()),
      account:  () => import('./account.js').then(m => m.initAccount()),
      login:    () => import('./login.js').then(m => m.initLogin()),
      signup:   () => import('./signup.js').then(m => m.initSignup()),
      forgotpw: () => import('./forgotpw.js').then(m => m.initForgotPassword()),
      contact:  () => import('./contact.js').then(m => m.initContact()),
      cart:     () => import('./cart.js').then(m => {
        const container = document.querySelector('.cartContents');
        if (!container) return;
        m.cartModule.renderCartProducts(container);
      }),
  };

  function close() {
      _abortController.abort();
      _abortController = new AbortController();
      _closeCallbacks.forEach(fn => fn());
      _closeCallbacks = [];
      _currentTarget = null;
      _isLoading = false;
      overlay.classList.remove('active');
      overlayBackground.classList.remove('active');
      contentDiv.innerHTML = '';
  }

  // Re-runs the module init for the current target without re-fetching the template.
  // Useful when data changes and the panel needs to reinitialise in place.
  function refresh(target) {
      if (contentDiv.innerHTML && _currentTarget === target) {
          initTemplate(target);
      }
  }

  function registerCloseCallback(fn) {
      _closeCallbacks.push(fn);
  }

  function getSignal() {
      return _abortController.signal;
  }

  function showOverlay() {
      overlay.classList.add('active');
      overlayBackground.classList.add('active');
  }

  function initTemplate(target) {
      moduleMap[target]?.().catch(err => console.error(`Failed to init ${target}:`, err));
  }

  function loadTemplate(target) {
      _currentTarget = target;
      _isLoading = true;

      if (templateCache[target]) {
          _isLoading = false;
          contentDiv.innerHTML = templateCache[target];
          showOverlay();
          initTemplate(target);
          return;
      }

      fetch(`/templates/${target}.html`)
          .then(res => {
              if (!res.ok) throw new Error('Template not found');
              return res.text();
          })
          .then(html => {
              _isLoading = false;
              templateCache[target] = html;
              contentDiv.innerHTML = html;
              showOverlay();
              initTemplate(target);
          })
          .catch(err => {
              _isLoading = false;
              console.error(err);
              contentDiv.innerHTML = '<p>Template not found.</p>';
              showOverlay();
          });
  }

  function open(target, onClose = null) {
      _closeCallbacks = [];
      if (onClose) _closeCallbacks.push(onClose);

      // If the overlay is already visible and showing this target, don't reload
      // the template — doing so would destroy all mounted panel event listeners.
      // The caller can use overlayModule.refresh(target) for an explicit re-init.
      if (_currentTarget === target && (overlay.classList.contains('active') || _isLoading)) {
          return;
      }

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

  return { init, open, close, refresh, registerCloseCallback, getSignal };
})();

// Re-exported for callers that need to abort pending fetches when the overlay closes.
export function getOverlaySignal() {
    return overlayModule.getSignal();
}