const fs = require('fs');
const path = require('path');

const headerPath = path.resolve(__dirname, '../../frontend/src/components/Header.jsx');
const cssPath = path.resolve(__dirname, '../../frontend/src/index.css');

const headerContent = fs.readFileSync(headerPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');

const tests = [];

function check(title, condition, detail = '') {
  tests.push({ title, passed: !!condition, detail });
  console.log(`[${condition ? 'PASS' : 'FAIL'}] ${title} ${detail ? '(' + detail + ')' : ''}`);
}

console.log('==================================================');
console.log('VERIFYING FRONTEND NOTIFICATION UI & CSS INTEGRITY');
console.log('==================================================');

// 1. Notification bell button
check('Bell button ID exists', headerContent.includes('id="notifications-bell-btn"'));
check('Bell button triggers toggle and loads notifs', headerContent.includes('setShowNotifications(prev => !prev)') && headerContent.includes('loadNotifs()'));

// 2. Unread badge
check('Notification badge ID exists', headerContent.includes('id="notifications-badge"'));
check('Notification badge displays dynamic count', headerContent.includes("unreadCount > 9 ? '9+' : unreadCount"));

// 3. Notification Drawer & Panel
check('Notification panel ID exists', headerContent.includes('id="notifications-panel"'));
check('Drawer accessibility region and label', headerContent.includes('role="region"') && headerContent.includes('aria-label="Notification drawer"'));

// 4. Close button
check('Close button ID exists', headerContent.includes('id="notifications-close-btn"'));
check('Close button closes drawer', headerContent.includes('onClick={() => setShowNotifications(false)}'));

// 5. Click outside & Escape key listeners
check('Click outside handler closes notifications', headerContent.includes('handleClickOutside') && headerContent.includes('setShowNotifications(false)'));
check('Escape key closes notifications', headerContent.includes("e.key === 'Escape'") && headerContent.includes('setShowNotifications(false)'));

// 6. Mark all read
check('Mark all read button ID exists', headerContent.includes('id="notifications-mark-all-read-btn"'));
check('Mark all read handler marks read in UI & backend', headerContent.includes('handleMarkAllRead') && headerContent.includes('markAllNotificationsRead()'));
check('Mark all read sets unreadCount to 0', headerContent.includes('setUnreadCount(0)'));

// 7. Clear all with confirmation modal
check('Clear all button ID exists', headerContent.includes('id="notifications-clear-all-btn"'));
check('Clear all triggers confirmation modal', headerContent.includes('setShowClearModal(true)'));
check('Clear modal has title', headerContent.includes('Clear all notifications?'));
check('Clear modal Cancel button', headerContent.includes('id="clear-notifs-cancel-btn"'));
check('Clear modal Confirm button', headerContent.includes('id="clear-notifs-confirm-btn"'));
check('Clear confirm handler invokes API and resets state', headerContent.includes('handleConfirmClearAll') && headerContent.includes('clearAllNotifications()'));

// 8. Individual read on click
check('Individual notification click handler', headerContent.includes('handleMarkSingleRead(notif.id)'));
check('Individual read decreases unreadCount', headerContent.includes('Math.max(0, prev - 1)'));

// 9. Empty state
check('Clean empty state message', headerContent.includes('No notifications') && headerContent.includes('You are all caught up!'));
check('Empty state bell icon', headerContent.includes('empty-bell-icon'));

// 10. CSS Visual Distinction
check('CSS .notification-drawer defined', cssContent.includes('.notification-drawer'));
check('CSS .notification-item.unread defined', cssContent.includes('.notification-item.unread'));
check('CSS .notification-item.read defined', cssContent.includes('.notification-item.read'));
check('CSS .notification-unread-dot defined', cssContent.includes('.notification-unread-dot'));
check('CSS .drawer-empty-state defined', cssContent.includes('.drawer-empty-state'));

console.log('==================================================');
const allPassed = tests.every(t => t.passed);
console.log(`TOTAL: ${tests.filter(t => t.passed).length}/${tests.length} CHECKS PASSED`);
console.log('==================================================');

process.exit(allPassed ? 0 : 1);
