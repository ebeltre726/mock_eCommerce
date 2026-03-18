import { fetchSettings, patchSettings } from '../services/settings.service.js';

export async function getSettings(req, res) {
    try {
        const data = await fetchSettings(req.user.userId);
        res.json(data);
    } catch (err) {
        console.error('getSettings error:', err);
        res.status(500).json({ error: 'Failed to retrieve settings' });
    }
}

export async function updateSettings(req, res) {
    try {
        const updated = await patchSettings(req.user.userId, req.body);
        res.json(updated);
    } catch (err) {
        console.error('updateSettings error:', err);
        res.status(400).json({ error: err.message || 'Failed to update settings' });
    }
}