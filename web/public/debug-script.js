// Simple script to check the actual runtime state
// This will be injected into the running app to check what's happening

console.log('🔍 === AVATAR DEBUG INVESTIGATION ===');

// Check localStorage state
console.log('📋 LocalStorage State:');
console.log('isAuthenticated:', localStorage.getItem('isAuthenticated'));
console.log('user:', localStorage.getItem('user'));
console.log('access_token:', localStorage.getItem('access_token')?.substring(0, 50) + '...');
console.log('dev_config:', localStorage.getItem('dev_config'));

// Check development config
try {
    const devConfig = localStorage.getItem('dev_config');
    if (devConfig) {
        const parsed = JSON.parse(devConfig);
        console.log('🔧 Development Config:', parsed);
    }
} catch (e) {
    console.error('Error parsing dev config:', e);
}

// Check user data
try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        console.log('👤 User Data:', user);
        console.log('Avatar URL:', user.avatar);

        // Test the avatar URL
        if (user.avatar) {
            const img = new Image();
            img.onload = () => console.log('✅ Avatar URL loads successfully');
            img.onerror = () => console.log('❌ Avatar URL failed to load');
            img.src = user.avatar;
        }
    }
} catch (e) {
    console.error('Error parsing user data:', e);
}

// Check if the React app is even loaded
if (window.React) {
    console.log('✅ React is loaded');
} else {
    console.log('❌ React is not loaded');
}

// Check if we can find the header component
setTimeout(() => {
    const header = document.querySelector('header');
    if (header) {
        console.log('✅ Header component found');

        // Look for avatar images
        const avatarImages = document.querySelectorAll('img[alt*="avatar"], img[alt*="Avatar"], img[alt*="User"]');
        console.log('🖼️ Avatar images found:', avatarImages.length);

        avatarImages.forEach((img, index) => {
            console.log(`Avatar ${index + 1}:`, {
                src: img.src,
                alt: img.alt,
                style: window.getComputedStyle(img),
                visible: img.offsetWidth > 0 && img.offsetHeight > 0
            });
        });

        // Look for avatar fallbacks
        const fallbacks = document.querySelectorAll('div[class*="avatar"], div[class*="Avatar"]');
        console.log('🔲 Avatar fallbacks found:', fallbacks.length);

        fallbacks.forEach((div, index) => {
            console.log(`Fallback ${index + 1}:`, {
                textContent: div.textContent,
                className: div.className,
                style: window.getComputedStyle(div)
            });
        });

    } else {
        console.log('❌ Header component not found');
    }
}, 3000);

console.log('🔍 === END AVATAR DEBUG INVESTIGATION ===');