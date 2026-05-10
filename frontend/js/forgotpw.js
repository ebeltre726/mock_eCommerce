import { overlayModule } from './overlay.js';
import { apiFetch }      from './api.js';

export function initForgotPassword() {
    const step1      = document.getElementById('forgot-step1');
    const step2      = document.getElementById('forgot-step2');
    const successMsg = document.getElementById('forgot-success');
    const error1     = document.getElementById('forgot-error1');
    const error2     = document.getElementById('forgot-error2');

    let submittedEmail = '';

    // ── Step 1: request reset code ────────────────────────────────────────────
    document.getElementById('send-code-btn').addEventListener('click', async () => {
        const email = document.getElementById('forgot-email').value.trim();
        error1.textContent = '';

        if (!email) {
            error1.textContent = 'Please enter your email.';
            return;
        }

        const btn = document.getElementById('send-code-btn');
        btn.disabled = true;
        btn.textContent = 'Sending…';

        try {
            await apiFetch('auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });
            submittedEmail = email;
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
        } catch (err) {
            error1.textContent = err.message ?? 'Something went wrong. Please try again.';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send Reset Code';
        }
    });

    // ── Step 2: confirm code + new password ───────────────────────────────────
    document.getElementById('confirm-reset-btn').addEventListener('click', async () => {
        const code     = document.getElementById('reset-code').value.trim();
        const password = document.getElementById('reset-password').value;
        const confirm  = document.getElementById('reset-confirm-password').value;
        error2.textContent = '';

        if (!code || !password || !confirm) {
            error2.textContent = 'Please fill in all fields.';
            return;
        }
        if (password !== confirm) {
            error2.textContent = 'Passwords do not match.';
            return;
        }

        const btn = document.getElementById('confirm-reset-btn');
        btn.disabled = true;
        btn.textContent = 'Resetting…';

        try {
            await apiFetch('auth/confirm-forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email: submittedEmail, code, password }),
            });
            step2.classList.add('hidden');
            successMsg.classList.remove('hidden');
            setTimeout(() => overlayModule.open('login'), 2500);
        } catch (err) {
            error2.textContent = err.message ?? 'Failed to reset password. Please try again.';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Reset Password';
        }
    });

    // ── Back to login ─────────────────────────────────────────────────────────
    document.getElementById('back-to-login-btn')
        ?.addEventListener('click', () => overlayModule.open('login'));
}
