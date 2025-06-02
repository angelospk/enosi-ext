// src/background/index.ts
import { onMessage, sendMessage } from 'webext-bridge/background';
import { createPinia, Pinia } from 'pinia';
import { useMessageStore } from '../stores/messages.store';
import type { BackgroundState, MessagePayloads, BackgroundResponsePayloads, BackgroundEvents } from '../types/bridge';
import browser from 'webextension-polyfill';

console.info("Extension: Background script loaded.");

const piniaInstance: Pinia = createPinia(); // Δημιουργία Pinia instance
// Δεν χρειάζεται να κάνουμε app.use(piniaInstance) εδώ, καθώς το defineStore το χειρίζεται.

let messageStore: ReturnType<typeof useMessageStore>;
let pollingIntervalId: number | null = null;
const POLLING_INTERVAL = 20000; // 20 δευτερόλεπτα
let activeTabIdForApp: number | null = null; // Για να ξέρουμε σε ποιο tab να στείλουμε updates

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

  messageStore.isLoading = true;
  messageStore.lastError = null;

  try {
    const postBody = {
      etos: new Date().getFullYear(), // Το έτος μπορεί να χρειαστεί να είναι πιο δυναμικό ή παραμετροποιήσιμο
      edeId: messageStore.currentApplicationId
    };
    const response = await fetch("https://eae2024.opekepe.gov.gr/eae2024/rest/MainService/checkAee?", {
      method: "POST",
      headers: { /* ... τα headers σας ... */
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
      if (response.status === 401 || response.status === 403) {
        if (pollingIntervalId) clearInterval(pollingIntervalId);
        pollingIntervalId = null;
        messageStore.setApplicationId(null);
      }
      console.error(`Extension (BG): Error fetching messages - Status: ${response.status}`, errorText);
      return; // Έξοδος αν υπάρχει σφάλμα για να μην γίνει updateMessages με παλιά δεδομένα
    }

    const jsonData = await response.json();
    if (jsonData && Array.isArray(jsonData.data)) {
      messageStore.updateMessages(jsonData.data, messageStore.currentApplicationId); // Περνάμε και το ID για επιβεβαίωση
    } else {
      messageStore.updateMessages([], messageStore.currentApplicationId);
    }
  } catch (error: any) {
    console.error("Extension (BG): Error during message polling fetch:", error);
    messageStore.lastError = error.message || "Άγνωστο σφάλμα δικτύου";
  } finally {
    messageStore.isLoading = false;
  }
}

function startOrUpdatePollingForStore(newAppId: string | null, tabId: number) {
  if (!messageStore) return;
  const oldAppId = messageStore.currentApplicationId;

  if (oldAppId === newAppId && activeTabIdForApp === tabId) {
    // Αν το ID είναι το ίδιο και το polling τρέχει για αυτό το tab, δεν κάνουμε κάτι
    // εκτός αν το polling έχει σταματήσει για κάποιο λόγο
    if (!pollingIntervalId && newAppId) {
        // console.log(`Extension (BG): Polling was stopped, restarting for AppID: ${newAppId} on tab ${tabId}`);
    } else if (!newAppId) {
        // console.log(`Extension (BG): AppID is null, ensuring polling is stopped.`);
    } else {
        return;
    }
  }


  activeTabIdForApp = newAppId ? tabId : null;
  messageStore.setApplicationId(newAppId);

  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }

  if (newAppId) {
    // console.log(`Extension (BG): Starting polling for AppID: ${newAppId} on tab ${tabId}`);
    pollMessagesForStore();
    pollingIntervalId = window.setInterval(pollMessagesForStore, POLLING_INTERVAL);
  } else {
    // console.log("Extension (BG): No AppID, polling stopped. Store cleared.");
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

    // Παρακολούθηση αλλαγών στο store για αποστολή στο content script
    messageStore.$subscribe(async (mutation, state) => {
        // console.log("Extension (BG): Store changed, attempting to send update to tab:", activeTabIdForApp, mutation.events);
        if (activeTabIdForApp) {
            const currentBgState: BackgroundState = {
                currentApplicationId: state.currentApplicationId,
                messages: state.messages,
                isLoading: state.isLoading,
                lastError: state.lastError,
                changeCounters: state.changeCounters,
            };
            try {
                await sendMessage('state-updated', currentBgState, { context: 'content-script', tabId: activeTabIdForApp });
            } catch (e) {
                // console.warn(`Extension (BG): Failed to send state-updated to tab ${activeTabIdForApp}`, e);
                // Αν το tab δεν υπάρχει πια, ίσως πρέπει να καθαρίσουμε το activeTabIdForApp
                try {
                    const tabInfo = await browser.tabs.get(activeTabIdForApp);
                    if (!tabInfo) activeTabIdForApp = null;
                } catch {
                    activeTabIdForApp = null; // Το tab δεν υπάρχει
                }
            }

            // Ειδικός χειρισμός για νέες ειδοποιήσεις σφαλμάτων
            if (mutation.events && mutation.events.key === 'changeCounters') {
                 const counters = mutation.events.newValue as BackgroundState['changeCounters'];
                 if (counters && counters.newErrors > 0) {
                    const newErrorMessages = state.messages.filter(m => m.type === 'Error' && m.firstSeen === m.lastSeen); // Απλή προσέγγιση για "νέα"
                    if (newErrorMessages.length > 0) {
                         try {
                            await sendMessage(
                                'show-error-notifications',
                                newErrorMessages.slice(0, 3).map(e => ({id: e.id, text: e.cleanedText})),
                                { context: 'content-script', tabId: activeTabIdForApp }
                            );
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

onMessage('dismiss-message-once', ({ data }) => {
  if (messageStore) messageStore.dismissMessageOnce(data.messageId);
});

onMessage('dismiss-message-permanently', ({ data }) => {
  if (messageStore) messageStore.dismissMessagePermanently(data.messageId);
});

onMessage('clear-change-counters', () => {
  if (messageStore) messageStore.clearChangeCounters();
});

onMessage('popup-visibility-changed', ({ data, sender }) => {
    if(data.visible && messageStore && sender.tabId === activeTabIdForApp) {
        messageStore.clearChangeCounters();
    }
});

// Νέο handler για να παίρνει το URL από το content script σε περίπτωση που οι listeners του background δεν πιάνουν όλες τις αλλαγές
onMessage('url-changed-for-id-check', ({data, sender}) => {
    if (data.url && sender.tabId) {
        const appId = extractApplicationIdFromUrl(data.url);
        startOrUpdatePollingForStore(appId, sender.tabId);
    }
});

// Για να καθαρίσει το state αν κλείσει το σχετικό tab
browser.tabs.onRemoved.addListener((tabId) => {
    if (tabId === activeTabIdForApp) {
        console.log(`Extension (BG): Active tab ${tabId} was removed. Clearing application ID and stopping poll.`);
        startOrUpdatePollingForStore(null, tabId);
        activeTabIdForApp = null;
    }
});