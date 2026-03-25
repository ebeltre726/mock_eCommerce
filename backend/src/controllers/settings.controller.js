// settinsg.controller.js
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

        await updatePassword(req.user.userId, current, password);
        res.json({ success: true });
    } catch (err) {
        res.status(err.message === 'Invalid current password' ? 400 : 500)
           .json({ error: err.message || 'Failed to update password' });
    }
}

export async function deleteAccount(req, res) {
    try {
        await removeAccount(req.user.userId);
        res.json({ success: true });
    } catch (err) {
        console.error('deleteAccount error:', err);
        res.status(500).json({ error: 'Failed to delete account' });
    }
}