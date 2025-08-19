// Monitoring script to track regulation creation
// Run this script to monitor the server logs for regulation creation

const fs = require('fs');
const path = require('path');

console.log('🔍 Regulation Creation Monitor');
console.log('==============================');
console.log('This script will help you monitor when regulations are being created.');
console.log('Watch the server console output for the following log patterns:');
console.log('');
console.log('📋 LOG PATTERNS TO WATCH:');
console.log('1. === REGULATION CREATION LOG ===');
console.log('2. === FRONTEND REGULATION CREATION LOG ===');
console.log('3. === ADD REGULATION MODAL OPENED ===');
console.log('4. === ADD REGULATION BUTTON CLICKED ===');
console.log('');
console.log('📋 DOCUMENT UPLOAD LOGS TO WATCH:');
console.log('1. === DOCUMENT UPLOAD LOG ===');
console.log('2. === API DOCUMENT UPLOAD LOG ===');
console.log('');
console.log('🔍 INSTRUCTIONS:');
console.log('1. Start your server: node server.js');
console.log('2. Open the browser console (F12)');
console.log('3. Upload a document in documents.html');
console.log('4. Check both server console and browser console for logs');
console.log('5. Look for any regulation creation logs that appear after document upload');
console.log('');
console.log('📊 WHAT TO LOOK FOR:');
console.log('- If regulations are created automatically, you\'ll see regulation creation logs');
console.log('- Check the timestamps to see if they match document upload times');
console.log('- Look at the request headers and referer to identify the source');
console.log('- Check the stack traces to see what triggered the regulation creation');
console.log('');
console.log('🚨 TROUBLESHOOTING:');
console.log('If you see regulation creation logs after document upload:');
console.log('1. Check the referer header to see which page triggered it');
console.log('2. Look at the stack trace to see the call chain');
console.log('3. Check if any background processes or timers are running');
console.log('4. Look for any database triggers or stored procedures');
console.log('');
console.log('✅ NEXT STEPS:');
console.log('After identifying the source, we can:');
console.log('1. Remove the automatic regulation creation code');
console.log('2. Add checks to prevent automatic creation');
console.log('3. Modify the document upload process');
console.log('');
console.log('Press Ctrl+C to exit this monitor');
console.log('==============================');

// Keep the script running
process.stdin.resume();

process.on('SIGINT', () => {
  console.log('\n👋 Monitor stopped. Good luck debugging!');
  process.exit(0);
});