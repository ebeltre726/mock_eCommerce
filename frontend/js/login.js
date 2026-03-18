import { overlayModule } from './overlay.js';

export function initLogin() {
    const form = document.getElementById('signin-form');
    const signupButton = document.getElementById('signup-button');

    if (signupButton) {
        signupButton.addEventListener('click', () => {
            overlayModule.open('signup');
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            email: form.email.value,
            password: form.password.value,
        };

        try {
            const res = await fetch("http://localhost:3000/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (!res.ok) {
                document.getElementById("signin-error").textContent = result.message || "Login failed";
                return;
            }

            // ✅ Store token
            localStorage.setItem('token', result.token);

            // ✅ Load account UI (or redirect)
            overlayModule.open('account');

        } catch (err) {
            document.getElementById("signin-error").textContent = "Something went wrong.";
            console.error(err);
        }
    });
}