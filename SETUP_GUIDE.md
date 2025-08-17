# Hướng dẫn triển khai Push Notification cho Flutter App (iOS)

## Tổng quan
Hướng dẫn này sẽ giúp bạn triển khai hệ thống push notification cho ứng dụng Flutter trên iOS khi có ý kiến khách hàng mới trong MS SQL Server.

## Yêu cầu hệ thống
- Flutter SDK 3.0+
- Xcode 14+
- iOS 12+
- Node.js 16+
- MS SQL Server
- Tài khoản Firebase
- Apple Developer Account

## Bước 1: Cấu hình Firebase

### 1.1 Tạo project Firebase
1. Truy cập [Firebase Console](https://console.firebase.google.com)
2. Tạo project mới hoặc chọn project hiện tại
3. Thêm iOS app với Bundle ID trùng với Flutter app

### 1.2 Tải GoogleService-Info.plist
1. Trong Firebase Console, vào Project Settings
2. Chọn iOS app vừa tạo
3. Tải file `GoogleService-Info.plist`
4. Thêm file này vào `ios/Runner/` trong Xcode

### 1.3 Cấu hình APNs
1. Trong Firebase Console, vào Project Settings > Cloud Messaging
2. Upload APNs Authentication Key (.p8 file) từ Apple Developer Account
3. Hoặc upload APNs Certificate (.p12 file)

### 1.4 Tạo Service Account Key
1. Vào Project Settings > Service accounts
2. Generate new private key
3. Lưu file JSON vào `backend_api/config/firebase-service-account.json`

## Bước 2: Cấu hình Flutter Project

### 2.1 Cập nhật pubspec.yaml
```yaml
dependencies:
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.10
  flutter_local_notifications: ^16.3.2
  http: ^1.1.0
```

### 2.2 Copy Flutter files
Copy các file từ thư mục `flutter_files/` vào project Flutter:
- `lib/services/notification_service.dart`
- `lib/screens/home_screen.dart`
- `lib/screens/notification_screen.dart`
- Cập nhật `lib/main.dart`

### 2.3 Cấu hình iOS trong Xcode
1. Mở `ios/Runner.xcworkspace`
2. Thêm `GoogleService-Info.plist` vào Runner target
3. Trong Signing & Capabilities, thêm:
   - Push Notifications
   - Background Modes (Remote notifications)
4. Cập nhật `Info.plist` theo file mẫu

## Bước 3: Cấu hình Database

### 3.1 Chạy SQL Scripts
```sql
-- Chạy file database_scripts/create_tables.sql
-- Tạo các bảng: user_tokens, notification_history
-- Tạo trigger và stored procedures
```

### 3.2 Cập nhật bảng customerfeedback
Đảm bảo bảng có các cột:
- `id` (Primary Key)
- `customer_name`
- `feedback_content`
- `assigned_user_id`
- `created_at`

## Bước 4: Cấu hình Backend API

### 4.1 Cài đặt dependencies
```bash
cd backend_api
npm install
```

### 4.2 Cấu hình environment
```bash
cp .env.example .env
# Cập nhật các thông tin trong .env file
```

### 4.3 Cấu hình .env file
```env
PORT=3000
DB_SERVER=your-sql-server
DB_NAME=your-database
DB_USER=your-username
DB_PASSWORD=your-password
FIREBASE_PROJECT_ID=your-firebase-project-id
```

### 4.4 Khởi chạy server
```bash
npm run dev
```

## Bước 5: Testing

### 5.1 Test Flutter App
1. Chạy app trên iOS device thật (không hoạt động trên simulator)
2. Kiểm tra FCM token được tạo
3. Verify token được gửi lên server

### 5.2 Test API endpoints
```bash
# Test health check
curl http://localhost:3000/health

# Test save FCM token
curl -X POST http://localhost:3000/api/user/fcm-token \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "fcm_token": "your_fcm_token",
    "platform": "ios"
  }'

# Test notification
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{
    "fcm_token": "your_fcm_token",
    "title": "Test Notification",
    "body": "This is a test message"
  }'
```

### 5.3 Test Database Trigger
```sql
-- Insert test feedback để trigger notification
INSERT INTO customerfeedback (id, customer_name, feedback_content, assigned_user_id)
VALUES ('TEST001', 'Test Customer', 'Test feedback content', 'test_user');
```

## Bước 6: Production Deployment

### 6.1 Cấu hình Production
1. Cập nhật Firebase project cho production
2. Sử dụng production APNs certificates
3. Cấu hình production database connection
4. Set NODE_ENV=production

### 6.2 Security Checklist
- [ ] Sử dụng HTTPS cho API endpoints
- [ ] Implement authentication/authorization
- [ ] Validate input data
- [ ] Rate limiting đã được cấu hình
- [ ] Database connection sử dụng SSL
- [ ] Firebase service account key được bảo mật

## Troubleshooting

### Lỗi thường gặp

#### 1. FCM Token không được tạo
- Kiểm tra GoogleService-Info.plist đã được thêm đúng
- Verify Push Notifications capability đã được enable
- Chạy trên device thật, không phải simulator

#### 2. Notification không nhận được
- Kiểm tra APNs certificate/key trong Firebase
- Verify FCM token còn valid
- Check app có đang chạy background không

#### 3. Database connection failed
- Kiểm tra connection string
- Verify firewall settings
- Check SQL Server authentication mode

#### 4. API errors
- Check server logs
- Verify Firebase service account permissions
- Test API endpoints với Postman

### Debug Commands
```bash
# Check Flutter logs
flutter logs

# Check API server logs
npm run dev

# Test database connection
sqlcmd -S server -d database -U username -P password
```

## Monitoring và Maintenance

### 1. Cleanup định kỳ
```sql
-- Chạy hàng tuần để cleanup old tokens
EXEC sp_cleanup_old_tokens;
```

### 2. Monitor API performance
- Sử dụng logging middleware
- Monitor Firebase quota usage
- Check database performance

### 3. Update dependencies
```bash
# Flutter
flutter pub upgrade

# Node.js
npm update
```

## Liên hệ hỗ trợ
Nếu gặp vấn đề trong quá trình triển khai, vui lòng kiểm tra:
1. Logs của Flutter app
2. Logs của API server  
3. Firebase Console logs
4. SQL Server logs

## Tài liệu tham khảo
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Flutter Firebase Messaging](https://firebase.flutter.dev/docs/messaging/overview)
- [Apple Push Notifications](https://developer.apple.com/documentation/usernotifications)
