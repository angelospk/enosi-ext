// src/background/message-polling.ts
import { messageStore, settingsStore } from './state';
import { fetchLastYearsData } from  './last-year-data'

// --- Module State ---
let pollingIntervalId: number | null = null;
let activeTabIdForApp: number | null = null;
let currentAppId: string | null = null;

/**
 * Extracts the application ID from the specific OPEKEPE URL hash.
 */
export function extractApplicationIdFromUrl(url: string): string | null {
  try {
    const urlObject = new URL(url);
    if (urlObject.host === 'eae2024.opekepe.gov.gr' && urlObject.hash.includes("/Edetedeaeehd?id=")) {
      const hashParams = new URLSearchParams(urlObject.hash.substring(urlObject.hash.indexOf('?') + 1));
      const encodedId = hashParams.get('id');
      return encodedId ? decodeURIComponent(encodedId) : null;
    }
  } catch (e) {
    // Not a valid URL, ignore.
  }
  return null;
}

/**
 * Performs a single poll for messages from the OPEKEPE API.
 */
async function pollMessages(): Promise<void> {
  if (!currentAppId) {
    console.warn("BG-Polling: pollMessages called without an application ID. Stopping.");
    stopPolling();
    return;
  }

  console.info("BG-Polling: Starting message poll for app:", currentAppId);
  messageStore.isLoading = true;
  messageStore.lastError = null;

  try {
    const response = await fetch("https://eae2024.opekepe.gov.gr/eae2024/rest/MainService/checkAee?", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      body: JSON.stringify({ etos: new Date().getFullYear(), edeId: currentAppId }),
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      messageStore.lastError = `Σφάλμα λήψης: ${response.status}`;
      console.error("BG-Polling: Poll failed with status:", response.status, errorText);
      if (response.status === 401 || response.status === 403) {
        stopPolling();
        messageStore.clearApplicationId();
      }
      return;
    }

    const jsonData = await response.json();
    messageStore.updateMessages(Array.isArray(jsonData?.data) ? jsonData.data : [], currentAppId);
  } catch (error: any) {
    console.error("BG-Polling: Error during message polling:", error);
    messageStore.lastError = error.message || "Άγνωστο σφάλμα δικτύου";
  } finally {
    messageStore.isLoading = false;
  }
}

function stopPolling(): void {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
    console.info("BG-Polling: Polling stopped.");
  }
}

/**
 * Starts the polling process if conditions are met (appId, polling enabled).
 */
function startPolling(): void {
  stopPolling(); // Ensure no multiple intervals are running
  if (settingsStore.pollingEnabled && currentAppId) {
    pollingIntervalId = self.setInterval(pollMessages, settingsStore.pollingInterval);
    console.info(`BG-Polling: Polling started with interval ${settingsStore.pollingInterval}ms for app: ${currentAppId}`);
  } else {
    console.info("BG-Polling: Conditions not met for starting poll timer (polling disabled or no AppID).");
  }
}

/**
 * Main controller for the polling logic. Called when URL or settings change.
 * @param newAppId The new application ID, or null if none.
 * @param tabId The ID of the tab where the change was detected.
 */
export async function updatePollingState(newAppId: string | null, tabId: number): Promise<void> {
  // If the App ID is new, update everything
  if (newAppId && newAppId !== messageStore.currentApplicationId) {
    console.log(`BG-Polling: New application ID detected: '${newAppId}'. Updating state.`);
    messageStore.clearApplicationId();
    currentAppId = newAppId;
    activeTabIdForApp = tabId;
    messageStore.setApplicationId(newAppId);
    
    // Fetch auxiliary data for the new application
    fetchLastYearsData(newAppId);
    
    // Perform an immediate poll, then start the interval
    await pollMessages();
    startPolling();
  } else if (newAppId) {
    // Same App ID, but could be a different tab or a settings change.
    // Ensure the active tab is updated.
    activeTabIdForApp = tabId;
  } else if (!newAppId && currentAppId) {
    // Navigated away from a page with an App ID
    console.log("BG-Polling: Navigated away from application page.");
    // currentAppId = null;
    // activeTabIdForApp = null;
    // messageStore.clearApplicationId();
    // stopPolling();
  }
}

/**
 * Restarts or stops the polling interval based on current settings.
 * Called when settings are changed by the user.
 */
export function startOrStopPollingBasedOnSettings(): void {
    if (currentAppId) {
        startPolling();
    }
}

/** Getter to allow other modules to know the active tab */
export const getActiveTabId = () => activeTabIdForApp;