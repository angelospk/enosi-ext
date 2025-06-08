// src/background/index.ts
import { onMessage, sendMessage } from 'webext-bridge/background';
import { createPinia, Pinia } from 'pinia';
import { useMessageStore } from '../stores/messages.store';
import type { BackgroundState, MessagePayloads, BackgroundResponsePayloads, BackgroundEvents } from '../types/bridge';
import browser, { type Storage } from 'webextension-polyfill';
import { info } from 'console';
import { watch } from 'vue';

console.info("Extension: Background script loaded.");

const piniaInstance: Pinia = createPinia(); // Δημιουργία Pinia instance
// Δεν χρειάζεται να κάνουμε app.use(piniaInstance) εδώ, καθώς το defineStore το χειρίζεται.

let messageStore: ReturnType<typeof useMessageStore>;
let pollingIntervalId: number | null = null;
const POLLING_INTERVAL = 20000; // 20 δευτερόλεπτα
let activeTabIdForApp: number | null = null; // Για να ξέρουμε σε ποιο tab να στείλουμε updates
let pollingEnabled = false;
let pollingIntervalMs = POLLING_INTERVAL;

// --- Settings Management ---
const POLLING_ENABLED_KEY = 'settings_pollingEnabled';
const POLLING_INTERVAL_KEY = 'settings_pollingInterval';

async function initializeSettings() {
  const defaults = {
    [POLLING_ENABLED_KEY]: false,
    [POLLING_INTERVAL_KEY]: 20000,
  };
  const settings = await browser.storage.local.get(defaults);

  pollingEnabled = settings[POLLING_ENABLED_KEY] as boolean;
  pollingIntervalMs = settings[POLLING_INTERVAL_KEY] as number;

  console.info(`Extension (BG): Initial settings loaded. Polling enabled: ${pollingEnabled}, Interval: ${pollingIntervalMs}ms`);
}

function handleSettingsChanges(changes: { [key: string]: Storage.StorageChange }, area: string) {
  if (area !== 'local') return;

  if (changes[POLLING_ENABLED_KEY]) {
    pollingEnabled = !!changes[POLLING_ENABLED_KEY].newValue;
    console.info(`Extension (BG): Polling enabled setting changed to: ${pollingEnabled}`);
    if (messageStore?.currentApplicationId && activeTabIdForApp) {
      startOrUpdatePollingForStore(messageStore.currentApplicationId, activeTabIdForApp);
    }
  }

  if (changes[POLLING_INTERVAL_KEY]) {
    const ms = Number(changes[POLLING_INTERVAL_KEY].newValue);
    if (!isNaN(ms) && ms >= 2000) {
      pollingIntervalMs = ms;
      console.info(`Extension (BG): Polling interval setting changed to: ${pollingIntervalMs}ms`);
      if (pollingEnabled && messageStore?.currentApplicationId && activeTabIdForApp) {
        startOrUpdatePollingForStore(messageStore.currentApplicationId, activeTabIdForApp);
      }
    }
  }
}

browser.storage.onChanged.addListener(handleSettingsChanges);
initializeSettings();

// --- Λειτουργίες πυρήνα (παρόμοιες με πριν, αλλά στο background) ---

function extractApplicationIdFromUrl(url: string): string | null {
  try {
    const urlObject = new URL(url);
    if (urlObject.host === 'eae2024.opekepe.gov.gr' && urlObject.hash.includes("/Edetedeaeehd?id=")) {
      const hashParams = new URLSearchParams(urlObject.hash.substring(urlObject.hash.indexOf('?') + 1));
      const encodedId = hashParams.get('id');
      if (encodedId) {
        return decodeURIComponent(encodedId);
      }
    }
  } catch (e) {
    // console.warn("Extension (BG): Error parsing URL for application ID", e);
  }
  return null;
}

async function pollMessagesForStore() {
  if (!messageStore) {
    console.error("Extension (BG): Message store not initialized for polling.");
    return;
  }
  if (!messageStore.currentApplicationId) {
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    pollingIntervalId = null;
    messageStore.isLoading = false;
    return;
  }

  console.info("BG: Starting message poll for app:", messageStore.currentApplicationId);
  messageStore.isLoading = true;
  messageStore.lastError = null;

  try {
    const postBody = {
      etos: new Date().getFullYear(),
      edeId: messageStore.currentApplicationId
    };
    const response = await fetch("https://eae2024.opekepe.gov.gr/eae2024/rest/MainService/checkAee?", {
      method: "POST",
      headers: {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json",
        "cache-control": "no-cache",
        "pragma": "no-cache",
      },
      body: JSON.stringify(postBody),
      credentials: "include",
      mode: "cors"
    });

    if (!response.ok) {
      const errorText = await response.text();
      messageStore.lastError = `Σφάλμα λήψης: ${response.status}`;
      console.error("BG: Poll failed with status:", response.status, errorText);
      if (response.status === 401 || response.status === 403) {
        if (pollingIntervalId) clearInterval(pollingIntervalId);
        pollingIntervalId = null;
        messageStore.clearApplicationId();
      }
      return;
    }

    const jsonData = await response.json();
    console.info("BG: Poll response:", {
      hasData: !!jsonData,
      isArray: Array.isArray(jsonData.data),
      messageCount: Array.isArray(jsonData.data) ? jsonData.data.length : 0
    });
    if (jsonData && Array.isArray(jsonData.data)) {
      messageStore.updateMessages(jsonData.data, messageStore.currentApplicationId);
    } else {
      messageStore.updateMessages([], messageStore.currentApplicationId);
    }
  } catch (error: any) {
    console.error("BG: Error during message polling:", error);
    messageStore.lastError = error.message || "Άγνωστο σφάλμα δικτύου";
  } finally {
    messageStore.isLoading = false;
  }
}

async function startOrUpdatePollingForStore(appId: string | null, tabId: number) {
  if (!messageStore) {
    console.error("Extension (BG): Message store not initialized for polling.");
    return;
  }
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
  if (appId) {
    messageStore.setApplicationId(appId);
  } else {
    messageStore.clearApplicationId();
  }
  activeTabIdForApp = tabId;
  await pollMessagesForStore();
  if (pollingEnabled && appId && typeof pollingIntervalMs === 'number' && !isNaN(pollingIntervalMs)) {
    pollingIntervalId = self.setInterval(pollMessagesForStore, pollingIntervalMs);
  }
}

// --- Listeners για Αλλαγές URL ---
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url && tab.url.startsWith("https://eae2024.opekepe.gov.gr/eae2024/")) {
    // console.log(`Extension (BG): Tab ${tabId} updated to ${tab.url}`);
    const appId = extractApplicationIdFromUrl(tab.url);
    startOrUpdatePollingForStore(appId, tabId);
  }
});

browser.tabs.onActivated.addListener(activeInfo => {
  browser.tabs.get(activeInfo.tabId).then(tab => {
    if (tab?.url && tab.url.startsWith("https://eae2024.opekepe.gov.gr/eae2024/")) {
      // console.log(`Extension (BG): Tab ${activeInfo.tabId} activated: ${tab.url}`);
      const appId = extractApplicationIdFromUrl(tab.url);
      startOrUpdatePollingForStore(appId, activeInfo.tabId);
    } else {
      // Το ενεργό tab δεν είναι η σελίδα μας, σταματάμε το polling ή το αφήνουμε αν είναι συνδεδεμένο με άλλο tab
      // Αυτή η λογική μπορεί να γίνει πιο περίπλοκη αν θέλουμε polling μόνο για το ενεργό tab
      // Προς το παρόν, αν αλλάξει σε tab που δεν είναι η σελίδα μας, και το appId ήταν από αυτό το tab, το μηδενίζει.
       if (activeTabIdForApp === activeInfo.tabId) { // Αν το polling ήταν για το tab που απενεργοποιήθηκε
           // startOrUpdatePollingForStore(null, activeInfo.tabId); // Αμφιλεγόμενο αν πρέπει να το κάνει εδώ
       }
    }
  });
});

// Για SPA πλοήγηση εντός του hash
browser.webNavigation.onHistoryStateUpdated.addListener(details => {
  if (details.url && details.url.startsWith("https://eae2024.opekepe.gov.gr/eae2024/")) {
    // console.log(`Extension (BG): History state updated for tab ${details.tabId} to ${details.url}`);
    const appId = extractApplicationIdFromUrl(details.url);
    startOrUpdatePollingForStore(appId, details.tabId);
  }
});


// --- Αρχικοποίηση του store και Παρακολούθηση Αλλαγών του ---
function initializeStoreAndWatch() {
    messageStore = useMessageStore(piniaInstance);
    messageStore.clearApplicationId(); // Clean the id store at startup

    // Παρακολούθηση αλλαγών στο store για αποστολή στο content script
    messageStore.$subscribe(async (mutation, state) => {
        // console.log("Extension (BG): Store changed, attempting to send update to tab:", activeTabIdForApp, mutation.events);
        if (activeTabIdForApp) {
            const currentBgState = {
                currentApplicationId: state.currentApplicationId,
                messages: state.messages,
                isLoading: state.isLoading,
                lastError: state.lastError,
                changeCounters: state.changeCounters,
            } as const;
            try {
                console.info("BG: Sending state update to tab:", {
                    tabId: activeTabIdForApp,
                    appId: state.currentApplicationId,
                    messageCount: state.messages.length,
                    isLoading: state.isLoading,
                    hasError: !!state.lastError
                });
                await sendMessage('state-updated', currentBgState, { context: 'content-script', tabId: activeTabIdForApp });
            } catch (e) {
                console.warn(`Extension (BG): Failed to send state-updated to tab ${activeTabIdForApp}`, e);
                // Αν το tab δεν υπάρχει πια, ίσως πρέπει να καθαρίσουμε το activeTabIdForApp
                try {
                    const tabInfo = await browser.tabs.get(activeTabIdForApp);
                    if (!tabInfo) activeTabIdForApp = null;
                } catch {
                    activeTabIdForApp = null; // Το tab δεν υπάρχει
                }
            }

            // Ειδικός χειρισμός για νέες ειδοποιήσεις σφαλμάτων
            if (mutation.events && 'key' in mutation.events && 'newValue' in mutation.events) {
                 const counters = mutation.events.newValue as BackgroundState['changeCounters'];
                 if (counters && counters.newErrors > 0) {
                    const newErrorMessages = state.messages.filter(m => m.type === 'Error' && m.firstSeen === m.lastSeen); // Απλή προσέγγιση για "νέα"
                    if (newErrorMessages.length > 0) {
                         try {
                            if (activeTabIdForApp !== null) {
                                await sendMessage(
                                    'show-error-notifications',
                                    newErrorMessages.slice(0, 3).map(e => ({id: e.id, text: e.cleanedText})),
                                    { context: 'content-script', tabId: activeTabIdForApp }
                                );
                            }
                         } catch (e) {
                            // console.warn(`Extension (BG): Failed to send show-error-notifications to tab ${activeTabIdForApp}`, e);
                         }
                    }
                 }
            }
        }
    });
}
initializeStoreAndWatch();


// --- Handlers για Μηνύματα από το Content Script ---
onMessage('get-initial-state', async ({ data, sender }) => {
  const tabId = sender.tabId;
  if (!tabId) return null;

  // Ελέγχουμε αν το τρέχον URL του tab έχει ID
  const tab = await browser.tabs.get(tabId);
  if (tab?.url) {
      const appIdFromUrl = extractApplicationIdFromUrl(tab.url);
      // Αν το ID του tab είναι διαφορετικό από το τρέχον ID του store ή αν δεν υπάρχει τρέχον ID στο store,
      // κάνουμε "επανεκκίνηση" του polling για αυτό το tab.
      if (appIdFromUrl !== messageStore.currentApplicationId || (appIdFromUrl && !messageStore.currentApplicationId)) {
          startOrUpdatePollingForStore(appIdFromUrl, tabId);
      } else if (!appIdFromUrl && messageStore.currentApplicationId && activeTabIdForApp === tabId) {
          // Αν το URL του tab δεν έχει ID πια, αλλά το store έχει ID από αυτό το tab
          startOrUpdatePollingForStore(null, tabId);
      }
  }


  if (activeTabIdForApp !== tabId && messageStore.currentApplicationId) {
      // Αν το αίτημα έρχεται από tab που δεν είναι το "ενεργό" για το store,
      // αλλά το store έχει δεδομένα, ίσως να μην θέλουμε να τα δώσουμε ή να ξεκινήσουμε νέο polling.
      // Προς το παρόν, επιστρέφουμε την τρέχουσα κατάσταση του store,
      // αλλά η λογική του activeTabIdForApp θα πρέπει να είναι πιο αυστηρή.
      // console.warn(`Extension (BG): get-initial-state from non-active tab ${tabId}, current active for store is ${activeTabIdForApp}`);
  }

  return {
    currentApplicationId: messageStore.currentApplicationId,
    messages: messageStore.messages,
    isLoading: messageStore.isLoading,
    lastError: messageStore.lastError,
    changeCounters: messageStore.changeCounters,
  };
});

onMessage('dismiss-message', async (message) => {
  const data = message.data as { messageId: string; permanent: boolean };
  if (!data || !data.messageId) {
    console.error("BG: Received invalid dismiss message data:", data);
    return;
  }
  if (messageStore) {
    if (data.permanent) {
      await messageStore.dismissMessagePermanently(data.messageId);
    } else {
      messageStore.dismissMessageOnce(data.messageId);
    }
  }
});

onMessage('clear-change-counters', () => {
  if (messageStore) {
    messageStore.clearChangeCounters();
  }
});

onMessage('popup-visibility-changed', async (message) => {
  const data = message.data as unknown as { visible: boolean };
  if (data?.visible && messageStore) {
    messageStore.clearChangeCounters();
  }
});

onMessage('url-changed', ({ data }) => {
  if (data && typeof data === 'object' && 'url' in data) {
    const appId = extractApplicationIdFromUrl(data.url as string);
    if (appId && activeTabIdForApp !== null) {
      startOrUpdatePollingForStore(appId, activeTabIdForApp);
    }
  }
});

// Για να καθαρίσει το state αν κλείσει το σχετικό tab
browser.tabs.onRemoved.addListener((tabId) => {
    if (tabId === activeTabIdForApp) {
        console.info(`Extension (BG): Active tab ${tabId} was removed. Clearing application ID and stopping poll.`);
        startOrUpdatePollingForStore(null, tabId);
        activeTabIdForApp = null;
    }
});

// Listen for messages from content script
onMessage('url-changed-for-id-check', async (message) => {
  const data = message.data as { url: string; tabId: number };
  if (!data || !data.url) {
    console.error("BG: Received invalid URL change data:", data);
    return;
  }
  console.info("BG: Received URL change:", data.url);
  const appId = extractApplicationIdFromUrl(data.url);
  if (appId) {
    console.info("BG: Extracted app ID:", appId);
    if (data.tabId) {
      startOrUpdatePollingForStore(appId, data.tabId);
    }
  } else {
    console.info("BG: No app ID found in URL");
    if (messageStore) {
      messageStore.clearApplicationId();
    }
  }
});

// Subscribe to store changes
watch(() => messageStore?.currentApplicationId, (newAppId) => {
  if (newAppId && activeTabIdForApp) {
    const currentBgState = {
      currentApplicationId: newAppId,
      messages: messageStore?.messages || [],
      isLoading: messageStore?.isLoading || false,
      lastError: messageStore?.lastError,
      changeCounters: messageStore?.changeCounters || {
        newErrors: 0,
        newWarnings: 0,
        newInfos: 0,
        removedMessages: 0
      }
    };

    // Send state update to content script
    sendMessage('state-updated', currentBgState, { context: 'content-script', tabId: activeTabIdForApp }).catch((error) => {
      console.warn("BG: Failed to send state update:", error);
    });
  }
});