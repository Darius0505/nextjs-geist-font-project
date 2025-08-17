const sql = require('mssql');

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true, // Use encryption
    trustServerCertificate: true // For development only
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise = null;

/**
 * Get database connection pool
 */
async function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig).connect();
  }
  return poolPromise;
}

/**
 * Save or update FCM token for user
 * @param {string} userId - User ID
 * @param {string} fcmToken - FCM token
 * @param {string} platform - Platform (ios/android)
 */
async function saveUserToken(userId, fcmToken, platform = 'ios') {
  try {
    const pool = await getPool();
    const request = pool.request();

    // Check if token already exists
    const existingToken = await request
      .input('userId', sql.NVarChar, userId)
      .input('fcmToken', sql.NVarChar, fcmToken)
      .query(`
        SELECT id FROM user_tokens 
        WHERE user_id = @userId AND fcm_token = @fcmToken
      `);

    if (existingToken.recordset.length > 0) {
      // Update existing token
      await request
        .input('platform', sql.NVarChar, platform)
        .query(`
          UPDATE user_tokens 
          SET platform = @platform, updated_at = GETDATE()
          WHERE user_id = @userId AND fcm_token = @fcmToken
        `);
      console.log(`✅ Updated existing FCM token for user: ${userId}`);
    } else {
      // Insert new token
      await request
        .input('platform', sql.NVarChar, platform)
        .query(`
          INSERT INTO user_tokens (user_id, fcm_token, platform, created_at, updated_at)
          VALUES (@userId, @fcmToken, @platform, GETDATE(), GETDATE())
        `);
      console.log(`✅ Saved new FCM token for user: ${userId}`);
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error saving user token:', error);
    throw error;
  }
}

/**
 * Get all FCM tokens for a user
 * @param {string} userId - User ID
 */
async function getUserTokens(userId) {
  try {
    const pool = await getPool();
    const request = pool.request();

    const result = await request
      .input('userId', sql.NVarChar, userId)
      .query(`
        SELECT fcm_token 
        FROM user_tokens 
        WHERE user_id = @userId 
        AND created_at > DATEADD(day, -30, GETDATE())
        ORDER BY updated_at DESC
      `);

    return result.recordset.map(row => row.fcm_token);
  } catch (error) {
    console.error('❌ Error getting user tokens:', error);
    throw error;
  }
}

/**
 * Remove FCM token
 * @param {string} userId - User ID
 * @param {string} fcmToken - FCM token to remove
 */
async function removeUserToken(userId, fcmToken) {
  try {
    const pool = await getPool();
    const request = pool.request();

    await request
      .input('userId', sql.NVarChar, userId)
      .input('fcmToken', sql.NVarChar, fcmToken)
      .query(`
        DELETE FROM user_tokens 
        WHERE user_id = @userId AND fcm_token = @fcmToken
      `);

    console.log(`✅ Removed FCM token for user: ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error removing user token:', error);
    throw error;
  }
}

/**
 * Save notification history
 * @param {string} userId - User ID
 * @param {object} notification - Notification data
 * @param {object} data - Additional data
 */
async function saveNotificationHistory(userId, notification, data = {}) {
  try {
    const pool = await getPool();
    const request = pool.request();

    await request
      .input('userId', sql.NVarChar, userId)
      .input('title', sql.NVarChar, notification.title)
      .input('body', sql.NVarChar, notification.body)
      .input('data', sql.NVarChar, JSON.stringify(data))
      .input('feedbackId', sql.NVarChar, data.feedback_id || null)
      .query(`
        INSERT INTO notification_history 
        (user_id, title, body, data, feedback_id, created_at, is_read)
        VALUES (@userId, @title, @body, @data, @feedbackId, GETDATE(), 0)
      `);

    console.log(`✅ Saved notification history for user: ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error saving notification history:', error);
    throw error;
  }
}

/**
 * Get notification history for user
 * @param {string} userId - User ID
 * @param {number} limit - Number of notifications to retrieve
 */
async function getNotificationHistory(userId, limit = 50) {
  try {
    const pool = await getPool();
    const request = pool.request();

    const result = await request
      .input('userId', sql.NVarChar, userId)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          id, title, body, data, feedback_id, created_at, is_read
        FROM notification_history 
        WHERE user_id = @userId 
        ORDER BY created_at DESC
      `);

    return result.recordset.map(row => ({
      id: row.id,
      title: row.title,
      body: row.body,
      data: row.data ? JSON.parse(row.data) : {},
      feedback_id: row.feedback_id,
      created_at: row.created_at,
      is_read: row.is_read
    }));
  } catch (error) {
    console.error('❌ Error getting notification history:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security)
 */
async function markNotificationAsRead(notificationId, userId) {
  try {
    const pool = await getPool();
    const request = pool.request();

    await request
      .input('notificationId', sql.Int, notificationId)
      .input('userId', sql.NVarChar, userId)
      .query(`
        UPDATE notification_history 
        SET is_read = 1, read_at = GETDATE()
        WHERE id = @notificationId AND user_id = @userId
      `);

    console.log(`✅ Marked notification as read: ${notificationId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Get users who should receive notifications for new feedback
 * @param {string} feedbackId - Feedback ID
 */
async function getUsersForFeedbackNotification(feedbackId) {
  try {
    const pool = await getPool();
    const request = pool.request();

    // This query should be customized based on your business logic
    // For example, notify admins, or users responsible for specific customers
    const result = await request
      .input('feedbackId', sql.NVarChar, feedbackId)
      .query(`
        SELECT DISTINCT cf.assigned_user_id as user_id
        FROM customerfeedback cf
        WHERE cf.id = @feedbackId
        AND cf.assigned_user_id IS NOT NULL
        
        UNION
        
        SELECT 'admin' as user_id  -- Notify all admins
        -- Add more business logic here as needed
      `);

    return result.recordset.map(row => row.user_id);
  } catch (error) {
    console.error('❌ Error getting users for feedback notification:', error);
    throw error;
  }
}

/**
 * Get feedback details
 * @param {string} feedbackId - Feedback ID
 */
async function getFeedbackDetails(feedbackId) {
  try {
    const pool = await getPool();
    const request = pool.request();

    const result = await request
      .input('feedbackId', sql.NVarChar, feedbackId)
      .query(`
        SELECT 
          id,
          customer_name,
          feedback_content,
          created_at,
          assigned_user_id
        FROM customerfeedback 
        WHERE id = @feedbackId
      `);

    if (result.recordset.length > 0) {
      const feedback = result.recordset[0];
      return {
        id: feedback.id,
        customerName: feedback.customer_name,
        content: feedback.feedback_content,
        createdAt: feedback.created_at,
        assignedUserId: feedback.assigned_user_id
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting feedback details:', error);
    throw error;
  }
}

/**
 * Clean up old tokens (older than 30 days)
 */
async function cleanupOldTokens() {
  try {
    const pool = await getPool();
    const request = pool.request();

    const result = await request.query(`
      DELETE FROM user_tokens 
      WHERE created_at < DATEADD(day, -30, GETDATE())
    `);

    console.log(`✅ Cleaned up ${result.rowsAffected[0]} old tokens`);
    return { success: true, deletedCount: result.rowsAffected[0] };
  } catch (error) {
    console.error('❌ Error cleaning up old tokens:', error);
    throw error;
  }
}

module.exports = {
  getPool,
  saveUserToken,
  getUserTokens,
  removeUserToken,
  saveNotificationHistory,
  getNotificationHistory,
  markNotificationAsRead,
  getUsersForFeedbackNotification,
  getFeedbackDetails,
  cleanupOldTokens
};
