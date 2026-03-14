import { sendMessage } from '../services/contact.service.js';

export async function sendContactMessage(req, res) {
    try {
        console.log(req.body)
        const { firstName, lastName, email, emailMessage } = req.body;
        await sendMessage({ firstName, lastName, email, emailMessage });
        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (err) {
        console.error('sendContactMessage error:', err);
        res.status(400).json({ error: err.message || 'Failed to send message' });
    }
}