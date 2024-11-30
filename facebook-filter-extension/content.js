// Configuration for Groq API
const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// Global settings object
let settings = {};

// Load settings from storage
function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(null, function(data) {
            settings = data;
            resolve(settings);
        });
    });
}

// Process text through Groq API
async function analyzeText(text) {
    if (!settings.groqApiKey) {
        console.error('Groq API key not set');
        return null;
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "mixtral-8x7b-32768",
                messages: [{
                    role: "user",
                    content: `Analyze the following text and respond with ONLY a JSON object in this exact format, no other text:
{
    "religiousSentiment": "one of: [Iskon, Hindu, Islam, Secular, None]",
    "sentimentScore": "number between 0-10",
    "reason": "brief explanation"
}

Text to analyze: "${text.replace(/"/g, '\\"')}"`
                }],
                temperature: 0.3,
                max_tokens: 150
            })
        });

        const data = await response.json();
        
        if (!data.choices?.[0]?.message?.content) {
            console.error('Invalid API response:', data);
            return null;
        }

        const content = data.choices[0].message.content.trim();
        try {
            const parsed = JSON.parse(content);
            if (!parsed.religiousSentiment || !parsed.sentimentScore) {
                console.error('Invalid JSON structure:', parsed);
                return null;
            }
            return parsed;
        } catch (parseError) {
            console.error('JSON Parse Error:', {
                error: parseError,
                content: content
            });
            return null;
        }
    } catch (error) {
        console.error('Error analyzing text:', error);
        return null;
    }
}

// Process a single post
async function processPost(container, contentElement) {
    if (container.dataset.processed) return;
    container.dataset.processed = 'true';

    const textContent = contentElement.innerText.trim();
    if (!textContent) return;

    const analysis = await analyzeText(textContent);
    if (!analysis) return;

    if (!shouldShowPost(analysis)) {
        contentElement.style.textDecoration = 'line-through';
        contentElement.style.opacity = '0.7';
        
        const reason = document.createElement('div');
        reason.style.fontSize = '12px';
        reason.style.color = '#65676B';
        reason.style.marginTop = '5px';
        reason.textContent = `Filtered: ${analysis.reason || 'Does not match your preferences'}`;
        contentElement.parentNode.insertBefore(reason, contentElement.nextSibling);
    }
}

// Determine if post should be shown based on settings
function shouldShowPost(analysis) {
    if (analysis.sentimentScore < settings.minSentiment) {
        return false;
    }

    const includeBeliefs = settings.includeBeliefs?.split(',').map(b => b.trim().toLowerCase()) || [];
    const excludeBeliefs = settings.excludeBeliefs?.split(',').map(b => b.trim().toLowerCase()) || [];

    const belief = analysis.religiousSentiment.toLowerCase();
    
    if (excludeBeliefs.includes(belief)) {
        return false;
    }

    if (includeBeliefs.length > 0 && !includeBeliefs.includes(belief)) {
        return false;
    }

    return true;
}

const feed_selector = ".x1hc1fzr.x1unhpq9.x6o7n8i"
const story_message_selector = '[data-ad-rendering-role="story_message"]'

// Process the entire newsfeed
function processNewsFeed() {
    const feed = document.querySelector(feed_selector);
    if (!feed) {
        setTimeout(processNewsFeed, 2000);
        return;
    }

    if (!window._feedObserver) {
        window._feedObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        const content = node.querySelector(story_message_selector);
                        if (content) {
                            processPost(node, content);
                        }
                    }
                });
            });
        });

        window._feedObserver.observe(feed, {
            childList: true,
            subtree: true
        });

        // Process existing posts
        feed.querySelectorAll(story_message_selector).forEach(content => {
            processPost(content.closest('[role="article"]'), content);
        });
    }
}

// Load settings and start processing
loadSettings().then(() => {
    setTimeout(processNewsFeed, 1000);
});

// Listen for settings changes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'settingsUpdated') {
        settings = request.settings;
        // No need to reprocess posts, just update settings for new posts
        sendResponse({ status: 'ok' });
    }
});
