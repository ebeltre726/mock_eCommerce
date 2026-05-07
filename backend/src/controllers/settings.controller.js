import { fetchSettings, patchSettings, updatePassword, removeAccount } from '../services/settings.service.js';

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

export async function changePassword(req, res) {
    try {
        const { current, password } = req.body;

        if (!current || !password) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        // Cognito's ChangePassword requires the access token (not the ID token).
        // Client must send it in X-Access-Token alongside the Bearer ID token.
        const accessToken = req.headers['x-access-token'];
        if (!accessToken) {
            return res.status(401).json({ error: 'Access token required to change password' });
        }

        await updatePassword(req.user.userId, current, password, accessToken);
        res.json({ success: true });
    } catch (err) {
        console.error('changePassword error:', err);
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
        console.error('deleteAccount error:', err);
        res.status(500).json({ error: 'Failed to delete account' });
    }
}
