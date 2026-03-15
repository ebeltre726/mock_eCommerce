import { overlayModule } from './overlay.js';

export function initSignup() {
    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault(); // stops default form submission/page reload

        const form = e.target;
        const data = Object.fromEntries(new FormData(form));

        // Validate before sending
        if (data.email !== data.confirmEmail) {
            document.getElementById('signup-error').textContent = 'Emails do not match';
            return;
        }
        if (data.password !== data.confirmPassword) {
            document.getElementById('signup-error').textContent = 'Passwords do not match';
            return;
        }

        const res = await fetch('http://localhost:3000/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                password: data.password,
                termsConditions: form.querySelector('#terms').checked,
            })
        });

        const result = await res.json();

        if (!res.ok) {
            document.getElementById('signup-error').textContent = result.error;
            return;
        }

        localStorage.setItem('token', result.token);
        overlayModule.loadTemplate('account');
    });
}