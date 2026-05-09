import { fetchOverview, patchOverview } from '../services/account.service.js';
import { uploadAvatar } from '../services/avatar.service.js';
import logger from '../utils/logger.js';

export async function getOverview(req, res) {
    try {
        const data = await fetchOverview(req.user.userId);
        res.json(data);
    } catch (err) {
        logger.error({ err }, 'getOverview error');
        res.status(500).json({ error: 'Failed to retrieve overview' });
    }
}

export async function updateOverview(req, res) {
    try {
        const updated = await patchOverview(req.user.userId, req.body);
        res.json(updated);
    } catch (err) {
        logger.error({ err }, 'updateOverview error');
        res.status(400).json({ error: err.message || 'Failed to update profile' });
    }
}

export async function uploadAvatarFile(req, res) {
  try {
    const userId = req.user.userId;
    const file = req.file;

    logger.info({ userId, fileSize: file?.size, mimetype: file?.mimetype }, 'Avatar upload attempt');

    const result = await uploadAvatar(userId, file);

    res.json({
      message: "Avatar uploaded successfully",
      avatar: result
    });

  } catch (err) {
    logger.error({ err }, 'Avatar upload error');
    res.status(400).json({ error: err.message });
  }
}
