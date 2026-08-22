/**
 * ui-overlay.js — SachMei overlay UI injected into YouTube.
 *
 * Creates and manages:
 *   1. Floating SachMei trigger button (🔍 SachMei)
 *   2. Live fact-check panel (draggable, resizable)
 *   3. Current claim display with verdict badge
 *   4. Verdict history list with timestamp navigation
 *   5. Loading / error / no-transcript states
 *
 * Design: modern glassmorphism, dark-mode, premium look.
 * Uses the overlay.css stylesheet injected via manifest.
 */

class UIOverlay {
  constructor({ onSeekTo, onRetry }) {
    this._onSeekTo = onSeekTo || (() => {});
    this._onRetry = onRetry || null;
    this._isOpen = false;
    this._currentResult = null;
    this._history = [];       // [{ claim, result, timestamp }]
    this._maxHistory = 50;
    this._state = 'idle';     // 'idle' | 'loading' | 'checking' | 'no-transcript' | 'error' | 'disabled'

    // DOM elements
    this._fab = null;        // floating action button
    this._panel = null;      // main panel
    this._initialized = false;
  }

  // ─────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────

  init() {
    if (this._initialized) return;

    this._createFAB();
    this._createPanel();
    this._attachKeyboardShortcut();

    this._initialized = true;
    console.log('[SachMei UI] Overlay initialized.');
  }

  destroy() {
    this._fab?.remove();
    this._panel?.remove();
    this._fab = null;
    this._panel = null;
    this._initialized = false;
  }

  reset() {
    this._history = [];
    this._currentResult = null;
    this._state = 'idle';
    this._updatePanelContent();
  }

  // ─────────────────────────────────────────────
  // State management
  // ─────────────────────────────────────────────

  setState(state, payload = {}) {
    this._state = state;

    if (this._fab) {
      this._fab.dataset.state = state;
      // Update FAB indicator dot
      const dot = this._fab.querySelector('.sachmei-fab-dot');
      if (dot) {
        dot.className = 'sachmei-fab-dot sachmei-dot-' + state;
      }
    }

    // Update panel header status
    const statusEl = this._panel?.querySelector('#sachmei-status-text');
    if (statusEl) {
      statusEl.textContent = this._getStatusText(state, payload);
    }

    // Update panel body content based on state
    this._updatePanelContent(payload);
  }

  _getStatusText(state, payload = {}) {
    const map = {
      idle: '● Live',
      loading: '⏳ Loading transcript...',
      checking: '🔍 Checking claim...',
      'no-transcript': '⚠ No captions',
      error: '✗ Error',
      disabled: '○ Off',
    };
    return map[state] || '● Live';
  }

  // ─────────────────────────────────────────────
  // Public update methods
  // ─────────────────────────────────────────────

  showResult(claim, result, timestamp) {
    this._currentResult = { claim, result, timestamp };

    // Add to history
    this._history.unshift({ claim, result, timestamp });
    if (this._history.length > this._maxHistory) {
      this._history.pop();
    }

    this.setState('idle');

    // Auto-open panel on new result if it's closed
    // (only on first result or high-confidence false/misleading)
    const shouldAutoOpen =
      this._history.length === 1 ||
      (result.verdict === 'FALSE' && result.confidence > 0.8) ||
      (result.verdict === 'MISLEADING' && result.confidence > 0.75);

    if (shouldAutoOpen && !this._isOpen) {
      this.open();
    } else {
      this._updatePanelContent();
    }

    // Show FAB notification badge
    this._showFABBadge(result.verdict);
  }

  showChecking(claim) {
    this.setState('checking', { claim });
  }

  showNoTranscript() {
    this.setState('no-transcript');
    if (!this._isOpen) this.open();
  }

  showError(message) {
    this.setState('error', { message });
  }

  showDisabled() {
    this.setState('disabled');
    this.close();
  }

  showEnabled() {
    this.setState('idle');
  }

  open() {
    this._isOpen = true;
    if (this._panel) {
      this._panel.classList.add('sachmei-panel-visible');
      this._panel.setAttribute('aria-hidden', 'false');
    }
    if (this._fab) {
      this._fab.classList.add('sachmei-fab-active');
    }
    this._updatePanelContent();
  }

  close() {
    this._isOpen = false;
    if (this._panel) {
      this._panel.classList.remove('sachmei-panel-visible');
      this._panel.setAttribute('aria-hidden', 'true');
    }
    if (this._fab) {
      this._fab.classList.remove('sachmei-fab-active');
    }
  }

  toggle() {
    this._isOpen ? this.close() : this.open();
  }

  // ─────────────────────────────────────────────
  // FAB
  // ─────────────────────────────────────────────

  _createFAB() {
    this._fab = document.createElement('div');
    this._fab.id = 'sachmei-fab';
    this._fab.className = 'sachmei-fab';
    this._fab.setAttribute('role', 'button');
    this._fab.setAttribute('aria-label', 'SachMei Fact Checker');
    this._fab.setAttribute('tabindex', '0');
    this._fab.title = 'SachMei — Live Fact Checker (Alt+S)';
    this._fab.innerHTML = `
      <div class="sachmei-fab-inner">
        <span class="sachmei-fab-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </span>
        <span class="sachmei-fab-label">SachMei</span>
        <span class="sachmei-fab-dot sachmei-dot-idle"></span>
      </div>
      <div class="sachmei-fab-badge" id="sachmei-fab-badge"></div>
    `;

    this._fab.addEventListener('click', () => this.toggle());
    this._fab.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
    });

    document.body.appendChild(this._fab);
  }

  _showFABBadge(verdict) {
    const badge = this._fab?.querySelector('#sachmei-fab-badge');
    if (!badge) return;

    const icons = { TRUE: '✓', FALSE: '✗', MISLEADING: '⚠', PARTIALLY_TRUE: '~', UNVERIFIABLE: '?' };
    const colors = {
      TRUE: 'sachmei-badge-true',
      FALSE: 'sachmei-badge-false',
      MISLEADING: 'sachmei-badge-misleading',
      PARTIALLY_TRUE: 'sachmei-badge-partial',
      UNVERIFIABLE: 'sachmei-badge-unknown',
    };

    badge.textContent = icons[verdict] || '?';
    badge.className = `sachmei-fab-badge ${colors[verdict] || ''}`;
    badge.classList.add('sachmei-badge-visible');

    // Auto-hide badge after 8 seconds
    clearTimeout(this._badgeTimer);
    this._badgeTimer = setTimeout(() => {
      badge.classList.remove('sachmei-badge-visible');
    }, 8000);
  }

  // ─────────────────────────────────────────────
  // Main Panel
  // ─────────────────────────────────────────────

  _createPanel() {
    this._panel = document.createElement('div');
    this._panel.id = 'sachmei-panel';
    this._panel.className = 'sachmei-panel';
    this._panel.setAttribute('role', 'dialog');
    this._panel.setAttribute('aria-label', 'SachMei Fact Check Panel');
    this._panel.setAttribute('aria-hidden', 'true');

    this._panel.innerHTML = `
      <div class="sachmei-panel-header" id="sachmei-drag-handle">
        <div class="sachmei-header-left">
          <div class="sachmei-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <div class="sachmei-header-title">
            <span class="sachmei-brand">SachMei</span>
            <span class="sachmei-tagline">Live Fact Checker</span>
          </div>
        </div>
        <div class="sachmei-header-right">
          <span id="sachmei-status-text" class="sachmei-status">● Live</span>
          <button class="sachmei-btn-icon" id="sachmei-close-btn" title="Close panel" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="sachmei-panel-tabs">
        <button class="sachmei-tab sachmei-tab-active" id="sachmei-tab-current" data-tab="current">Current</button>
        <button class="sachmei-tab" id="sachmei-tab-history" data-tab="history">
          History <span class="sachmei-history-count" id="sachmei-history-count">0</span>
        </button>
      </div>

      <div class="sachmei-panel-body" id="sachmei-panel-body">
        <!-- Content updated dynamically -->
      </div>

      <div class="sachmei-panel-footer">
        <span class="sachmei-footer-note">AI-powered · Not legal advice</span>
        <a class="sachmei-footer-link" href="https://github.com" target="_blank" rel="noopener">About</a>
      </div>
    `;

    // Close button
    this._panel.querySelector('#sachmei-close-btn').addEventListener('click', () => this.close());

    // Tab switching
    this._panel.querySelectorAll('.sachmei-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._panel.querySelectorAll('.sachmei-tab').forEach(t => t.classList.remove('sachmei-tab-active'));
        tab.classList.add('sachmei-tab-active');
        this._activeTab = tab.dataset.tab;
        this._updatePanelContent();
      });
    });

    this._activeTab = 'current';
    this._makeDraggable(this._panel, this._panel.querySelector('#sachmei-drag-handle'));

    document.body.appendChild(this._panel);
  }

  _updatePanelContent(payload = {}) {
    const body = this._panel?.querySelector('#sachmei-panel-body');
    if (!body) return;

    // Update history count badge
    const historyCount = this._panel.querySelector('#sachmei-history-count');
    if (historyCount) historyCount.textContent = this._history.length;

    if (this._activeTab === 'history') {
      body.innerHTML = this._renderHistory();
      this._attachHistoryListeners(body);
      return;
    }

    // Current tab
    switch (this._state) {
      case 'loading':
        body.innerHTML = this._renderLoading('Finding video captions...');
        break;
      case 'checking':
        body.innerHTML = this._renderLoading(
          'Checking this claim...',
          payload.claim ? `"${truncate(payload.claim, 100)}"` : ''
        );
        break;
      case 'no-transcript':
        body.innerHTML = this._renderNoTranscript();
        break;
      case 'error':
        body.innerHTML = this._renderError(payload.message);
        break;
      case 'disabled':
        body.innerHTML = this._renderDisabled();
        break;
      default:
        body.innerHTML = this._currentResult
          ? this._renderResult(this._currentResult)
          : this._renderIdle();
    }

    // Attach timestamp click listeners
    body.querySelectorAll('[data-seek]').forEach(el => {
      el.addEventListener('click', () => {
        const time = parseFloat(el.dataset.seek);
        if (!isNaN(time)) this._onSeekTo(time);
      });
    });

    // Retry transcript button (shown in no-transcript state)
    const retryBtn = body.querySelector('#sachmei-retry-transcript-btn');
    if (retryBtn && this._onRetry) {
      retryBtn.addEventListener('click', () => {
        this.setState('loading');
        this._onRetry();
      });
    }
  }

  // ─────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────

  _renderIdle() {
    return `
      <div class="sachmei-empty-state">
        <div class="sachmei-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <p class="sachmei-empty-title">Listening for claims...</p>
        <p class="sachmei-empty-subtitle">
          SachMei detects factual claims as the video plays.<br>
          If nothing appears, <strong>enable CC</strong> in the YouTube player ▶ CC button.
        </p>
      </div>
    `;
  }

  _renderLoading(title, subtitle = '') {
    return `
      <div class="sachmei-loading-state">
        <div class="sachmei-spinner"></div>
        <p class="sachmei-loading-title">${this._esc(title)}</p>
        ${subtitle ? `<p class="sachmei-loading-claim">${this._esc(subtitle)}</p>` : ''}
      </div>
    `;
  }

  _renderNoTranscript(msg) {
    return `
      <div class="sachmei-empty-state sachmei-state-warn">
        <div class="sachmei-empty-icon sachmei-icon-warn">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <p class="sachmei-empty-title">Enable CC to fact-check</p>
        <p class="sachmei-empty-subtitle">
          This video's captions aren't pre-loaded.<br><br>
          <strong>Click CC in the YouTube player</strong> to turn on captions, then press Retry.
        </p>
        <button class="sachmei-btn-secondary" id="sachmei-retry-transcript-btn">↻ Retry</button>
      </div>
    `;
  }

  _renderError(message) {
    return `
      <div class="sachmei-empty-state sachmei-state-error">
        <div class="sachmei-empty-icon sachmei-icon-error">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <p class="sachmei-empty-title">Unable to verify this claim</p>
        <p class="sachmei-empty-subtitle">${this._esc(message || 'An error occurred. Please try again.')}</p>
        <button class="sachmei-btn-secondary" id="sachmei-retry-btn">Try again</button>
      </div>
    `;
  }

  _renderDisabled() {
    return `
      <div class="sachmei-empty-state">
        <div class="sachmei-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
        </div>
        <p class="sachmei-empty-title">Fact-checking is OFF</p>
        <p class="sachmei-empty-subtitle">Enable SachMei from the toolbar popup to start live fact-checking.</p>
      </div>
    `;
  }

  _renderResult({ claim, result, timestamp }) {
    const { verdict, confidence, explanation, sources, keyFinding } = result;

    const verdictConfig = {
      TRUE: { label: 'TRUE', emoji: '✓', class: 'sachmei-verdict-true', color: '#22c55e' },
      FALSE: { label: 'FALSE', emoji: '✗', class: 'sachmei-verdict-false', color: '#ef4444' },
      MISLEADING: { label: 'MISLEADING', emoji: '⚠', class: 'sachmei-verdict-misleading', color: '#f59e0b' },
      PARTIALLY_TRUE: { label: 'PARTLY TRUE', emoji: '~', class: 'sachmei-verdict-partial', color: '#f97316' },
      UNVERIFIABLE: { label: 'UNVERIFIABLE', emoji: '?', class: 'sachmei-verdict-unknown', color: '#94a3b8' },
      // Map backend verdicts to extension verdicts
      SUPPORTED: { label: 'TRUE', emoji: '✓', class: 'sachmei-verdict-true', color: '#22c55e' },
      CONTRADICTED: { label: 'FALSE', emoji: '✗', class: 'sachmei-verdict-false', color: '#ef4444' },
      INSUFFICIENT_EVIDENCE: { label: 'UNVERIFIABLE', emoji: '?', class: 'sachmei-verdict-unknown', color: '#94a3b8' },
    };

    const vc = verdictConfig[verdict] || verdictConfig['UNVERIFIABLE'];
    const confidencePct = Math.round((confidence || 0) * 100);

    const sourcesHtml = sources && sources.length > 0
      ? `<div class="sachmei-sources">
          <h4 class="sachmei-section-label">Sources</h4>
          <ul class="sachmei-sources-list">
            ${sources.map(s => `
              <li>
                <a class="sachmei-source-link" href="${this._esc(s.url)}" target="_blank" rel="noopener noreferrer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                  ${this._esc(s.title || s.url)}
                </a>
              </li>
            `).join('')}
          </ul>
        </div>`
      : '';

    return `
      <div class="sachmei-result">
        <div class="sachmei-result-claim">
          <h4 class="sachmei-section-label">Claim</h4>
          <p class="sachmei-claim-text">"${this._esc(claim)}"</p>
          <button class="sachmei-timestamp-btn" data-seek="${timestamp}" title="Jump to this moment">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Checked at ${formatTimestamp(timestamp)}
          </button>
        </div>

        <div class="sachmei-verdict-section">
          <div class="sachmei-verdict-badge ${vc.class}">
            <span class="sachmei-verdict-emoji">${vc.emoji}</span>
            <span class="sachmei-verdict-label">${vc.label}</span>
          </div>
          <div class="sachmei-confidence">
            <div class="sachmei-confidence-bar-wrap">
              <div class="sachmei-confidence-bar" style="width: ${confidencePct}%; background: ${vc.color}"></div>
            </div>
            <span class="sachmei-confidence-label">Confidence: ${confidencePct}%</span>
          </div>
        </div>

        ${keyFinding ? `
        <div class="sachmei-key-finding">
          <h4 class="sachmei-section-label">Key Finding</h4>
          <p class="sachmei-key-finding-text">${this._esc(keyFinding)}</p>
        </div>` : ''}

        <div class="sachmei-explanation">
          <h4 class="sachmei-section-label">Explanation</h4>
          <p class="sachmei-explanation-text">${this._esc(explanation || 'No explanation provided.')}</p>
        </div>

        ${sourcesHtml}
      </div>
    `;
  }

  _renderHistory() {
    if (this._history.length === 0) {
      return `<div class="sachmei-empty-state">
        <p class="sachmei-empty-title">No checks yet</p>
        <p class="sachmei-empty-subtitle">Fact-check results will appear here as the video plays.</p>
      </div>`;
    }

    const verdictEmoji = {
      TRUE: '✓', FALSE: '✗', MISLEADING: '⚠', PARTIALLY_TRUE: '~', UNVERIFIABLE: '?',
      SUPPORTED: '✓', CONTRADICTED: '✗', INSUFFICIENT_EVIDENCE: '?',
    };
    const verdictClass = {
      TRUE: 'sachmei-hist-true', FALSE: 'sachmei-hist-false',
      MISLEADING: 'sachmei-hist-misleading', PARTIALLY_TRUE: 'sachmei-hist-partial',
      UNVERIFIABLE: 'sachmei-hist-unknown', SUPPORTED: 'sachmei-hist-true',
      CONTRADICTED: 'sachmei-hist-false', INSUFFICIENT_EVIDENCE: 'sachmei-hist-unknown',
    };

    return `
      <div class="sachmei-history-list">
        ${this._history.map((item, i) => `
          <div class="sachmei-history-item" data-index="${i}" tabindex="0" role="button"
               aria-label="Claim at ${formatTimestamp(item.timestamp)}: ${item.result.verdict}">
            <div class="sachmei-hist-left">
              <span class="sachmei-hist-badge ${verdictClass[item.result.verdict] || 'sachmei-hist-unknown'}">
                ${verdictEmoji[item.result.verdict] || '?'}
              </span>
              <div class="sachmei-hist-content">
                <p class="sachmei-hist-claim">${this._esc(truncate(item.claim, 80))}</p>
                <span class="sachmei-hist-verdict">${item.result.verdict?.replace('_', ' ')}</span>
              </div>
            </div>
            <button class="sachmei-timestamp-btn sachmei-hist-time" data-seek="${item.timestamp}">
              ${formatTimestamp(item.timestamp)}
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  _attachHistoryListeners(container) {
    container.querySelectorAll('.sachmei-history-item').forEach((item, i) => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-seek]')) return; // handled separately
        const entry = this._history[i];
        if (entry) {
          this._currentResult = entry;
          this._activeTab = 'current';
          this._panel.querySelectorAll('.sachmei-tab').forEach(t => {
            t.classList.toggle('sachmei-tab-active', t.dataset.tab === 'current');
          });
          this._updatePanelContent();
        }
      });
    });
  }

  // ─────────────────────────────────────────────
  // Drag functionality
  // ─────────────────────────────────────────────

  _makeDraggable(panel, handle) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    handle.style.cursor = 'grab';

    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      handle.style.cursor = 'grabbing';

      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const newLeft = Math.max(0, Math.min(window.innerWidth - 380, startLeft + dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - 100, startTop + dy));

      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      handle.style.cursor = 'grab';
    });
  }

  // ─────────────────────────────────────────────
  // Keyboard shortcut
  // ─────────────────────────────────────────────

  _attachKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      // Alt+S to toggle SachMei panel
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  // ─────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────

  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// Singleton
const uiOverlay = new UIOverlay({
  onSeekTo: (time) => {
    const video =
      (window._sachMeiGetVideo && window._sachMeiGetVideo()) ||
      document.querySelector('video.html5-main-video') ||
      document.querySelector('video.video-stream') ||
      document.querySelector('ytd-shorts video') ||
      document.querySelector('video');
    if (video) {
      video.currentTime = time;
      console.log(`[SachMei UI] Seeked to ${formatTimestamp(time)}`);
    }
  },
  onRetry: () => {
    // Calls the retry hook set by youtube-content.js
    if (window._sachMeiRetry) window._sachMeiRetry();
  }
});
