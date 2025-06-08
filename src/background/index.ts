// src/background/index.ts
import browser from 'webextension-polyfill';
import { useMessageStore } from '../stores/messages.store';
import { useSearchStore } from '../stores/search.store';
import { pinia } from '../utils/pinia';
import { initializeSettings, handleSettingsChanges } from './settings';
import { registerSearchHandlers } from './search';
import { registerLastYearDataHandlers } from './last-year-data';
import {
  registerBrowserEventListeners,
  registerMessageHandlers,
  subscribeToStoreChanges,
} from './listeners';

async function main() {
  console.info("Extension: Background script starting initialization...");

  // 1. Initialize stores
  useMessageStore(pinia);
  const searchStore = useSearchStore(pinia);

  // 2. Load settings from storage
  await initializeSettings();

  // 3. Register all event and message listeners
  registerBrowserEventListeners();
  registerMessageHandlers();
  registerSearchHandlers();
  registerLastYearDataHandlers();

  // 4. Subscribe to store changes to push updates to UI
  subscribeToStoreChanges();

  // 5. Listen for any future changes to settings
  browser.storage.onChanged.addListener(handleSettingsChanges);

  // 6. Pre-fetch search data
  await searchStore.fetchAllInitialData();

  console.info("Extension: Background script initialization complete.");
}

main().catch(console.error);

async function fetchLastYearsData(appId: string) {
  console.info(`[Background] Fetching last year's data for application:`, appId);
  // Send a start message so the UI can show a loading state
  await sendMessage('last-year-data-updated', { data: null, error: null, applicationId: appId }, 'content-script');

  try {
    const lastYear = new Date().getFullYear() - 1;
    // ... existing code ...
    // Cache the successful result
    lastYearDataCache = { applicationId: appId, data: result };

    await sendMessage('last-year-data-updated', { data: toRaw(result), applicationId: appId }, 'content-script');
    console.info('[Background] Successfully fetched and sent last year\'s data.');
  } catch (error: any) {
    console.error('[Background] Error fetching last year\'s data:', error);
    // Clear cache on error
    lastYearDataCache = null;
    await sendMessage('last-year-data-updated', { error: error.message || 'Άγνωστο σφάλμα', applicationId: appId }, 'content-script');
  }
}