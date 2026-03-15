import { overlayModule } from './overlay.js';

export function initLogin() {
    document.getElementById('signin-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
            })
        });

        const data = await res.json();

        if (!res.ok) {
            document.getElementById('signin-error').textContent = data.error;
            return;
        }

        localStorage.setItem('token', data.token);
        overlayModule.loadTemplate('account');
    });
}