// content-scripts/state.ts

import { createPinia, Pinia } from 'pinia';
import { sendMessage, onMessage } from 'webext-bridge/content-script';
import { useMessageStore, type ProcessedMessage } from '../stores/messages.store';
import { useLastYearDataStore } from '../stores/lastYearData.store';
import { useOptionsStore } from '../stores/options.store';
import type { BackgroundState } from '../types/bridge';
import { updateIconBadge, showErrorNotifications } from 'src/content-script/ui';

// --- Create a single, shared Pinia instance for the content script ---
export const pinia: Pinia = createPinia();

// --- Initialize and export stores for use in other modules ---
export const messageStore = useMessageStore(pinia);
export const lastYearDataStore = useLastYearDataStore(pinia);
export const optionsStore = useOptionsStore(pinia);

/**
 * Requests the initial state from the background script and updates the local store.
 */
async function requestInitialState() {
  try {
    const state = await sendMessage('get-bg-state', null) as unknown as BackgroundState;
    if (state) {
      messageStore.$patch(state);
      updateIconBadge(state.changeCounters);
      // Load the application ID needed for shortcuts
      // await optionsStore.applicationIdPromise;
      console.info("CS: Initial state loaded.");
    }
  } catch (e) {
    console.warn("CS: Failed to get initial state from background.", e);
  }
}

/**
 * Sets up listeners for messages from the background script.
 */
function setupMessageListeners() {
  onMessage('state-updated', (message) => {
    const data = message.data as unknown as BackgroundState;
    if (!data || typeof data !== 'object') {
      console.error("CS: Received invalid state update:", data);
      return;
    }
    console.info("CS: Received state update from background.", data);
    messageStore.$patch(data);
    updateIconBadge(data.changeCounters);
  });

  onMessage('show-error-notifications', ({ data }) => {
    if (data && Array.isArray(data)) {
      showErrorNotifications(data as unknown as ProcessedMessage[]);
    }
  });
}

/**
 * Monitors URL changes and notifies the background script.
 * Important for Single Page Applications (SPAs).
 */
function startUrlChangeObserver() {
  let lastCheckedUrl = "";
  const checkUrlAndNotify = () => {
    const currentHref = window.location.href;
    if (currentHref !== lastCheckedUrl) {
      lastCheckedUrl = currentHref;
      if (currentHref.startsWith("https://eae2024.opekepe.gov.gr/eae2024/")) {
        sendMessage('url-changed-for-id-check', { url: currentHref })
          .catch(e => console.warn("CS: Failed to send URL change to background", e));
      }
    }
  };

  // Initial check
  checkUrlAndNotify();

  // Observe for SPA navigations
  const navigationObserver = new MutationObserver(checkUrlAndNotify);
  navigationObserver.observe(document.documentElement, { childList: true, subtree: true });

  // Observe for hash changes
  window.addEventListener('hashchange', checkUrlAndNotify);
  console.info("CS: URL change observer started.");
}

/**
 * Initializes all state and communication aspects of the content script.
 */
export function initializeStateAndCommunication() {
  setupMessageListeners();
  requestInitialState();
  startUrlChangeObserver();
}