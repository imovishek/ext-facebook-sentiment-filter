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
async function analyzeText(text, imageUrl = null) {
    if (!settings.groqApiKey) {
        console.error('Groq API key not set');
        return null;
    }

    const includeBeliefs = settings.includeBeliefs?.split(',').map(b => b.trim().toLowerCase()) || [];
    const excludeBeliefs = settings.excludeBeliefs?.split(',').map(b => b.trim().toLowerCase()) || [];


    try {
        let data = {
            excludesAllOfExcludedBeliefs: false,
            includesAnyOfIncludedBeliefs: false,
            sentimentScore: 0
        }
     
        const retry_max = 5
        for (let i = 0; i < retry_max; i++) {
            try {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${settings.groqApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: "llama-3.2-90b-vision-preview",
                        messages: [{
                            role: "user",
                            content: `I am making a Facebook sentiment filter. I have a list of beliefs that I want to include and a list of beliefs that I want to exclude. Analyze the following post and first determine if it completely excludes "${excludeBeliefs.join(',')}" and then if it completely includes "${includeBeliefs.join(',')}" and respond with ONLY a JSON object in this exact format, no other text:

        {
            "excludesAllOfExcludedBeliefs": boolean,
            "includesAnyOfIncludedBeliefs": boolean,
            "sentimentScore": number,
            "reason": "The reasone why it was filtered"
        }

        sentimentScore should be between 0 and 10 based on how much okay to show it to users.
        Post to analyze: "${text.replace(/"/g, '\\"')}"`
                        }, ...(imageUrl ? [{
                            role: "user",
                            content: [
                                {
                                    type: 'image_url',
                                    image_url: {
                                        "url": imageUrl
                                    }
                                }
                            ]
                        }] : [])],
                        temperature: 0.3,
                        max_tokens: 250
                    })
                });

                data = await response.json();
                if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                    break;
                }
            } catch (error) {
                console.error('Error analyzing text:', error);
                if (i < retry_max - 1) {
                    console.log(`Retrying after ${i + 1} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, (i + 1) * 4 * 1000));
                }
            }
            
        }
        
        if (!data['choices'] || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
            console.error('Invalid API response:', data);
            return null;
        }

        const content = data.choices[0].message.content.trim();
        const json_string = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);  
        try {
            // json starts with { and ends with }
            console.log('Post Analysis:', content, json_string);
            const parsed = JSON.parse(json_string);

            console.log('Parsed JSON:', parsed);

            if (parsed.excludesAllOfExcludedBeliefs === undefined || parsed.includesAnyOfIncludedBeliefs === undefined || parsed.sentimentScore === undefined) {
                console.error('Invalid API response:', data);
                return null;
            }
             
            return parsed;
        } catch (parseError) {
            console.error('JSON Parse Error:', {
                error: parseError,
                content: json_string
            });
            return null;
        }
    } catch (error) {
        console.error('Error analyzing text:', error);
        return null;
    }
}

cache = {

}

// Process a single post
async function processPost(container, contentElement) {
    if (container.dataset.processed) return;
    container.dataset.processed = 'true';

    const textContent = contentElement.innerText.trim();
    if (!textContent) return;
    let analysis = cache[textContent];

    if (!cache[textContent]) {
        analysis = await analyzeText(textContent);
        cache[textContent] = analysis;
    }

    if (!analysis) return;

    if (!shouldShowPost(analysis)) {
        console.log('Filtering post:', {textContent, analysis});

        contentElement.style.textDecoration = 'line-through';
        contentElement.style.opacity = '0.2';
        contentElement.style.height = '40px';
        
        const reason = document.createElement('div');
        reason.style.fontSize = '14px';
        reason.style.color = '#65676B';
        reason.style.marginTop = '5px';
        reason.style.backgroundColor = '#f5f6f7';
        reason.style.padding = '10px';
        reason.style.borderRadius = '5px';
        reason.textContent = `Filtered: ${analysis.reason || 'Does not match your preferences'}`;
        // remove all next siblings
        all_siblings = []
        for (let i = contentElement.nextSibling; i; i = i.nextSibling) {
            all_siblings.push(i)
        }
        for (let i = 0; i < all_siblings.length; i++) {
            all_siblings[i].remove()
        }
        contentElement.parentNode.insertBefore(reason, contentElement.nextSibling);
    }
}

// Determine if post should be shown based on settings
function shouldShowPost(analysis) {
   

    if (analysis.excludesAllOfExcludedBeliefs) {
            
           return true;
    }
    if (analysis.sentimentScore < settings.minSentiment) {
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
                        const image_url = node.querySelector('img')?.src;
                        console.log("Image url:", image_url);
                        if (content) {
                            processPost(node, content, image_url);
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
