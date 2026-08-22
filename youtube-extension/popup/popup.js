/**
 * popup.js — Extension popup controller.
 *
 * Manages:
 *   - Enable/disable toggle
 *   - Status display (reads from active YouTube tab)
 *   - Provider selection
 *   - API key input
 *   - Cache clearing
 */

'use strict';

// ─────────────────────────────────────────────
// DOM references
// ─────────────────────────────────────────────

const toggleEl = document.getElementById('toggle-enabled');
const statusIndicator = document.getElementById('status-indicator');
const statusTitle = document.getElementById('status-title');
const statusSubtitle = document.getElementById('status-subtitle');
const statsSection = document.getElementById('stats-section');
const statSegments = document.getElementById('stat-segments');
const statChecks = document.getElementById('stat-checks');
const statCache = document.getElementById('stat-cache');
const providerSelect = document.getElementById('provider-select');
const apiKeySection = document.getElementById('api-key-section');
const geminiApiKeyInput = document.getElementById('gemini-api-key');
const saveApiKeyBtn = document.getElementById('save-api-key');
const clearCacheBtn = document.getElementById('btn-clear-cache');

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function showToast(message, duration = 2000) {
  let toast = document.querySelector('.popup-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'popup-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), duration);
}

function setStatus(type, title, subtitle) {
  statusIndicator.className = 'status-indicator ' + (type || '');
  statusTitle.textContent = title || '';
  statusSubtitle.textContent = subtitle || '';
}

// ─────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────

async function init() {
  // Load saved settings
  const settings = await chrome.storage.sync.get([
    'enabled', 'provider', 'geminiApiKey', 'autoStart'
  ]);

  // Reflect settings in UI
  toggleEl.checked = settings.enabled !== false;
  providerSelect.value = settings.provider || 'mock';
  geminiApiKeyInput.value = settings.geminiApiKey || '';

  // Show/hide API key input based on provider
  apiKeySection.hidden = providerSelect.value !== 'gemini';

  // Query the active YouTube tab for status
  await refreshStatus();
}

async function refreshStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || (!tab.url?.includes('youtube.com/watch') && !tab.url?.includes('youtube.com/shorts'))) {
      setStatus('', 'Not on a YouTube video', 'Navigate to a YouTube video to begin');
      statsSection.hidden = true;
      return;
    }

    // Ask content script for status
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (res) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(res);
      });
    });

    if (!response?.status) {
      setStatus('loading', 'Connecting to YouTube...', 'Content script is initializing');
      statsSection.hidden = true;
      return;
    }

    const { enabled, videoId, hasTranscript, segmentCount, cacheStats, fcStats } = response.status;

    if (!enabled) {
      setStatus('', 'Fact-checking is OFF', 'Use the toggle above to enable it');
      statsSection.hidden = true;
      return;
    }

    if (!videoId) {
      setStatus('', 'No video detected', 'Play a YouTube video to start');
      statsSection.hidden = true;
      return;
    }

    if (hasTranscript) {
      setStatus('active', 'Live fact-checking active', `Transcript loaded · ${segmentCount} segments`);
    } else {
      setStatus('loading', 'Loading transcript...', 'Detecting available captions');
    }

    // Update stats
    if (hasTranscript) {
      statsSection.hidden = false;
      statSegments.textContent = segmentCount || '0';
      statChecks.textContent = fcStats?.requests || 0;
      const rate = parseFloat(cacheStats?.hitRate);
      statCache.textContent = isNaN(rate) ? '0%' : `${Math.round(rate * 100)}%`;
    } else {
      statsSection.hidden = true;
    }
  } catch (e) {
    setStatus('', 'Not on a YouTube video', 'Navigate to a YouTube video to begin');
    statsSection.hidden = true;
  }
}

// ─────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────

// Enable/disable toggle
toggleEl.addEventListener('change', async () => {
  const enabled = toggleEl.checked;
  await chrome.storage.sync.set({ enabled });

  // Tell service worker (which broadcasts to all YouTube tabs)
  await chrome.runtime.sendMessage({ type: 'SET_ENABLED', payload: { enabled } });

  showToast(enabled ? 'Fact-checking enabled ✓' : 'Fact-checking disabled');
  await refreshStatus();
});

// Provider select
providerSelect.addEventListener('change', async () => {
  const provider = providerSelect.value;
  await chrome.storage.sync.set({ provider });
  apiKeySection.hidden = provider !== 'gemini';
  showToast(`Provider set to ${provider}`);
});

// Save API key
saveApiKeyBtn.addEventListener('click', async () => {
  const key = geminiApiKeyInput.value.trim();
  if (!key) {
    showToast('Please enter an API key');
    return;
  }
  await chrome.storage.sync.set({ geminiApiKey: key });
  showToast('API key saved ✓');
});

// Clear cache
clearCacheBtn.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
  if (response?.success) {
    showToast(`Cache cleared (${response.cleared} entries)`);
    await refreshStatus();
  }
});

// Refresh status every 3 seconds while popup is open
const refreshInterval = setInterval(refreshStatus, 3000);
window.addEventListener('unload', () => clearInterval(refreshInterval));

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
init();
