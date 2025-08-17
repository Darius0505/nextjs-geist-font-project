-- Script tạo các bảng cần thiết cho hệ thống push notification
-- Chạy script này trên MS SQL Server

-- 1. Bảng lưu FCM tokens của users
CREATE TABLE user_tokens (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(50) NOT NULL,
    fcm_token NVARCHAR(500) NOT NULL,
    platform NVARCHAR(20) NOT NULL DEFAULT 'ios',
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME NOT NULL DEFAULT GETDATE(),
    
    -- Indexes
    INDEX IX_user_tokens_user_id (user_id),
    INDEX IX_user_tokens_created_at (created_at),
    
    -- Constraints
    CONSTRAINT CK_user_tokens_platform CHECK (platform IN ('ios', 'android'))
);

-- 2. Bảng lưu lịch sử notifications
CREATE TABLE notification_history (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(50) NOT NULL,
    title NVARCHAR(255) NOT NULL,
    body NVARCHAR(1000) NOT NULL,
    data NVARCHAR(MAX), -- JSON data
    feedback_id NVARCHAR(50), -- Reference to feedback
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    is_read BIT NOT NULL DEFAULT 0,
    read_at DATETIME NULL,
    
    -- Indexes
    INDEX IX_notification_history_user_id (user_id),
    INDEX IX_notification_history_created_at (created_at),
    INDEX IX_notification_history_feedback_id (feedback_id),
    INDEX IX_notification_history_is_read (is_read)
);

-- 3. Cập nhật bảng customerfeedback (nếu chưa có các cột cần thiết)
-- Kiểm tra và thêm cột assigned_user_id nếu chưa có
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('customerfeedback') AND name = 'assigned_user_id')
BEGIN
    ALTER TABLE customerfeedback ADD assigned_user_id NVARCHAR(50) NULL;
END

-- Kiểm tra và thêm cột customer_name nếu chưa có
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('customerfeedback') AND name = 'customer_name')
BEGIN
    ALTER TABLE customerfeedback ADD customer_name NVARCHAR(255) NULL;
END

-- Kiểm tra và thêm cột created_at nếu chưa có
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('customerfeedback') AND name = 'created_at')
BEGIN
    ALTER TABLE customerfeedback ADD created_at DATETIME NOT NULL DEFAULT GETDATE();
END

-- 4. Stored Procedure để gửi notification khi có feedback mới
CREATE OR ALTER PROCEDURE sp_send_notification_new_feedback
    @feedback_id NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @customer_name NVARCHAR(255);
    DECLARE @feedback_content NVARCHAR(MAX);
    DECLARE @assigned_user_id NVARCHAR(50);
    
    -- Lấy thông tin feedback
    SELECT 
        @customer_name = customer_name,
        @feedback_content = feedback_content,
        @assigned_user_id = assigned_user_id
    FROM customerfeedback 
    WHERE id = @feedback_id;
    
    -- Gọi API để gửi notification (sử dụng HTTP request)
    -- Bạn có thể sử dụng sp_OACreate và sp_OAMethod để gọi HTTP API
    -- Hoặc sử dụng SQL Server Integration Services (SSIS)
    -- Hoặc tạo một job để gọi API endpoint
    
    -- Ví dụ: Log thông tin để debug
    PRINT 'New feedback notification should be sent for feedback_id: ' + @feedback_id;
    PRINT 'Customer: ' + ISNULL(@customer_name, 'Unknown');
    PRINT 'Assigned to: ' + ISNULL(@assigned_user_id, 'Unassigned');
    
    -- Trong thực tế, bạn sẽ cần gọi API endpoint:
    -- POST http://your-api-server/api/notifications/new-feedback
    -- Body: {"feedback_id": "@feedback_id", "customer_name": "@customer_name"}
END;

-- 5. Trigger để tự động gửi notification khi có feedback mới
CREATE OR ALTER TRIGGER tr_customerfeedback_insert
ON customerfeedback
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @feedback_id NVARCHAR(50);
    
    -- Lấy ID của feedback vừa được insert
    SELECT @feedback_id = id FROM inserted;
    
    -- Gọi stored procedure để xử lý notification
    EXEC sp_send_notification_new_feedback @feedback_id;
END;

-- 6. Stored Procedure để cleanup old tokens
CREATE OR ALTER PROCEDURE sp_cleanup_old_tokens
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @deleted_count INT;
    
    -- Xóa tokens cũ hơn 30 ngày
    DELETE FROM user_tokens 
    WHERE created_at < DATEADD(day, -30, GETDATE());
    
    SET @deleted_count = @@ROWCOUNT;
    
    PRINT 'Cleaned up ' + CAST(@deleted_count AS NVARCHAR(10)) + ' old tokens';
    
    -- Xóa notification history cũ hơn 90 ngày
    DELETE FROM notification_history 
    WHERE created_at < DATEADD(day, -90, GETDATE());
    
    SET @deleted_count = @@ROWCOUNT;
    
    PRINT 'Cleaned up ' + CAST(@deleted_count AS NVARCHAR(10)) + ' old notifications';
END;

-- 7. Tạo job để cleanup định kỳ (chạy hàng tuần)
-- Bạn có thể tạo SQL Server Agent Job để chạy sp_cleanup_old_tokens

-- 8. Sample data để test (optional)
/*
-- Insert sample user tokens
INSERT INTO user_tokens (user_id, fcm_token, platform) VALUES
('user1', 'sample_fcm_token_1', 'ios'),
('user2', 'sample_fcm_token_2', 'ios'),
('admin', 'sample_fcm_token_admin', 'ios');

-- Insert sample feedback
INSERT INTO customerfeedback (id, customer_name, feedback_content, assigned_user_id) VALUES
('FB001', 'Nguyen Van A', 'Sản phẩm rất tốt, tôi rất hài lòng', 'user1'),
('FB002', 'Tran Thi B', 'Dịch vụ cần cải thiện', 'user2');
*/

PRINT 'Database setup completed successfully!';
PRINT 'Tables created: user_tokens, notification_history';
PRINT 'Stored procedures created: sp_send_notification_new_feedback, sp_cleanup_old_tokens';
PRINT 'Trigger created: tr_customerfeedback_insert';
