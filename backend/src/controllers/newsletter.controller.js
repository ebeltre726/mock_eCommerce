import { fetchNewsletter, patchNewsletter } from '../services/newsletter.service.js';
import { sendNewsletterSubscribed, sendNewsletterUnsubscribed } from '../services/email.service.js';

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

        const current = await fetchNewsletter(req.user.userId);
        const updated = await patchNewsletter(req.user.userId, { subscribed, topics });

        // Fire-and-forget — email failure must not fail the preferences save
        const wasSubscribed = current.subscribed ?? false;
        if (!wasSubscribed && subscribed) {
            sendNewsletterSubscribed({ email: req.user.email, firstName: req.user.firstName })
                .catch(err => console.error('[email] newsletter subscribed send failed:', err));
        } else if (wasSubscribed && !subscribed) {
            sendNewsletterUnsubscribed({ email: req.user.email, firstName: req.user.firstName })
                .catch(err => console.error('[email] newsletter unsubscribed send failed:', err));
        }

        res.json({ ...updated, action: !wasSubscribed && subscribed ? 'subscribed' : wasSubscribed && !subscribed ? 'unsubscribed' : 'updated' });
    } catch (err) {
        console.error('updateNewsletter error:', err);
        res.status(400).json({ error: err.message || 'Failed to update newsletter preferences' });
    }
}