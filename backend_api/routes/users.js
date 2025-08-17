const express = require('express');
const router = express.Router();
const { saveUserToken, removeUserToken } = require('../services/database-service');
const { validateToken } = require('../services/firebase-service');

/**
 * Save FCM token for user
 * POST /api/user/fcm-token
 */
router.post('/fcm-token', async (req, res) => {
  try {
    const { fcm_token, platform, user_id } = req.body;

    // Validation
    if (!fcm_token || !user_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'fcm_token and user_id are required'
      });
    }

    if (!platform || !['ios', 'android'].includes(platform)) {
      return res.status(400).json({
        error: 'Invalid platform',
        message: 'platform must be either "ios" or "android"'
      });
    }

    // Validate FCM token with Firebase
    const tokenValidation = await validateToken(fcm_token);
    if (!tokenValidation.valid) {
      return res.status(400).json({
        error: 'Invalid FCM token',
        message: 'The provided FCM token is not valid'
      });
    }

    // Save token to database
    await saveUserToken(user_id, fcm_token, platform);

    res.status(200).json({
      success: true,
      message: 'FCM token saved successfully'
    });

  } catch (error) {
    console.error('Error saving FCM token:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to save FCM token'
    });
  }
});

/**
 * Remove FCM token for user
 * DELETE /api/user/fcm-token
 */
router.delete('/fcm-token', async (req, res) => {
  try {
    const { fcm_token, user_id } = req.body;

    // Validation
    if (!fcm_token || !user_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'fcm_token and user_id are required'
      });
    }

    // Remove token from database
    await removeUserToken(user_id, fcm_token);

    res.status(200).json({
      success: true,
      message: 'FCM token removed successfully'
    });

  } catch (error) {
    console.error('Error removing FCM token:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to remove FCM token'
    });
  }
});

/**
 * Get user profile (example endpoint)
 * GET /api/user/profile/:userId
 */
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // This is a placeholder - implement based on your user system
    res.status(200).json({
      user_id: userId,
      notification_enabled: true,
      platform: 'ios',
      last_active: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get user profile'
    });
  }
});

/**
 * Update user notification preferences
 * PUT /api/user/notification-preferences
 */
router.put('/notification-preferences', async (req, res) => {
  try {
    const { user_id, preferences } = req.body;

    // Validation
    if (!user_id || !preferences) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'user_id and preferences are required'
      });
    }

    // This is a placeholder - implement based on your requirements
    // You might want to save preferences to database
    
    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: preferences
    });

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update notification preferences'
    });
  }
});

module.exports = router;
