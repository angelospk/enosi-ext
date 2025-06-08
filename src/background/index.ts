// src/background/index.ts
import browser from 'webextension-polyfill';
import { searchStore } from './state';
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

  // 1. Initialize stores (now happens in state.ts)

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