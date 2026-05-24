import { sendMessage } from '../services/contact.service.js';
import { sendContactNotification } from '../services/email.service.js';
import logger from '../utils/logger.js';

export async function sendContactMessage(req, res) {
    try {
        const { firstName, lastName, email, emailMessage } = req.body;
        await sendMessage({ firstName, lastName, email, emailMessage });

        // Await the email before responding — Lambda freezes the execution context the
        // moment the response is sent, so a fire-and-forget Promise is silently abandoned.
        // .catch() keeps an SES failure from rejecting the outer try/catch so the stored
        // message still returns 200 even when email delivery fails.
        await sendContactNotification({ firstName, lastName, email, emailMessage })
            .catch(err => logger.error({ err }, '[email] contact notification send failed'));

        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (err) {
        logger.error({ err }, 'sendContactMessage error');
        res.status(400).json({ error: err.message || 'Failed to send message' });
    }
}
