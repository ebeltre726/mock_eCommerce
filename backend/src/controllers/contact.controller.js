import { sendMessage } from '../services/contact.service.js';
import { sendContactNotification } from '../services/email.service.js';
import logger from '../utils/logger.js';

export async function sendContactMessage(req, res) {
    try {
        const { firstName, lastName, email, emailMessage } = req.body;
        await sendMessage({ firstName, lastName, email, emailMessage });

        // DEBUG: no .catch() so any SES error propagates to the outer catch and
        // returns a 400 with the actual AWS error message — revert after diagnosis.
        await sendContactNotification({ firstName, lastName, email, emailMessage });

        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (err) {
        logger.error({ err }, 'sendContactMessage error');
        res.status(400).json({ error: err.message || 'Failed to send message' });
    }
}
