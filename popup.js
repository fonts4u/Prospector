// ============================================
// POPUP.JS - Main UI Controller
// Handles: UI interactions, shortlist display, export functionality
// ============================================

// DOM Elements
const startProspectingBtn = document.getElementById('startProspecting');
const statusMessage = document.getElementById('statusMessage');
const shortlistContainer = document.getElementById('shortlistContainer');
const exportBtn = document.getElementById('exportBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const clearShortlistBtn = document.getElementById('clearShortlistBtn');
const totalShortlistedEl = document.getElementById('totalShortlisted');
const totalProcessedEl = document.getElementById('totalProcessed');
const shortlistCountEl = document.getElementById('shortlistCount');

// ============================================
// INITIALIZATION
// Load shortlist on popup open
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  loadShortlist();
  updateStats();
});

// ============================================
// START PROSPECTING
// Scrape Product Hunt and open prospect tabs
// ============================================
startProspectingBtn.addEventListener('click', async () => {
  try {
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Verify we're on Product Hunt
    if (!tab.url.includes('producthunt.com')) {
      showStatus('Please navigate to Product Hunt first', 'error');
      return;
    }

    // Disable button during processing
    startProspectingBtn.disabled = true;
    startProspectingBtn.textContent = '⏳ Scraping...';

    // Inject scraping script into Product Hunt page
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeProductHunt
    });

    const products = results[0].result;

    if (!products || products.length === 0) {
      showStatus('No products found. Try scrolling down on Product Hunt.', 'error');
      startProspectingBtn.disabled = false;
      startProspectingBtn.textContent = '🚀 Start Prospecting (Top 15)';
      return;
    }

    // Send products to background script to open tabs
    chrome.runtime.sendMessage(
      { action: 'startProspecting', products },
      (response) => {
        if (response && response.success) {
          showStatus(`✓ Opened ${response.tabsOpened} prospect tabs. Check each tab!`, 'success');
          updateStats();
        } else {
          showStatus('Failed to open tabs: ' + (response?.error || 'Unknown error'), 'error');
        }

        // Re-enable button
        startProspectingBtn.disabled = false;
        startProspectingBtn.textContent = '🚀 Start Prospecting (Top 15)';
      }
    );

  } catch (error) {
    console.error('Prospecting error:', error);
    showStatus('Error: ' + error.message, 'error');
    startProspectingBtn.disabled = false;
    startProspectingBtn.textContent = '🚀 Start Prospecting (Top 15)';
  }
});

// ============================================
// PRODUCT HUNT SCRAPER FUNCTION
// Injected into Product Hunt page to extract products
// ============================================
function scrapeProductHunt() {
  const products = [];

  // Multiple selectors to handle different Product Hunt layouts
  const productSelectors = [
    'div[data-test="post-item"]',
    'article',
    '.styles_item__3_jbJ',
    '[data-test*="post"]'
  ];

  let productCards = [];

  // Try each selector until we find products
  for (const selector of productSelectors) {
    productCards = document.querySelectorAll(selector);
    if (productCards.length > 0) break;
  }

  // Fallback: try to find any links to product pages
  if (productCards.length === 0) {
    const allLinks = document.querySelectorAll('a[href*="/posts/"]');

    allLinks.forEach((link, index) => {
      if (index >= 15) return; // Limit to 15

      const name = link.textContent.trim() || `Product ${index + 1}`;
      const productUrl = link.href;

      // Try to extract website from nearby elements
      const parent = link.closest('article, div[data-test="post-item"], .styles_item__3_jbJ');
      let website = null;
      let tagline = 'No tagline found';

      if (parent) {
        // Look for website link
        const websiteLink = parent.querySelector('a[href^="http"]:not([href*="producthunt.com"])');
        if (websiteLink) {
          website = websiteLink.href;
        }

        // Look for tagline/description
        const descEl = parent.querySelector('p, span[class*="tagline"], div[class*="description"]');
        if (descEl) {
          tagline = descEl.textContent.trim();
        }
      }

      let finalWebsite = website;
      let isFallback = false;

      if (!finalWebsite) {
        finalWebsite = `https://www.google.com/search?q=${encodeURIComponent(name + ' official website')}`;
        isFallback = true;
      }

      products.push({
        name: name,
        tagline: tagline,
        website: finalWebsite,
        productHuntUrl: productUrl,
        isWebsiteFallback: isFallback
      });
    });
  } else {
    // Process found product cards
    productCards.forEach((card, index) => {
      if (index >= 15) return; // Limit to 15

      // Extract product name
      const nameEl = card.querySelector('h3, h2, a[href*="/posts/"], strong');
      const name = nameEl ? nameEl.textContent.trim() : `Product ${index + 1}`;

      // Extract tagline
      const taglineEl = card.querySelector('p, span[class*="tagline"], div[class*="description"]');
      const tagline = taglineEl ? taglineEl.textContent.trim() : 'No tagline found';

      // Extract website link (look for external links)
      const websiteLink = card.querySelector('a[href^="http"]:not([href*="producthunt.com"])');
      const website = websiteLink ? websiteLink.href : null;

      // Get Product Hunt URL
      const phLink = card.querySelector('a[href*="/posts/"]');
      const productHuntUrl = phLink ? phLink.href : '';

      // If no website found, create a Google Search fallback
      let finalWebsite = website;
      let isFallback = false;

      if (!finalWebsite) {
        finalWebsite = `https://www.google.com/search?q=${encodeURIComponent(name + ' official website')}`;
        isFallback = true;
      }

      products.push({
        name,
        tagline,
        website: finalWebsite,
        productHuntUrl,
        isWebsiteFallback: isFallback
      });
    });
  }

  return products;
}

// ============================================
// LOAD AND DISPLAY SHORTLIST
// ============================================
function loadShortlist() {
  chrome.runtime.sendMessage({ action: 'getShortlist' }, (response) => {
    const shortlist = response.shortlist || [];

    // Update count badge
    shortlistCountEl.textContent = shortlist.length;
    totalShortlistedEl.textContent = shortlist.length;

    // Show/hide export and clear buttons
    if (shortlist.length > 0) {
      exportBtn.style.display = 'block';
      exportJsonBtn.style.display = 'block';
      clearShortlistBtn.style.display = 'block';
    } else {
      exportBtn.style.display = 'none';
      exportJsonBtn.style.display = 'none';
      clearShortlistBtn.style.display = 'none';
    }

    // Clear container
    shortlistContainer.innerHTML = '';

    if (shortlist.length === 0) {
      shortlistContainer.innerHTML = `
        <div class="empty-state">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <p>No shortlisted prospects yet</p>
          <p style="font-size: 11px; margin-top: 4px;">Start prospecting to add items</p>
        </div>
      `;
      return;
    }

    // Display each shortlisted item (most recent first)
    shortlist.reverse().forEach((item, index) => {
      const itemEl = createShortlistItem(item, index);
      shortlistContainer.appendChild(itemEl);
    });
  });
}

// ============================================
// CREATE SHORTLIST ITEM ELEMENT
// ============================================
function createShortlistItem(item, index) {
  const div = document.createElement('div');
  div.className = 'shortlist-item';

  // Truncate long text
  const truncate = (text, maxLength) => {
    if (!text) return 'N/A';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const socials = item.socialLinks || {};
  const socialIcons = Object.keys(socials).map(platform => {
    return `<a href="${socials[platform]}" target="_blank" title="Visit ${platform}" style="text-decoration: none; font-size: 14px; margin-right: 6px;">${getSocialEmoji(platform)}</a>`;
  }).join('');

  div.innerHTML = `
    <h4>${truncate(item.name || item.companyName, 40)}</h4>
    <p><strong>H1:</strong> ${truncate(item.h1, 60)}</p>
    <p><strong>CTA:</strong> ${truncate(item.ctaText, 40)}</p>
    ${socialIcons ? `<p><strong>Socials:</strong> ${socialIcons}</p>` : ''}
    <p class="meta">Added: ${item.dateAdded || 'Unknown'}</p>
    <div class="shortlist-actions">
      <button class="btn-small btn-linkedin" data-company="${item.name || item.companyName}">
        🔍 Find Founder
      </button>
      <button class="btn-small" style="background: #e9ecef;" data-website="${item.website}">
        🌐 Visit Site
      </button>
    </div>
  `;

  // Add event listeners
  const linkedinBtn = div.querySelector('.btn-linkedin');
  linkedinBtn.addEventListener('click', () => {
    const companyName = linkedinBtn.dataset.company;
    chrome.runtime.sendMessage(
      { action: 'openLinkedInSearch', companyName },
      (response) => {
        if (response && response.success) {
          showStatus('LinkedIn search opened in new tab', 'success');
        }
      }
    );
  });

  const visitBtn = div.querySelector('[data-website]');
  visitBtn.addEventListener('click', () => {
    const website = visitBtn.dataset.website;
    chrome.tabs.create({ url: website });
  });

  return div;
}

// ============================================
// EXPORT SHORTLIST AS PDF
// ============================================
exportBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'getShortlist' }, (response) => {
    const shortlist = response.shortlist || [];

    if (shortlist.length === 0) {
      showStatus('No data to export', 'error');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation

      // Add Title
      doc.setFontSize(22);
      doc.setTextColor(102, 126, 234); // Primary color
      doc.text('UX Prospector - Shortlist Report', 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

      // Prepare data for table
      const head = [['Company', 'Website', 'H1 Headline', 'Primary CTA', 'UX Score', 'LinkedIn URL', 'Social Links', 'Date Added']];
      const body = shortlist.map(item => {
        const socials = item.socialLinks || {};
        const socialText = Object.keys(socials).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');

        return [
          item.name || item.companyName || 'N/A',
          item.website || 'N/A',
          item.h1 || 'N/A',
          item.ctaText || 'N/A',
          item.uxScore || '0',
          item.socialLinks?.linkedin || 'N/A',
          socialText || 'None',
          item.dateAdded || 'N/A'
        ];
      });

      // Generate Table
      doc.autoTable({
        head: head,
        body: body,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] },
        styles: { fontSize: 6.5, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 22 }, // Company
          1: { cellWidth: 35, textColor: [102, 126, 234] }, // Website
          2: { cellWidth: 40 }, // H1
          3: { cellWidth: 22 }, // CTA
          4: { cellWidth: 10 }, // Score
          5: { cellWidth: 45, textColor: [102, 126, 234] }, // LinkedIn
          6: { cellWidth: 40, textColor: [102, 126, 234] }, // Social Links
          7: { cellWidth: 20 }  // Date
        },
        didDrawCell: (data) => {
          if (data.section === 'body') {
            const item = shortlist[data.row.index];
            if (!item) return;

            // Handle Website (Col 1)
            if (data.column.index === 1 && item.website && item.website !== 'N/A') {
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: item.website });
            }
            // Handle LinkedIn (Col 5)
            if (data.column.index === 5 && item.socialLinks?.linkedin && item.socialLinks.linkedin !== 'N/A') {
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: item.socialLinks.linkedin });
            }
            // Handle Other Socials (Col 6) - Link to first available non-linkedin social OR display multiple
            if (data.column.index === 6) {
              const otherSocialPlatforms = Object.keys(item.socialLinks || {}).filter(p => p !== 'linkedin');
              if (otherSocialPlatforms.length > 0) {
                // For simplicity in PDF table format, we link to the first platform 
                const firstPlatform = otherSocialPlatforms[0];
                doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: item.socialLinks[firstPlatform] });
              }
            }
          }
        }
      });

      doc.save(`ux-prospects-${new Date().toISOString().split('T')[0]}.pdf`);
      showStatus(`✓ Exported ${shortlist.length} prospects as PDF`, 'success');
    } catch (err) {
      console.error('PDF Export Error:', err);
      showStatus('Error generating PDF. Check console.', 'error');
    }
  });
});

// ============================================
// EXPORT SHORTLIST AS JSON
// ============================================
exportJsonBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'getShortlist' }, (response) => {
    const shortlist = response.shortlist || [];

    if (shortlist.length === 0) {
      showStatus('No data to export', 'error');
      return;
    }

    const dataStr = JSON.stringify(shortlist, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `ux-prospects-${new Date().toISOString().split('T')[0]}.json`;
    downloadLink.click();

    showStatus(`✓ Exported ${shortlist.length} prospects as JSON`, 'success');
  });
});

// ============================================
// UTILITY: GET SOCIAL EMOJI
// ============================================
function getSocialEmoji(platform) {
  const emojis = {
    linkedin: '🟦',
    twitter: '🐦',
    facebook: '🔵',
    instagram: '📸',
    github: '🐙',
    youtube: '📺'
  };
  return emojis[platform] || '🌐';
}

// ============================================
// CLEAR SHORTLIST
// ============================================
clearShortlistBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all shortlisted prospects?')) {
    chrome.runtime.sendMessage({ action: 'clearShortlist' }, (response) => {
      if (response && response.success) {
        loadShortlist();
        updateStats();
        showStatus('Shortlist cleared', 'info');
      }
    });
  }
});

// ============================================
// UPDATE STATISTICS
// ============================================
function updateStats() {
  chrome.storage.local.get(['shortlist', 'stats'], (result) => {
    const shortlist = result.shortlist || [];
    const stats = result.stats || { processed: 0 };

    totalShortlistedEl.textContent = shortlist.length;
    totalProcessedEl.textContent = stats.processed || 0;
  });
}

// ============================================
// SHOW STATUS MESSAGE
// ============================================
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
  statusMessage.style.display = 'block';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 5000);
}

// ============================================
// AUTO-REFRESH SHORTLIST
// Listen for storage changes to update UI in real-time
// ============================================
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.shortlist) {
    loadShortlist();
    updateStats();
  }
});

console.log('Popup UI loaded successfully ✓');
