import { fetchOverview, patchOverview } from '../services/account.service.js';

export async function getOverview(req, res) {
    try {
        const data = await fetchOverview(req.user.userId);
        res.json(data);
    } catch (err) {
        console.error('getOverview error:', err);
        res.status(500).json({ error: 'Failed to retrieve overview' });
    }
}

export async function updateOverview(req, res) {
    try {
        const updated = await patchOverview(req.user.userId, req.body);
        res.json(updated);
    } catch (err) {
        console.error('updateOverview error:', err);
        res.status(400).json({ error: err.message || 'Failed to update profile' });
    }
}