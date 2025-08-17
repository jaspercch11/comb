// Test script for the notification system
// Run this in the browser console to test notifications

async function testNotificationSystem() {
  console.log('🧪 Testing notification system...');
  
  try {
    // Test 1: Create a notification
    console.log('📝 Creating test notification...');
    const notificationData = {
      title: 'Test Notification',
      message: 'This is a test notification to verify the system is working.',
      type: 'info',
      dept: 'Human Resources',
      sender_dept: 'Compliance & Risk Management',
      sender_user: 'Test User',
      priority: 'normal',
      action_required: false
    };
    
    const createResponse = await fetch('http://localhost:3000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notificationData)
    });
    
    if (createResponse.ok) {
      const result = await createResponse.json();
      console.log('✅ Notification created successfully:', result);
    } else {
      throw new Error('Failed to create notification');
    }
    
    // Test 2: Get notifications count
    console.log('🔢 Getting notifications count...');
    const countResponse = await fetch('http://localhost:3000/api/notifications/count');
    if (countResponse.ok) {
      const countData = await countResponse.json();
      console.log('✅ Unread notifications count:', countData.count);
    }
    
    // Test 3: Get all notifications
    console.log('📋 Getting all notifications...');
    const getResponse = await fetch('http://localhost:3000/api/notifications');
    if (getResponse.ok) {
      const notifications = await getResponse.json();
      console.log('✅ Total notifications:', notifications.length);
      console.log('📊 Notifications:', notifications);
    }
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Function to create multiple test notifications
async function createMultipleTestNotifications() {
  const departments = [
    'Human Resources',
    'Project Management',
    'Sales & CRM',
    'Manufacturing & Production Mgmt.',
    'Inventory & Warehouse Mgmt.',
    'Procurement',
    'Finance and Accounting',
    'B.I. and Analytics'
  ];
  
  const notificationTypes = [
    { type: 'audit', title: 'Audit Reminder', message: 'Quarterly audit is due next week.' },
    { type: 'incident', title: 'Incident Report', message: 'New incident has been reported in your department.' },
    { type: 'document', title: 'Document Review', message: 'Policy document requires your review and approval.' },
    { type: 'risk', title: 'Risk Assessment', message: 'Risk assessment update is required.' }
  ];
  
  console.log('🚀 Creating multiple test notifications...');
  
  for (let i = 0; i < departments.length; i++) {
    const dept = departments[i];
    const notifType = notificationTypes[i % notificationTypes.length];
    
    try {
      const notificationData = {
        title: `${notifType.title} - ${dept}`,
        message: `${notifType.message} Please take necessary action.`,
        type: notifType.type,
        dept: dept,
        sender_dept: 'Compliance & Risk Management',
        sender_user: 'System',
        priority: i < 3 ? 'high' : 'normal',
        action_required: i < 4
      };
      
      const response = await fetch('http://localhost:3000/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationData)
      });
      
      if (response.ok) {
        console.log(`✅ Created notification for ${dept}`);
      } else {
        console.log(`❌ Failed to create notification for ${dept}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error creating notification for ${dept}:`, error);
    }
  }
  
  console.log('🎯 Multiple notifications creation completed!');
}

// Function to clear all test notifications
async function clearTestNotifications() {
  console.log('🧹 Clearing test notifications...');
  
  try {
    // Get all notifications
    const response = await fetch('http://localhost:3000/api/notifications');
    if (response.ok) {
      const notifications = await response.json();
      
      // Find test notifications (those with "Test" in title or "System" as sender)
      const testNotifications = notifications.filter(n => 
        !n.isSystem && (
          n.title.includes('Test') || 
          n.sender_user === 'System' ||
          n.sender_user === 'Test User'
        )
      );
      
      console.log(`Found ${testNotifications.length} test notifications to clear`);
      
      // Note: You would need to implement a DELETE endpoint to actually remove them
      // For now, we'll just mark them as read
      for (const notif of testNotifications) {
        if (!notif.is_read) {
          const notifId = notif.id.replace('notif-', '');
          await fetch(`http://localhost:3000/api/notifications/${notifId}/read`, {
            method: 'PUT'
          });
        }
      }
      
      console.log('✅ Test notifications marked as read');
    }
  } catch (error) {
    console.error('❌ Error clearing test notifications:', error);
  }
}

// Export functions for use in console
window.testNotificationSystem = testNotificationSystem;
window.createMultipleTestNotifications = createMultipleTestNotifications;
window.clearTestNotifications = clearTestNotifications;

console.log('🧪 Notification test functions loaded!');
console.log('Available functions:');
console.log('- testNotificationSystem() - Run basic tests');
console.log('- createMultipleTestNotifications() - Create test data');
console.log('- clearTestNotifications() - Clear test data');