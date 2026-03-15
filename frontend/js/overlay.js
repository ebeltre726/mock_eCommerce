export const overlayModule = (() => {
  const overlay = document.getElementById('overlay');
  const overlayBackground = document.querySelector('.overlayBackground');
  const closeBtn = overlay.querySelector('.closeOverlays');
  const contentDiv = overlay.querySelector('.content');
  const templateCache = {};

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
    console.log('initTemplate called with:', target);
      requestAnimationFrame(() => {
          switch (target) {
              case 'products':
                  import('./products.js').then(({ initProducts }) => initProducts());
                  break;
              case 'checkout':
                  import('./checkout.js').then(({ initCheckout }) => initCheckout());
                  break;
              case 'account':
                  import('./account.js').then(({ initAccount }) => initAccount());
                  break;
              case 'login':
                  import('./login.js').then(({ initLogin }) => initLogin());
                  break;
              case 'signup':
                import('./signup.js')
                .then(({ initSignup }) => {
                    console.log('signup.js imported, initSignup:', initSignup); // add this
                    initSignup();
                })
                .catch(err => console.error('signup import failed:', err)); 
                  break;
          }
      });
  }

  function loadTemplate(target) {
    console.log('loadTemplate called with:', target);
      // Use cache first
      if (templateCache[target]) {
          contentDiv.innerHTML = templateCache[target];
          showOverlay();
          initTemplate(target);
          return;
      }

      // Fetch template if not cached
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
      showOverlay();
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

  return { init, open, close, loadTemplate };
})();