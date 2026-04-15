import { fetchOverview, patchOverview } from '../services/account.service.js';
import { uploadAvatar } from '../services/avatar.service.js';

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

export async function uploadAvatarFile(req, res) {
  try {
    const userId = req.user.userId;
    const file = req.file;

    console.log('Avatar upload attempt:', { userId, file: file ? { size: file.size, mimetype: file.mimetype, originalname: file.originalname } : 'no file' });

    const result = await uploadAvatar(userId, file);

    res.json({
      message: "Avatar uploaded successfully",
      avatar: result
    });

  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(400).json({ error: err.message });
  }
}