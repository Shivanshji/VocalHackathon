/**
 * options.js — Options page controller.
 */

'use strict';

// ─── Sensitivity labels ───────────────────────────────────────
const sensitivityLabels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];

// ─── DOM refs ─────────────────────────────────────────────────
const optEnabled = document.getElementById('opt-enabled');
const optAutoStart = document.getElementById('opt-auto-start');
const optShowConfidence = document.getElementById('opt-show-confidence');
const providerRadios = document.querySelectorAll('input[name="provider"]');
const geminiKeyRow = document.getElementById('gemini-key-row');
const geminiKeyInput = document.getElementById('gemini-key');
const saveGeminiKey = document.getElementById('save-gemini-key');
const sensitivityRange = document.getElementById('sensitivity');
const sensitivityValue = document.getElementById('sensitivity-value');
const clearCacheBtn = document.getElementById('clear-cache-btn');
const cacheSizeDisplay = document.getElementById('cache-size-display');
const saveBar = document.getElementById('save-bar');
const saveAllBtn = document.getElementById('save-all-btn');
const toast = document.getElementById('options-toast');

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg, duration = 2500) {
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('visible'), duration);
}

// ─── Load settings ────────────────────────────────────────────
async function loadSettings() {
  const s = await chrome.storage.sync.get([
    'enabled', 'autoStart', 'showConfidence', 'provider', 'geminiApiKey', 'sensitivity'
  ]);

  optEnabled.checked = s.enabled !== false;
  optAutoStart.checked = s.autoStart !== false;
  optShowConfidence.checked = s.showConfidence !== false;

  const provider = s.provider || 'mock';
  document.querySelector(`input[value="${provider}"]`)?.click();

  if (s.geminiApiKey) {
    geminiKeyInput.value = s.geminiApiKey;
  }

  const sens = s.sensitivity || 3;
  sensitivityRange.value = sens;
  sensitivityValue.textContent = sensitivityLabels[sens - 1];

  await loadCacheStats();
}

async function loadCacheStats() {
  const items = await chrome.storage.local.get(null);
  const fcKeys = Object.keys(items).filter(k => k.startsWith('fc_'));
  cacheSizeDisplay.textContent = `${fcKeys.length} entries cached`;
}

// ─── Save all ─────────────────────────────────────────────────
async function saveAll() {
  const provider = document.querySelector('input[name="provider"]:checked')?.value || 'mock';

  await chrome.storage.sync.set({
    enabled: optEnabled.checked,
    autoStart: optAutoStart.checked,
    showConfidence: optShowConfidence.checked,
    provider,
    sensitivity: parseInt(sensitivityRange.value, 10),
  });

  // Notify content scripts
  await chrome.runtime.sendMessage({
    type: 'SET_ENABLED',
    payload: { enabled: optEnabled.checked }
  }).catch(() => {});

  saveBar.hidden = true;
  showToast('Settings saved ✓');
}

// ─── Event listeners ──────────────────────────────────────────

// Track changes to show save bar
[optEnabled, optAutoStart, optShowConfidence, ...providerRadios, sensitivityRange].forEach(el => {
  el.addEventListener('change', () => { saveBar.hidden = false; });
});

providerRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    geminiKeyRow.hidden = radio.value !== 'gemini';
    saveBar.hidden = false;
  });
});

sensitivityRange.addEventListener('input', () => {
  sensitivityValue.textContent = sensitivityLabels[parseInt(sensitivityRange.value) - 1];
});

saveGeminiKey.addEventListener('click', async () => {
  const key = geminiKeyInput.value.trim();
  if (!key) { showToast('Please enter a key'); return; }
  await chrome.storage.sync.set({ geminiApiKey: key });
  showToast('API key saved ✓');
});

clearCacheBtn.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
  if (response?.success) {
    showToast(`Cleared ${response.cleared} cached entries`);
    await loadCacheStats();
  }
});

saveAllBtn.addEventListener('click', saveAll);

// ─── Start ────────────────────────────────────────────────────
loadSettings();
