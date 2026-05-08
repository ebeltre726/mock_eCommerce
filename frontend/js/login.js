import { overlayModule }         from './overlay.js';
import { cartModule }            from './cart.js';
import { apiFetch }              from './api.js';
import { mergeWishlistOnLogin }  from './wishlist.js';

const UNCONFIRMED_MSG = 'Please verify your email before logging in.';

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
        clearResendHint(errorEl);

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

            // If Cognito says the email isn't verified yet, offer a resend link.
            if (err.message?.includes(UNCONFIRMED_MSG) && errorEl) {
                showResendHint(errorEl, form.email.value);
            }
        }
    });
}

function showResendHint(errorEl, email) {
    const existing = errorEl.parentElement?.querySelector('.resend-hint');
    if (existing) return; // already shown

    const hint = document.createElement('p');
    hint.className = 'resend-hint';
    hint.style.cssText = 'font-size:0.85em;margin-top:4px;';

    const link = document.createElement('a');
    link.href    = '#';
    link.textContent = 'Resend verification email';
    link.addEventListener('click', async ev => {
        ev.preventDefault();
        link.textContent = 'Sending…';
        link.style.pointerEvents = 'none';
        try {
            await apiFetch('auth/resend-confirmation', {
                method: 'POST',
                body:   JSON.stringify({ email }),
            });
            link.textContent = 'Sent! Check your inbox.';
        } catch (err) {
            link.textContent = err.message?.includes('Too many')
                ? 'Too many attempts — wait a moment and try again.'
                : 'Could not send — try again later.';
        }
    });

    hint.appendChild(link);
    errorEl.insertAdjacentElement('afterend', hint);
}

function clearResendHint(errorEl) {
    errorEl?.parentElement?.querySelector('.resend-hint')?.remove();
}
