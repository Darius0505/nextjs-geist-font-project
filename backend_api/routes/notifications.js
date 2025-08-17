const express = require('express');
const router = express.Router();
const { 
  getNotificationHistory, 
  markNotificationAsRead,
  getUsersForFeedbackNotification,
  getFeedbackDetails
} = require('../services/database-service');
const { 
  sendNotificationToToken, 
  sendNewFeedbackNotification 
} = require('../services/firebase-service');

/**
 * Get notification history for user
 * GET /api/notifications?user_id=xxx&limit=50
 */
router.get('/', async (req, res) => {
  try {
    const { user_id, limit = 50 } = req.query;

    // Validation
    if (!user_id) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'user_id is required'
      });
    }

    const notifications = await getNotificationHistory(user_id, parseInt(limit));

    res.status(200).json({
      success: true,
      data: notifications,
      count: notifications.length
    });

  } catch (error) {
    console.error('Error getting notification history:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get notification history'
    });
  }
});

/**
 * Mark notification as read
 * PUT /api/notifications/:notificationId/read
 */
router.put('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { user_id } = req.body;

    // Validation
    if (!user_id) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'user_id is required'
      });
    }

    await markNotificationAsRead(notificationId, user_id);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to mark notification as read'
    });
  }
});

/**
 * Send test notification
 * POST /api/notifications/test
 */
router.post('/test', async (req, res) => {
  try {
    const { fcm_token, title, body, data = {} } = req.body;

    // Validation
    if (!fcm_token) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'fcm_token is required'
      });
    }

    const notification = {
      title: title || 'Test Notification',
      body: body || 'This is a test notification from your server'
    };

    const result = await sendNotificationToToken(fcm_token, notification, {
      type: 'test',
      ...data
    });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Test notification sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to send notification',
        message: result.error
      });
    }

  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to send test notification'
    });
  }
});

/**
 * Send notification for new customer feedback
 * POST /api/notifications/new-feedback
 * This endpoint will be called by database trigger or external system
 */
router.post('/new-feedback', async (req, res) => {
  try {
    const { feedback_id, customer_name, feedback_content } = req.body;

    // Validation
    if (!feedback_id) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'feedback_id is required'
      });
    }

    // Get feedback details from database
    const feedbackDetails = await getFeedbackDetails(feedback_id);
    if (!feedbackDetails) {
      return res.status(404).json({
        error: 'Feedback not found',
        message: 'The specified feedback does not exist'
      });
    }

    // Get users who should receive this notification
    const userIds = await getUsersForFeedbackNotification(feedback_id);
    
    if (userIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No users to notify for this feedback'
      });
    }

    // Send notifications to all relevant users
    const results = [];
    for (const userId of userIds) {
      try {
        const result = await sendNewFeedbackNotification(userId, {
          id: feedback_id,
          customerName: feedbackDetails.customerName,
          content: feedbackDetails.content,
          createdAt: feedbackDetails.createdAt
        });
        results.push({ userId, result });
      } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error);
        results.push({ userId, result: { success: false, error: error.message } });
      }
    }

    const successCount = results.filter(r => r.result.success).length;
    const failureCount = results.length - successCount;

    res.status(200).json({
      success: true,
      message: 'Feedback notifications processed',
      summary: {
        totalUsers: userIds.length,
        successCount,
        failureCount
      },
      details: results
    });

  } catch (error) {
    console.error('Error processing new feedback notification:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process new feedback notification'
    });
  }
});

/**
 * Send custom notification to specific user
 * POST /api/notifications/send
 */
router.post('/send', async (req, res) => {
  try {
    const { user_id, title, body, data = {} } = req.body;

    // Validation
    if (!user_id || !title || !body) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'user_id, title, and body are required'
      });
    }

    const result = await sendNewFeedbackNotification(user_id, {
      id: data.feedback_id || 'custom',
      customerName: data.customer_name || 'System',
      content: body,
      createdAt: new Date().toISOString()
    });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Notification sent successfully',
        details: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to send notification',
        message: result.error
      });
    }

  } catch (error) {
    console.error('Error sending custom notification:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to send custom notification'
    });
  }
});

/**
 * Get notification statistics
 * GET /api/notifications/stats?user_id=xxx
 */
router.get('/stats', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'user_id is required'
      });
    }

    const notifications = await getNotificationHistory(user_id, 1000);
    
    const stats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.is_read).length,
      read: notifications.filter(n => n.is_read).length,
      thisWeek: notifications.filter(n => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(n.created_at) > weekAgo;
      }).length,
      thisMonth: notifications.filter(n => {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return new Date(n.created_at) > monthAgo;
      }).length
    };

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting notification stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get notification statistics'
    });
  }
});

module.exports = router;
