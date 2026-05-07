import { overlayModule }         from './overlay.js';
import { cartModule }            from './cart.js';
import { apiFetch }              from './api.js';
import { mergeWishlistOnLogin }  from './wishlist.js';

export function initLogin() {
    const form      = document.getElementById('login-form');
    const signupBtn = document.getElementById('signup-button');
    const errorEl   = document.getElementById('signin-error');

    if (!form) {
        console.error('[login] Form element not found — check template ID matches login.js query');
        return;
    }

    signupBtn?.addEventListener('click', () => overlayModule.open('signup'));

    document.getElementById('reset-password-btn')
        ?.addEventListener('click', () => overlayModule.open('forgotpw'));

    form.addEventListener('submit', async e => {
        e.preventDefault();

        try {
            const result = await apiFetch('auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email:    form.email.value,
                    password: form.password.value,
                }),
            });

            // Store the Cognito ID token — used as the Bearer token on all API calls.
            // Store the access token — required to call /api/auth/logout (GlobalSignOut).
            // Store the refresh token — used to silently renew sessions before expiry.
            localStorage.setItem('token',        result.token);
            localStorage.setItem('accessToken',  result.accessToken);
            localStorage.setItem('refreshToken', result.refreshToken);

            await cartModule.mergeCartsOnLogin();
            await mergeWishlistOnLogin();
            overlayModule.open('account');

        } catch (err) {
            if (errorEl) errorEl.textContent = err.message ?? 'Something went wrong.';
            console.error('[login] error:', err);
        }
    });
}
