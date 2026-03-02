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
  
    function loadTemplate(target) {
      // Use cache first
      if (templateCache[target]) {
        contentDiv.innerHTML = templateCache[target];
        overlay.classList.add('active');
        overlayBackground.classList.add('active');
  
        if (target === 'products') {
          requestAnimationFrame(() => {
            import('./products.js').then(({ initProducts }) => initProducts());
          });
        }
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
          overlay.classList.add('active');
          overlayBackground.classList.add('active');
  
          if (target === 'products') {
            requestAnimationFrame(() => {
              import('./products.js').then(({ initProducts }) => initProducts());
            });
          }
        })
        .catch(err => {
          console.error(err);
          contentDiv.innerHTML = '<p>Template not found.</p>';
          overlay.classList.add('active');
          overlayBackground.classList.add('active');
        });
    }
  
    function open(target) {
      // Always show overlay
      overlay.classList.add('active');
      overlayBackground.classList.add('active');
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