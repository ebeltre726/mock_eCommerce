import { fetchNewsletter, patchNewsletter } from '../services/newsletter.service.js';
import { sendNewsletterSubscribed, sendNewsletterUnsubscribed } from '../services/email.service.js';
import logger from '../utils/logger.js';

export async function getNewsletter(req, res) {
    try {
        const data = await fetchNewsletter(req.user.userId);
        res.json(data);
    } catch (err) {
        logger.error({ err }, 'getNewsletter error');
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

        // Await the email before responding — Lambda freezes the execution context the
        // moment the HTTP response is sent, so a fire-and-forget Promise is silently
        // abandoned. .catch() prevents an SES failure from rolling back a successful
        // preferences save.
        const wasSubscribed = current.subscribed ?? false;
        if (!wasSubscribed && subscribed) {
            await sendNewsletterSubscribed({ email: req.user.email, firstName: req.user.firstName })
                .catch(err => logger.error({ err }, '[email] newsletter subscribed send failed'));
        } else if (wasSubscribed && !subscribed) {
            await sendNewsletterUnsubscribed({ email: req.user.email, firstName: req.user.firstName })
                .catch(err => logger.error({ err }, '[email] newsletter unsubscribed send failed'));
        }

        res.json({ ...updated, action: !wasSubscribed && subscribed ? 'subscribed' : wasSubscribed && !subscribed ? 'unsubscribed' : 'updated' });
    } catch (err) {
        logger.error({ err }, 'updateNewsletter error');
        res.status(400).json({ error: err.message || 'Failed to update newsletter preferences' });
    }
}
