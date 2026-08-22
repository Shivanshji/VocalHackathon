/**
 * youtube-content.js — Main content script entry point.
 *
 * Orchestrates:
 *   1. YouTube SPA navigation detection (video changes)
 *   2. Extension enable/disable state management
 *   3. TranscriptManager initialization per video
 *   4. Fact-check pipeline trigger
 *   5. UI state updates
 *   6. Service worker message bridging
 *
 * This is the "glue" module that connects all other modules.
 * It loads LAST in the content_scripts array so all dependencies
 * (utils, services, content modules) are already defined.
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────

  let currentVideoId = null;
  let isEnabled = true;
  let isInitialized = false;

  // ─────────────────────────────────────────────
  // Core orchestrator
  // ─────────────────────────────────────────────

  const transcriptManager = new TranscriptManager({
    onClaimDetected: handleClaimDetected,
    onStatusChange: handleStatusChange,
    onTranscriptLoaded: handleTranscriptLoaded,
  });

  // ─────────────────────────────────────────────
  // Claim handling
  // ─────────────────────────────────────────────

  async function handleClaimDetected(claimData) {
    if (!isEnabled) return;

    console.log(`[SachMei] Claim detected: "${truncate(claimData.claim, 80)}"`);

    // Show "checking" state in UI
    uiOverlay.showChecking(claimData.claim);

    // Update fact-check service with current video
    factCheckService.setCurrentVideo(claimData.videoId);

    try {
      const result = await factCheckService.checkClaim(claimData);

      // Verify result is still relevant (video hasn't changed)
      if (claimData.videoId !== currentVideoId) {
        console.log('[SachMei] Result discarded — video changed during check.');
        return;
      }

      console.log(`[SachMei] Result: ${result.verdict} (${Math.round(result.confidence * 100)}%)`);

      uiOverlay.showResult(
        claimData.claim,
        result,
        claimData.timestamp
      );
    } catch (error) {
      if (error.message.includes('Video changed')) {
        console.log('[SachMei] Request aborted — video changed.');
        return;
      }
      console.error('[SachMei] Fact-check error:', error.message);
      uiOverlay.showError(error.message);
    }
  }

  function handleStatusChange(status) {
    console.log(`[SachMei] Status: ${status.type}`, status);

    switch (status.type) {
      case 'LOADING_TRANSCRIPT':
        uiOverlay.setState('loading');
        break;
      case 'TRANSCRIPT_LOADED':
        uiOverlay.setState('idle');
        console.log(`[SachMei] Transcript loaded: ${status.count} segments via ${status.strategy}`);
        break;
      case 'NO_TRANSCRIPT':
        uiOverlay.showNoTranscript();
        break;
      default:
        break;
    }
  }

  function handleTranscriptLoaded({ segments, videoId }) {
    // Nothing additional needed here for now
    // Could be used to pre-process all segments for analysis
  }

  // ─────────────────────────────────────────────
  // Video ID extraction — handles ALL YouTube URL formats
  // ─────────────────────────────────────────────

  function getVideoIdFromUrl() {
    const href = location.href;

    // Standard watch page: youtube.com/watch?v=VIDEO_ID
    const watchMatch = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];

    // YouTube Shorts: youtube.com/shorts/VIDEO_ID
    const shortsMatch = href.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    // Embedded: youtube.com/embed/VIDEO_ID
    const embedMatch = href.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];

    return null;
  }

  // ─────────────────────────────────────────────
  // Video element finder — works for all YouTube layouts
  // ─────────────────────────────────────────────

  function getVideoElement() {
    // Try all known YouTube video element selectors
    return (
      document.querySelector('video.html5-main-video') ||
      document.querySelector('video.video-stream') ||
      document.querySelector('#movie_player video') ||
      document.querySelector('ytd-player video') ||
      document.querySelector('ytd-shorts video') ||
      document.querySelector('video[src]') ||
      document.querySelector('video')
    );
  }

  // Expose globally so TranscriptManager can use it
  window._sachMeiGetVideo = getVideoElement;

  function handleVideoChange(newVideoId) {
    if (newVideoId === currentVideoId) return;

    console.log(`[SachMei] Video changed: ${currentVideoId} → ${newVideoId}`);
    currentVideoId = newVideoId;

    // Notify service worker to abort old requests
    chrome.runtime.sendMessage({
      type: 'ABORT_VIDEO_REQUESTS',
      payload: { videoId: currentVideoId }
    }).catch(() => {});

    // Reset all state
    factCheckService.reset();
    uiOverlay.reset();

    if (!newVideoId) {
      // Not on a video page
      uiOverlay.setState('idle');
      return;
    }

    // Initialize for new video
    if (isEnabled) {
      uiOverlay.setState('loading');
      transcriptManager.init(newVideoId).then(() => {
        if (isEnabled) {
          transcriptManager.enable();
        }
      }).catch(err => {
        console.error('[SachMei] TranscriptManager init error:', err);
        uiOverlay.showNoTranscript();
      });
    }
  }

  // ─────────────────────────────────────────────
  // YouTube SPA navigation listener
  // ─────────────────────────────────────────────

  function setupNavigationDetection() {
    // YouTube uses pushState for navigation — intercept it
    const originalPushState = history.pushState.bind(history);
    history.pushState = function (...args) {
      originalPushState(...args);
      onUrlChange();
    };

    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = function (...args) {
      originalReplaceState(...args);
      onUrlChange();
    };

    window.addEventListener('popstate', onUrlChange);

    // YouTube-specific: ytd-app fires "yt-navigate-finish" events
    document.addEventListener('yt-navigate-finish', onUrlChange);
    document.addEventListener('yt-page-data-updated', onUrlChange);

    // Shorts SPA navigation: observe URL via MutationObserver on <title>
    const titleEl = document.querySelector('title');
    if (titleEl) {
      new MutationObserver(() => onUrlChange()).observe(
        titleEl, { childList: true, subtree: true, characterData: true }
      );
    }

    // Also watch for DOM changes on the ytd-app element (catches Shorts navigation)
    const appEl = document.querySelector('ytd-app, yt-app, #app');
    if (appEl) {
      let _lastHref = location.href;
      new MutationObserver(() => {
        if (location.href !== _lastHref) {
          _lastHref = location.href;
          onUrlChange();
        }
      }).observe(appEl, { childList: true, subtree: false });
    }
  }

  let _urlChangeTimeout = null;
  function onUrlChange() {
    // Debounce — multiple events often fire together
    clearTimeout(_urlChangeTimeout);
    _urlChangeTimeout = setTimeout(() => {
      const newVideoId = getVideoIdFromUrl();
      handleVideoChange(newVideoId);
    }, 300);
  }

  // ─────────────────────────────────────────────
  // Extension toggle handling
  // ─────────────────────────────────────────────

  function setEnabled(enabled) {
    isEnabled = enabled;
    console.log(`[SachMei] ${enabled ? 'Enabled' : 'Disabled'}`);

    if (enabled) {
      uiOverlay.showEnabled();
      transcriptManager.enable();

      // If no transcript loaded yet (was disabled at start), load now
      if (!transcriptManager.isLoaded && currentVideoId) {
        transcriptManager.init(currentVideoId).then(() => {
          transcriptManager.enable();
        });
      }
    } else {
      transcriptManager.disable();
      uiOverlay.showDisabled();
    }
  }

  // ─────────────────────────────────────────────
  // Service worker messages
  // ─────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'EXTENSION_TOGGLE':
        setEnabled(message.enabled);
        sendResponse({ success: true });
        break;

      case 'GET_STATUS':
        sendResponse({
          success: true,
          status: {
            enabled: isEnabled,
            videoId: currentVideoId,
            hasTranscript: transcriptManager.isLoaded,
            segmentCount: transcriptManager.segmentCount,
            cacheStats: sachMeiCache.getStats(),
            fcStats: factCheckService.getStats(),
          }
        });
        break;

      default:
        break;
    }
  });

  // ─────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────

  async function init() {
    if (isInitialized) return;
    isInitialized = true;

    console.log('[SachMei] Content script initializing...');

    // Load settings from storage
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, response => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(response);
        });
      });

      if (response?.settings) {
        isEnabled = response.settings.enabled !== false; // default true
      }
    } catch (e) {
      console.warn('[SachMei] Could not load settings:', e.message);
    }

    // Initialize UI overlay
    uiOverlay.init();

    if (!isEnabled) {
      uiOverlay.showDisabled();
    }

    // Setup navigation detection
    setupNavigationDetection();

    // Expose retry hook for the UI's "Retry" button
    window._sachMeiRetry = () => {
      console.log('[SachMei] Manual retry triggered.');
      if (currentVideoId) {
        transcriptManager.init(currentVideoId).then(() => {
          if (isEnabled) transcriptManager.enable();
        }).catch(() => uiOverlay.showNoTranscript());
      }
    };

    // Initialize for the current page
    // Use a small delay to ensure YouTube has injected ytInitialPlayerResponse
    const videoId = getVideoIdFromUrl();
    if (videoId) {
      // For Shorts, YouTube may take longer to inject data — wait a bit more
      const isShorts = location.href.includes('/shorts/');
      const delay = isShorts ? 1500 : 800;
      setTimeout(() => handleVideoChange(videoId), delay);
    } else {
      console.log('[SachMei] Not on a video page — waiting for navigation.');
    }

    console.log('[SachMei] Initialized. Enabled:', isEnabled);
  }

  // ─────────────────────────────────────────────
  // Entry point
  // ─────────────────────────────────────────────

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already ready
    setTimeout(init, 100); // small delay for YouTube to inject its globals
  }

})();
