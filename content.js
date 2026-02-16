// ============================================
// CONTENT SCRIPT - Injected into every webpage
// Handles: Floating overlay panel, page data extraction
// ============================================

// Only inject panel on non-Product Hunt pages and non-Google pages
const currentUrl = window.location.href;
const shouldInjectPanel = !currentUrl.includes('producthunt.com') &&
  !currentUrl.includes('google.com') &&
  !currentUrl.includes('chrome://') &&
  !currentUrl.includes('chrome-extension://');

if (shouldInjectPanel) {
  injectProspectPanel();
}

// ============================================
// INJECT PROSPECT EVALUATION PANEL
// Creates floating overlay UI
// ============================================
function injectProspectPanel() {
  // Prevent duplicate injection
  if (document.getElementById('ux-prospect-panel')) {
    return;
  }

  // Create panel container
  const panel = document.createElement('div');
  panel.id = 'ux-prospect-panel';
  panel.className = 'ux-prospect-panel';

  // Create panel HTML
  panel.innerHTML = `
    <div class="ux-panel-header">
      <h3>🎯 UX Prospect Evaluator</h3>
      <button id="ux-panel-close" class="ux-panel-close">×</button>
    </div>
    
    <div class="ux-panel-body">
      <div class="ux-rating-section">
        <label>UX Clarity Score:</label>
        <div class="ux-rating-buttons">
          <button class="ux-rating-btn" data-score="1">1</button>
          <button class="ux-rating-btn" data-score="2">2</button>
          <button class="ux-rating-btn" data-score="3">3</button>
          <button class="ux-rating-btn" data-score="4">4</button>
          <button class="ux-rating-btn" data-score="5">5</button>
        </div>
        <small id="ux-rating-label">Rate the UX clarity (1=Poor, 5=Excellent)</small>
      </div>
      
      <div class="ux-extracted-data">
        <div class="ux-data-item">
          <strong>H1:</strong>
          <span id="ux-h1-preview">Analyzing...</span>
        </div>
        <div class="ux-data-item">
          <strong>Primary CTA:</strong>
          <span id="ux-cta-preview">Analyzing...</span>
        </div>
        <div class="ux-data-item">
          <strong>Nav Items:</strong>
          <span id="ux-nav-preview">Analyzing...</span>
        </div>
        <div class="ux-data-item">
          <strong>Socials:</strong>
          <span id="ux-social-preview">Analyzing...</span>
        </div>
      </div>
      
      <div class="ux-actions">
        <button id="ux-shortlist-btn" class="ux-btn ux-btn-primary">
          ⭐ Shortlist
        </button>
        <button id="ux-reject-btn" class="ux-btn ux-btn-danger">
          ❌ Reject
        </button>
        <button id="ux-generate-dm-btn" class="ux-btn ux-btn-secondary">
          📋 Generate DM
        </button>
        <button id="ux-find-founder-btn" class="ux-btn ux-btn-secondary">
          🔍 Find Founder
        </button>
      </div>
      
      <div id="ux-status-msg" class="ux-status-msg"></div>
    </div>
  `;

  // Append to body
  document.body.appendChild(panel);

  // Extract page data immediately
  extractPageData();

  // Add event listeners
  attachPanelEventListeners();
}

// ============================================
// EXTRACT PAGE DATA
// Scrapes H1, CTA, navigation, socials, meta description
// ============================================
function extractPageData() {
  // Extract H1 (first visible H1)
  const h1Element = document.querySelector('h1');
  const h1Text = h1Element ? h1Element.textContent.trim() : 'No H1 found';
  document.getElementById('ux-h1-preview').textContent = truncateText(h1Text, 50);

  // Extract primary CTA
  const ctaText = extractPrimaryCTA();
  document.getElementById('ux-cta-preview').textContent = truncateText(ctaText, 40);

  // Extract navigation items
  const navItems = extractNavigationItems();
  document.getElementById('ux-nav-preview').textContent = navItems.join(', ') || 'No nav found';

  // Extract socials
  const socialLinks = extractSocialLinks();
  const socialPreviewEl = document.getElementById('ux-social-preview');

  if (socialPreviewEl) {
    const socialIcons = Object.keys(socialLinks).map(platform => {
      return `<a href="${socialLinks[platform]}" target="_blank" title="Visit ${platform}" style="text-decoration: none; display: inline-flex; align-items: center; margin-right: 10px;">${getSocialIcon(platform)}</a>`;
    }).join('');

    if (socialIcons) {
      socialPreviewEl.innerHTML = socialIcons;
    } else {
      const companyName = extractCompanyName();
      const searchQuery = `"${companyName}" site:x.com OR site:twitter.com`;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      socialPreviewEl.innerHTML = `<a href="${searchUrl}" target="_blank" style="color: var(--ux-primary); font-size: 12px; display: flex; align-items: center; gap: 4px; text-decoration: underline;">${getSocialIcon('twitter')} Search X on Google</a>`;
    }
  }

  // Store extracted data globally for later use
  window.uxProspectData = {
    h1: h1Text,
    ctaText: ctaText,
    navItems: navItems,
    socialLinks: socialLinks,
    metaDescription: extractMetaDescription(),
    url: window.location.href,
    companyName: extractCompanyName()
  };
}

// ============================================
// UTILITY: GET SOCIAL ICON (SVG)
// Returns premium brand icons
// ============================================
function getSocialIcon(platform) {
  const icons = {
    linkedin: `<svg style="width:16px;height:16px;vertical-align:middle" viewBox="0 0 24 24" fill="#0077B5"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>`,
    twitter: `<svg style="width:16px;height:16px;vertical-align:middle" viewBox="0 0 24 24" fill="#000000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    facebook: `<svg style="width:16px;height:16px;vertical-align:middle" viewBox="0 0 24 24" fill="#1877F2"><path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7h-2.54v-2.9h2.54v-2.2c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.45 2.9h-2.33v7c4.78-.75 8.44-4.89 8.44-9.9 0-5.53-4.5-10.02-10-10.02z"/></svg>`,
    instagram: `<svg style="width:16px;height:16px;vertical-align:middle" viewBox="0 0 24 24" fill="#E4405F"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>`,
    github: `<svg style="width:16px;height:16px;vertical-align:middle" viewBox="0 0 24 24" fill="#181717"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.63-.33 2.47-.33.84 0 1.68.11 2.47.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>`
  };
  return icons[platform] || `<span style="font-size:16px">🌐</span>`;
}

// ============================================
// EXTRACT SOCIAL LINKS
// Finds social media profiles on the page
// ============================================
function extractSocialLinks() {
  const socials = {};
  const links = document.querySelectorAll('a[href]');

  const socialPatterns = {
    linkedin: /linkedin\.com\/(company|in)\//,
    twitter: /(twitter\.com|x\.com)\//,
    facebook: /facebook\.com\//,
    instagram: /instagram\.com\//,
    github: /github\.com\//,
    youtube: /youtube\.com\//
  };

  links.forEach(link => {
    const href = link.href.toLowerCase();
    for (const [platform, pattern] of Object.entries(socialPatterns)) {
      if (pattern.test(href) && !socials[platform]) {
        socials[platform] = link.href;
      }
    }
  });

  return socials;
}

// ============================================
// EXTRACT PRIMARY CTA BUTTON
// Finds the most prominent call-to-action
// ============================================
function extractPrimaryCTA() {
  // Common CTA button selectors
  const ctaSelectors = [
    'button[class*="cta"]',
    'a[class*="cta"]',
    'button[class*="primary"]',
    'a[class*="primary"]',
    'button[class*="hero"]',
    'a[class*="hero"]',
    'a[href*="signup"]',
    'a[href*="get-started"]',
    'a[href*="try"]',
    'button:contains("Get Started")',
    'button:contains("Start Free")',
    'button:contains("Try")',
    'button:contains("Sign Up")',
    'button:contains("Demo")'
  ];

  // Try each selector
  for (const selector of ctaSelectors) {
    const element = document.querySelector(selector);
    if (element && isVisible(element)) {
      return element.textContent.trim();
    }
  }

  // Fallback: Find largest visible button in hero section
  const heroSection = document.querySelector('section, header, [class*="hero"], [class*="banner"]');
  if (heroSection) {
    const buttons = heroSection.querySelectorAll('button, a[class*="button"], a[class*="btn"]');
    for (const btn of buttons) {
      if (isVisible(btn)) {
        return btn.textContent.trim();
      }
    }
  }

  // Last resort: any visible button
  const anyButton = document.querySelector('button, a[class*="button"]');
  if (anyButton && isVisible(anyButton)) {
    return anyButton.textContent.trim();
  }

  return 'No CTA found';
}

// ============================================
// EXTRACT NAVIGATION ITEMS
// Gets main navigation menu items
// ============================================
function extractNavigationItems() {
  const navItems = [];

  // Try common nav selectors
  const navSelectors = [
    'nav a',
    'header nav a',
    '[role="navigation"] a',
    'ul[class*="nav"] a',
    'ul[class*="menu"] a'
  ];

  for (const selector of navSelectors) {
    const links = document.querySelectorAll(selector);
    if (links.length > 0) {
      links.forEach((link, index) => {
        if (index < 8 && isVisible(link)) { // Limit to 8 items
          const text = link.textContent.trim();
          if (text && text.length > 0 && text.length < 30) {
            navItems.push(text);
          }
        }
      });
      break; // Stop after finding first valid nav
    }
  }

  return [...new Set(navItems)]; // Remove duplicates
}

// ============================================
// EXTRACT META DESCRIPTION
// ============================================
function extractMetaDescription() {
  const metaDesc = document.querySelector('meta[name="description"]');
  return metaDesc ? metaDesc.content : 'No meta description';
}

// ============================================
// EXTRACT COMPANY NAME
// Try to extract from page title or domain
// ============================================
function extractCompanyName() {
  // Try page title first
  const title = document.title;
  if (title) {
    // Remove common suffixes
    const cleanTitle = title
      .replace(/\s*[-–|]\s*.*$/, '') // Remove everything after dash/pipe
      .replace(/\s*\|\s*.*$/, '')
      .trim();
    if (cleanTitle) return cleanTitle;
  }

  // Fallback to domain name
  const hostname = window.location.hostname;
  const domain = hostname.replace('www.', '').split('.')[0];
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

// ============================================
// CHECK IF ELEMENT IS VISIBLE
// ============================================
function isVisible(element) {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  return style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0;
}

// ============================================
// ATTACH EVENT LISTENERS TO PANEL
// ============================================
function attachPanelEventListeners() {
  let selectedScore = null;

  // Rating buttons
  const ratingButtons = document.querySelectorAll('.ux-rating-btn');
  ratingButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedScore = parseInt(btn.dataset.score);

      // Update UI
      ratingButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update label
      const labels = {
        1: '1 - Poor UX',
        2: '2 - Below Average',
        3: '3 - Average',
        4: '4 - Good',
        5: '5 - Excellent'
      };
      document.getElementById('ux-rating-label').textContent = labels[selectedScore];

      // Store score
      if (window.uxProspectData) {
        window.uxProspectData.uxScore = selectedScore;
      }
    });
  });

  // Shortlist button
  document.getElementById('ux-shortlist-btn').addEventListener('click', () => {
    const data = {
      ...window.uxProspectData,
      website: window.location.href,
      name: window.uxProspectData.companyName,
      uxScore: selectedScore || 0
    };

    chrome.runtime.sendMessage(
      { action: 'saveShortlist', data },
      (response) => {
        if (response && response.success) {
          showPanelStatus('✓ Added to shortlist!', 'success');

          // Auto-close tab after 2 seconds
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          showPanelStatus(response?.message || 'Failed to save', 'error');
        }
      }
    );
  });

  // Reject button
  document.getElementById('ux-reject-btn').addEventListener('click', () => {
    if (confirm('Close this tab and reject this prospect?')) {
      chrome.runtime.sendMessage({ action: 'rejectProspect' });
      window.close();
    }
  });

  // Generate DM button - Now only generates and copies, NO REDIRECT
  document.getElementById('ux-generate-dm-btn').addEventListener('click', () => {
    const btn = document.getElementById('ux-generate-dm-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Generating...';

    chrome.runtime.sendMessage(
      {
        action: 'generateDM',
        data: window.uxProspectData
      },
      (response) => {
        btn.disabled = false;
        btn.textContent = '📋 Generate DM';

        if (response && response.success) {
          // Copy to clipboard
          navigator.clipboard.writeText(response.dmTemplate).then(() => {
            showPanelStatus('✓ DM copied to clipboard!', 'success');
          });
        } else {
          showPanelStatus('Failed to generate DM', 'error');
        }
      }
    );
  });

  // Find Founder button - Dedicated action for redirection
  document.getElementById('ux-find-founder-btn').addEventListener('click', () => {
    const linkedinUrl = window.uxProspectData.socialLinks?.linkedin;
    // If it looks like a personal profile (contains /in/), pass it as directUrl
    const isDirectProfile = linkedinUrl && linkedinUrl.includes('/in/');

    // Fallback search now uses Google as requested for higher accuracy
    const companyName = window.uxProspectData.companyName;
    const googleQuery = `site:linkedin.com/in "${companyName}" (founder OR ceo)`;
    const fallbackSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;

    chrome.runtime.sendMessage({
      action: 'openLinkedInSearch',
      companyName: companyName,
      directUrl: isDirectProfile ? linkedinUrl : fallbackSearchUrl
    });
  });

  // Close button
  document.getElementById('ux-panel-close').addEventListener('click', () => {
    const panel = document.getElementById('ux-prospect-panel');
    panel.classList.add('ux-hidden');
  });
}

// ============================================
// SHOW STATUS MESSAGE IN PANEL
// ============================================
function showPanelStatus(message, type = 'info') {
  const statusEl = document.getElementById('ux-status-msg');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `ux-status-msg ${type}`;
  statusEl.style.display = 'block';

  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}

// ============================================
// UTILITY: TRUNCATE TEXT
// ============================================
function truncateText(text, maxLength) {
  if (!text) return 'N/A';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
  const panel = document.getElementById('ux-prospect-panel');
  if (!panel || panel.classList.contains('ux-hidden')) return;

  // Press 'S' to shortlist
  if (e.key === 's' || e.key === 'S') {
    const btn = document.getElementById('ux-shortlist-btn');
    if (btn) btn.click();
  }

  // Press 'R' to reject
  if (e.key === 'r' || e.key === 'R') {
    const btn = document.getElementById('ux-reject-btn');
    if (btn) btn.click();
  }

  // Press 'D' to generate DM
  if (e.key === 'd' || e.key === 'D') {
    const btn = document.getElementById('ux-generate-dm-btn');
    if (btn) btn.click();
  }

  // Press 'F' to find founder
  if (e.key === 'f' || e.key === 'F') {
    const btn = document.getElementById('ux-find-founder-btn');
    if (btn) btn.click();
  }

  // Press 'ESC' to hide panel
  if (e.key === 'Escape') {
    panel.classList.add('ux-hidden');
  }
});

console.log('UX Prospect content script loaded ✓');
