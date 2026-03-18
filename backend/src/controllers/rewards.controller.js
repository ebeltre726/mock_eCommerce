import { fetchRewards } from '../services/rewards.service.js';

export async function getRewards(req, res) {
    try {
        const data = await fetchRewards(req.user.userId);
        res.json(data);
    } catch (err) {
        console.error('getRewards error:', err);
        res.status(500).json({ error: 'Failed to retrieve rewards' });
    }
}