import { fetchSettings, patchSettings, updatePassword, removeAccount } from '../services/settings.service.js';
import logger from '../utils/logger.js';

export async function getSettings(req, res) {
    try {
        const data = await fetchSettings(req.user.userId);
        res.json(data);
    } catch (err) {
        logger.error({ err }, 'getSettings error');
        res.status(500).json({ error: 'Failed to retrieve settings' });
    }
}

export async function updateSettings(req, res) {
    try {
        const updated = await patchSettings(req.user.userId, req.body);
        res.json(updated);
    } catch (err) {
        logger.error({ err }, 'updateSettings error');
        res.status(400).json({ error: err.message || 'Failed to update settings' });
    }
}

export async function changePassword(req, res) {
    try {
        const { current, password } = req.body;

        if (!current || !password) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        // Cognito's ChangePassword requires the access token (not the ID token).
        // Prefer the httpOnly cookie; fall back to X-Access-Token for API clients.
        const accessToken = req.cookies?.access_token ?? req.headers['x-access-token'];
        if (!accessToken) {
            return res.status(401).json({ error: 'Access token required to change password' });
        }

        await updatePassword(req.user.userId, current, password, accessToken);
        res.json({ success: true });
    } catch (err) {
        logger.error({ err }, 'changePassword error');
        const status = err.message === 'Current password is incorrect.' ? 400 : 500;
        res.status(status).json({ error: err.message || 'Failed to update password' });
    }
}

export async function deleteAccount(req, res) {
    try {
        // email comes from the Cognito ID token claims set on req.user by requireAuth
        await removeAccount(req.user.userId, req.user.email);
        res.json({ success: true });
    } catch (err) {
        logger.error({ err }, 'deleteAccount error');
        res.status(500).json({ error: 'Failed to delete account' });
    }
}
