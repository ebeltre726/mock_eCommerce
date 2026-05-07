import { overlayModule } from './overlay.js';
import { apiFetch }      from './api.js';

export function initSignup() {
    const form       = document.getElementById('signup-form');
    const loginButton = document.getElementById('login-btn');
    const errorEl    = document.getElementById('signup-error');

    if (loginButton) {
        loginButton.addEventListener('click', () => {
            overlayModule.open('login');
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            firstName:       form.firstName.value,
            lastName:        form.lastName.value,
            email:           form.email.value,
            confirmEmail:    form.confirmEmail.value,
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

        try {
            const result = await apiFetch('auth/signup', {
                method: 'POST',
                body: JSON.stringify({
                    firstName:       data.firstName,
                    lastName:        data.lastName,
                    email:           data.email,
                    password:        data.password,
                    termsConditions: data.termsConditions,
                }),
            });

            // Cognito requires email verification before login is allowed.
            // Show the confirmation message and redirect to login — no token yet.
            if (errorEl) {
                errorEl.style.color  = 'green';
                errorEl.textContent  = result.message ?? 'Account created! Please verify your email then log in.';
            }

            setTimeout(() => overlayModule.open('login'), 3000);

        } catch (err) {
            if (errorEl) {
                errorEl.style.color = '';
                errorEl.textContent = err.message ?? 'Something went wrong.';
            }
            console.error('[signup] error:', err);
        }
    });
}
