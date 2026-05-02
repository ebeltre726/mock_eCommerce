import { apiFetch } from './api.js';

export function initContact() {
    const form = document.getElementById('contactForm');
    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = 'true';

    form.addEventListener('submit', async e => {
        e.preventDefault();

        const btn = form.querySelector('.submit-button');
        const statusEl = document.getElementById('contact-status');

        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
            await apiFetch('contact', {
                method: 'POST',
                body: JSON.stringify({
                    firstName:    form.firstName.value,
                    lastName:     form.lastName.value,
                    email:        form.email.value,
                    emailMessage: form.emailMessage.value,
                }),
            });

            form.reset();
            if (statusEl) {
                statusEl.textContent = 'Message sent! We will be in touch shortly.';
                statusEl.className = 'contact-status success';
            }
        } catch (err) {
            if (statusEl) {
                statusEl.textContent = err.message ?? 'Failed to send message. Please try again.';
                statusEl.className = 'contact-status error';
            }
            console.error('[contact] submit error:', err);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send Message';
        }
    });
}
