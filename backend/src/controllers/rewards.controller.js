import { fetchRewards } from '../services/rewards.service.js';
import logger from '../utils/logger.js';

export async function getRewards(req, res) {
    try {
        const data = await fetchRewards(req.user.userId);
        res.json(data);
    } catch (err) {
        logger.error({ err }, 'getRewards error');
        res.status(500).json({ error: 'Failed to retrieve rewards' });
    }
}
