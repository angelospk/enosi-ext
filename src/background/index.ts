// src/background/index.ts
import { searchStore, settingsStore } from './state';
import { watch } from 'vue';
import { registerSearchHandlers } from './search';
import { registerLastYearDataHandlers } from './last-year-data';
import {
  registerBrowserEventListeners,
  registerMessageHandlers,
  subscribeToStoreChanges,
} from './listeners';
import { startOrStopPollingBasedOnSettings } from './message-polling';

async function main() {
  console.info("Extension: Background script starting initialization...");

  // 1. Initialize stores (happens in state.ts)
  // Ensure settings are loaded before dependent modules use them.
  await settingsStore.allSettingsLoaded;
  console.info(`BG-Settings: Initial settings loaded. Polling: ${settingsStore.pollingEnabled}, Interval: ${settingsStore.pollingInterval}ms`);

  // 2. Register all event and message listeners
  registerBrowserEventListeners();
  registerMessageHandlers();
  registerSearchHandlers();
  registerLastYearDataHandlers();

  // 3. Subscribe to store changes to push updates to UI
  subscribeToStoreChanges();

  // 4. Watch for settings changes to react accordingly
  watch(
    () => [settingsStore.pollingEnabled, settingsStore.pollingInterval],
    ([newPollingEnabled, newInterval], [oldPollingEnabled, oldInterval]) => {
      console.info(`BG-Settings: Polling settings changed. Enabled: ${newPollingEnabled}, Interval: ${newInterval}ms`);
      // This function will handle the logic of stopping or starting the polling.
      startOrStopPollingBasedOnSettings();
    },
    { deep: true } // Use deep watch if settings were a nested object
  );

  // 5. Pre-fetch search data
  await searchStore.fetchAllInitialData();

  console.info("Extension: Background script initialization complete.");
}

main().catch(console.error);