import { overlayModule } from './overlay.js';
import { apiFetch }      from './api.js';

export function initSignup() {
    const form        = document.getElementById('signup-form');
    const loginButton = document.getElementById('login-btn');
    const errorEl     = document.getElementById('signup-error');

    if (loginButton) {
        loginButton.addEventListener('click', () => overlayModule.open('login'));
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            firstName:       form.firstName.value,
            lastName:        form.lastName.value,
            email:           form.email.value.trim().toLowerCase(),
            confirmEmail:    form.confirmEmail.value.trim().toLowerCase(),
            password:        form.password.value,
            confirmPassword: form.confirmPassword.value,
            termsConditions: form.querySelector('#terms')?.checked,
        };

        if (data.email !== data.confirmEmail) {
            errorEl.textContent = 'Emails do not match';
            return;
        }

        if (data.password !== data.confirmPassword) {
            errorEl.textContent = 'Passwords do not match';
            return;
        }

        const submitBtn = form.querySelector('#createAcc');
        submitBtn.disabled    = true;
        submitBtn.textContent = 'Creating account…';

        try {
            await apiFetch('auth/signup', {
                method: 'POST',
                body: JSON.stringify({
                    firstName:       data.firstName,
                    lastName:        data.lastName,
                    email:           data.email,
                    password:        data.password,
                    termsConditions: data.termsConditions,
                }),
            });

            // Transition to verification step instead of redirecting immediately.
            showVerifyPanel(data.email);

        } catch (err) {
            if (errorEl) {
                errorEl.style.color = '';
                errorEl.textContent = err.message ?? 'Something went wrong.';
            }
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Create Account';
            console.error('[signup] error:', err);
        }
    });
}

// ── Verification panel ────────────────────────────────────────────────────────

function showVerifyPanel(email) {
    const step1      = document.getElementById('signup-step1');
    const verifyStep = document.getElementById('signup-verify-step');
    const subText    = document.getElementById('signup-verify-sub');

    if (!verifyStep) return;

    if (subText) {
        subText.textContent = `We sent a 6-digit code to ${email}. Enter it below to activate your account.`;
    }

    step1?.classList.add('hidden');
    verifyStep.classList.remove('hidden');

    const inputs    = verifyStep.querySelectorAll('.otp-input');
    const errorEl   = document.getElementById('signup-verify-error');
    const verifyBtn = document.getElementById('signup-verify-btn');
    const resendBtn = document.getElementById('signup-resend-btn');

    wireOtpInputs(inputs);

    verifyBtn?.addEventListener('click', () =>
        submitVerifyCode(email, inputs, errorEl, verifyBtn)
    );

    wireResendBtn(resendBtn, email, errorEl);
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
        btn.textContent = 'Verified! Taking you to sign in…';
        setTimeout(() => overlayModule.open('login'), 1400);
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

    inputs[0]?.focus();
}

function wireResendBtn(btn, email, errorEl) {
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
