// src/background/listeners.ts
import browser from 'webextension-polyfill';
import { onMessage, sendMessage } from 'webext-bridge/background';
import { toRaw } from 'vue';
import { messageStore } from './state';
import { extractApplicationIdFromUrl, updatePollingState, getActiveTabId } from './message-polling';
import type { BackgroundState } from '../types/bridge';

/**
 * Central handler for URL updates from any source (tab updates, activation, history changes).
 * @param url The URL that changed.
 * @param tabId The ID of the tab where the change occurred.
 */
function handleUrlUpdate(url: string | undefined, tabId: number): void {
  if (!url || !url.startsWith("https://eae2024.opekepe.gov.gr/eae2024/")) {
    // If the user navigates to a non-OPEKEPE page in the active tab, we might want to clear the state.
    if (tabId === getActiveTabId()) {
        updatePollingState(null, tabId);
    }
    return;
  }
  const newAppId = extractApplicationIdFromUrl(url);
  updatePollingState(newAppId, tabId);
}

/**
 * Registers listeners for browser events like tab changes.
 */
export function registerBrowserEventListeners(): void {
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab?.url) {
      handleUrlUpdate(tab.url, tabId);
    }
  });

  browser.tabs.onActivated.addListener(activeInfo => {
    browser.tabs.get(activeInfo.tabId).then(tab => handleUrlUpdate(tab.url, activeInfo.tabId));
  });

  browser.webNavigation.onHistoryStateUpdated.addListener(details => {
    if (details.url) {
      handleUrlUpdate(details.url, details.tabId);
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    if (tabId === getActiveTabId()) {
      console.info(`BG-Listeners: Active tab ${tabId} was removed. Clearing state.`);
      updatePollingState(null, tabId);
    }
  });
}

/**
 * Subscribes to changes in the Pinia message store to push updates to the content script.
 */
export function subscribeToStoreChanges(): void {
  messageStore.$subscribe(async (mutation, state) => {
    const activeTabId = getActiveTabId();
    if (!activeTabId) return;

    const bgState = toRaw(state) as BackgroundState;

    try {
      // Send the full state update to the content script
      await sendMessage('state-updated', JSON.parse(JSON.stringify(bgState)), { context: 'content-script', tabId: activeTabId });
    } catch (e) {
      console.warn(`BG-Listeners: Failed to send state-updated to tab ${activeTabId}. It may have been closed.`, e);
      // The onRemoved listener will handle cleanup.
    }
  });
}

/**
 * Registers generic message handlers that don't fit in other modules.
 */
export function registerMessageHandlers(): void {
  onMessage('get-bg-state', () => {
    return toRaw(messageStore.$state) as BackgroundState;
  });

  onMessage('url-changed-for-id-check', ({ data, sender }) => {
    const url = (data as { url?: string })?.url;
    const tabId = sender.tabId;
    if (url && tabId) {
      handleUrlUpdate(url, tabId);
    }
  });

  onMessage('dismiss-message', async ({ data }) => {
    const { messageId, permanent } = data as { messageId: string; permanent: boolean };
    if (messageId) {
      if (permanent) {
        await messageStore.dismissMessagePermanently(messageId);
      } else {
        messageStore.dismissMessageOnce(messageId);
      }
    }
  });

  onMessage('clear-change-counters', () => {
    messageStore.clearChangeCounters();
  });

  onMessage('popup-visibility-changed', ({ data }) => {
    if ((data as { visible: boolean })?.visible) {
      messageStore.clearChangeCounters();
    }
  });
}