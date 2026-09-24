const fs = require('fs');
const path = require('path');

const settingsPath = path.resolve(__dirname, '../../frontend/src/pages/Settings.jsx');
const headerPath = path.resolve(__dirname, '../../frontend/src/components/Header.jsx');

const settingsContent = fs.readFileSync(settingsPath, 'utf8');
const headerContent = fs.readFileSync(headerPath, 'utf8');

const tests = [];

function check(title, condition, detail = '') {
  tests.push({ title, passed: !!condition, detail });
  console.log(`[${condition ? 'PASS' : 'FAIL'}] ${title} ${detail ? '(' + detail + ')' : ''}`);
}

console.log('==================================================');
console.log('VERIFYING FRONTEND SETTINGS & PROFILE UI INTEGRITY');
console.log('==================================================');

// 1. Profile load
check('fetchProfile imported and invoked', settingsContent.includes('fetchProfile') && settingsContent.includes('loadUserProfile'));
check('No demo names in initial state', !settingsContent.includes('Maya Chen') && !settingsContent.includes('demo@example.com') && !settingsContent.includes('Demo Company'));

// 2. Field inputs
check('First Name input exists', settingsContent.includes('id="settings-fname"'));
check('Last Name input exists', settingsContent.includes('id="settings-lname"'));
check('Email input exists and is disabled', settingsContent.includes('id="settings-email"') && settingsContent.includes('disabled'));
check('Phone input exists', settingsContent.includes('id="settings-phone"'));
check('Company input exists', settingsContent.includes('id="settings-company"'));
check('Role select exists', settingsContent.includes('id="settings-role"'));
check('Country select exists', settingsContent.includes('id="settings-country"'));
check('Language select exists', settingsContent.includes('id="settings-lang"'));

// 3. Avatar and Initials
check('Dynamic initials fallback rendered', settingsContent.includes('initials') && settingsContent.includes('effectiveAvatarSrc'));
check('Choose photo button triggers file dialog', settingsContent.includes('fileInputRef.current?.click()'));
check('Remove photo button opens confirmation modal', settingsContent.includes('setShowRemovePhotoModal(true)'));
check('Remove photo confirmation modal defined', settingsContent.includes('Remove profile photo?') && settingsContent.includes('handleConfirmRemovePhoto'));

// 4. Save and Synchronization
check('handleSaveProfile calls updateProfile', settingsContent.includes('handleSaveProfile') && settingsContent.includes('updateProfile(cleanData)'));
check('Dispatches churnguard_profile_updated on update', settingsContent.includes("window.dispatchEvent(new Event('churnguard_profile_updated'))"));
check('Header listens to churnguard_profile_updated', headerContent.includes("window.addEventListener('churnguard_profile_updated', handleProfileSync)"));

// 5. Language preference notice
check('Language preference notice indicates translation not ready', settingsContent.includes('Full UI translation is not yet implemented'));

// 6. Security and Password
check('Password tab & criteria verification', settingsContent.includes('passwordCriteria') && settingsContent.includes('requestPasswordOtp'));

console.log('==================================================');
const allPassed = tests.every(t => t.passed);
console.log(`TOTAL: ${tests.filter(t => t.passed).length}/${tests.length} CHECKS PASSED`);
console.log('==================================================');

process.exit(allPassed ? 0 : 1);
