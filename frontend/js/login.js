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
                if (err.code === 'UserNotConfirmedException') {
                    const e = new Error('Please verify your email before logging in.');
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
                    const e = new Error('SRP_NOT_ENABLED');
                    e.code  = 'SRP_NOT_ENABLED';
                    reject(e);
                } else {
                    reject(new Error(err.message ?? 'Something went wrong.'));
                }
            },
            totpRequired() {
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

        const email    = form.email.value.trim().toLowerCase();
        const password = form.password.value;

        try {
            try {
                const tokens = await srpAuthenticate(email, password);
                await apiFetch('auth/tokens', {
                    method: 'POST',
                    body:   JSON.stringify(tokens),
                });
            } catch (srpErr) {
                if (srpErr.code !== 'SRP_NOT_ENABLED') throw srpErr;
                console.warn('[login] USER_SRP_AUTH not enabled on Cognito client; using backend proxy fallback.');
                await apiFetch('auth/login', {
                    method: 'POST',
                    body:   JSON.stringify({ email, password }),
                });
            }

            await cartModule.mergeCartsOnLogin();
            await mergeWishlistOnLogin();
            refreshWishlistIcons();
            overlayModule.open('account');

        } catch (err) {
            if (errorEl) errorEl.textContent = err.message ?? 'Something went wrong.';
            console.error('[login] error:', err);

            if (err.code === UNCONFIRMED_CODE) {
                showVerifyPanel(email);
            }
        }
    });
}

// ── Verification panel ────────────────────────────────────────────────────────

function showVerifyPanel(email) {
    const step1       = document.getElementById('login-step1');
    const verifyStep  = document.getElementById('login-verify-step');
    const subText     = document.getElementById('login-verify-sub');

    if (!verifyStep) return;

    if (subText) {
        subText.innerHTML =
            `Enter the 6-digit code sent to ${email}.` +
            `<span class="spam-hint">Don't see it? Check your spam folder.</span>`;
    }

    step1?.classList.add('hidden');
    verifyStep.classList.remove('hidden');

    const inputs  = verifyStep.querySelectorAll('.otp-input');
    const errorEl = document.getElementById('login-verify-error');
    const verifyBtn = document.getElementById('login-verify-btn');
    const resendBtn = document.getElementById('login-resend-btn');
    const backBtn   = document.getElementById('login-verify-back');

    wireOtpInputs(inputs);

    backBtn?.addEventListener('click', () => {
        verifyStep.classList.add('hidden');
        step1?.classList.remove('hidden');
        inputs.forEach(i => { i.value = ''; i.classList.remove('otp-filled'); });
        if (errorEl) errorEl.textContent = '';
    });

    verifyBtn?.addEventListener('click', () => submitVerifyCode(email, inputs, errorEl, verifyBtn));

    wireResendBtn(resendBtn, email, errorEl, subText);
}

async function submitVerifyCode(email, inputs, errorEl, btn) {
    const code = [...inputs].map(i => i.value).join('');
    if (code.length < 6) {
        if (errorEl) errorEl.textContent = 'Please enter all 6 digits.';
        return;
    }
    if (errorEl) errorEl.textContent = '';

    const orig = btn.textContent;
    btn.disabled    = true;
    btn.textContent = 'Verifying…';

    try {
        await apiFetch('auth/confirm-signup', {
            method: 'POST',
            body:   JSON.stringify({ email, code }),
        });
        // Account confirmed — surface a brief success state then go to login.
        btn.textContent = 'Verified! Redirecting…';
        setTimeout(() => {
            overlayModule.open('login');
        }, 1400);
    } catch (err) {
        if (errorEl) errorEl.textContent = err.message ?? 'Verification failed. Please try again.';
        btn.disabled    = false;
        btn.textContent = orig;
    }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function wireOtpInputs(inputs) {
    inputs.forEach((input, idx) => {
        input.addEventListener('input', e => {
            const val = e.target.value.replace(/\D/g, '');
            e.target.value = val.slice(-1);
            e.target.classList.toggle('otp-filled', val.length > 0);
            if (val && idx < inputs.length - 1) inputs[idx + 1].focus();
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !input.value && idx > 0) {
                inputs[idx - 1].value = '';
                inputs[idx - 1].classList.remove('otp-filled');
                inputs[idx - 1].focus();
            }
        });

        input.addEventListener('paste', e => {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData)
                .getData('text').replace(/\D/g, '').slice(0, 6);
            pasted.split('').forEach((ch, i) => {
                if (inputs[i]) {
                    inputs[i].value = ch;
                    inputs[i].classList.add('otp-filled');
                }
            });
            const next = inputs[Math.min(pasted.length, inputs.length - 1)];
            next?.focus();
        });
    });

    // Auto-focus first box
    inputs[0]?.focus();
}

function wireResendBtn(btn, email, errorEl, subEl) {
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const orig = btn.textContent;
        btn.disabled    = true;
        btn.textContent = 'Sending…';
        if (errorEl) errorEl.textContent = '';
        try {
            await apiFetch('auth/resend-confirmation', {
                method: 'POST',
                body:   JSON.stringify({ email }),
            });
            btn.textContent = 'Sent!';
            if (subEl) {
                subEl.innerHTML =
                    `New code sent to ${email}.` +
                    `<span class="spam-hint">Check your spam folder if you don't see it.</span>`;
            }
            setTimeout(() => {
                btn.textContent = orig;
                btn.disabled    = false;
            }, 3000);
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = err.message?.includes('Too many')
                    ? 'Too many attempts — wait a moment and try again.'
                    : 'Could not send — try again later.';
            }
            btn.textContent = orig;
            btn.disabled    = false;
        }
    });
}
