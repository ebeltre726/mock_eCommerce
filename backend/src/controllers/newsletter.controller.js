import { fetchNewsletter, patchNewsletter } from '../services/newsletter.service.js';

export async function getNewsletter(req, res) {
    try {
        const data = await fetchNewsletter(req.user.userId);
        res.json(data);
    } catch (err) {
        console.error('getNewsletter error:', err);
        res.status(500).json({ error: 'Failed to retrieve newsletter preferences' });
    }
}

export async function updateNewsletter(req, res) {
    try {
        const { subscribed, topics } = req.body;
        if (subscribed === undefined) {
            return res.status(400).json({ error: 'subscribed field is required' });
        }
        const updated = await patchNewsletter(req.user.userId, { subscribed, topics });
        res.json(updated);
    } catch (err) {
        console.error('updateNewsletter error:', err);
        res.status(400).json({ error: err.message || 'Failed to update newsletter preferences' });
    }
}