# Notification System Implementation

## Overview
This notification system allows users to send notifications to other departments from the audit.html page. When viewing recent activity, users can click on an activity item and use the "Notify Department" button to send a notification to the relevant department.

## Features

### 🎯 Core Functionality
- **Send Notifications**: Click on any recent activity and use "Notify Department" button
- **Department Targeting**: Notifications are sent to specific departments
- **Real-time Updates**: Notification count updates every 30 seconds
- **Visual Indicators**: Unread notifications show with blue left border and badge count
- **Click to Mark Read**: Click on unread notifications to mark them as read

### 🔔 Notification Types
- **System Notifications**: Automatically generated from incidents, audits, documents, and risks
- **Custom Notifications**: Manually created notifications sent between departments
- **Priority Levels**: low, normal, high, urgent
- **Action Required**: Mark notifications that require user action

### 📊 Database Schema
The system creates a `notifications` table with the following structure:
```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  dept TEXT,
  sender_dept TEXT,
  sender_user TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  action_required BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  metadata JSONB
);
```

## API Endpoints

### GET `/api/notifications`
- Returns all notifications (system + custom)
- Includes read/unread status and department information
- Sorted by creation date (newest first)

### POST `/api/notifications`
- Creates a new notification
- Required fields: `title`, `message`
- Optional fields: `type`, `dept`, `sender_dept`, `sender_user`, `priority`, `action_required`, `action_url`, `metadata`

### PUT `/api/notifications/:id/read`
- Marks a notification as read
- Updates `is_read` and `read_at` fields

### GET `/api/notifications/count`
- Returns count of unread notifications
- Used for badge display on bell icon

## How to Use

### 1. Send a Notification
1. Go to `audit.html`
2. Click on any item in the "Recent Activity" section
3. Click the "Notify Department" button
4. The notification will be sent to the department associated with that activity

### 2. View Notifications
1. Click the bell icon (🔔) in the header
2. View all notifications (system and custom)
3. Click on unread custom notifications to mark them as read

### 3. Test the System
The system includes test functions that can be run in the browser console:

```javascript
// Basic functionality test
testNotificationSystem()

// Create multiple test notifications
createMultipleTestNotifications()

// Clear test notifications
clearTestNotifications()
```

## File Structure

```
├── server.js                    # Backend server with notification endpoints
├── notifications.js             # Frontend notification handling
├── AUDIT.JS                     # Audit page logic with notification integration
├── audit.html                   # Audit page with notification button
├── css/audit.css               # Styles including notification badge
├── test-notifications.js        # Test functions for the notification system
└── NOTIFICATION_SYSTEM_README.md # This documentation
```

## Implementation Details

### Frontend Integration
- **Activity Modal**: Enhanced with notification functionality
- **Button States**: Shows sending progress and success/failure feedback
- **Visual Feedback**: Button changes color and text based on status

### Backend Features
- **Database Integration**: PostgreSQL with proper schema
- **Activity Logging**: All notifications are logged to activities table
- **Error Handling**: Comprehensive error handling and user feedback
- **Data Validation**: Required field validation and type checking

### Security Considerations
- **Input Validation**: All user inputs are validated
- **SQL Injection Protection**: Uses parameterized queries
- **Error Logging**: Errors are logged but not exposed to users

## Testing

### Manual Testing
1. Start the server: `node server.js`
2. Open `audit.html` in your browser
3. Click on recent activity items
4. Use the "Notify Department" button
5. Check the bell icon for notification count
6. View notifications by clicking the bell

### Automated Testing
Use the test functions in the browser console:
```javascript
// Run all tests
testNotificationSystem()

// Create test data
createMultipleTestNotifications()

// Verify notification count updates
// Check bell icon badge
```

## Troubleshooting

### Common Issues

1. **Notifications not appearing**
   - Check browser console for errors
   - Verify server is running on port 3000
   - Check database connection

2. **Button not working**
   - Ensure JavaScript is enabled
   - Check for console errors
   - Verify the activity has a department

3. **Database errors**
   - Check PostgreSQL connection
   - Verify notifications table exists
   - Check server logs

### Debug Mode
Enable debug logging by checking the browser console and server logs for detailed error information.

## Future Enhancements

### Planned Features
- **Email Notifications**: Send notifications via email
- **Push Notifications**: Browser push notifications
- **Notification Templates**: Predefined notification formats
- **Department Management**: Add/remove departments dynamically
- **Notification History**: Search and filter notifications
- **Bulk Operations**: Mark multiple notifications as read

### Integration Possibilities
- **Slack Integration**: Send notifications to Slack channels
- **Microsoft Teams**: Teams webhook integration
- **SMS Notifications**: Text message notifications
- **Mobile App**: Native mobile notification app

## Support

For issues or questions about the notification system:
1. Check the browser console for JavaScript errors
2. Review server logs for backend errors
3. Verify database connectivity
4. Test with the provided test functions

## License

This notification system is part of the ComplyTeam Dashboard project.