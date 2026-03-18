import { overlayModule } from './overlay.js';

export function initSignup() {
    const form = document.getElementById('signup-form');
    const loginButton = document.getElementById('login-btn');

    if (loginButton) {
        loginButton.addEventListener('click', () => {
            overlayModule.open('login');
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            firstName: form.firstName.value,
            lastName: form.lastName.value,
            email: form.email.value,
            confirmEmail: form.confirmEmail.value,
            password: form.password.value,
            confirmPassword: form.confirmPassword.value,
            termsConditions: form.querySelector('#terms')?.checked
        };

        // ✅ Frontend validation
        if (data.email !== data.confirmEmail) {
            document.getElementById('signup-error').textContent = 'Emails do not match';
            return;
        }

        if (data.password !== data.confirmPassword) {
            document.getElementById('signup-error').textContent = 'Passwords do not match';
            return;
        }

        

        try {
            const res = await fetch("http://localhost:3000/api/auth/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    password: data.password,
                    termsConditions: data.termsConditions
                })
            });

            const result = await res.json();

            if (!res.ok) {
                document.getElementById("signup-error").textContent = result.message || "Signup failed";
                return;
            }

            // ✅ Option A: auto-login after signup
            if (result.token) {
                localStorage.setItem('token', result.token);
                overlayModule.open('account');
            } else {
                // ✅ Option B: go to login screen
                overlayModule.open('login');
            }

        } catch (err) {
            document.getElementById("signup-error").textContent = "Something went wrong.";
            console.error(err);
        }
    });
}