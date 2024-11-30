// Default settings
const DEFAULT_SETTINGS = {
    includeBeliefs: 'Iskon,Hindu,Islam',
    excludeBeliefs: '',
    minSentiment: 5,
    minimizePosts: true,
    groqApiKey: ''
};

// Handle installation and update
chrome.runtime.onInstalled.addListener(() => {
    // Load existing settings and merge with defaults
    chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS), function(existingSettings) {
        const finalSettings = { ...DEFAULT_SETTINGS, ...existingSettings };
        chrome.storage.sync.set(finalSettings, () => {
            console.log('Settings initialized:', finalSettings);
        });
    });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getSettings') {
        chrome.storage.sync.get(null, function(settings) {
            sendResponse({ settings: settings });
        });
        return true; // Will respond asynchronously
    }
});
