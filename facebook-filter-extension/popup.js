document.addEventListener('DOMContentLoaded', function() {
    const includeBeliefs = document.getElementById('includeBeliefs');
    const excludeBeliefs = document.getElementById('excludeBeliefs');
    const minSentiment = document.getElementById('minSentiment');
    const minimizePosts = document.getElementById('minimizePosts');
    const saveButton = document.getElementById('saveSettings');
    const groqKeyInput = document.createElement('input');
    groqKeyInput.type = 'password';
    groqKeyInput.id = 'groqApiKey';
    groqKeyInput.placeholder = 'Enter your Groq API Key';
    document.querySelector('.section').appendChild(groqKeyInput);

    // Load saved settings
    chrome.storage.sync.get(null, function(data) {
        if (data.includeBeliefs) includeBeliefs.value = data.includeBeliefs;
        if (data.excludeBeliefs) excludeBeliefs.value = data.excludeBeliefs;
        if (data.minSentiment) minSentiment.value = data.minSentiment;
        if (data.minimizePosts !== undefined) minimizePosts.checked = data.minimizePosts;
        if (data.groqApiKey) groqKeyInput.value = data.groqApiKey;
    });

    // Save settings
    saveButton.addEventListener('click', function() {
        const settings = {
            includeBeliefs: includeBeliefs.value,
            excludeBeliefs: excludeBeliefs.value,
            minSentiment: parseInt(minSentiment.value),
            minimizePosts: minimizePosts.checked,
            groqApiKey: groqKeyInput.value
        };

        chrome.storage.sync.set(settings, function() {
            // Show save confirmation
            const status = document.createElement('div');
            status.textContent = 'Settings saved!';
            status.style.color = 'green';
            status.style.marginTop = '10px';
            saveButton.parentNode.appendChild(status);
            setTimeout(() => status.remove(), 2000);

            // Notify content script of settings change
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                const currentTab = tabs[0];
                if (currentTab && currentTab.url && currentTab.url.includes('facebook.com')) {
                    chrome.tabs.sendMessage(currentTab.id, {
                        type: 'settingsUpdated',
                        settings: settings
                    }).catch(error => {
                        console.log('Could not send message to content script, page may need refresh');
                    });
                }
            });
        });
    });
});
