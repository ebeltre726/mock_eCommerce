import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';
import { overlayModule }         from './overlay.js';
import { cartModule }            from './cart.js';
import { apiFetch }              from './api.js';
import { mergeWishlistOnLogin, refreshWishlistIcons } from './wishlist.js';
import config                    from './config.js';

// SRP auth communicates directly with Cognito — the password never transits the backend.
let _pool = null;
function getPool() {
    if (!_pool) {
        _pool = new CognitoUserPool({
            UserPoolId: config.cognito.userPoolId,
            ClientId:   config.cognito.clientId,
        });
    }
    return _pool;
}

function srpAuthenticate(email, password) {
    return new Promise((resolve, reject) => {
        const cognitoUser = new CognitoUser({ Username: email, Pool: getPool() });
        const authDetails = new AuthenticationDetails({ Username: email, Password: password });

        cognitoUser.authenticateUser(authDetails, {
            onSuccess(result) {
                resolve({
                    idToken:      result.getIdToken().getJwtToken(),
                    accessToken:  result.getAccessToken().getJwtToken(),
                    refreshToken: result.getRefreshToken().getToken(),
                });
            },
            onFailure(err) {
                // Map Cognito error codes to user-friendly messages matching the old flow.
                if (err.code === 'UserNotConfirmedException') {
                    const e = new Error('Please verify your email before logging in. Check your inbox for a verification link.');
                    e.code = err.code;
                    reject(e);
                } else if (err.code === 'NotAuthorizedException' || err.code === 'UserNotFoundException') {
                    reject(new Error('Invalid email or password'));
                } else if (err.code === 'PasswordResetRequiredException') {
                    reject(new Error('Password reset required — use "Forgot password" below.'));
                } else if (
                    err.code === 'InvalidParameterException' &&
                    err.message?.includes('USER_SRP_AUTH')
                ) {
                    // The Cognito App Client was created without ALLOW_USER_SRP_AUTH.
                    // Tag it so the submit handler can fall back to the backend proxy.
                    // Fix: aws cognito-idp update-user-pool-client --explicit-auth-flows
                    //      ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH
                    const e = new Error('SRP_NOT_ENABLED');
                    e.code  = 'SRP_NOT_ENABLED';
                    reject(e);
                } else {
                    reject(new Error(err.message ?? 'Something went wrong.'));
                }
            },
            totpRequired() {
                // TOTP MFA handling: surface a message; full MFA flow is a future enhancement.
                reject(new Error('MFA is required. Please use a supported client to complete sign-in.'));
            },
            newPasswordRequired() {
                reject(new Error('Your account requires a new password. Please contact support.'));
            },
        });
    });
}

const UNCONFIRMED_CODE = 'UserNotConfirmedException';

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

        const email    = form.email.value.trim().toLowerCase();
        const password = form.password.value;

        try {
            // 1a. Preferred: SRP auth directly with Cognito — password never reaches our backend.
            // 1b. Fallback:  if USER_SRP_AUTH isn't enabled on the Cognito App Client, route
            //     through the backend proxy (USER_PASSWORD_AUTH). This keeps login working in
            //     dev environments where the pool client hasn't been fully configured.
            //     Fix the root cause with:
            //       aws cognito-idp update-user-pool-client \
            //         --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH
            try {
                const tokens = await srpAuthenticate(email, password);
                await apiFetch('auth/tokens', {
                    method: 'POST',
                    body:   JSON.stringify(tokens),
                });
            } catch (srpErr) {
                if (srpErr.code !== 'SRP_NOT_ENABLED') throw srpErr;
                // SRP not available — backend proxy sets cookies directly via USER_PASSWORD_AUTH.
                console.warn('[login] USER_SRP_AUTH not enabled on Cognito client; using backend proxy fallback.');
                await apiFetch('auth/login', {
                    method: 'POST',
                    body:   JSON.stringify({ email, password }),
                });
            }

            // Auth cookies are now set. The browser sends them automatically.
            await cartModule.mergeCartsOnLogin();
            await mergeWishlistOnLogin();
            refreshWishlistIcons();
            overlayModule.open('account');

        } catch (err) {
            if (errorEl) errorEl.textContent = err.message ?? 'Something went wrong.';
            console.error('[login] error:', err);

            // Offer a resend link if the account isn't verified yet.
            if (err.code === UNCONFIRMED_CODE && errorEl) {
                showResendHint(errorEl, email);
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
