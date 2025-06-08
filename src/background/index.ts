// src/background/index.ts
import { onMessage, sendMessage } from 'webext-bridge/background';
import { createPinia, Pinia } from 'pinia';
import { toRaw, ref, watch } from 'vue';
import { useMessageStore } from '../stores/messages.store';
import { useSearchStore, type SearchableItem, type DataCategoryCode, type RecentItem } from '../stores/search.store';
import type { BackgroundState, LastYearData } from '../types/bridge';
import browser, { type Storage } from 'webextension-polyfill';
import { info } from 'console';
import { useStorageLocal } from '../composables/useBrowserStorage';
import { setupPinia } from '~/stores';

console.info("Extension: Background script loaded.");

const piniaInstance: Pinia = createPinia();

let messageStore: ReturnType<typeof useMessageStore>;
// let searchStore: ReturnType<typeof useSearchStore>;
let pollingIntervalId: number | null = null;
let activeTabIdForApp: number | null = null;
let pollingEnabled = false;
let pollingIntervalMs = 20000;

// --- Settings Management ---
const POLLING_ENABLED_KEY = 'settings_pollingEnabled';
const POLLING_INTERVAL_KEY = 'settings_pollingInterval';

function handleSettingsChanges(changes: { [key: string]: Storage.StorageChange }, area: string) {
  if (area !== 'local') return;

  const newPollingEnabled = changes[POLLING_ENABLED_KEY]?.newValue;
  if (newPollingEnabled !== undefined) {
    pollingEnabled = !!newPollingEnabled;
    console.info(`Extension (BG): Polling enabled setting changed to: ${pollingEnabled}`);
    if (messageStore?.currentApplicationId && activeTabIdForApp) {
      startOrUpdatePollingForStore(messageStore.currentApplicationId, activeTabIdForApp);
    }
  }

  const newInterval = changes[POLLING_INTERVAL_KEY]?.newValue;
  if (newInterval !== undefined) {
    const ms = Number(newInterval);
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

// --- Core Logic ---

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
  if (!messageStore || !messageStore.currentApplicationId) {
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    pollingIntervalId = null;
    if (messageStore) messageStore.isLoading = false;
    return;
  }

  console.info("BG: Starting message poll for app:", messageStore.currentApplicationId);
  messageStore.isLoading = true;
  messageStore.lastError = null;

  try {
    const postBody = { etos: new Date().getFullYear(), edeId: messageStore.currentApplicationId };
    const response = await fetch("https://eae2024.opekepe.gov.gr/eae2024/rest/MainService/checkAee?", {
      method: "POST",
      headers: { "accept": "application/json, text/plain, */*", "content-type": "application/json", "cache-control": "no-cache", "pragma": "no-cache" },
      body: JSON.stringify(postBody),
      credentials: "include",
      mode: "cors"
    });

    if (!response.ok) {
      messageStore.lastError = `Σφάλμα λήψης: ${response.status}`;
      console.error("BG: Poll failed with status:", response.status, await response.text());
      if (response.status === 401 || response.status === 403) {
        if (pollingIntervalId) clearInterval(pollingIntervalId);
        pollingIntervalId = null;
        messageStore.clearApplicationId();
      }
      return;
    }

    const jsonData = await response.json();
    messageStore.updateMessages(Array.isArray(jsonData?.data) ? jsonData.data : [], messageStore.currentApplicationId);
  } catch (error: any) {
    console.error("BG: Error during message polling:", error);
    messageStore.lastError = error.message || "Άγνωστο σφάλμα δικτύου";
  } finally {
    if (messageStore) messageStore.isLoading = false;
  }
}

async function startOrUpdatePollingForStore(appId: string | null, tabId: number) {
  if (!messageStore) return;

  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
  
  messageStore.setApplicationId(appId);
  
  if (appId) {
      activeTabIdForApp = tabId;
      fetchLastYearsData(appId);
      await pollMessagesForStore();
      if (pollingEnabled && typeof pollingIntervalMs === 'number' && !isNaN(pollingIntervalMs)) {
          pollingIntervalId = self.setInterval(pollMessagesForStore, pollingIntervalMs);
      }
  } else {
      console.log("BG: No AppID provided. Polling stopped, but last known ID is kept.");
  }
}

function handleUrlUpdate(url: string | undefined, tabId: number) {
    if (!url || !url.startsWith("https://eae2024.opekepe.gov.gr/eae2024/")) {
        return; // Not on the target site, do nothing to keep the last known ID
    }

    const newAppId = extractApplicationIdFromUrl(url);

    if (newAppId && newAppId !== messageStore.currentApplicationId) {
        console.log(`Extension (BG): Found new application ID '${newAppId}' on tab ${tabId}. Updating store.`);
        startOrUpdatePollingForStore(newAppId, tabId);
    } else if (newAppId) {
        activeTabIdForApp = tabId; // Same ID, but tab might have changed
  }
}

// --- Task 1: Fetch and cache last year's data ---
interface LastYearsData {
  paa: any[];
  eco: any[];
  con: any[];
}
interface LastYearDataCache {
  applicationId: string;
  data: LastYearsData;
}

const applicationId = useStorageLocal<string | null>('application_id', null);

// Initialize Pinia and stores
const pinia = setupPinia();
const searchStore = useSearchStore(pinia);

// Keep a simple in-memory cache for the last fetched data
let lastYearDataCache: LastYearDataCache | null = null;

// Only on dev mode
if (import.meta.hot) {
  // ... existing code ...
}

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  // ... existing code ...
  // ... existing code ...
  watch(applicationId, (newId, oldId) => {
    if (newId && newId !== oldId) {
      console.log('[Background] Application ID has changed to:', newId);
      // Fetch data for the new application ID automatically
      fetchLastYearsData(newId);
      // Let the popup stores know about the change
      sendMessage('application-id-changed', newId, 'popup').catch(e => console.error(e));
    }
  });
});

// Listen for requests from the popup to get last year's data
onMessage('request-last-year-data-fetch', async () => {
  const currentAppId = applicationId.value;

  if (!currentAppId) {
    return sendMessage('last-year-data-updated', { error: 'Δεν έχει επιλεγεί αίτηση.' }, 'popup');
  }

  // If we have valid cached data for the current application, return it immediately
  if (lastYearDataCache && lastYearDataCache.applicationId === currentAppId) {
    console.log('[Background] Serving last year data from cache for app:', currentAppId);
    return sendMessage('last-year-data-updated', { data: toRaw(lastYearDataCache.data) }, 'popup');
  }

  // Otherwise, trigger a new fetch
  await fetchLastYearsData(currentAppId);
});

async function fetchLastYearsData(appId: string) {
  console.log(`[Background] Fetching last year's data for application:`, appId);
  // Send a start message so the UI can show a loading state
  // Although the store sets loading to true, this could be useful for other listeners
  await sendMessage('last-year-data-updated', { data: null, error: null }, 'popup');

  try {
    const lastYear = new Date().getFullYear() - 1;

    const endpoints = {
        paa: 'https://eae2024.opekepe.gov.gr/eae2024/rest/Edetedeaeepaa/findAllByCriteriaRange_EdetedeaeehdGrpEdaa',
        oikologika: 'https://eae2024.opekepe.gov.gr/eae2024/rest/Edetedeaeeeco/findAllByCriteriaRange_EdetedeaeehdGrpEdeg',
        enisxyseis: 'https://eae2024.opekepe.gov.gr/eae2024/rest/Edetedeaeerequest/findAllByCriteriaRange_EdetedeaeehdGrpEdrq'
    };

    const requests = Object.entries(endpoints).map(([key, url]) => 
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "edeId_id": appId,
                "gParams_yearEae": lastYear,
                "fromRowIndex": 0,
                "toRowIndex": 10000
            })
        }).then(res => {
            if (!res.ok) throw new Error(`Request failed for ${key} with status ${res.status}`);
            return res.json();
        })
    );

    const [paaRes, oikologikaRes, enisxyseisRes] = await Promise.all(requests);

    const paaData = await paaRes.json();
    const oikologikaData = await oikologikaRes.json();
    const enisxyseisData = await enisxyseisRes.json();

    const result: LastYearsData = {
      paa: paaData.data.map((item: any) => ({ name: item.eaaId.description, code: item.eaaId.kodikos })),
      eco: oikologikaData.data.map((item: any) => ({ name: item.esgrId.esceId.description, code: item.esgrId.esceId.kodikos })),
      con: enisxyseisData.data.map((item: any) => ({ name: item.eschId.description, code: item.eschId.kodikos })),
    };

    // Cache the successful result
    lastYearDataCache = { applicationId: appId, data: result };

    await sendMessage('last-year-data-updated', { data: toRaw(result) }, 'popup');
    console.log('[Background] Successfully fetched and sent last year\'s data.');
  } catch (error: any) {
    console.error('[Background] Error fetching last year\'s data:', error);
    // Clear cache on error
    lastYearDataCache = null;
    await sendMessage('last-year-data-updated', { error: error.message || 'Άγνωστο σφάλμα' }, 'popup');
  }
}

// --- Initialization and Listeners ---
async function initialize() {
    messageStore = useMessageStore(piniaInstance);
    searchStore = useSearchStore(piniaInstance);

    await searchStore.fetchAllInitialData();

    const settings = await browser.storage.local.get({ [POLLING_ENABLED_KEY]: false, [POLLING_INTERVAL_KEY]: 20000 });
    pollingEnabled = settings[POLLING_ENABLED_KEY] as boolean;
    pollingIntervalMs = settings[POLLING_INTERVAL_KEY] as number;
    console.info(`Extension (BG): Initial settings loaded. Polling enabled: ${pollingEnabled}, Interval: ${pollingIntervalMs}ms`);

    messageStore.$subscribe(async (mutation, state) => {
        if (activeTabIdForApp) {
            try {
                await sendMessage('state-updated', toRaw(state) as any, { context: 'content-script', tabId: activeTabIdForApp });
            } catch (e) {
                console.warn(`Extension (BG): Failed to send state-updated to tab ${activeTabIdForApp}`, e);
                try {
                    if (!(await browser.tabs.get(activeTabIdForApp))) activeTabIdForApp = null;
                } catch { activeTabIdForApp = null; }
            }
        }
    });

    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab?.url) handleUrlUpdate(tab.url, tabId);
    });
    browser.tabs.onActivated.addListener(activeInfo => {
      browser.tabs.get(activeInfo.tabId).then(tab => handleUrlUpdate(tab.url, activeInfo.tabId));
    });
    browser.webNavigation.onHistoryStateUpdated.addListener(details => {
      if (details.url) handleUrlUpdate(details.url, details.tabId);
    });
}

// --- Message Handlers ---

onMessage('get-bg-state', () => {
  return toRaw(messageStore.$state) as BackgroundState;
});

onMessage('get-search-suggestions', ({ data }) => {
    const { searchTerm } = data as { searchTerm: string };
    
    const normalizedTerm = searchTerm.toUpperCase();
    const prefixMatch = normalizedTerm.match(/^([ΚΠΔΜΟΣΤΑΤ])([!/])(.*)$/);

    let results: SearchableItem[] = [];

    if (prefixMatch) {
        const category = prefixMatch[1] as DataCategoryCode;
        const searchType = prefixMatch[2];
        const relevantSearchTerm = prefixMatch[3].toLowerCase();

        if (searchType === '!') { 
            results = (toRaw(searchStore.recentAndPopular.value) || [])
                .filter((item: SearchableItem) => item.category_code === category && item.name.toLowerCase().includes(relevantSearchTerm));
        } else { 
            const searchSpace = toRaw(searchStore.allData.value[category]) || [];
            results = searchSpace.filter((item: SearchableItem) => item.name.toLowerCase().includes(relevantSearchTerm));
        }
    } else {
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        const recentResults = (toRaw(searchStore.recentAndPopular.value) || [])
            .filter((item: SearchableItem) => item.name.toLowerCase().includes(lowerSearchTerm));

        const recentResultCodes = new Set(recentResults.map((r: SearchableItem) => `${r.category_code}-${r.code}`));
        const allDataResults: SearchableItem[] = [];

        for (const categoryKey in searchStore.allData.value) {
            const category = categoryKey as DataCategoryCode;
            const items = toRaw(searchStore.allData.value[category]) || [];

            for(const item of items) {
                const uniqueId = `${item.category_code}-${item.code}`;
                if (!recentResultCodes.has(uniqueId) && item.name.toLowerCase().includes(lowerSearchTerm)) {
                    allDataResults.push(item);
                }
            }
        }
        
        results = [...recentResults, ...allDataResults];
    }
    
    return results.slice(0, 20);
});

onMessage('item-selected', ({ data }) => {
    const selectedItem = data as Omit<SearchableItem, 'selection_count'>;
    if (selectedItem?.code && selectedItem?.category_code) {
        searchStore.handleSelection(selectedItem);
  }
});

// Search Functionality
// =================================================================
onMessage('search:query', async ({ data: queryData }) => {
  const { query, category_code } = queryData;
  console.log(`[Background] Received search query: '${query}' in category: ${category_code}`);

  await searchStore.fetchAllInitialData(); // Ensures data is loaded

  const results: SearchableItem[] = [];
  const lowerCaseQuery = query.toLowerCase();

  const recent = toRaw(searchStore.recentAndPopular);
  const allData = toRaw(searchStore.allData);

  // 1. Search in Recent & Popular if no specific category is given
  if (!category_code) {
    for (const item of recent) {
      if (item.name.toLowerCase().includes(lowerCaseQuery) || item.code.toLowerCase().includes(lowerCaseQuery)) {
        results.push(item);
      }
    }
  }

  // 2. Search in allData (respecting category if provided)
  const categoriesToSearch = category_code ? [category_code] : Object.keys(allData) as DataCategoryCode[];

  for (const cat of categoriesToSearch) {
    const dataList = allData[cat];
    if (dataList) {
      for (const item of dataList) {
        if (item.name.toLowerCase().includes(lowerCaseQuery) || item.code.toLowerCase().includes(lowerCaseQuery)) {
          // Avoid duplicates from recent search
          if (!results.some(r => r.code === item.code && r.category_code === item.category_code)) {
            results.push(item);
          }
        }
      }
    }
  }

  // Sort results: prioritize recent items, then by name
  results.sort((a, b) => {
    const aIsRecent = recent.some(r => r.code === a.code && r.category_code === a.category_code);
    const bIsRecent = recent.some(r => r.code === b.code && r.category_code === b.category_code);
    if (aIsRecent && !bIsRecent) return -1;
    if (!aIsRecent && bIsRecent) return 1;
    return a.name.localeCompare(b.name);
  });
  
  console.log(`[Background] Sending ${results.length} search results.`);
  return results.slice(0, 50); // Limit results
});

onMessage('search:handle-selection', async ({ data: selectedItem }) => {
  await searchStore.handleSelection(selectedItem);
});

initialize();