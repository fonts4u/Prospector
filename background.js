// ============================================
// BACKGROUND SERVICE WORKER (Manifest V3)
// Handles: Tab management, message routing, extension state
// ============================================

// Store currently opened prospect tabs
let prospectTabs = [];
let currentProcessingIndex = 0;

// ============================================
// MESSAGE LISTENER - Central communication hub
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Handle Product Hunt scraping request
  if (message.action === 'startProspecting') {
    handleProductHuntScraping(message.products, sendResponse);
    return true; // Keep channel open for async response
  }

  // Handle shortlist save
  if (message.action === 'saveShortlist') {
    saveToShortlist(message.data, sendResponse);
    return true;
  }

  // Handle rejection (close tab)
  if (message.action === 'rejectProspect') {
    chrome.tabs.remove(sender.tab.id);
    sendResponse({ success: true });
    return true;
  }

  // Handle DM generation
  if (message.action === 'generateDM') {
    generateDMTemplate(message.data, sendResponse);
    return true;
  }

  // Handle LinkedIn search
  if (message.action === 'openLinkedInSearch') {
    openLinkedInFounderSearch(message.companyName, sendResponse, message.directUrl);
    return true;
  }

  // Get all shortlisted prospects
  if (message.action === 'getShortlist') {
    chrome.storage.local.get(['shortlist'], (result) => {
      sendResponse({ shortlist: result.shortlist || [] });
    });
    return true;
  }

  // Clear all shortlisted prospects
  if (message.action === 'clearShortlist') {
    chrome.storage.local.set({ shortlist: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// ============================================
// PRODUCT HUNT SCRAPING HANDLER
// Opens each product's website in background tabs
// ============================================
function handleProductHuntScraping(products, sendResponse) {
  if (!products || products.length === 0) {
    sendResponse({ success: false, error: 'No products found' });
    return;
  }

  // Limit to 15 products
  const limitedProducts = products.slice(0, 15);
  prospectTabs = [];

  // Open each product website in a new background tab
  let tabsOpened = 0;

  limitedProducts.forEach((product, index) => {
    // Small delay between opening tabs to avoid browser throttling
    setTimeout(() => {
      chrome.tabs.create({
        url: product.website,
        active: false // Open in background
      }, (tab) => {
        prospectTabs.push({
          tabId: tab.id,
          product: product
        });

        tabsOpened++;

        // Send response when all tabs are opened
        if (tabsOpened === limitedProducts.length) {
          sendResponse({
            success: true,
            tabsOpened: tabsOpened,
            message: `Opened ${tabsOpened} prospect tabs`
          });
        }
      });
    }, index * 300); // 300ms delay between each tab
  });
}

// ============================================
// SAVE TO SHORTLIST
// Stores prospect data in chrome.storage.local
// ============================================
function saveToShortlist(prospectData, sendResponse) {
  chrome.storage.local.get(['shortlist'], (result) => {
    const shortlist = result.shortlist || [];

    // Add timestamp and unique ID
    const enrichedData = {
      ...prospectData,
      id: Date.now(),
      timestamp: new Date().toISOString(),
      dateAdded: new Date().toLocaleDateString()
    };

    // Prevent duplicates based on website URL
    const isDuplicate = shortlist.some(item => item.website === prospectData.website);

    if (!isDuplicate) {
      shortlist.push(enrichedData);

      chrome.storage.local.set({ shortlist }, () => {
        sendResponse({
          success: true,
          message: 'Added to shortlist',
          totalShortlisted: shortlist.length
        });
      });
    } else {
      sendResponse({
        success: false,
        message: 'Already shortlisted'
      });
    }
  });
}

// ============================================
// GENERATE DM TEMPLATE
// Creates personalized outreach message
// ============================================
function generateDMTemplate(data, sendResponse) {
  const { companyName, h1, ctaText, navItems, metaDescription } = data;

  // Infer goal from CTA text
  let inferredGoal = 'conversion';
  if (ctaText) {
    const lowerCTA = ctaText.toLowerCase();
    if (lowerCTA.includes('start') || lowerCTA.includes('try') || lowerCTA.includes('free')) {
      inferredGoal = 'trial signups';
    } else if (lowerCTA.includes('demo') || lowerCTA.includes('schedule')) {
      inferredGoal = 'demo bookings';
    } else if (lowerCTA.includes('buy') || lowerCTA.includes('pricing')) {
      inferredGoal = 'direct sales';
    } else if (lowerCTA.includes('learn') || lowerCTA.includes('explore')) {
      inferredGoal = 'product education';
    }
  }

  // Generate personalized DM
  const dmTemplate = `Hi [Founder Name],

I explored ${companyName} and noticed your headline: "${h1 || 'N/A'}"

Your primary CTA "${ctaText || 'N/A'}" suggests you're focused on ${inferredGoal}.

I identified a couple of friction points that might impact activation:
• [Specific observation 1]
• [Specific observation 2]

Happy to share a quick UX teardown if helpful.

Best,
[Your Name]

---
METADATA FOR CONTEXT:
Navigation: ${navItems?.join(', ') || 'N/A'}
Meta Description: ${metaDescription || 'N/A'}`;

  sendResponse({
    success: true,
    dmTemplate,
    companyName,
    inferredGoal
  });
}

// ============================================
// OPEN LINKEDIN FOUNDER SEARCH
// Redirects directly to LinkedIn's native people search or a specific profile
// ============================================
function openLinkedInFounderSearch(companyName, sendResponse, directUrl = null) {
  // If we have a direct LinkedIn URL (usually from scrapers or socials), use it directly
  const searchURL = (directUrl && directUrl.includes('linkedin.com'))
    ? directUrl
    : `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(companyName + ' Founder CEO')}`;

  chrome.tabs.create({
    url: searchURL,
    active: true
  }, (tab) => {
    sendResponse({
      success: true,
      message: directUrl ? 'LinkedIn profile opened directly' : 'LinkedIn search opened directly',
      url: searchURL
    });
  });
}

// ============================================
// EXTENSION INSTALLATION
// Show welcome message on first install
// ============================================
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Product Hunt UX Prospector installed successfully!');

    // Initialize storage
    chrome.storage.local.set({
      shortlist: [],
      settings: {
        maxProspects: 15,
        autoCloseOnReject: true
      }
    });
  }
});

// ============================================
// TAB CLOSE LISTENER
// Clean up prospect tabs array when tabs are closed
// ============================================
chrome.tabs.onRemoved.addListener((tabId) => {
  prospectTabs = prospectTabs.filter(item => item.tabId !== tabId);
});

console.log('Background service worker loaded successfully ✓');
